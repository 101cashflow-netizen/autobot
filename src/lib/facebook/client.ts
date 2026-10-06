import { supabaseAdmin } from "@/lib/supabase/server";
import { GRAPH_BASE } from "@/lib/facebook/oauth";
import type { AppSettings } from "@/lib/types";

export class FacebookNotConnectedError extends Error {
  constructor() {
    super("Facebook is not connected. Connect it from Settings first.");
  }
}

export class NoPageSelectedError extends Error {
  constructor() {
    super("No Facebook Page selected. Choose one on the Pages screen first.");
  }
}

async function loadSettings(): Promise<AppSettings> {
  const db = supabaseAdmin();
  const { data } = await db.from("app_settings").select("*").eq("id", 1).single<AppSettings>();
  if (!data) throw new Error("Settings row is missing.");
  return data;
}

async function graph(path: string, params: Record<string, string>, init?: RequestInit) {
  const url = `${GRAPH_BASE}${path}`;
  const res = await fetch(init?.method === "POST" ? url : `${url}?${new URLSearchParams(params)}`, {
    ...init,
    ...(init?.method === "POST"
      ? {
          headers: { "Content-Type": "application/x-www-form-urlencoded", ...init?.headers },
          body: new URLSearchParams(params),
        }
      : {}),
    signal: AbortSignal.timeout(30_000),
  });

  const body = await res.json().catch(() => null);
  if (!res.ok || body?.error) {
    throw new Error(body?.error?.message ?? `Facebook API ${path} failed (${res.status})`);
  }
  return body;
}

export interface FacebookPage {
  id: string;
  name: string;
  category: string | null;
  /** Non-expiring when minted from a long-lived user token. */
  access_token: string;
}

/**
 * Every Page this person can create content on. `tasks` is filtered rather
 * than trusted wholesale: being able to see a Page does not mean being allowed
 * to publish to it, and finding that out at post time would be far worse.
 */
export async function fetchPages(): Promise<FacebookPage[]> {
  const settings = await loadSettings();
  if (!settings.facebook_user_token) throw new FacebookNotConnectedError();

  const pages: FacebookPage[] = [];
  let after: string | undefined;

  do {
    const params: Record<string, string> = {
      access_token: settings.facebook_user_token,
      fields: "id,name,category,access_token,tasks",
      limit: "100",
    };
    if (after) params.after = after;

    const data = await graph("/me/accounts", params);
    for (const p of data.data ?? []) {
      if (Array.isArray(p.tasks) && !p.tasks.includes("CREATE_CONTENT")) continue;
      pages.push({
        id: p.id,
        name: p.name,
        category: p.category ?? null,
        access_token: p.access_token,
      });
    }
    after = data.paging?.cursors?.after && data.paging?.next ? data.paging.cursors.after : undefined;
  } while (after);

  return pages;
}

/** Permissions this app cannot work without. */
export const REQUIRED_PERMISSIONS = [
  "pages_show_list",
  "pages_manage_posts",
  "pages_read_engagement",
];

/**
 * Which of the required permissions the connected account actually granted.
 *
 * Worth checking explicitly: when the Meta app uses Login for Business the
 * permissions come from a saved configuration, so a configuration missing
 * `pages_manage_posts` connects perfectly and then fails at publish time with a
 * bare "(#200) Permissions error" that names nothing.
 */
export async function missingPermissions(userToken: string): Promise<string[]> {
  try {
    const data = await graph("/me/permissions", { access_token: userToken });
    const granted = new Set(
      (data.data ?? [])
        .filter((p: { status: string }) => p.status === "granted")
        .map((p: { permission: string }) => p.permission)
    );
    return REQUIRED_PERMISSIONS.filter((p) => !granted.has(p));
  } catch {
    return [];
  }
}

export async function fetchAccount(): Promise<{ name: string }> {
  const settings = await loadSettings();
  if (!settings.facebook_user_token) throw new FacebookNotConnectedError();
  const data = await graph("/me", { access_token: settings.facebook_user_token, fields: "name" });
  return { name: data.name };
}

export interface PublishPhotoInput {
  pageId: string;
  pageToken: string;
  message: string;
  imageUrl: string;
}

/**
 * Publishes a photo post. Meta fetches the image from `url` itself, which is
 * why every generated image is re-hosted on Supabase Storage first — a
 * best-effort free provider's URL would not be a safe thing for Facebook's
 * crawler to depend on.
 */
export async function publishPhoto(input: PublishPhotoInput): Promise<{ id: string }> {
  const data = await graph(
    `/${input.pageId}/photos`,
    {
      url: input.imageUrl,
      message: input.message,
      access_token: input.pageToken,
      published: "true",
    },
    { method: "POST" }
  );
  return { id: data.post_id ?? data.id };
}

export interface PublishVideoInput {
  pageId: string;
  pageToken: string;
  description: string;
  videoUrl: string;
  title?: string;
}

/**
 * Publishes a video post to Facebook using direct file_url.
 * Facebook downloads the video directly from Pexels/Pixabay CDN,
 * requiring zero heavy file transfer through the serverless function.
 */
export async function publishVideo(input: PublishVideoInput): Promise<{ id: string }> {
  const params: Record<string, string> = {
    file_url: input.videoUrl,
    description: input.description,
    access_token: input.pageToken,
  };
  if (input.title) {
    params.title = input.title;
  }

  const data = await graph(
    `/${input.pageId}/videos`,
    params,
    { method: "POST" }
  );
  return { id: data.id };
}

export interface PublishTextInput {
  pageId: string;
  pageToken: string;
  message: string;
  link?: string;
}

/**
 * Publishes a text-only status update to Facebook Page feed.
 */
export async function publishText(input: PublishTextInput): Promise<{ id: string }> {
  const params: Record<string, string> = {
    message: input.message,
    access_token: input.pageToken,
  };
  if (input.link) {
    params.link = input.link;
  }

  const data = await graph(
    `/${input.pageId}/feed`,
    params,
    { method: "POST" }
  );
  return { id: data.id };
}

