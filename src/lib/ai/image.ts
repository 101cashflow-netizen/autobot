import { env } from "@/lib/env";
import { getEffectiveGeminiApiKey } from "@/lib/ai/gemini-key";
import { getEffectiveAvatarConfig, formatAvatarPrompt } from "@/lib/ai/avatar";
import { fetchStockPhoto } from "@/lib/stock/media";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { ImageSource, ImageSourcePref } from "@/lib/types";

const STORAGE_BUCKET = "post-images";

// Square reads well in the Facebook feed on both mobile and desktop, and
// avoids the centre-crop that wide images get in the timeline.
const WIDTH = 1200;
const HEIGHT = 1200;

export function resolveImageSource(pref: ImageSourcePref): ImageSource {
  if (pref === "mixed") return Math.random() < 0.5 ? "ai" : "stock";
  return pref;
}

/**
 * Topics phrased as listicles ("easy weeknight dinner ideas") make the model
 * return a grid of thumbnails, which reads as a stock collage in the feed.
 * Steering it toward one photographed subject fixes that.
 */
const PHOTO_STYLE =
  "single subject, professional photograph, natural light, shallow depth of field, high detail, no text, no watermark, no collage, no grid";

function b64ToBlob(b64Data: string, contentType = "image/jpeg"): Blob {
  if (typeof Buffer !== "undefined") {
    const buffer = Buffer.from(b64Data, "base64");
    return new Blob([buffer], { type: contentType });
  }
  const binaryString = atob(b64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
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
 * Generate image using Google Gemini (Imagen 3 / 4) predict endpoint.
 */
async function fetchGeminiImagenPredict(prompt: string, apiKey: string): Promise<Blob> {
  const models = ["imagen-3.0-generate-002", "imagen-4.0-generate-001"];
  let lastErr: Error | null = null;

  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instances: [{ prompt: `${prompt}, ${PHOTO_STYLE}` }],
            parameters: {
              sampleCount: 1,
              aspectRatio: "1:1",
            },
          }),
          signal: AbortSignal.timeout(35_000),
        }
      );

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`${model} predict failed (${res.status}): ${errText}`);
      }

      const data = await res.json();
      const b64 =
        data?.predictions?.[0]?.bytesBase64Encoded ??
        data?.predictions?.[0]?.image?.imageBytes;

      if (!b64 || typeof b64 !== "string") {
        throw new Error(`No image bytes returned by ${model}`);
      }

      return b64ToBlob(b64, "image/jpeg");
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastErr ?? new Error("Gemini Imagen predict failed");
}

/**
 * Generate image using Gemini's OpenAI-compatible images endpoint.
 */
async function fetchGeminiOpenAiImage(prompt: string, apiKey: string): Promise<Blob> {
  const models = ["imagen-3.0-generate-002", "gemini-2.5-flash-image"];
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
        throw new Error(`${model} openai endpoint failed (${res.status}): ${errBody}`);
      }

      const data = await res.json();
      const b64 = data?.data?.[0]?.b64_json;
      if (!b64 || typeof b64 !== "string") {
        throw new Error(`No b64_json in ${model} response`);
      }

      return b64ToBlob(b64, "image/jpeg");
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastErr ?? new Error("Gemini OpenAI image generation failed");
}

/**
 * Keyless free fallback via Pollinations AI.
 */
async function fetchPollinationsImageBytes(prompt: string): Promise<Blob> {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(
    `${prompt}, ${PHOTO_STYLE}`
  )}?width=${WIDTH}&height=${HEIGHT}&nologo=true&seed=${Math.floor(Math.random() * 1_000_000)}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Pollinations image API ${res.status}`);
  return res.blob();
}

/**
 * Primary AI image generator: uses Gemini (Imagen) when key is available,
 * and falls back to Pollinations AI if needed.
 */
async function fetchAiImageBytes(prompt: string): Promise<Blob> {
  const geminiKey = await getEffectiveGeminiApiKey();
  if (geminiKey) {
    try {
      return await fetchGeminiImagenPredict(prompt, geminiKey);
    } catch (predictErr) {
      console.warn("[Gemini Imagen Predict failed, trying OpenAI compatibility endpoint]:", predictErr);
      try {
        return await fetchGeminiOpenAiImage(prompt, geminiKey);
      } catch (openAiErr) {
        console.warn("[Gemini OpenAI image endpoint failed, falling back to Pollinations]:", openAiErr);
      }
    }
  }

  return await fetchPollinationsImageBytes(prompt);
}

async function fetchStockImageBytes(query: string): Promise<Blob> {
  const { blob } = await fetchStockPhoto(query);
  return blob;
}

/**
 * Generates or sources a post image, then re-hosts it in our own Supabase
 * Storage bucket rather than linking the provider's URL directly.
 */
export async function generateImage(
  prompt: string,
  pref: ImageSourcePref
): Promise<{ url: string; source: ImageSource }> {
  const source = resolveImageSource(pref);
  const avatarConfig = await getEffectiveAvatarConfig();

  // If source is AI and avatar consistency is enabled, enrich the prompt with Nasha's traits
  const effectiveAiPrompt = avatarConfig.enabled
    ? formatAvatarPrompt(prompt, avatarConfig.prompt)
    : prompt;

  let blob: Blob;
  try {
    blob = source === "ai" ? await fetchAiImageBytes(effectiveAiPrompt) : await fetchStockImageBytes(prompt);
  } catch (err) {
    // Fall back to the other source rather than failing the whole generation.
    const fallbackSource: ImageSource = source === "ai" ? "stock" : "ai";
    try {
      blob =
        fallbackSource === "ai"
          ? await fetchAiImageBytes(effectiveAiPrompt)
          : await fetchStockImageBytes(prompt);
      return await upload(blob, fallbackSource);
    } catch {
      throw err instanceof Error ? err : new Error("Image generation failed");
    }
  }

  return upload(blob, source);
}

async function upload(blob: Blob, source: ImageSource): Promise<{ url: string; source: ImageSource }> {
  const db = supabaseAdmin();
  const path = `${new Date().toISOString().slice(0, 10)}/${getUuid()}.jpg`;
  const bytes = new Uint8Array(await blob.arrayBuffer());

  const { error } = await db.storage.from(STORAGE_BUCKET).upload(path, bytes, {
    contentType: blob.type || "image/jpeg",
    upsert: false,
  });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data } = db.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, source };
}
