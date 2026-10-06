import { env } from "@/lib/env";
import { getEffectiveGeminiApiKey } from "@/lib/ai/gemini-key";
import { getSettings } from "@/lib/db/settings";
import type {
  ContentProvider,
  CopyGuidelines,
  CopyLanguage,
  CopyLength,
  CopyTone,
  GeneratedContent,
  TextAiProviderPref,
} from "@/lib/types";

/**
 * Facebook copy generation across LLM providers.
 * Gemini is prioritized whenever a key is configured (via database or env var).
 * Groq and Pollinations are used as fallbacks if Gemini is not configured or fails.
 * If all providers fail, a template copy is returned.
 */

export function buildSystemPrompt(guidelines: CopyGuidelines): string {
  const lang = guidelines.language || "auto";

  const length =
    guidelines.length === "random"
      ? (["short", "medium", "long"] as const)[Math.floor(Math.random() * 3)]
      : guidelines.length || "medium";

  const tone =
    guidelines.tone === "random"
      ? ([
          "conversational",
          "persuasive",
          "informative",
          "inspirational",
          "humorous",
          "professional",
        ] as const)[Math.floor(Math.random() * 6)]
      : guidelines.tone || "conversational";

  const langRule = (() => {
    switch (lang) {
      case "en":
        return "- language: STRICT RULE — The entire output (title, description, and hashtags) MUST be written in ENGLISH, regardless of the language of the topic.";
      case "pt":
        return "- language: REGRA ESTRITA — Todo o conteúdo (título, descrição e hashtags) DEVE ser escrito obrigatoriamente em PORTUGUÊS (Brasil), mesmo se o tema estiver em outro idioma.";
      case "es":
        return "- language: REGLA ESTRICTA — Todo el contenido (título, descripción y hashtags) DEBE escribirse obligatoriamente en ESPAÑOL.";
      case "auto":
      default:
        return "- language: Write the entire post (title, description, and hashtags) in the exact same language as the provided topic (e.g., Portuguese if the topic is in Portuguese, English if in English).";
    }
  })();

  const lengthRule = (() => {
    switch (length) {
      case "short":
        return "- description length: Short and punchy. Exactly 1-2 impactful sentences, <= 180 characters total. Designed for rapid mobile consumption.";
      case "long":
        return "- description length: Long-form storytelling, STRICT MAXIMUM OF 500 CHARACTERS TOTAL. Exactly 3 to 5 rich sentences, narrative, value, and insights. Under NO circumstance should the description exceed 500 characters.";
      case "medium":
      default:
        return "- description length: Medium format. 2-3 short sentences, <= 350 characters, written to be read on a mobile phone.";
    }
  })();

  const toneRule = (() => {
    switch (tone) {
      case "persuasive":
        return "- tone & style: Persuasive, high-converting, benefit-driven copy. Focus on value, problem-solving, and a clear call-to-action.";
      case "informative":
        return "- tone & style: Educational and informative. Practical tips, structured actionable insights, and authority without technical jargon.";
      case "inspirational":
        return "- tone & style: Inspiring and motivational. Emotionally resonant, thoughtful, uplifting, and encouraging personal growth.";
      case "humorous":
        return "- tone & style: Witty, lighthearted, humorous, and entertaining. Playful and engaging while remaining brand-safe.";
      case "professional":
        return "- tone & style: Professional, executive, authoritative, and corporate. Credible, formal, and polished.";
      case "conversational":
      default:
        return "- tone & style: Conversational, friendly, approachable, relatable, and authentic. Speak as a trusted friend to the community.";
    }
  })();

  const customRule = guidelines.customRules?.trim()
    ? `\n- Additional user instructions (strictly follow these): ${guidelines.customRules.trim()}`
    : "";

  return `You are an expert Facebook Page copywriter. Given a topic, write a single high-performing Facebook post in strict JSON with this exact shape and nothing else:
{"title": string, "description": string, "hashtags": string[]}

The three parts are joined into one caption, in that order, so they must read as one cohesive post.

Rules:
${langRule}
- title: the opening hook, <= 80 characters. Conversational, scroll-stopping, specific. At most one emoji. No hashtags.
${lengthRule}
${toneRule}
- engagement: End the description with a question or a soft call to action that invites comments, since engagement drives Facebook reach.
- hashtags: 3 to 5 short, highly relevant hashtags, lowercase, no "#" symbol, no spaces. Facebook rewards a few precise tags, not a wall of them.
- character limit: The description field MUST NEVER exceed 500 characters.${customRule}
- Output ONLY the JSON object. No markdown fences, no commentary.`;
}

const TIMEOUT_MS = 20_000;

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("No JSON object in response");
  return JSON.parse(text.slice(start, end + 1));
}

function parseContent(raw: string): GeneratedContent {
  const parsed = extractJson(raw);
  if (!parsed || typeof parsed !== "object") throw new Error("Malformed generation payload");
  const o = parsed as Record<string, unknown>;
  if (
    typeof o.title !== "string" ||
    typeof o.description !== "string" ||
    !Array.isArray(o.hashtags) ||
    !o.hashtags.every((h) => typeof h === "string")
  ) {
    throw new Error("Malformed generation payload");
  }

  let desc = o.description.trim();
  if (desc.length > 500) {
    desc = desc.slice(0, 497).trim() + "...";
  }

  return {
    title: o.title.trim().slice(0, 120),
    description: desc,
    hashtags: (o.hashtags as string[]).map((h) => h.replace(/^#/, "").trim()).filter(Boolean),
  };
}

/** Shared call shape for OpenAI-compatible endpoints (Pollinations, Groq). */
async function chatCompletion(
  url: string,
  model: string,
  topic: string,
  systemPrompt: string,
  apiKey?: string
): Promise<string> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model,
      temperature: 0.9,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Topic: ${topic}` },
      ],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  const host = new URL(url).host;
  const body = await res.text();
  if (!res.ok) throw new Error(`${host} responded ${res.status}`);

  const data = JSON.parse(body);
  if (data?.error) {
    const message = typeof data.error === "string" ? data.error : data.error?.message;
    throw new Error(`${host}: ${message ?? "unknown error"}`);
  }

  const content: unknown = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("Empty completion");
  return content;
}

async function geminiCompletion(topic: string, apiKey: string, systemPrompt: string): Promise<string> {
  const preferredModels = [
    "gemini-3.5-flash-lite",
    "gemini-3.8-flash",
    "gemini-3.5-flash",
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
  ];

  let modelsToTry = [...preferredModels];

  // Dynamically query available models from Google AI Studio if accessible
  try {
    const listRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (listRes.ok) {
      const listData = await listRes.json();
      const available: string[] = (listData?.models || [])
        .filter((m: { supportedGenerationMethods?: string[] }) =>
          m.supportedGenerationMethods?.includes("generateContent")
        )
        .map((m: { name: string }) => m.name.replace(/^models\//, ""))
        .filter(
          (name: string) =>
            name.startsWith("gemini-") &&
            !name.includes("image") &&
            !name.includes("tts") &&
            !name.includes("audio") &&
            !name.includes("live") &&
            !name.includes("embedding")
        );

      if (available.length > 0) {
        const matched = preferredModels.filter((m) => available.includes(m));
        const others = available.filter((m) => !matched.includes(m));
        modelsToTry = [...matched, ...others];
      }
    }
  } catch {
    // If listing models fails, use preferredModels
  }

  let lastError: Error | null = null;

  for (const model of modelsToTry) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: "user", parts: [{ text: `Topic: ${topic}` }] }],
            generationConfig: { temperature: 0.9, responseMimeType: "application/json" },
          }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        }
      );

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        let cleanErr = errText;
        try {
          const parsed = JSON.parse(errText);
          cleanErr = parsed?.error?.message || errText;
        } catch {}
        throw new Error(`Google Gemini (${model}) erro ${res.status}: ${cleanErr}`);
      }

      const data = await res.json();
      const content: unknown = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof content !== "string" || !content.trim()) {
        throw new Error(`Resposta vazia do Gemini (${model})`);
      }
      return content;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new Error("Todas as tentativas com Gemini falharam");
}

function template(topic: string, language: CopyLanguage = "auto"): GeneratedContent {
  const clean = topic.trim();
  const words = clean.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6);
  if (language === "en") {
    return {
      title: `${clean} — worth checking out today`,
      description: `Here are a few practical insights and thoughts on ${clean.toLowerCase()}. What is your take on this? Let us know in the comments below!`,
      hashtags: [...new Set(words)].concat(["tips", "insights", "trending"]).slice(0, 5),
    };
  }
  if (language === "es") {
    return {
      title: `${clean} — vale la pena revisar hoy`,
      description: `Compartimos algunas ideas sobre ${clean.toLowerCase()}. Consejos prácticos para aplicar esta semana. ¿Cuál probarías primero?`,
      hashtags: [...new Set(words)].concat(["ideas", "consejos"]).slice(0, 5),
    };
  }
  return {
    title: `${clean} — vale a pena conferir hoje`,
    description: `Reunimos algumas ideias sobre ${clean.toLowerCase()}. Dicas práticas para experimentar esta semana. Por qual delas você começaria?`,
    hashtags: [...new Set(words)].concat(["dicas", "ideias"]).slice(0, 5),
  };
}

type Attempt = { provider: ContentProvider; run: () => Promise<string> };

async function providerChain(
  topic: string,
  preferredProvider: TextAiProviderPref | undefined,
  failures: string[],
  systemPrompt: string
): Promise<Attempt[]> {
  const chain: Attempt[] = [];
  const settings = await getSettings().catch(() => null);
  const providerPref = preferredProvider || settings?.text_provider_pref || "auto";

  const isGeminiAllowed = settings?.gemini_enabled !== false;
  const isGroqAllowed = settings?.groq_enabled !== false;
  const isPollinationsAllowed = settings?.pollinations_enabled !== false;

  const geminiKey = await getEffectiveGeminiApiKey();

  // If user explicitly chose Gemini
  if (providerPref === "gemini") {
    if (geminiKey) {
      chain.push({
        provider: "gemini",
        run: () => geminiCompletion(topic, geminiKey, systemPrompt),
      });
    } else {
      failures.push(
        "Google Gemini: Nenhuma chave API configurada. Salve sua chave no menu Settings > Google Gemini AI ou defina GEMINI_API_KEY."
      );
    }
    return chain;
  }

  const groqKey = settings?.groq_api_key?.trim() || env.groqApiKey;

  // If user explicitly chose Groq
  if (providerPref === "groq") {
    if (groqKey) {
      for (const model of ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "llama3-70b-8192"]) {
        chain.push({
          provider: "groq",
          run: () =>
            chatCompletion("https://api.groq.com/openai/v1/chat/completions", model, topic, systemPrompt, groqKey),
        });
      }
    } else {
      failures.push(
        "Groq: Nenhuma chave API configurada. Salve sua chave no menu Settings > Groq AI ou defina GROQ_API_KEY."
      );
    }
    return chain;
  }

  // If user explicitly chose Pollinations
  if (providerPref === "pollinations") {
    chain.push({
      provider: "pollinations",
      run: () => chatCompletion("https://text.pollinations.ai/openai", "openai-fast", topic, systemPrompt),
    });
    return chain;
  }

  // Automatic chain (auto)
  if (isGeminiAllowed) {
    if (geminiKey) {
      chain.push({
        provider: "gemini",
        run: () => geminiCompletion(topic, geminiKey, systemPrompt),
      });
    } else {
      failures.push("Google Gemini: Chave não informada em Settings.");
    }
  }

  if (isGroqAllowed && groqKey) {
    for (const model of ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "llama3-70b-8192"]) {
      chain.push({
        provider: "groq",
        run: () =>
          chatCompletion("https://api.groq.com/openai/v1/chat/completions", model, topic, systemPrompt, groqKey),
      });
    }
  }

  if (isPollinationsAllowed) {
    chain.push({
      provider: "pollinations",
      run: () => chatCompletion("https://text.pollinations.ai/openai", "openai-fast", topic, systemPrompt),
    });
  }

  return chain;
}

export async function generateContent(
  topic: string,
  preferredProvider?: TextAiProviderPref,
  guidelines?: CopyGuidelines
): Promise<GeneratedContent> {
  const failures: string[] = [];
  const settings = await getSettings().catch(() => null);

  const effectiveGuidelines: CopyGuidelines = {
    language: guidelines?.language || settings?.copy_language || "auto",
    length: guidelines?.length || settings?.copy_length || "medium",
    tone: guidelines?.tone || settings?.copy_tone || "conversational",
    customRules: guidelines?.customRules ?? settings?.copy_custom_rules ?? "",
  };

  const systemPrompt = buildSystemPrompt(effectiveGuidelines);
  const chain = await providerChain(topic, preferredProvider, failures, systemPrompt);

  for (const { provider, run } of chain) {
    try {
      const parsed = parseContent(await run());
      return { ...parsed, provider, providerErrors: failures };
    } catch (err) {
      failures.push(`${provider}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.warn("[generateContent] every provider failed:", failures.join(" | "));
  return {
    ...template(topic, effectiveGuidelines.language),
    provider: "template",
    providerError: failures[0],
    providerErrors: failures,
  };
}
