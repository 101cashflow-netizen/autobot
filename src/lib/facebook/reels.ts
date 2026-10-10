import { getVideoItem, updateVideoItem } from "@/lib/db/videos";
import { createPostRecord } from "@/lib/db/posts";
import { getSettings } from "@/lib/db/settings";
import { publishVideo, NoPageSelectedError } from "@/lib/facebook/client";
import { generateReelsContent } from "@/lib/ai/text";
import { composeMessage, isFacebookConnected } from "@/lib/types";
import type { VideoLibraryItem } from "@/lib/types";

export async function publishReelFromLibrary(videoId: string): Promise<VideoLibraryItem> {
  const item = await getVideoItem(videoId);
  if (!item) throw new Error("Vídeo não encontrado na biblioteca.");

  const settings = await getSettings();
  if (!isFacebookConnected(settings) || !settings.default_page_id || !settings.default_page_token) {
    const errorMsg = new NoPageSelectedError().message;
    await updateVideoItem(videoId, { status: "failed", error_message: errorMsg });
    throw new Error(errorMsg);
  }

  const pageId = settings.default_page_id;
  const pageToken = settings.default_page_token;

  try {
    // 1. Generate high-converting Reels copy based on the video's title
    const copy = await generateReelsContent(item.title);

    // 2. Format the message for Facebook
    const message = composeMessage(
      {
        title: copy.title,
        description: copy.description,
        hashtags: copy.hashtags,
        link_url: null,
      },
      settings.utm_suffix
    );

    // 3. Publish to Facebook using direct Google Drive download file_url
    const result = await publishVideo({
      pageId,
      pageToken,
      videoUrl: item.video_url,
      title: copy.title,
      description: message,
    });

    const publishedAt = new Date().toISOString();

    // 4. Update Video Library status to published
    const updated = await updateVideoItem(videoId, {
      status: "published",
      published_at: publishedAt,
      facebook_post_id: result.id,
      error_message: null,
    });

    // 5. Also log into the general posts table so it reflects in History and Dashboard metrics
    try {
      await createPostRecord({
        topic: item.title,
        title: copy.title,
        description: copy.description,
        hashtags: copy.hashtags,
        image_url: "",
        image_source: "stock",
        media_type: "video",
        media_url: item.video_url,
        link_url: null,
        page_id: pageId,
        page_name: settings.default_page_name,
        scheduled_at: null,
        status: "posted",
        posted_at: publishedAt,
        facebook_post_id: result.id,
      });
    } catch (postErr) {
      console.warn("Could not insert post log for published reel:", postErr);
    }

    return updated;
  } catch (err) {
    let message = err instanceof Error ? err.message : "Erro desconhecido ao publicar Reel no Facebook.";
    if (/\(#200\)|permissions? error/i.test(message)) {
      message =
        "Facebook rejeitou a publicação por falta de permissões (pages_manage_posts). Verifique seu Meta App.";
    }
    await updateVideoItem(videoId, { status: "failed", error_message: message });
    throw new Error(message);
  }
}
