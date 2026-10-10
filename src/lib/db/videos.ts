import { supabaseAdmin } from "@/lib/supabase/server";
import {
  cleanFilenameToTopic,
  getDirectDriveDownloadUrl,
  parseDriveVideoLinks,
  fetchDriveFileMetadata,
  type DriveFolderFile,
} from "@/lib/drive";
import type { VideoLibraryItem, VideoLibraryStatus } from "@/lib/types";

export async function listVideoLibrary(
  opts: { status?: VideoLibraryStatus | VideoLibraryStatus[]; limit?: number } = {}
): Promise<VideoLibraryItem[]> {
  const db = supabaseAdmin();
  let query = db.from("video_library").select("*").order("created_at", { ascending: false });

  if (opts.status) {
    query = Array.isArray(opts.status)
      ? query.in("status", opts.status)
      : query.eq("status", opts.status);
  }
  if (opts.limit) query = query.limit(opts.limit);

  const { data, error } = await query;
  if (error) {
    // If table not created yet, return empty array rather than crashing
    if (error.message.includes("does not exist") || error.code === "42P01") {
      return [];
    }
    throw new Error(`Falha ao listar vídeos da biblioteca: ${error.message}`);
  }
  return (data ?? []) as VideoLibraryItem[];
}

export async function getVideoItem(id: string): Promise<VideoLibraryItem | null> {
  const db = supabaseAdmin();
  const { data, error } = await db.from("video_library").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Falha ao buscar vídeo: ${error.message}`);
  return data as VideoLibraryItem | null;
}

/**
 * Inserts new videos found in Google Drive folder without overwriting existing records or published statuses.
 */
export async function syncDriveVideos(files: DriveFolderFile[]): Promise<{ inserted: number; total: number }> {
  if (files.length === 0) return { inserted: 0, total: 0 };
  const db = supabaseAdmin();

  // First fetch existing drive_file_ids
  const fileIds = files.map((f) => f.id);
  const { data: existing, error: fetchErr } = await db
    .from("video_library")
    .select("drive_file_id")
    .in("drive_file_id", fileIds);

  if (fetchErr) {
    if (fetchErr.message.includes("does not exist") || fetchErr.code === "42P01") {
      throw new Error(
        "A tabela video_library ainda não existe no seu Supabase. Execute o comando SQL em supabase/schema.sql."
      );
    }
    throw fetchErr;
  }

  const existingSet = new Set((existing ?? []).map((e: { drive_file_id: string }) => e.drive_file_id));
  const newFiles = files.filter((f) => !existingSet.has(f.id));

  if (newFiles.length === 0) {
    return { inserted: 0, total: files.length };
  }

  const toInsert = newFiles.map((f) => ({
    drive_file_id: f.id,
    title: cleanFilenameToTopic(f.name),
    raw_filename: f.name,
    video_url: getDirectDriveDownloadUrl(f.id),
    file_size: f.size ?? null,
    status: "pending" as const,
  }));

  const { error: insertErr } = await db.from("video_library").insert(toInsert);
  if (insertErr) throw new Error(`Erro ao salvar vídeos importados: ${insertErr.message}`);

  return { inserted: newFiles.length, total: files.length };
}

/**
 * Parses raw text with one or more Google Drive video links and imports them to the library.
 */
export async function addVideosFromLinks(
  linksText: string,
  apiKey?: string | null
): Promise<{ inserted: number; total: number; existing: number }> {
  const parsed = parseDriveVideoLinks(linksText);
  if (parsed.length === 0) {
    throw new Error("Nenhum link válido do Google Drive foi encontrado no texto colado.");
  }

  const db = supabaseAdmin();
  const fileIds = parsed.map((p) => p.id);

  const { data: existing, error: fetchErr } = await db
    .from("video_library")
    .select("drive_file_id")
    .in("drive_file_id", fileIds);

  if (fetchErr) {
    if (fetchErr.message.includes("does not exist") || fetchErr.code === "42P01") {
      throw new Error(
        "A tabela video_library ainda não existe no seu Supabase. Execute o comando SQL em supabase/schema.sql."
      );
    }
    throw fetchErr;
  }

  const existingSet = new Set((existing ?? []).map((e: { drive_file_id: string }) => e.drive_file_id));
  const toProcess = parsed.filter((p) => !existingSet.has(p.id));

  if (toProcess.length === 0) {
    return { inserted: 0, total: parsed.length, existing: existingSet.size };
  }

  const itemsToInsert = await Promise.all(
    toProcess.map(async (item) => {
      let meta = await fetchDriveFileMetadata(item.id, apiKey);
      const rawName = meta?.name || item.title || `Vídeo ${item.id.slice(0, 8)}`;
      const title = item.title || cleanFilenameToTopic(rawName);

      return {
        drive_file_id: item.id,
        title,
        raw_filename: rawName,
        video_url: getDirectDriveDownloadUrl(item.id),
        file_size: meta?.size ?? null,
        status: "pending" as const,
      };
    })
  );

  const { error: insertErr } = await db.from("video_library").insert(itemsToInsert);
  if (insertErr) {
    throw new Error(`Erro ao salvar vídeos importados: ${insertErr.message}`);
  }

  return {
    inserted: itemsToInsert.length,
    total: parsed.length,
    existing: existingSet.size,
  };
}

export async function updateVideoItem(id: string, patch: Partial<VideoLibraryItem>): Promise<VideoLibraryItem> {
  const db = supabaseAdmin();
  const { data, error } = await db.from("video_library").update(patch).eq("id", id).select().single();
  if (error) throw new Error(`Falha ao atualizar vídeo: ${error.message}`);
  return data as VideoLibraryItem;
}

export async function deleteVideoItem(id: string): Promise<void> {
  const db = supabaseAdmin();
  const { error } = await db.from("video_library").delete().eq("id", id);
  if (error) throw new Error(`Falha ao remover vídeo: ${error.message}`);
}

/**
 * Returns the next pending video in line to be published by the Reels autopilot.
 * Oldest created first (chronological order).
 */
export async function getNextPendingVideo(): Promise<VideoLibraryItem | null> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("video_library")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (error.message.includes("does not exist") || error.code === "42P01") return null;
    throw error;
  }
  return data as VideoLibraryItem | null;
}
