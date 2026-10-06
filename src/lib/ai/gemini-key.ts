import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Returns the Gemini API key to use.
 * Checks the database (app_settings.gemini_api_key) first,
 * then falls back to the environment variable (GEMINI_API_KEY).
 */
export async function getEffectiveGeminiApiKey(): Promise<string> {
  try {
    const db = supabaseAdmin();
    const { data } = await db
      .from("app_settings")
      .select("gemini_api_key")
      .eq("id", 1)
      .maybeSingle();

    if (
      data &&
      "gemini_api_key" in data &&
      typeof data.gemini_api_key === "string" &&
      data.gemini_api_key.trim()
    ) {
      return data.gemini_api_key.trim();
    }
  } catch {
    // If the table or column is missing or unreachable, fall back to environment variable
  }

  return env.geminiApiKey || "";
}
