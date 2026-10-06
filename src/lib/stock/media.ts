import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/server";

export interface StockKeys {
  pexelsApiKey: string;
  pixabayApiKey: string;
  stockProvider: "pexels" | "pixabay" | "any";
}

export async function getStockKeys(): Promise<StockKeys> {
  let pexelsFromDb = "";
  let pixabayFromDb = "";
  let stockProviderFromDb: "pexels" | "pixabay" | "any" = "any";

  try {
    const db = supabaseAdmin();
    const { data } = await db
      .from("app_settings")
      .select("pexels_api_key, pixabay_api_key, stock_provider")
      .eq("id", 1)
      .maybeSingle();

    if (data) {
      if (typeof data.pexels_api_key === "string") pexelsFromDb = data.pexels_api_key.trim();
      if (typeof data.pixabay_api_key === "string") pixabayFromDb = data.pixabay_api_key.trim();
      if (data.stock_provider) stockProviderFromDb = data.stock_provider;
    }
  } catch {
    // If table column not ready, fallback to env
  }

  const pexelsApiKey = pexelsFromDb || env.pexelsApiKey || "";
  const pixabayApiKey =
    pixabayFromDb ||
    env.pixabayApiKey ||
    "";

  return {
    pexelsApiKey,
    pixabayApiKey,
    stockProvider: stockProviderFromDb,
  };
}

/* ---------------------------------------------------------------- PHOTOS */

async function fetchPexelsPhoto(query: string, apiKey: string): Promise<Blob> {
  const searchUrl = `https://api.pexels.com/v1/search?${new URLSearchParams({
    query,
    orientation: "square",
    per_page: "15",
  })}`;

  const res = await fetch(searchUrl, {
    headers: { Authorization: apiKey },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) throw new Error(`Pexels photo search failed (${res.status})`);
  const data = await res.json();
  const photos = data.photos ?? [];
  if (photos.length === 0) throw new Error(`Nenhuma foto encontrada no Pexels para: "${query}"`);

  const chosen = photos[Math.floor(Math.random() * photos.length)];
  const downloadUrl = chosen.src?.large2x || chosen.src?.large || chosen.src?.original;
  if (!downloadUrl) throw new Error("URL da foto Pexels não encontrada");

  const imageRes = await fetch(downloadUrl, { signal: AbortSignal.timeout(20_000) });
  if (!imageRes.ok) throw new Error("Falha ao baixar foto do Pexels");
  return imageRes.blob();
}

async function fetchPixabayPhoto(query: string, apiKey: string): Promise<Blob> {
  const searchUrl = `https://pixabay.com/api/?${new URLSearchParams({
    key: apiKey,
    q: query,
    image_type: "photo",
    per_page: "15",
    safesearch: "true",
  })}`;

  const res = await fetch(searchUrl, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Pixabay photo search failed (${res.status})`);
  const data = await res.json();
  const hits = data.hits ?? [];
  if (hits.length === 0) throw new Error(`Nenhuma foto encontrada no Pixabay para: "${query}"`);

  const chosen = hits[Math.floor(Math.random() * hits.length)];
  const downloadUrl = chosen.largeImageURL || chosen.webformatURL;
  if (!downloadUrl) throw new Error("URL da foto Pixabay não encontrada");

  const imageRes = await fetch(downloadUrl, { signal: AbortSignal.timeout(20_000) });
  if (!imageRes.ok) throw new Error("Falha ao baixar foto do Pixabay");
  return imageRes.blob();
}

export async function fetchStockPhoto(
  query: string,
  preferred?: "pexels" | "pixabay" | "any"
): Promise<{ blob: Blob; provider: "pexels" | "pixabay" }> {
  const keys = await getStockKeys();
  const targetProvider = preferred || keys.stockProvider;

  const tryPexels = async () => {
    if (!keys.pexelsApiKey) throw new Error("PEXELS_API_KEY não configurada");
    return { blob: await fetchPexelsPhoto(query, keys.pexelsApiKey), provider: "pexels" as const };
  };

  const tryPixabay = async () => {
    if (!keys.pixabayApiKey) throw new Error("PIXABAY_API_KEY não configurada");
    return { blob: await fetchPixabayPhoto(query, keys.pixabayApiKey), provider: "pixabay" as const };
  };

  if (targetProvider === "pexels") {
    try {
      return await tryPexels();
    } catch (err) {
      if (keys.pixabayApiKey) return await tryPixabay();
      throw err;
    }
  }

  if (targetProvider === "pixabay") {
    try {
      return await tryPixabay();
    } catch (err) {
      if (keys.pexelsApiKey) return await tryPexels();
      throw err;
    }
  }

  // "any": try whichever is available
  if (keys.pexelsApiKey && keys.pixabayApiKey) {
    // Random balance between both
    const first = Math.random() < 0.5 ? tryPexels : tryPixabay;
    const second = first === tryPexels ? tryPixabay : tryPexels;
    try {
      return await first();
    } catch {
      return await second();
    }
  }

  if (keys.pexelsApiKey) return await tryPexels();
  if (keys.pixabayApiKey) return await tryPixabay();

  throw new Error("Configure PEXELS_API_KEY ou PIXABAY_API_KEY nas Configurações para usar fotos de stock.");
}

/* ---------------------------------------------------------------- VIDEOS */

async function fetchPexelsVideo(query: string, apiKey: string): Promise<{ videoUrl: string; previewUrl?: string }> {
  const searchUrl = `https://api.pexels.com/videos/search?${new URLSearchParams({
    query,
    per_page: "15",
  })}`;

  const res = await fetch(searchUrl, {
    headers: { Authorization: apiKey },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) throw new Error(`Pexels video search failed (${res.status})`);
  const data = await res.json();
  const videos = data.videos ?? [];
  if (videos.length === 0) throw new Error(`Nenhum vídeo encontrado no Pexels para: "${query}"`);

  const chosen = videos[Math.floor(Math.random() * videos.length)];
  const files: Array<{ file_type?: string; link: string; quality?: string; width?: number }> =
    chosen.video_files ?? [];

  // Filter for MP4 and pick an optimal HD or SD resolution
  const mp4Files = files.filter((f) => !f.file_type || f.file_type === "video/mp4");
  const selectedFile =
    mp4Files.find((f) => f.quality === "hd" && (f.width ?? 0) <= 1920) ||
    mp4Files.find((f) => f.quality === "sd") ||
    mp4Files[0] ||
    files[0];

  if (!selectedFile?.link) throw new Error("Arquivo MP4 do vídeo Pexels não encontrado");

  return {
    videoUrl: selectedFile.link,
    previewUrl: chosen.image,
  };
}

async function fetchPixabayVideo(query: string, apiKey: string): Promise<{ videoUrl: string; previewUrl?: string }> {
  const searchUrl = `https://pixabay.com/api/videos/?${new URLSearchParams({
    key: apiKey,
    q: query,
    per_page: "15",
    safesearch: "true",
  })}`;

  const res = await fetch(searchUrl, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Pixabay video search failed (${res.status})`);
  const data = await res.json();
  const hits = data.hits ?? [];
  if (hits.length === 0) throw new Error(`Nenhum vídeo encontrado no Pixabay para: "${query}"`);

  const chosen = hits[Math.floor(Math.random() * hits.length)];
  const v = chosen.videos;
  const selectedUrl = v?.medium?.url || v?.large?.url || v?.small?.url || v?.tiny?.url;

  if (!selectedUrl) throw new Error("Arquivo MP4 do vídeo Pixabay não encontrado");

  return {
    videoUrl: selectedUrl,
    previewUrl: chosen.picture_id ? `https://i.vimeocdn.com/video/${chosen.picture_id}_640x360.jpg` : undefined,
  };
}

export async function fetchStockVideo(
  query: string,
  preferred?: "pexels" | "pixabay" | "any"
): Promise<{ videoUrl: string; previewUrl?: string; provider: "pexels" | "pixabay" }> {
  const keys = await getStockKeys();
  const targetProvider = preferred || keys.stockProvider;

  const tryPexels = async () => {
    if (!keys.pexelsApiKey) throw new Error("PEXELS_API_KEY não configurada");
    const result = await fetchPexelsVideo(query, keys.pexelsApiKey);
    return { ...result, provider: "pexels" as const };
  };

  const tryPixabay = async () => {
    if (!keys.pixabayApiKey) throw new Error("PIXABAY_API_KEY não configurada");
    const result = await fetchPixabayVideo(query, keys.pixabayApiKey);
    return { ...result, provider: "pixabay" as const };
  };

  if (targetProvider === "pexels") {
    try {
      return await tryPexels();
    } catch (err) {
      if (keys.pixabayApiKey) return await tryPixabay();
      throw err;
    }
  }

  if (targetProvider === "pixabay") {
    try {
      return await tryPixabay();
    } catch (err) {
      if (keys.pexelsApiKey) return await tryPexels();
      throw err;
    }
  }

  // "any": try whichever is available
  if (keys.pexelsApiKey && keys.pixabayApiKey) {
    const first = Math.random() < 0.5 ? tryPexels : tryPixabay;
    const second = first === tryPexels ? tryPixabay : tryPexels;
    try {
      return await first();
    } catch {
      return await second();
    }
  }

  if (keys.pexelsApiKey) return await tryPexels();
  if (keys.pixabayApiKey) return await tryPixabay();

  throw new Error("Configure PEXELS_API_KEY ou PIXABAY_API_KEY nas Configurações para usar vídeos de stock.");
}
