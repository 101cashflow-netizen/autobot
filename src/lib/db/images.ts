import { supabaseAdmin } from "@/lib/supabase/server";
import {
  cleanImageFilenameToTopic,
  getDirectDriveImageUrl,
  getDirectDriveDownloadUrl,
  parseDriveImageLinks,
  fetchDriveFileMetadata,
  type DriveFolderFile,
} from "@/lib/drive";
import type { ImageLibraryItem, ImageLibraryStatus } from "@/lib/types";

export async function listImageLibrary(
  opts: { status?: ImageLibraryStatus | ImageLibraryStatus[]; limit?: number } = {}
): Promise<ImageLibraryItem[]> {
  const db = supabaseAdmin();
  let query = db.from("image_library").select("*").order("created_at", { ascending: false });

  if (opts.status) {
    query = Array.isArray(opts.status)
      ? query.in("status", opts.status)
      : query.eq("status", opts.status);
  }
  if (opts.limit) query = query.limit(opts.limit);

  const { data, error } = await query;
  if (error) {
    if (error.message.includes("does not exist") || error.code === "42P01") {
      return [];
    }
    throw new Error(`Falha ao listar imagens da biblioteca: ${error.message}`);
  }
  return (data ?? []) as ImageLibraryItem[];
}

export async function getImageItem(id: string): Promise<ImageLibraryItem | null> {
  const db = supabaseAdmin();
  const { data, error } = await db.from("image_library").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Falha ao buscar imagem: ${error.message}`);
  return data as ImageLibraryItem | null;
}

/**
 * Inserts new images found in Google Drive folder without overwriting existing records or published statuses.
 */
export async function syncDriveImages(files: DriveFolderFile[]): Promise<{ inserted: number; total: number }> {
  if (files.length === 0) return { inserted: 0, total: 0 };
  const db = supabaseAdmin();

  // First fetch existing drive_file_ids
  const fileIds = files.map((f) => f.id);
  const { data: existing, error: fetchErr } = await db
    .from("image_library")
    .select("drive_file_id")
    .in("drive_file_id", fileIds);

  if (fetchErr) {
    if (fetchErr.message.includes("does not exist") || fetchErr.code === "42P01") {
      throw new Error(
        "A tabela image_library ainda não existe no seu Supabase. Execute o comando SQL em supabase/schema.sql."
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
    title: cleanImageFilenameToTopic(f.name),
    raw_filename: f.name,
    image_url: getDirectDriveImageUrl(f.id),
    file_size: f.size ?? null,
    status: "pending" as const,
  }));

  const { error: insertErr } = await db.from("image_library").insert(toInsert);
  if (insertErr) throw new Error(`Erro ao salvar imagens importadas: ${insertErr.message}`);

  return { inserted: newFiles.length, total: files.length };
}

/**
 * Parses raw text with one or more Google Drive image links and imports them to the library.
 */
export async function addImagesFromLinks(
  linksText: string,
  apiKey?: string | null
): Promise<{ inserted: number; total: number; existing: number }> {
  const parsed = parseDriveImageLinks(linksText);
  if (parsed.length === 0) {
    throw new Error("Nenhum link válido do Google Drive foi encontrado no texto colado.");
  }

  const db = supabaseAdmin();
  const fileIds = parsed.map((p) => p.id);

  const { data: existing, error: fetchErr } = await db
    .from("image_library")
    .select("drive_file_id")
    .in("drive_file_id", fileIds);

  if (fetchErr) {
    if (fetchErr.message.includes("does not exist") || fetchErr.code === "42P01") {
      throw new Error(
        "A tabela image_library ainda não existe no seu Supabase. Execute o comando SQL em supabase/schema.sql."
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
      const rawName = meta?.name || item.title || `Imagem ${item.id.slice(0, 8)}`;
      const title = item.title || cleanImageFilenameToTopic(rawName);

      return {
        drive_file_id: item.id,
        title,
        raw_filename: rawName,
        image_url: getDirectDriveImageUrl(item.id),
        file_size: meta?.size ?? null,
        status: "pending" as const,
      };
    })
  );

  const { error: insertErr } = await db.from("image_library").insert(itemsToInsert);
  if (insertErr) {
    throw new Error(`Erro ao salvar imagens importadas: ${insertErr.message}`);
  }

  return {
    inserted: itemsToInsert.length,
    total: parsed.length,
    existing: existingSet.size,
  };
}

export async function updateImageItem(id: string, patch: Partial<ImageLibraryItem>): Promise<ImageLibraryItem> {
  const db = supabaseAdmin();
  const { data, error } = await db.from("image_library").update(patch).eq("id", id).select().single();
  if (error) throw new Error(`Falha ao atualizar imagem: ${error.message}`);
  return data as ImageLibraryItem;
}

export async function deleteImageItem(id: string): Promise<void> {
  const db = supabaseAdmin();
  const { error } = await db.from("image_library").delete().eq("id", id);
  if (error) throw new Error(`Falha ao remover imagem: ${error.message}`);
}

/**
 * Returns the next pending image in line to be published by the Batch Images autopilot.
 * Oldest created first (chronological queue order).
 */
export async function getNextPendingImage(): Promise<ImageLibraryItem | null> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("image_library")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (error.message.includes("does not exist") || error.code === "42P01") return null;
    throw error;
  }
  return data as ImageLibraryItem | null;
}
