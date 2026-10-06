export type ImageSource = "ai" | "stock";
export type ImageSourcePref = "ai" | "stock" | "mixed";
export type PostStatus = "draft" | "scheduled" | "posted" | "failed";

/**
 * Where autopilot gets its subjects. "mine" rotates through the owner's own
 * topic list and only borrows trending ideas while that list is empty.
 */
export type TopicSource = "mine" | "trending" | "mixed";

export interface Topic {
  id: string;
  text: string;
  enabled: boolean;
  use_count: number;
  last_used_at: string | null;
  created_at: string;
}

export interface AppSettings {
  id: 1;
  /** Meta app credentials, normally entered in Settings rather than env vars. */
  facebook_app_id: string | null;
  facebook_app_secret: string | null;
  /**
   * Facebook Login for Business "login configuration" id. Apps created with the
   * Page-management use case get Login for Business, where config_id replaces
   * scope — the permissions come from the saved configuration instead of the
   * URL. Null means the app uses classic Facebook Login and scopes.
   */
  facebook_config_id: string | null;
  /** Long-lived user token — lists Pages and mints Page tokens, never posts. */
  facebook_user_token: string | null;
  facebook_token_expires_at: string | null;
  facebook_user_name: string | null;
  default_page_id: string | null;
  default_page_name: string | null;
  /** Page tokens derived from a long-lived user token do not expire. */
  default_page_token: string | null;
  /** Gemini API key stored in database (optional fallback to env var). */
  gemini_api_key?: string | null;
  /** Avatar character consistency settings (e.g. Nasha). */
  avatar_enabled?: boolean;
  avatar_name?: string | null;
  avatar_prompt?: string | null;
  /** Pexels and Pixabay stock API keys and provider preference */
  pexels_api_key?: string | null;
  pixabay_api_key?: string | null;
  stock_provider?: StockProvider;
  /** Copywriting AI settings */
  text_provider_pref?: TextAiProviderPref;
  gemini_enabled?: boolean;
  groq_enabled?: boolean;
  pollinations_enabled?: boolean;
  copy_language?: CopyLanguage;
  copy_length?: CopyLength;
  copy_tone?: CopyTone;
  copy_custom_rules?: string | null;
  cloudflare_account_id?: string | null;
  cloudflare_api_token?: string | null;
  pollinations_api_key?: string | null;
  image_source: ImageSourcePref;
  utm_suffix: string;
  auto_post_enabled: boolean;
  posts_per_day: number;
  posting_hours: number[];
  timezone: string;
  last_auto_post_at: string | null;
  /** Absent on databases created before topics existed; treat as "mine". */
  topic_source?: TopicSource;
  updated_at: string;
}

export type MediaType = "image" | "video" | "text";
export type StockProvider = "pexels" | "pixabay" | "any";

export interface Post {
  id: string;
  topic: string;
  title: string;
  description: string;
  hashtags: string[];
  image_url: string;
  image_source: ImageSource;
  media_type?: MediaType;
  media_url?: string | null;
  link_url: string | null;
  page_id: string | null;
  page_name: string | null;
  status: PostStatus;
  scheduled_at: string | null;
  posted_at: string | null;
  facebook_post_id: string | null;
  error_message: string | null;
  created_at: string;
}

export interface PageCache {
  page_id: string;
  name: string;
  category: string | null;
  fetched_at: string;
}

/** Which free service actually wrote the copy. "template" means every AI
 *  provider was unreachable and the deterministic fallback was used. */
export type ContentProvider = "groq" | "gemini" | "pollinations" | "template";
export type TextAiProviderPref = "auto" | "gemini" | "groq" | "pollinations";

export type CopyLanguage = "auto" | "pt" | "en" | "es";
export type CopyLength = "short" | "medium" | "long" | "random";
export type CopyTone =
  | "conversational"
  | "persuasive"
  | "informative"
  | "inspirational"
  | "humorous"
  | "professional"
  | "random";

export interface CopyGuidelines {
  language?: CopyLanguage;
  length?: CopyLength;
  tone?: CopyTone;
  customRules?: string;
}

export interface GeneratedContent {
  title: string;
  description: string;
  hashtags: string[];
  provider?: ContentProvider;
  /** First provider failure, surfaced so a degraded draft can explain itself. */
  providerError?: string;
  /** Detailed breakdown of all provider failures */
  providerErrors?: string[];
}

/**
 * Public URL of a published post. Facebook returns `post_id` as
 * `<page-id>_<post-id>`, and that composite is itself addressable.
 */
export const facebookPostUrl = (postId: string) => `https://www.facebook.com/${postId}`;

export const isFacebookConnected = (s: Pick<AppSettings, "facebook_user_token">) =>
  Boolean(s.facebook_user_token);

/**
 * Facebook takes one `message` per post, so the separately-edited parts are
 * composed here — one place, shared by the publisher and the preview.
 */
export function composeMessage(
  post: Pick<Post, "title" | "description" | "hashtags" | "link_url">,
  utmSuffix = ""
): string {
  const tags = post.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ");
  return [post.title, post.description, post.link_url ?? "", tags, utmSuffix]
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n\n");
}
