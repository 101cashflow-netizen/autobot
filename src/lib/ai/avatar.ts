import { supabaseAdmin } from "@/lib/supabase/server";

export const DEFAULT_AVATAR_NAME = "Nasha";

export const DEFAULT_AVATAR_PROMPT =
  "A high-quality, photorealistic cinematic photograph of a 21-year-old girl named Nasha. She is around 1.62m (5'4\") tall with an athletic, well-toned hourglass figure (classic American fit physique), showing a healthy and natural good shape. She has light brown skin (morena clara), a natural-flowing hairstyle with light-brown slightly curly hair, and subtle freckles across her cheeks. She features a discreet, tiny stud piercing in her left nostril. She is wearing light, breezy new-hippie clothing made of natural organic cotton fibers in an earthy olive green color. Photorealistic, hyper-detailed skin and body texture, soft natural daylight, shallow depth of field, 4k resolution, strict character consistency.";

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

  return `${cleaned}, in a scene representing: ${topicPrompt}. Professional photography, natural daylight, hyper-detailed skin texture, realistic expression, no text, no watermark, 4k resolution, strict character consistency`;
}
