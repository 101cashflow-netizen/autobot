import { publishPhoto, publishVideo, publishText, NoPageSelectedError, getPageToken } from "@/lib/facebook/client";
import { getPost, updatePostRecord } from "@/lib/db/posts";
import { getSettings } from "@/lib/db/settings";
import { composeMessage } from "@/lib/types";
import type { Post } from "@/lib/types";

/**
 * Publishes one queued post to its Facebook Page and records the outcome.
 * Shared by the "post now" route and the scheduled-queue cron worker so there
 * is exactly one place that talks to the Graph publish endpoint.
 */
export async function publishPostNow(postId: string): Promise<Post> {
  const post = await getPost(postId);
  if (!post) throw new Error("Post not found.");

  const settings = await getSettings();

  const pageId = post.page_id ?? settings.default_page_id;
  if (!pageId) {
    return updatePostRecord(postId, {
      status: "failed",
      error_message: new NoPageSelectedError().message,
    });
  }

  // Resolve page token: supports default page AND any other page the user manages!
  const pageInfo = await getPageToken(pageId);
  const pageToken = pageInfo?.token;

  if (!pageToken) {
    return updatePostRecord(postId, {
      status: "failed",
      error_message: `Não foi possível encontrar o token de acesso para a página ${post.page_name || pageId}.`,
    });
  }


  try {
    const isVideo = post.media_type === "video";
    const isText = post.media_type === "text" || (!post.image_url && !post.media_url);

    let result: { id: string };
    if (isVideo && (post.media_url || post.image_url)) {
      result = await publishVideo({
        pageId,
        pageToken,
        description: composeMessage(post, settings.utm_suffix),
        videoUrl: post.media_url || post.image_url,
        title: post.title,
      });
    } else if (isText) {
      result = await publishText({
        pageId,
        pageToken,
        message: composeMessage(post, settings.utm_suffix),
        link: post.link_url || undefined,
      });
    } else {
      let finalImageUrl = post.image_url;
      if (
        post.image_source === "drive" ||
        post.image_url.includes("googleusercontent.com") ||
        post.image_url.includes("drive.google.com")
      ) {
        try {
          const { extractDriveFileId } = await import("@/lib/drive");
          const { ensurePublicImageUrl } = await import("@/lib/facebook/images");
          const fileId = extractDriveFileId(post.image_url);
          if (fileId) {
            finalImageUrl = await ensurePublicImageUrl(fileId, post.image_url);
          }
        } catch (e) {
          console.warn("Could not ensure public storage URL for drive image:", e);
        }
      }

      result = await publishPhoto({
        pageId,
        pageToken,
        message: composeMessage(post, settings.utm_suffix),
        imageUrl: finalImageUrl,
      });
    }

    return await updatePostRecord(postId, {
      status: "posted",
      facebook_post_id: result.id,
      posted_at: new Date().toISOString(),
      error_message: null,
    });
  } catch (err) {
    let message = err instanceof Error ? err.message : "Unknown error while posting.";

    // Facebook reports a token that lacks pages_manage_posts as a bare
    // "(#200) Permissions error", which says nothing about what to fix.
    if (/\(#200\)|permissions? error/i.test(message)) {
      message =
        "Facebook rejected this for missing permissions. The connected token needs " +
        "pages_manage_posts. Add it to your Meta app — and to the Login for Business " +
        "configuration if you use one — then disconnect and connect again so a new " +
        "token is issued.";
    }

    return await updatePostRecord(postId, { status: "failed", error_message: message });
  }
}
