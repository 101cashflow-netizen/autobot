import { env } from "@/lib/env";
import { getEffectiveGeminiApiKey } from "@/lib/ai/gemini-key";
import { getEffectiveAvatarConfig, formatAvatarPrompt } from "@/lib/ai/avatar";
import { fetchStockPhoto } from "@/lib/stock/media";
import { getSettings } from "@/lib/db/settings";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { ImageSource, ImageSourcePref } from "@/lib/types";

const STORAGE_BUCKET = "post-images";

// Square reads well in the Facebook feed on both mobile and desktop, and
// avoids the centre-crop that wide images get in the timeline.
const WIDTH = 1024;
const HEIGHT = 1024;

export function resolveImageSource(pref: ImageSourcePref): ImageSource {
  if (pref === "mixed") return Math.random() < 0.5 ? "ai" : "stock";
  return pref;
}

/**
 * Strict photographic style and negative prompts to strongly enforce
 * real human DSLR photography and prevent cartoon/drawing/blur/3D render looks.
 */
const PHOTO_STYLE =
  "candid photograph, authentic portrait of real person, 85mm lens, natural daylight, sharp focus on eyes, realistic human skin texture, natural pores, authentic lighting, no blur, no drawing, no cartoon, no anime, no painting, no illustration, no 3D render, no CGI, no smooth plastic skin, no watermark, no text";

function b64ToBlob(b64Data: string, contentType = "image/jpeg"): Blob {
  const cleanB64 = b64Data.replace(/^data:[^;]+;base64,/, "").trim();
  if (typeof Buffer !== "undefined") {
    const buffer = Buffer.from(cleanB64, "base64");
    return new Blob([buffer], { type: contentType });
  }
  const binaryString = atob(cleanB64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Blob([bytes], { type: contentType });
}

function getUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "img-" + Math.random().toString(36).substring(2, 15) + "-" + Date.now().toString(36);
}

/**
 * Cloudflare Workers AI: FLUX.1 Schnell.
 * Free tier gives 10,000 neurons daily to every Cloudflare account.
 * Produces ultra-photorealistic human portraits without cartoon effects.
 */
async function fetchCloudflareFluxImage(prompt: string, accountId: string, apiToken: string): Promise<Blob> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/black-forest-labs/flux-1-schnell`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt: `${prompt}, ${PHOTO_STYLE}` }),
      signal: AbortSignal.timeout(45_000),
    }
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Cloudflare Workers AI FLUX erro (${res.status}): ${errText}`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const data = await res.json();
    const b64 = data?.result?.image;
    if (!b64 || typeof b64 !== "string") {
      throw new Error("Cloudflare Workers AI FLUX não retornou a imagem em result.image");
    }
    return b64ToBlob(b64, "image/jpeg");
  }

  return res.blob();
}

/**
 * Pollinations AI with user API key (enter.pollinations.ai).
 * Unlocks real FLUX.1 model with high resolution and no watermark.
 */
async function fetchPollinationsAuthImage(prompt: string, apiKey: string): Promise<Blob> {
  const res = await fetch("https://gen.pollinations.ai/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "flux",
      prompt: `${prompt}, ${PHOTO_STYLE}`,
      response_format: "b64_json",
      n: 1,
    }),
    signal: AbortSignal.timeout(45_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Pollinations Auth erro (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error("Sem imagem retornada pela API autenticada do Pollinations");
  return b64ToBlob(b64, "image/jpeg");
}

/**
 * Generate image using Gemini generateContent with image modality.
 */
async function fetchGeminiGenerateContentImage(prompt: string, apiKey: string): Promise<Blob> {
  const models = ["gemini-2.5-flash-image", "gemini-3.1-flash-image"];
  let lastErr: Error | null = null;

  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${prompt}, ${PHOTO_STYLE}` }] }],
            generationConfig: {
              responseModalities: ["TEXT", "IMAGE"],
            },
          }),
          signal: AbortSignal.timeout(35_000),
        }
      );

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        let cleanErr = errText;
        try {
          const parsed = JSON.parse(errText);
          cleanErr = parsed?.error?.message || errText;
        } catch {}
        throw new Error(`${model} (${res.status}): ${cleanErr}`);
      }

      const data = await res.json();
      const parts = data?.candidates?.[0]?.content?.parts || [];
      const imagePart = parts.find((p: any) => p.inlineData || p.inline_data);
      const b64 = imagePart?.inlineData?.data || imagePart?.inline_data?.data;
      const mime = imagePart?.inlineData?.mimeType || imagePart?.inline_data?.mime_type || "image/jpeg";

      if (!b64) throw new Error(`Nenhum dado de imagem retornado por ${model}`);
      return b64ToBlob(b64, mime);
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastErr ?? new Error("Gemini generateContent image falhou");
}

/**
 * Generate image using Gemini's OpenAI-compatible images endpoint.
 */
async function fetchGeminiOpenAiImage(prompt: string, apiKey: string): Promise<Blob> {
  const models = ["gemini-2.5-flash-image", "gemini-3-pro-image-preview"];
  let lastErr: Error | null = null;

  for (const model of models) {
    try {
      const res = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/openai/images/generations",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            prompt: `${prompt}, ${PHOTO_STYLE}`,
            response_format: "b64_json",
            n: 1,
          }),
          signal: AbortSignal.timeout(35_000),
        }
      );

      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        let cleanErr = errBody;
        try {
          const parsed = JSON.parse(errBody);
          cleanErr = parsed?.error?.message || errBody;
        } catch {}
        throw new Error(`${model} (${res.status}): ${cleanErr}`);
      }

      const data = await res.json();
      const b64 = data?.data?.[0]?.b64_json;
      if (!b64 || typeof b64 !== "string") {
        throw new Error(`Sem b64_json na resposta de ${model}`);
      }

      return b64ToBlob(b64, "image/jpeg");
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastErr ?? new Error("Gemini OpenAI endpoint falhou");
}

/**
 * Keyless free fallback via Pollinations AI.
 * Explicitly sets enhance=false to avoid the AI prompt rewriter turning realistic
 * photo descriptions into fantasy/anime drawings.
 */
async function fetchPollinationsImageBytes(prompt: string): Promise<Blob> {
  const seed = Math.floor(Math.random() * 1_000_000);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(
    `${prompt}, ${PHOTO_STYLE}`
  )}?width=${WIDTH}&height=${HEIGHT}&nologo=true&enhance=false&seed=${seed}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(40_000) });
  if (!res.ok) throw new Error(`Pollinations API retornou status ${res.status}`);
  return res.blob();
}

/**
 * Primary AI image generator:
 * 1. Checks Cloudflare Workers AI FLUX (if configured in Settings/env)
 * 2. Checks Pollinations with API Key (if configured)
 * 3. Checks Google Gemini (if key has image quota enabled)
 * 4. Falls back to Pollinations Keyless with anti-cartoon photo prompt
 */
async function fetchAiImageBytes(prompt: string): Promise<{ blob: Blob; provider: string; errorHint?: string }> {
  const settings = await getSettings().catch(() => null);

  // 1. Cloudflare Workers AI (FLUX.1 Schnell)
  const cfAccountId = settings?.cloudflare_account_id?.trim() || env.cloudflareAccountId;
  const cfApiToken = settings?.cloudflare_api_token?.trim() || env.cloudflareAiToken;
  if (cfAccountId && cfApiToken) {
    try {
      const blob = await fetchCloudflareFluxImage(prompt, cfAccountId, cfApiToken);
      return { blob, provider: "cloudflare-flux" };
    } catch (cfErr) {
      console.warn("[Cloudflare Workers AI FLUX falhou, tentando próximo provedor]:", cfErr);
    }
  }

  // 2. Pollinations Authenticated with Key (FLUX / Seedream)
  const polliKey = settings?.pollinations_api_key?.trim() || env.pollinationsApiKey;
  if (polliKey) {
    try {
      const blob = await fetchPollinationsAuthImage(prompt, polliKey);
      return { blob, provider: "pollinations-auth" };
    } catch (polliErr) {
      console.warn("[Pollinations Authenticated falhou, tentando próximo provedor]:", polliErr);
    }
  }

  // 3. Google Gemini Image
  let geminiError: string | null = null;
  const geminiKey = await getEffectiveGeminiApiKey();
  if (geminiKey) {
    try {
      const blob = await fetchGeminiGenerateContentImage(prompt, geminiKey);
      return { blob, provider: "gemini" };
    } catch (gcErr) {
      geminiError = gcErr instanceof Error ? gcErr.message : String(gcErr);
      try {
        const blob = await fetchGeminiOpenAiImage(prompt, geminiKey);
        return { blob, provider: "gemini" };
      } catch (openAiErr) {
        geminiError = openAiErr instanceof Error ? openAiErr.message : String(openAiErr);
      }
    }
  }

  // 4. Pollinations Keyless Fallback
  let errorHint: string | undefined;
  if (geminiError && geminiError.includes("429")) {
    errorHint =
      "Google Gemini: cota de imagem da chave gratuita excedida (limite de 0 RPM para imagens no Google AI Studio). Gerado via Pollinations. Configure Cloudflare Workers AI (FLUX) nas Configurações para fotos realistas gratuitas!";
  } else if (geminiError) {
    errorHint = `Google Gemini: ${geminiError}`;
  }

  const blob = await fetchPollinationsImageBytes(prompt);
  return { blob, provider: "pollinations-fallback", errorHint };
}

async function fetchStockImageBytes(query: string): Promise<Blob> {
  const { blob } = await fetchStockPhoto(query);
  return blob;
}

export interface GeneratedImageResult {
  url: string;
  source: ImageSource;
  provider?: string;
  errorHint?: string;
}

/**
 * Generates or sources a post image, then re-hosts it in our own Supabase
 * Storage bucket rather than linking the provider's URL directly.
 */
export async function generateImage(
  prompt: string,
  pref: ImageSourcePref
): Promise<GeneratedImageResult> {
  const source = resolveImageSource(pref);
  const avatarConfig = await getEffectiveAvatarConfig();

  // If source is AI and avatar consistency is enabled, enrich the prompt with Nasha's traits
  const effectiveAiPrompt = avatarConfig.enabled
    ? formatAvatarPrompt(prompt, avatarConfig.prompt)
    : prompt;

  let blob: Blob;
  let detectedProvider = source === "stock" ? "stock" : "ai";
  let detectedHint: string | undefined;

  try {
    if (source === "ai") {
      const res = await fetchAiImageBytes(effectiveAiPrompt);
      blob = res.blob;
      detectedProvider = res.provider;
      detectedHint = res.errorHint;
    } else {
      blob = await fetchStockImageBytes(prompt);
    }
  } catch (err) {
    // Fall back to the other source rather than failing the whole generation.
    const fallbackSource: ImageSource = source === "ai" ? "stock" : "ai";
    try {
      if (fallbackSource === "ai") {
        const res = await fetchAiImageBytes(effectiveAiPrompt);
        blob = res.blob;
        detectedProvider = res.provider;
        detectedHint = res.errorHint;
      } else {
        blob = await fetchStockImageBytes(prompt);
      }
      return await upload(blob, fallbackSource, detectedProvider, detectedHint);
    } catch {
      throw err instanceof Error ? err : new Error("Image generation failed");
    }
  }

  return upload(blob, source, detectedProvider, detectedHint);
}

async function upload(
  blob: Blob,
  source: ImageSource,
  provider?: string,
  errorHint?: string
): Promise<GeneratedImageResult> {
  const db = supabaseAdmin();
  const path = `${new Date().toISOString().slice(0, 10)}/${getUuid()}.jpg`;
  const bytes = new Uint8Array(await blob.arrayBuffer());

  const { error } = await db.storage.from(STORAGE_BUCKET).upload(path, bytes, {
    contentType: blob.type || "image/jpeg",
    upsert: false,
  });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data } = db.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, source, provider, errorHint };
}
