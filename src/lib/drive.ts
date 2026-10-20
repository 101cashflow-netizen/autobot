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

  // Check for ?folderId=<id>, &folderId=<id>, ?id=<id>, &id=<id>
  const paramMatch = trimmed.match(/[?&](?:folderId|id)=([a-zA-Z0-9_-]+)/i);
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
 * Generates direct image CDN URL for Google Drive public files.
 * Provides high-speed image delivery for web feeds and previews.
 */
export function getDirectDriveImageUrl(fileId: string): string {
  return `https://lh3.googleusercontent.com/d/${fileId}`;
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

/**
 * Transforms a raw image filename into a clean, human topic for the AI copy generator.
 * Example: "04_dicas_de_produtividade_no_trabalho_flux.png" -> "Dicas de produtividade no trabalho"
 */
export function cleanImageFilenameToTopic(filename: string): string {
  let name = filename.trim();

  // 1. Remove common image extensions
  name = name.replace(/\.(jpe?g|png|webp|gif|bmp|tiff|svg)$/i, "");

  // 2. Remove leading episode/number prefixes: "01 - ", "01_", "1. ", "Foto 01 - ", "Img 02 - "
  name = name.replace(/^(foto\s*\d+|img\s*\d+|imagem\s*\d+|batch\s*\d+|post\s*\d+|\d+)[\s._-]+/i, "");

  // 3. Remove common trailing suffixes like "_v2", "_final", "_1080p", "_flux", "_sdxl", "_upscaled", "_hd"
  name = name.replace(/[._-](v\d+|final|1080p|720p|flux|sdxl|upscaled|hd|render|copy|preview)$/i, "");

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

export interface ParsedVideoLink {
  id: string;
  title?: string;
  originalInput: string;
}

export type ParsedImageLink = ParsedVideoLink;

/**
 * Parses user-provided text containing Google Drive image links.
 * Accepts multiple links (one per line or separated by space/commas),
 * optionally with a custom title on the same line.
 */
export function parseDriveImageLinks(text: string): ParsedImageLink[] {
  return parseDriveVideoLinks(text);
}

/**
 * Parses user-provided text containing Google Drive video links.
 * Accepts multiple links (one per line or separated by space/commas),
 * optionally with a custom title on the same line.
 */
export function parseDriveVideoLinks(text: string): ParsedVideoLink[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const results: ParsedVideoLink[] = [];
  const seenIds = new Set<string>();

  for (const line of lines) {
    const words = line.split(/\s+/);
    let matchedId: string | null = null;
    const customTitleWords: string[] = [];

    for (let i = 0; i < words.length; i++) {
      const id = extractDriveFileId(words[i]);
      if (id && !matchedId) {
        matchedId = id;
      } else {
        customTitleWords.push(words[i]);
      }
    }

    if (matchedId && !seenIds.has(matchedId)) {
      seenIds.add(matchedId);
      const customTitle = customTitleWords.join(" ").trim();
      results.push({
        id: matchedId,
        title: customTitle || undefined,
        originalInput: line,
      });
    }
  }

  // Fallback: search regex for file IDs or URLs in case of unusual delimiters
  if (results.length === 0) {
    const urlMatches = text.match(/https?:\/\/[^\s"'<>]+/g) || [];
    for (const url of urlMatches) {
      const id = extractDriveFileId(url);
      if (id && !seenIds.has(id)) {
        seenIds.add(id);
        results.push({
          id,
          originalInput: url,
        });
      }
    }
  }

  return results;
}

/**
 * Attempts to retrieve public file metadata (name, size) via Google Drive API v3.
 * Works with API Key when the file is shared as "Anyone with the link can view".
 */
export async function fetchDriveFileMetadata(
  fileId: string,
  apiKey?: string | null
): Promise<{ id: string; name?: string; size?: number; mimeType?: string } | null> {
  if (!apiKey) return null;
  try {
    const fields = encodeURIComponent("id,name,size,mimeType");
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?key=${apiKey}&fields=${fields}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      return {
        id: data.id,
        name: data.name,
        size: data.size ? parseInt(data.size, 10) : undefined,
        mimeType: data.mimeType,
      };
    }
  } catch {}
  return null;
}

export interface DriveFolderFile {
  id: string;
  name: string;
  size?: number;
  mimeType?: string;
}

/**
 * Lists video files using a Google Apps Script Web App.
 * Free, requires zero Google Cloud OAuth verification, and bypasses Google's API key restriction.
 */
export async function listDriveFolderViaAppsScript(
  scriptUrl: string,
  folderId?: string
): Promise<DriveFolderFile[]> {
  const url = new URL(scriptUrl.trim());
  const existingFolderId = url.searchParams.get("folderId") || url.searchParams.get("id");
  if (existingFolderId) {
    url.searchParams.set("folderId", extractDriveFolderId(existingFolderId));
  } else if (folderId && !folderId.includes("script.google.com")) {
    url.searchParams.set("folderId", extractDriveFolderId(folderId));
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    signal: AbortSignal.timeout(15000),
    redirect: "follow",
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    if (
      res.status === 403 ||
      res.status === 401 ||
      errText.includes("Acesso negado") ||
      errText.includes("Você precisa ter acesso")
    ) {
      throw new Error(
        "Acesso Negado (Erro 403) no Google Apps Script: o script não está com acesso público. No editor do Google Apps Script (script.google.com), clique no botão azul 'Implantar' > 'Gerenciar implantações' > clique no ícone de lápis (Editar) > em 'Quem tem acesso' (Who has access), altere de 'Apenas eu' para 'Qualquer pessoa' (Anyone), selecione 'Nova versão' e clique em 'Implantar'."
      );
    }
    const cleanErr = errText.startsWith("<") ? `HTTP ${res.status}` : errText;
    throw new Error(`Google Apps Script retornou erro (${res.status}): ${cleanErr}`);
  }
  const data = await res.json();
  if (data?.error) {
    if (/Missing folderId parameter/i.test(data.error)) {
      throw new Error(
        "O Apps Script precisa saber qual pasta ler. Adicione ?folderId=ID_DA_PASTA no final da URL do Apps Script (ex: https://script.google.com/.../exec?folderId=1a2B3c...)."
      );
    }
    throw new Error(`Erro do Google Apps Script: ${data.error}`);
  }
  const rawFiles: Array<{ id: string; name: string; mimeType?: string; size?: string | number }> =
    data?.files || (Array.isArray(data) ? data : []);

  return rawFiles.map((f) => ({
    id: f.id,
    name: f.name || `Vídeo ${f.id.slice(0, 6)}`,
    size: f.size ? Number(f.size) : undefined,
    mimeType: f.mimeType,
  }));
}

/**
 * Lists video files in a Google Drive folder using Google Drive API v3 or Apps Script.
 * Folder must have "Anyone with the link can view" permissions.
 */
export async function listDriveFolderVideos(
  folderInput: string,
  apiKey?: string,
  appsScriptUrl?: string
): Promise<DriveFolderFile[]> {
  const trimmedFolder = folderInput.trim();
  const trimmedScript = (appsScriptUrl || "").trim();

  // If a Google Apps Script URL is configured or provided
  const activeScriptUrl = trimmedScript.includes("script.google.com/macros/s/")
    ? trimmedScript
    : trimmedFolder.includes("script.google.com/macros/s/")
      ? trimmedFolder
      : null;

  if (activeScriptUrl) {
    const targetFolderId = !trimmedFolder.includes("script.google.com/macros/s/")
      ? trimmedFolder
      : undefined;
    return listDriveFolderViaAppsScript(activeScriptUrl, targetFolderId);
  }

  const cleanId = extractDriveFolderId(trimmedFolder);
  if (!cleanId) throw new Error("ID da pasta do Google Drive não informado ou inválido.");
  if (!apiKey) {
    throw new Error(
      "Chave de API do Google não configurada. Configure o Google Apps Script ou salve uma chave de API nas Configurações."
    );
  }

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

    if (res.status === 401 && /API keys are not supported/i.test(cleanErr)) {
      throw new Error(
        "O Google Drive bloqueou a leitura de pastas por chave de API (requer OAuth2 ou Service Account). Você pode adicionar seus vídeos clicando no botão 'Adicionar Vídeos (Colar Links)' ou usando a URL do Google Apps Script."
      );
    }

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

/**
 * Lists image files using a Google Apps Script Web App.
 */
export async function listDriveFolderImagesViaAppsScript(
  scriptUrl: string,
  folderId?: string
): Promise<DriveFolderFile[]> {
  const url = new URL(scriptUrl.trim());
  const existingFolderId = url.searchParams.get("folderId") || url.searchParams.get("id");
  if (existingFolderId) {
    url.searchParams.set("folderId", extractDriveFolderId(existingFolderId));
  } else if (folderId && !folderId.includes("script.google.com")) {
    url.searchParams.set("folderId", extractDriveFolderId(folderId));
  }

  // Ask script for images specifically if supported
  if (!url.searchParams.has("type")) {
    url.searchParams.set("type", "image");
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    signal: AbortSignal.timeout(15000),
    redirect: "follow",
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    if (
      res.status === 403 ||
      res.status === 401 ||
      errText.includes("Acesso negado") ||
      errText.includes("Você precisa ter acesso")
    ) {
      throw new Error(
        "Acesso Negado (Erro 403) no Google Apps Script: o script não está com acesso público. No editor do Google Apps Script (script.google.com), clique no botão azul 'Implantar' > 'Gerenciar implantações' > clique no ícone de lápis (Editar) > em 'Quem tem acesso' (Who has access), altere de 'Apenas eu' para 'Qualquer pessoa' (Anyone), selecione 'Nova versão' e clique em 'Implantar'."
      );
    }
    const cleanErr = errText.startsWith("<") ? `HTTP ${res.status}` : errText;
    throw new Error(`Google Apps Script retornou erro (${res.status}): ${cleanErr}`);
  }
  const data = await res.json();
  if (data?.error) {
    if (/Missing folderId parameter/i.test(data.error)) {
      throw new Error(
        "O Apps Script precisa saber qual pasta ler. Adicione ?folderId=ID_DA_PASTA no final da URL do Apps Script."
      );
    }
    throw new Error(`Erro do Google Apps Script: ${data.error}`);
  }
  const rawFiles: Array<{ id: string; name: string; mimeType?: string; size?: string | number }> =
    data?.files || (Array.isArray(data) ? data : []);

  // Filter image files (in case the script returned all files)
  const imageFiles = rawFiles.filter((f) => {
    const isImageMime = f.mimeType?.startsWith("image/");
    const hasImageExt = /\.(jpe?g|png|webp|gif|bmp|tiff|svg)$/i.test(f.name || "");
    // If mimeType is unknown, check extension or accept if listed
    return isImageMime || hasImageExt || !f.mimeType?.startsWith("video/");
  });

  return imageFiles.map((f) => ({
    id: f.id,
    name: f.name || `Imagem ${f.id.slice(0, 6)}`,
    size: f.size ? Number(f.size) : undefined,
    mimeType: f.mimeType,
  }));
}

/**
 * Lists image files in a Google Drive folder using Google Drive API v3 or Apps Script.
 * Folder must have "Anyone with the link can view" permissions.
 */
export async function listDriveFolderImages(
  folderInput: string,
  apiKey?: string,
  appsScriptUrl?: string
): Promise<DriveFolderFile[]> {
  const trimmedFolder = folderInput.trim();
  const trimmedScript = (appsScriptUrl || "").trim();

  const activeScriptUrl = trimmedScript.includes("script.google.com/macros/s/")
    ? trimmedScript
    : trimmedFolder.includes("script.google.com/macros/s/")
      ? trimmedFolder
      : null;

  if (activeScriptUrl) {
    const targetFolderId = !trimmedFolder.includes("script.google.com/macros/s/")
      ? trimmedFolder
      : undefined;
    return listDriveFolderImagesViaAppsScript(activeScriptUrl, targetFolderId);
  }

  const cleanId = extractDriveFolderId(trimmedFolder);
  if (!cleanId) throw new Error("ID da pasta do Google Drive não informado ou inválido.");
  if (!apiKey) {
    throw new Error(
      "Chave de API do Google não configurada. Configure o Google Apps Script ou salve uma chave de API nas Configurações."
    );
  }

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

    if (res.status === 401 && /API keys are not supported/i.test(cleanErr)) {
      throw new Error(
        "O Google Drive bloqueou a leitura de pastas por chave de API (requer OAuth2 ou Service Account). Você pode adicionar suas imagens clicando no botão 'Adicionar Imagens (Colar Links)' ou usando a URL do Google Apps Script."
      );
    }

    throw new Error(`Google Drive API (${res.status}): ${cleanErr}`);
  }

  const data = await res.json();
  const rawFiles: Array<{ id: string; name: string; mimeType?: string; size?: string }> =
    data?.files || [];

  const imageFiles = rawFiles.filter((f) => {
    const isImageMime = f.mimeType?.startsWith("image/");
    const hasImageExt = /\.(jpe?g|png|webp|gif|bmp|tiff|svg)$/i.test(f.name);
    return isImageMime || hasImageExt;
  });

  return imageFiles.map((f) => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    size: f.size ? parseInt(f.size, 10) : undefined,
  }));
}
