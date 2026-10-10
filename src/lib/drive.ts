/**
 * Google Drive Video Integration Helpers.
 * Handles extracting IDs, generating direct download URLs,
 * sanitizing video filenames into topics, and listing folder contents via Drive API v3.
 */

export function extractDriveFolderId(input: string): string {
  const trimmed = input.trim();
  // Check for https://drive.google.com/drive/folders/<id> or /folders/<id>?...
  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch) return folderMatch[1];

  // Check for ?id=<id> or &id=<id>
  const paramMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (paramMatch) return paramMatch[1];

  // If input is already an ID (alphanumeric and dashes/underscores, usually 25+ chars)
  return trimmed;
}

export function extractDriveFileId(input: string): string | null {
  const trimmed = input.trim();
  // https://drive.google.com/file/d/<id>/view
  const fileMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) return fileMatch[1];

  // ?id=<id> or &id=<id> or export=download&id=<id>
  const paramMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (paramMatch) return paramMatch[1];

  // /open?id=<id>
  const openMatch = trimmed.match(/\/open\?id=([a-zA-Z0-9_-]+)/);
  if (openMatch) return openMatch[1];

  // Bare ID check
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

export function getDirectDriveDownloadUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

/**
 * Transforms a raw video filename into a clean, human topic for the AI copy generator.
 * Example: "03_como_criar_automacoes_no_flow_v2.mp4" -> "Como criar automacoes no flow"
 */
export function cleanFilenameToTopic(filename: string): string {
  let name = filename.trim();

  // 1. Remove common video extensions
  name = name.replace(/\.(mp4|mov|mkv|webm|avi|m4v|flv)$/i, "");

  // 2. Remove leading episode/number prefixes: "01 - ", "01_", "1. ", "Aula 01 - ", "Ep 2 - "
  name = name.replace(/^(aula\s*\d+|ep\s*\d+|epis[oó]dio\s*\d+|\d+)[\s._-]+/i, "");

  // 3. Remove common trailing suffixes like "_v2", "_final", "_1080p", "_720p", "_reels", "_hd"
  name = name.replace(/[._-](v\d+|final|1080p|720p|reels|hd|render|copy)$/i, "");

  // 4. Replace underscores, hyphens and dots with spaces
  name = name.replace(/[._-]+/g, " ");

  // 5. Clean up multiple spaces
  name = name.replace(/\s+/g, " ").trim();

  // 6. Capitalize first letter
  if (name.length > 0) {
    name = name.charAt(0).toUpperCase() + name.slice(1);
  }

  return name || filename;
}

export interface DriveFolderFile {
  id: string;
  name: string;
  size?: number;
  mimeType?: string;
}

/**
 * Lists video files in a Google Drive folder using Google Drive API v3.
 * Folder must have "Anyone with the link can view" permissions.
 */
export async function listDriveFolderVideos(
  folderId: string,
  apiKey: string
): Promise<DriveFolderFile[]> {
  const cleanId = extractDriveFolderId(folderId);
  if (!cleanId) throw new Error("ID da pasta do Google Drive não informado ou inválido.");
  if (!apiKey) throw new Error("Chave de API do Google necessária para listar a pasta.");

  // Query: parent is folderId and not in trash
  const query = encodeURIComponent(`'${cleanId}' in parents and trashed = false`);
  const fields = encodeURIComponent("files(id,name,mimeType,size,createdTime)");
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&orderBy=name&pageSize=100&key=${apiKey}`;

  const res = await fetch(url, {
    method: "GET",
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    let cleanErr = errText;
    try {
      const parsed = JSON.parse(errText);
      cleanErr = parsed?.error?.message || errText;
    } catch {}
    throw new Error(`Google Drive API (${res.status}): ${cleanErr}`);
  }

  const data = await res.json();
  const rawFiles: Array<{ id: string; name: string; mimeType?: string; size?: string }> =
    data?.files || [];

  // Filter video files
  const videoFiles = rawFiles.filter((f) => {
    const isVideoMime = f.mimeType?.startsWith("video/");
    const hasVideoExt = /\.(mp4|mov|mkv|webm|avi|m4v)$/i.test(f.name);
    return isVideoMime || hasVideoExt;
  });

  return videoFiles.map((f) => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    size: f.size ? parseInt(f.size, 10) : undefined,
  }));
}
