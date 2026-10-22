import { supabaseAdmin } from "@/lib/supabase/server";
import { getSettings, updateSettings } from "@/lib/db/settings";
import { graph, getPageToken, publishPhoto, publishText } from "@/lib/facebook/client";
import { generateRepostContent } from "@/lib/ai/text";
import { createPostRecord } from "@/lib/db/posts";
import { composeMessage } from "@/lib/types";

const STORAGE_BUCKET = "post-images";

function getUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "rep-" + Math.random().toString(36).substring(2, 15) + "-" + Date.now().toString(36);
}

/**
 * Rehosts a Facebook CDN image into Supabase Storage bucket so target pages
 * can publish it with 100% stability.
 */
async function rehostFacebookImage(imageUrl: string, postId: string): Promise<string> {
  try {
    const res = await fetch(imageUrl, {
      signal: AbortSignal.timeout(20000),
      headers: { Accept: "image/*,*/*" },
    });

    if (!res.ok) return imageUrl;

    const blob = await res.blob();
    if (!blob.size || !blob.type.startsWith("image/")) return imageUrl;

    const db = supabaseAdmin();
    const ext = blob.type.includes("png") ? "png" : blob.type.includes("webp") ? "webp" : "jpg";
    const path = `reposts/${new Date().toISOString().slice(0, 10)}/${postId}-${getUuid()}.${ext}`;
    const bytes = new Uint8Array(await blob.arrayBuffer());

    const { error: uploadErr } = await db.storage.from(STORAGE_BUCKET).upload(path, bytes, {
      contentType: blob.type || "image/jpeg",
      upsert: true,
    });

    if (uploadErr) {
      console.warn("Could not rehost repost image to storage:", uploadErr);
      return imageUrl;
    }

    const { data } = db.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return data?.publicUrl || imageUrl;
  } catch (err) {
    console.warn("Failed to download image for reposting:", err);
    return imageUrl;
  }
}

export interface RepostRunResult {
  ok: boolean;
  checkedCount: number;
  repostedCount: number;
  skippedCount: number;
  errors: string[];
  repostedPosts: Array<{
    sourcePostId: string;
    targetPageId: string;
    targetPostId?: string;
    title: string;
  }>;
}

/**
 * Checks for recent posts on the source page (e.g. Página Milionário) and reposts
 * any new items to each configured target page with optional AI rewriting.
 */
export async function checkAndRepost(options?: {
  force?: boolean;
  limit?: number;
}): Promise<RepostRunResult> {
  const settings = await getSettings();
  const errors: string[] = [];
  const repostedPosts: RepostRunResult["repostedPosts"] = [];

  const isEnabled = options?.force || settings.repost_enabled;
  if (!isEnabled) {
    return {
      ok: true,
      checkedCount: 0,
      repostedCount: 0,
      skippedCount: 0,
      errors: ["Repostagem automática está desativada."],
      repostedPosts: [],
    };
  }

  const sourcePageId = settings.repost_source_page_id;
  const targetPageIds = (settings.repost_target_page_ids || []).filter(
    (id) => Boolean(id) && id !== sourcePageId
  );

  if (!sourcePageId) {
    return {
      ok: false,
      checkedCount: 0,
      repostedCount: 0,
      skippedCount: 0,
      errors: ["Nenhuma página de origem (ex: Página Milionário) selecionada para repostar."],
      repostedPosts: [],
    };
  }

  if (targetPageIds.length === 0) {
    return {
      ok: false,
      checkedCount: 0,
      repostedCount: 0,
      skippedCount: 0,
      errors: ["Nenhuma página de destino configurada para receber as repostagens."],
      repostedPosts: [],
    };
  }

  // Get source page token
  const sourcePageInfo = await getPageToken(sourcePageId);
  if (!sourcePageInfo?.token) {
    return {
      ok: false,
      checkedCount: 0,
      repostedCount: 0,
      skippedCount: 0,
      errors: [`Token de acesso não encontrado para a página de origem ID: ${sourcePageId}.`],
      repostedPosts: [],
    };
  }

  // Fetch recent published posts from source page
  const fetchLimit = options?.limit || 10;
  let sourcePosts: Array<{
    id: string;
    message?: string;
    created_time?: string;
    full_picture?: string;
    permalink_url?: string;
  }> = [];

  try {
    const data = await graph(`/${sourcePageId}/published_posts`, {
      access_token: sourcePageInfo.token,
      fields: "id,message,created_time,full_picture,permalink_url",
      limit: String(fetchLimit),
    });
    sourcePosts = data.data || [];
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Falha ao ler posts da página de origem.";
    return {
      ok: false,
      checkedCount: 0,
      repostedCount: 0,
      skippedCount: 0,
      errors: [msg],
      repostedPosts: [],
    };
  }

  if (sourcePosts.length === 0) {
    await updateSettings({ last_repost_check_at: new Date().toISOString() });
    return {
      ok: true,
      checkedCount: 0,
      repostedCount: 0,
      skippedCount: 0,
      errors: [],
      repostedPosts: [],
    };
  }

  const db = supabaseAdmin();
  let skippedCount = 0;
  let repostedCount = 0;

  for (const srcPost of sourcePosts) {
    const sourcePostId = srcPost.id;
    const originalText = (srcPost.message || "").trim();
    const rawImageUrl = srcPost.full_picture;

    // A post must have at least some text or an image
    if (!originalText && !rawImageUrl) {
      skippedCount++;
      continue;
    }

    // Check which target pages have already received this post
    const { data: existingLogs } = await db
      .from("repost_logs")
      .select("target_page_id")
      .eq("source_post_id", sourcePostId)
      .eq("status", "success");

    const alreadyRepostedTargetIds = new Set((existingLogs || []).map((l) => l.target_page_id));
    const pendingTargetIds = targetPageIds.filter((id) => !alreadyRepostedTargetIds.has(id));

    if (pendingTargetIds.length === 0) {
      skippedCount++;
      continue;
    }

    // Prepare content (AI rewrite or original)
    let postContent: { title: string; description: string; hashtags: string[] };
    if (settings.repost_ai_rewrite !== false && originalText) {
      try {
        postContent = await generateRepostContent(originalText, settings.repost_ai_prompt || undefined);
      } catch (e) {
        console.warn("AI rewrite failed, using original post text:", e);
        const lines = originalText.split("\n").filter(Boolean);
        postContent = {
          title: lines[0]?.slice(0, 100) || "Destaque",
          description: lines.slice(1).join(" ") || originalText,
          hashtags: ["repost", "destaque"],
        };
      }
    } else {
      const lines = originalText.split("\n").filter(Boolean);
      postContent = {
        title: lines[0]?.slice(0, 100) || "Destaque",
        description: lines.slice(1).join(" ") || originalText,
        hashtags: [],
      };
    }

    // If there is an image, rehost it into Supabase Storage
    let finalImageUrl = "";
    if (rawImageUrl) {
      finalImageUrl = await rehostFacebookImage(rawImageUrl, sourcePostId);
    }

    // Repost to each pending target page
    for (const targetPageId of pendingTargetIds) {
      const targetPageInfo = await getPageToken(targetPageId);
      if (!targetPageInfo?.token) {
        errors.push(`Token não encontrado para a página de destino: ${targetPageId}`);
        await db.from("repost_logs").upsert(
          {
            source_page_id: sourcePageId,
            source_page_name: sourcePageInfo.name || settings.repost_source_page_name || "Página Milionário",
            source_post_id: sourcePostId,
            target_page_id: targetPageId,
            status: "failed",
            error_message: `Token não encontrado para a página ${targetPageId}`,
            post_title: postContent.title,
            reposted_at: new Date().toISOString(),
          },
          { onConflict: "source_post_id,target_page_id" }
        );
        continue;
      }

      try {
        const dummyPost = {
          title: postContent.title,
          description: postContent.description,
          hashtags: postContent.hashtags,
          link_url: null,
        };
        const message = composeMessage(dummyPost, settings.utm_suffix);

        let publishResult: { id: string };
        if (finalImageUrl) {
          publishResult = await publishPhoto({
            pageId: targetPageId,
            pageToken: targetPageInfo.token,
            message,
            imageUrl: finalImageUrl,
          });
        } else {
          publishResult = await publishText({
            pageId: targetPageId,
            pageToken: targetPageInfo.token,
            message,
          });
        }

        // Record in posts table so it appears in history
        await createPostRecord({
          topic: `Repost: ${sourcePageInfo.name || "Origem"}`,
          title: postContent.title,
          description: postContent.description,
          hashtags: postContent.hashtags,
          image_url: finalImageUrl,
          image_source: "stock",
          media_type: finalImageUrl ? "image" : "text",
          link_url: null,
          scheduled_at: null,
          page_id: targetPageId,
          page_name: targetPageInfo.name,
          status: "posted",
          posted_at: new Date().toISOString(),
          facebook_post_id: publishResult.id,
        });

        // Record in repost_logs
        await db.from("repost_logs").upsert(
          {
            source_page_id: sourcePageId,
            source_page_name: sourcePageInfo.name || settings.repost_source_page_name || "Página Milionário",
            source_post_id: sourcePostId,
            target_page_id: targetPageId,
            target_page_name: targetPageInfo.name,
            target_post_id: publishResult.id,
            post_title: postContent.title,
            status: "success",
            reposted_at: new Date().toISOString(),
          },
          { onConflict: "source_post_id,target_page_id" }
        );

        repostedCount++;
        repostedPosts.push({
          sourcePostId,
          targetPageId,
          targetPostId: publishResult.id,
          title: postContent.title,
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Falha ao publicar repost no Facebook.";
        errors.push(`Erro ao publicar na página ${targetPageInfo.name || targetPageId}: ${errMsg}`);
        await db.from("repost_logs").upsert(
          {
            source_page_id: sourcePageId,
            source_page_name: sourcePageInfo.name || settings.repost_source_page_name || "Página Milionário",
            source_post_id: sourcePostId,
            target_page_id: targetPageId,
            target_page_name: targetPageInfo.name,
            status: "failed",
            error_message: errMsg,
            post_title: postContent.title,
            reposted_at: new Date().toISOString(),
          },
          { onConflict: "source_post_id,target_page_id" }
        );
      }
    }
  }

  await updateSettings({ last_repost_check_at: new Date().toISOString() });

  return {
    ok: errors.length === 0,
    checkedCount: sourcePosts.length,
    repostedCount,
    skippedCount,
    errors,
    repostedPosts,
  };
}
