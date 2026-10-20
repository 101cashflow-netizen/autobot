import { getImageItem, updateImageItem } from "@/lib/db/images";
import { createPostRecord } from "@/lib/db/posts";
import { getSettings } from "@/lib/db/settings";
import { publishPhoto, NoPageSelectedError } from "@/lib/facebook/client";
import { generateContent } from "@/lib/ai/text";
import { composeMessage, isFacebookConnected } from "@/lib/types";
import { getDirectDriveDownloadUrl, getDirectDriveImageUrl } from "@/lib/drive";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { ImageLibraryItem } from "@/lib/types";

const STORAGE_BUCKET = "post-images";

function getUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "img-" + Math.random().toString(36).substring(2, 15) + "-" + Date.now().toString(36);
}

/**
 * Re-hosts an image from Google Drive into Supabase Storage bucket so Facebook Graph API
 * can reliably fetch it without Google Drive redirects or rate limit blocks.
 * Falls back gracefully to direct URLs if upload fails.
 */
async function ensurePublicImageUrl(fileId: string, currentUrl: string): Promise<string> {
  const downloadUrl = getDirectDriveDownloadUrl(fileId);
  const directCdnUrl = getDirectDriveImageUrl(fileId);

  try {
    const res = await fetch(downloadUrl, {
      signal: AbortSignal.timeout(20000),
      headers: { Accept: "image/*,*/*" },
    });

    if (res.ok) {
      const blob = await res.blob();
      if (blob.size > 0 && blob.type.startsWith("image/")) {
        const db = supabaseAdmin();
        const ext = blob.type.includes("png") ? "png" : blob.type.includes("webp") ? "webp" : "jpg";
        const path = `batch-drive/${new Date().toISOString().slice(0, 10)}/${getUuid()}.${ext}`;
        const bytes = new Uint8Array(await blob.arrayBuffer());

        const { error: uploadErr } = await db.storage.from(STORAGE_BUCKET).upload(path, bytes, {
          contentType: blob.type || "image/jpeg",
          upsert: false,
        });

        if (!uploadErr) {
          const { data } = db.storage.from(STORAGE_BUCKET).getPublicUrl(path);
          if (data?.publicUrl) {
            return data.publicUrl;
          }
        }
      }
    }
  } catch (err) {
    console.warn("Could not rehost Drive image to Supabase Storage, using direct CDN URL:", err);
  }

  return directCdnUrl || currentUrl || downloadUrl;
}

export async function publishImageFromLibrary(imageId: string): Promise<ImageLibraryItem> {
  const item = await getImageItem(imageId);
  if (!item) throw new Error("Imagem não encontrada na biblioteca.");

  const settings = await getSettings();
  if (!isFacebookConnected(settings) || !settings.default_page_id || !settings.default_page_token) {
    const errorMsg = new NoPageSelectedError().message;
    await updateImageItem(imageId, { status: "failed", error_message: errorMsg });
    throw new Error(errorMsg);
  }

  const pageId = settings.default_page_id;
  const pageToken = settings.default_page_token;

  try {
    // 1. Generate engaging Facebook copy based on the image title / topic
    const copy = await generateContent(item.title);

    // 2. Format message with title, description, hashtags and utm suffix
    const message = composeMessage(
      {
        title: copy.title,
        description: copy.description,
        hashtags: copy.hashtags,
        link_url: null,
      },
      settings.utm_suffix
    );

    // 3. Ensure image is publicly accessible for Facebook's photo endpoint
    const finalImageUrl = await ensurePublicImageUrl(item.drive_file_id, item.image_url);

    // 4. Publish to Facebook Page
    const result = await publishPhoto({
      pageId,
      pageToken,
      imageUrl: finalImageUrl,
      message,
    });

    const publishedAt = new Date().toISOString();

    // 5. Update library item
    const updated = await updateImageItem(imageId, {
      status: "published",
      published_at: publishedAt,
      facebook_post_id: result.id,
      image_url: finalImageUrl,
      error_message: null,
    });

    // 6. Record in posts table for History & Dashboard metrics
    try {
      await createPostRecord({
        topic: item.title,
        title: copy.title,
        description: copy.description,
        hashtags: copy.hashtags,
        image_url: finalImageUrl,
        image_source: "ai",
        media_type: "image",
        media_url: finalImageUrl,
        link_url: null,
        page_id: pageId,
        page_name: settings.default_page_name,
        scheduled_at: null,
        status: "posted",
        posted_at: publishedAt,
        facebook_post_id: result.id,
      });
    } catch (postErr) {
      console.warn("Could not insert post log for published batch image:", postErr);
    }

    return updated;
  } catch (err) {
    let message = err instanceof Error ? err.message : "Erro desconhecido ao publicar imagem no Facebook.";
    if (/\(#200\)|permissions? error/i.test(message)) {
      message =
        "Facebook rejeitou a publicação por falta de permissões (pages_manage_posts). Verifique seu Meta App.";
    }
    await updateImageItem(imageId, { status: "failed", error_message: message });
    throw new Error(message);
  }
}
