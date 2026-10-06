import { supabaseAdmin } from "@/lib/supabase/server";

export const DEFAULT_AVATAR_NAME = "Nasha";

export const DEFAULT_AVATAR_PROMPT =
  "Authentic candid photograph of a 21-year-old Brazilian woman named Nasha. She is around 1.62m (5'4\") tall with an athletic, naturally toned fit physique. She has natural light brown skin (morena clara), natural curly light-brown hair, subtle freckles on cheeks, and a tiny discreet stud piercing in her left nostril. Wearing casual earthy olive green organic clothing. Shot on Canon EOS R5 with 85mm portrait lens, f/1.8, natural soft daylight, sharp focus on eyes, authentic detailed real human skin texture with pores and natural imperfections. Raw photographic style, real person. No cartoon, no anime, no illustration, no drawing, no 3D render, no CGI, no smooth plastic skin, no blur, no watermark.";

/**
 * Retrieves the avatar configuration from app_settings with defaults.
 */
export async function getEffectiveAvatarConfig(): Promise<{
  enabled: boolean;
  name: string;
  prompt: string;
}> {
  try {
    const db = supabaseAdmin();
    const { data } = await db
      .from("app_settings")
      .select("avatar_enabled, avatar_name, avatar_prompt")
      .eq("id", 1)
      .maybeSingle();

    if (data) {
      return {
        enabled: data.avatar_enabled !== false,
        name: data.avatar_name || DEFAULT_AVATAR_NAME,
        prompt: data.avatar_prompt || DEFAULT_AVATAR_PROMPT,
      };
    }
  } catch {
    // If database column doesn't exist yet, default to active with Nasha's prompt
  }

  return {
    enabled: true,
    name: DEFAULT_AVATAR_NAME,
    prompt: DEFAULT_AVATAR_PROMPT,
  };
}

/**
 * Combines the avatar's visual DNA with the specific topic of the post.
 */
export function formatAvatarPrompt(topicPrompt: string, avatarPrompt: string): string {
  const cleaned = avatarPrompt
    .replace(/\bfull-body video\b/gi, "photograph")
    .replace(/\bvideo\b/gi, "photograph")
    .trim()
    .replace(/[.,\s]+$/, "");

  return `${cleaned}, in a scene representing: ${topicPrompt}. Authentic color photograph, realistic natural daylight, sharp focus, real human skin pores, candid shot, no drawing, no cartoon, no anime, no illustration, no 3d render, no blur, no watermark`;
}
