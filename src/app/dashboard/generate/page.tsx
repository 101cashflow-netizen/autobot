"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Sparkle,
  ArrowClockwise,
  FloppyDisk,
  Rocket,
  CalendarPlus,
  X,
  WarningCircle,
  CheckCircle,
  ArrowSquareOut,
  VideoCamera,
  Article,
  Folder,
  Images,
  MagnifyingGlass,
} from "@phosphor-icons/react/dist/ssr";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { facebookPostUrl } from "@/lib/types";
import type {
  CopyLanguage,
  CopyLength,
  CopyTone,
  GeneratedContent,
  ImageLibraryItem,
  ImageSource,
  ImageSourcePref,
  MediaType,
  PageCache,
  StockProvider,
  TextAiProviderPref,
} from "@/lib/types";

type Step = "idle" | "generating" | "ready";

export default function GeneratePage() {
  const [topic, setTopic] = useState("");
  const [mediaType, setMediaType] = useState<MediaType>("image");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [ownTopics, setOwnTopics] = useState<string[]>([]);
  const [imagePref, setImagePref] = useState<ImageSourcePref>("ai");
  const [copyAiPref, setCopyAiPref] = useState<TextAiProviderPref>("auto");
  const [copyLang, setCopyLang] = useState<CopyLanguage>("auto");
  const [copyLength, setCopyLength] = useState<CopyLength>("medium");
  const [copyTone, setCopyTone] = useState<CopyTone>("conversational");
  const [copyCustomRules, setCopyCustomRules] = useState<string>("");
  const [showGuidelines, setShowGuidelines] = useState(false);
  const [avatarName, setAvatarName] = useState<string | null>("Nasha");

  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [regeneratingText, setRegeneratingText] = useState(false);
  const [regeneratingMedia, setRegeneratingMedia] = useState(false);

  const [content, setContent] = useState<GeneratedContent | null>(null);
  const [image, setImage] = useState<{ url: string; source: ImageSource } | null>(null);
  const [imageHint, setImageHint] = useState<string | null>(null);
  const [video, setVideo] = useState<{
    url: string;
    previewUrl?: string;
    source: StockProvider;
    duration?: number;
  } | null>(null);
  const [hashtagInput, setHashtagInput] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  const [pages, setPages] = useState<PageCache[]>([]);
  const [selectedPageIds, setSelectedPageIds] = useState<string[]>([]);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [saving, setSaving] = useState<"draft" | "schedule" | "post_now" | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);

  // Google Drive synced images integration
  const [imageOrigin, setImageOrigin] = useState<"ai_stock" | "drive">("ai_stock");
  const [selectedDriveImage, setSelectedDriveImage] = useState<ImageLibraryItem | null>(null);
  const [driveImages, setDriveImages] = useState<ImageLibraryItem[]>([]);
  const [loadingDriveImages, setLoadingDriveImages] = useState(false);
  const [drivePickerOpen, setDrivePickerOpen] = useState(false);
  const [driveSearch, setDriveSearch] = useState("");

  async function loadDriveImages() {
    setLoadingDriveImages(true);
    try {
      const res = await fetch("/api/batch-images");
      const data = await res.json();
      setDriveImages(data.images ?? []);
    } catch {} finally {
      setLoadingDriveImages(false);
    }
  }

  function handleSelectDriveImage(item: ImageLibraryItem) {
    setSelectedDriveImage(item);
    setTopic(item.title);
    setImageOrigin("drive");
    setMediaType("image");
    setDrivePickerOpen(false);
  }

  useEffect(() => {
    // Arriving from the Topics screen's "write now" link. Read directly rather
    // than through useSearchParams, which would force a Suspense boundary
    // around the whole form for one optional value.
    const fromLink = new URLSearchParams(window.location.search).get("topic");
    if (fromLink) setTopic(fromLink);

    const driveImageId = new URLSearchParams(window.location.search).get("driveImageId");
    if (driveImageId) {
      fetch("/api/batch-images")
        .then((r) => r.json())
        .then((d) => {
          const found = (d.images ?? []).find((i: ImageLibraryItem) => i.id === driveImageId);
          if (found) {
            setSelectedDriveImage(found);
            setImageOrigin("drive");
            setMediaType("image");
            setTopic(found.title);
          }
        })
        .catch(() => {});
    }

    fetch("/api/topics")
      .then((r) => r.json())
      .then((d) =>
        setOwnTopics(
          (d.topics ?? [])
            .filter((t: { enabled: boolean }) => t.enabled)
            .map((t: { text: string }) => t.text)
        )
      )
      .catch(() => {});

    fetch("/api/trends")
      .then((r) => r.json())
      .then((d) => setSuggestions(d.topics ?? []))
      .catch(() => {});

    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        setImagePref(d.image_source ?? "ai");
        if (d.text_provider_pref) setCopyAiPref(d.text_provider_pref);
        if (d.copy_language) setCopyLang(d.copy_language);
        if (d.copy_length) setCopyLength(d.copy_length);
        if (d.copy_tone) setCopyTone(d.copy_tone);
        if (d.copy_custom_rules) setCopyCustomRules(d.copy_custom_rules);
        if (d.avatar_enabled !== false) {
          setAvatarName(d.avatar_name || "Nasha");
        } else {
          setAvatarName(null);
        }
      })
      .catch(() => {});

    fetch("/api/facebook/pages")
      .then((r) => r.json())
      .then((d) => {
        const loaded: PageCache[] = d.pages ?? [];
        setPages(loaded);
        if (d.defaultPageId) {
          setSelectedPageIds([d.defaultPageId]);
        } else if (loaded.length > 0) {
          setSelectedPageIds([loaded[0].page_id]);
        }
      })
      .catch(() => {});
  }, []);

  const selectedPageNames = useMemo(
    () => pages.filter((p) => selectedPageIds.includes(p.page_id)).map((p) => p.name),
    [pages, selectedPageIds]
  );

  async function generate() {
    if (topic.trim().length < 2) {
      setError("Enter a topic first — at least a couple of words.");
      return;
    }
    setError(null);
    setSuccess(null);
    setPublishedUrl(null);
    setStep("generating");
    setContent(null);
    setImage(null);
    setVideo(null);
    setImageHint(null);

    try {
      const copyPayload = {
        topic,
        provider: copyAiPref,
        language: copyLang,
        length: copyLength,
        tone: copyTone,
        customRules: copyCustomRules,
      };

      if (mediaType === "text") {
        const contentRes = await fetch("/api/generate/content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(copyPayload),
        });

        if (!contentRes.ok) throw new Error((await contentRes.json()).error ?? "Falha ao gerar o texto.");

        const contentData: GeneratedContent = await contentRes.json();
        setContent(contentData);
        setImage(null);
        setVideo(null);
        setStep("ready");
      } else if (mediaType === "video") {
        const [contentRes, videoRes] = await Promise.all([
          fetch("/api/generate/content", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(copyPayload),
          }),
          fetch("/api/generate/video", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: topic }),
          }),
        ]);

        if (!contentRes.ok) throw new Error((await contentRes.json()).error ?? "Falha ao gerar o texto.");
        if (!videoRes.ok) throw new Error((await videoRes.json()).error ?? "Falha ao buscar vídeo no Pexels/Pixabay.");

        const contentData: GeneratedContent = await contentRes.json();
        const rawVideo = await videoRes.json();
        const videoData = {
          url: rawVideo.url || rawVideo.videoUrl || "",
          previewUrl: rawVideo.previewUrl,
          source: (rawVideo.source || rawVideo.provider || "pexels") as StockProvider,
          duration: rawVideo.duration,
        };

        setContent(contentData);
        setVideo(videoData);
        setImage({ url: videoData.previewUrl || videoData.url, source: "stock" });
        setStep("ready");
      } else if (mediaType === "image" && imageOrigin === "drive") {
        if (!selectedDriveImage) {
          setError("Selecione uma imagem da sua pasta sincronizada do Drive antes de gerar.");
          setStep("idle");
          return;
        }

        const contentRes = await fetch("/api/generate/content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(copyPayload),
        });

        if (!contentRes.ok) throw new Error((await contentRes.json()).error ?? "Falha ao gerar o texto.");

        const contentData: GeneratedContent = await contentRes.json();
        setContent(contentData);
        setImage({
          url: selectedDriveImage.image_url,
          source: "drive",
        });
        setVideo(null);
        setStep("ready");
      } else {
        const [contentRes, imageRes] = await Promise.all([
          fetch("/api/generate/content", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(copyPayload),
          }),
          fetch("/api/generate/image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: topic, source: imagePref }),
          }),
        ]);

        if (!contentRes.ok) throw new Error((await contentRes.json()).error ?? "Falha ao gerar o texto.");
        if (!imageRes.ok) throw new Error((await imageRes.json()).error ?? "Falha ao gerar a imagem.");

        const contentData: GeneratedContent = await contentRes.json();
        const imageData: { url: string; source: ImageSource; errorHint?: string } = await imageRes.json();

        setContent(contentData);
        setImage(imageData);
        setImageHint(imageData.errorHint ?? null);
        setStep("ready");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStep("idle");
    }
  }

  async function regenerateText() {
    if (!topic.trim()) return;
    setError(null);
    setRegeneratingText(true);
    try {
      const res = await fetch("/api/generate/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          provider: copyAiPref,
          language: copyLang,
          length: copyLength,
          tone: copyTone,
          customRules: copyCustomRules,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Erro ao regenerar texto.");
      const data: GeneratedContent = await res.json();
      setContent(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao regenerar texto.");
    } finally {
      setRegeneratingText(false);
    }
  }

  async function regenerateMedia() {
    if (!topic.trim()) return;
    setError(null);
    setRegeneratingMedia(true);
    try {
      if (mediaType === "image" && imageOrigin === "drive") {
        loadDriveImages();
        setDrivePickerOpen(true);
        setRegeneratingMedia(false);
        return;
      }

      if (mediaType === "video") {
        const res = await fetch("/api/generate/video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: topic }),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "Erro ao buscar outro vídeo.");
        const rawVideo = await res.json();
        const videoData = {
          url: rawVideo.url || rawVideo.videoUrl || "",
          previewUrl: rawVideo.previewUrl,
          source: (rawVideo.source || rawVideo.provider || "pexels") as StockProvider,
          duration: rawVideo.duration,
        };
        setVideo(videoData);
        setImage({ url: videoData.previewUrl || videoData.url, source: "stock" });
      } else if (mediaType === "image") {
        const res = await fetch("/api/generate/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: topic, source: imagePref }),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "Erro ao gerar outra imagem.");
        const imageData: { url: string; source: ImageSource; errorHint?: string } = await res.json();
        setImage(imageData);
        setImageHint(imageData.errorHint ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao trocar mídia.");
    } finally {
      setRegeneratingMedia(false);
    }
  }

  function removeHashtag(tag: string) {
    if (!content) return;
    setContent({ ...content, hashtags: content.hashtags.filter((h) => h !== tag) });
  }

  function addHashtag() {
    const tag = hashtagInput.trim().replace(/^#/, "").toLowerCase();
    if (!tag || !content || content.hashtags.includes(tag)) return;
    setContent({ ...content, hashtags: [...content.hashtags, tag] });
    setHashtagInput("");
  }

  async function save(action: "draft" | "schedule" | "post_now") {
    if (!content || (mediaType !== "text" && !image && !video)) return;
    if (action !== "draft" && selectedPageIds.length === 0) {
      setError("Selecione ao menos uma Página antes de agendar ou publicar.");
      return;
    }
    if (action === "schedule" && !scheduledAt) {
      setError("Pick a date and time to schedule this post.");
      return;
    }

    setError(null);
    setSaving(action);
    try {
      const isVideo = mediaType === "video" && !!video;
      const isText = mediaType === "text";
      const firstPage = pages.find((p) => p.page_id === selectedPageIds[0]);

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          title: content.title,
          description: content.description,
          hashtags: content.hashtags,
          imageUrl: isVideo
            ? video!.previewUrl || video!.url
            : image
              ? image.url
              : "",
          imageSource: isVideo
            ? "stock"
            : image
              ? image.source
              : "ai",
          mediaType: isText ? "text" : isVideo ? "video" : "image",
          mediaUrl: isVideo ? video!.url : undefined,
          linkUrl: linkUrl || undefined,
          pageIds: selectedPageIds,
          pageId: selectedPageIds[0] || "unset",
          pageName: firstPage?.name ?? "Unset",
          action,
          scheduledAt: action === "schedule" ? new Date(scheduledAt).toISOString() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save post.");

      if (action === "post_now") {
        const postsList = data.posts || (data.post ? [data.post] : []);
        const failedPost = postsList.find((p: any) => p.status === "failed");
        if (failedPost) {
          throw new Error(failedPost.error_message ?? "Facebook rejected one or more posts.");
        }
      }

      const totalCount = data.count || (data.posts ? data.posts.length : 1);
      const isMulti = totalCount > 1;

      setSuccess(
        action === "draft"
          ? isMulti
            ? `${totalCount} rascunhos salvos com sucesso.`
            : "Salvo como rascunho."
          : action === "schedule"
            ? isMulti
              ? `${totalCount} posts agendados com sucesso.`
              : "Post agendado com sucesso."
            : isMulti
              ? `Publicado com sucesso em ${totalCount} páginas! 🎉`
              : isVideo
                ? "Vídeo publicado no Facebook 🎉"
                : isText
                  ? "Post de texto publicado no Facebook 🎉"
                  : "Foto publicada no Facebook 🎉"
      );
      setPublishedUrl(
        action === "post_now" && data.post?.facebook_post_id
          ? facebookPostUrl(data.post.facebook_post_id)
          : null
      );
      setStep("idle");
      setContent(null);
      setImage(null);
      setVideo(null);
      setTopic("");
      setScheduleOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save post.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Card>
        <label className="text-sm font-semibold text-foreground">Topic</label>
        <p className="mt-1 text-sm text-muted-foreground">
          What should this post be about? Be specific for better results.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Formato:</span>
            <div className="inline-flex rounded-xl border border-border bg-surface-2 p-0.5">
              <button
                type="button"
                onClick={() => {
                  setMediaType("image");
                  setImageOrigin("ai_stock");
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer",
                  mediaType === "image" && imageOrigin === "ai_stock"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Sparkle size={14} /> Imagem (IA / Stock)
              </button>
              <button
                type="button"
                onClick={() => {
                  setMediaType("image");
                  setImageOrigin("drive");
                  loadDriveImages();
                  if (!selectedDriveImage) {
                    setDrivePickerOpen(true);
                  }
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer",
                  mediaType === "image" && imageOrigin === "drive"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Folder size={14} /> Imagem do Drive
              </button>
              <button
                type="button"
                onClick={() => setMediaType("video")}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer",
                  mediaType === "video"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <VideoCamera size={14} /> Vídeo
              </button>
              <button
                type="button"
                onClick={() => setMediaType("text")}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer",
                  mediaType === "text"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Article size={14} /> Somente Texto
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">IA Redação:</span>
            <select
              value={copyAiPref}
              onChange={(e) => setCopyAiPref(e.target.value as TextAiProviderPref)}
              className="rounded-xl border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary"
              aria-label="IA da Redação"
            >
              <option value="auto">Automático (Gemini &gt; Groq &gt; Pollinations)</option>
              <option value="gemini">Google Gemini</option>
              <option value="groq">Groq (Llama 3)</option>
              <option value="pollinations">Pollinations (Gratuito)</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Idioma:</span>
            <select
              value={copyLang}
              onChange={(e) => setCopyLang(e.target.value as CopyLanguage)}
              className="rounded-xl border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary"
              aria-label="Idioma da Copy"
            >
              <option value="auto">Auto (Detectar do tema)</option>
              <option value="pt">Português (BR)</option>
              <option value="en">Inglês (English)</option>
              <option value="es">Espanhol (Español)</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Tamanho:</span>
            <select
              value={copyLength}
              onChange={(e) => setCopyLength(e.target.value as CopyLength)}
              className="rounded-xl border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary"
              aria-label="Tamanho da Copy"
            >
              <option value="random">🎲 Aleatório</option>
              <option value="short">Curto (1-2 frases)</option>
              <option value="medium">Médio (2-3 frases)</option>
              <option value="long">Longo (até 500 carac.)</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Tom:</span>
            <select
              value={copyTone}
              onChange={(e) => setCopyTone(e.target.value as CopyTone)}
              className="rounded-xl border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary"
              aria-label="Tom de Voz"
            >
              <option value="random">🎲 Aleatório</option>
              <option value="conversational">Conversacional</option>
              <option value="persuasive">Persuasivo / Vendas</option>
              <option value="informative">Informativo / Educativo</option>
              <option value="inspirational">Inspiracional</option>
              <option value="humorous">Divertido</option>
              <option value="professional">Profissional</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => setShowGuidelines((v) => !v)}
            className={cn(
              "rounded-xl border border-border px-2.5 py-1.5 text-xs font-medium transition cursor-pointer",
              showGuidelines || copyCustomRules.trim()
                ? "bg-primary/10 text-primary border-primary/30"
                : "bg-background text-muted-foreground hover:text-foreground"
            )}
            title="Configurar regras personalizadas de redação para este post"
          >
            {showGuidelines ? "Ocultar regras" : "+ Regras extras"}
          </button>
        </div>

        {showGuidelines && (
          <div className="mt-2.5 rounded-xl border border-border/80 bg-surface-2/60 p-3">
            <label className="text-xs font-semibold text-foreground">
              Instruções personalizadas para o Gemini / IA neste post:
            </label>
            <input
              type="text"
              value={copyCustomRules}
              onChange={(e) => setCopyCustomRules(e.target.value)}
              placeholder="Ex: Termine sempre com pergunta instigante; use no máximo 2 emojis; enfatize benefícios..."
              className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-primary"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Essas diretrizes são repassadas ao gerador de copy ao clicar em Gerar ou Regenerar Texto.
            </p>
          </div>
        )}

        {mediaType === "image" && imageOrigin === "ai_stock" && avatarName && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-purple-500/10 px-2.5 py-1 text-xs font-medium text-purple-600 dark:text-purple-400">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-pulse" />
            Avatar IA ativo: {avatarName} (consistência de personagem ligada)
          </div>
        )}

        {mediaType === "image" && imageOrigin === "drive" && (
          <div className="mt-3 rounded-xl border border-primary/30 bg-primary/5 p-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              {selectedDriveImage ? (
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-black/10">
                    <img
                      src={`https://lh3.googleusercontent.com/d/${selectedDriveImage.drive_file_id}`}
                      alt={selectedDriveImage.title}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://drive.google.com/uc?export=download&id=${selectedDriveImage.drive_file_id}`;
                      }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-foreground truncate">
                        {selectedDriveImage.title}
                      </span>
                      <Badge className="text-[10px] py-0 px-1.5">Google Drive</Badge>
                    </div>
                    <p className="text-[11px] font-mono text-muted-foreground truncate">
                      {selectedDriveImage.raw_filename}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Folder size={18} className="text-primary shrink-0" />
                  <span>Nenhuma imagem selecionada da sua pasta sincronizada do Drive.</span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    loadDriveImages();
                    setDrivePickerOpen(true);
                  }}
                  className="text-xs h-8"
                >
                  <Images size={14} className="mr-1" />
                  {selectedDriveImage ? "Trocar Imagem" : "Escolher Imagem do Drive"}
                </Button>
                {selectedDriveImage && (
                  <button
                    type="button"
                    onClick={() => setSelectedDriveImage(null)}
                    className="p-1 text-muted-foreground hover:text-foreground text-xs"
                    title="Remover seleção"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {mediaType === "video" && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Busca de vídeo em HD no Pexels e Pixabay (publicação direta no Facebook sem timeout)
          </div>
        )}

        {mediaType === "text" && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-600 dark:text-blue-400">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            Publicação de status somente texto no feed do Facebook (sem foto ou vídeo anexado)
          </div>
        )}

        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && generate()}
            placeholder={
              mediaType === "video"
                ? "Ex: pessoa relaxando na praia ao pôr do sol..."
                : mediaType === "text"
                  ? "Ex: pensamentos sobre disciplina e sucesso nos negócios..."
                  : imageOrigin === "drive"
                    ? "Título ou tema da imagem selecionada do Drive..."
                    : "e.g. cozy fall living room decor ideas"
            }
            className="flex-1 rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
          {mediaType === "image" && imageOrigin === "ai_stock" && (
            <select
              value={imagePref}
              onChange={(e) => setImagePref(e.target.value as ImageSourcePref)}
              className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
              aria-label="Image source"
            >
              <option value="ai">AI-generated image</option>
              <option value="stock">Free stock photo</option>
              <option value="mixed">Mix of both</option>
            </select>
          )}
          <Button onClick={generate} disabled={step === "generating"}>
            {mediaType === "video" ? (
              <VideoCamera size={16} weight="fill" />
            ) : mediaType === "text" ? (
              <Article size={16} weight="fill" />
            ) : imageOrigin === "drive" ? (
              <Folder size={16} weight="fill" />
            ) : (
              <Sparkle size={16} weight="fill" />
            )}
            {step === "generating"
              ? "Generating…"
              : mediaType === "video"
                ? "Gerar Post com Vídeo"
                : mediaType === "text"
                  ? "Gerar Post Somente Texto"
                  : imageOrigin === "drive"
                    ? "Gerar Post com esta Imagem"
                    : "Generate"}
          </Button>
        </div>

        {ownTopics.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="mt-1 text-xs font-medium text-muted-foreground">Your topics:</span>
            {ownTopics.slice(0, 10).map((t) => (
              <button
                key={t}
                onClick={() => setTopic(t)}
                className="cursor-pointer rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs text-primary transition hover:border-primary"
              >
                {t}
              </button>
            ))}
            <Link
              href="/dashboard/topics"
              className="mt-0.5 text-xs font-medium text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
            >
              Manage
            </Link>
          </div>
        )}

        {suggestions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="mt-1 text-xs font-medium text-muted-foreground">Trending ideas:</span>
            {suggestions.slice(0, 8).map((s) => (
              <button
                key={s}
                onClick={() => setTopic(s)}
                className="cursor-pointer rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition hover:border-primary hover:text-primary"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </Card>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-sm text-destructive">
          <WarningCircle size={18} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-success/30 bg-success/10 p-3.5 text-sm text-success">
          <CheckCircle size={18} className="shrink-0" />
          <span>{success}</span>
          {publishedUrl ? (
            <a
              href={publishedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold underline underline-offset-2"
            >
              Ver post no Facebook <ArrowSquareOut size={13} />
            </a>
          ) : (
            <Link
              href="/dashboard/queue"
              className="inline-flex items-center gap-1 font-semibold underline underline-offset-2 ml-1"
            >
              👉 Ver na Fila &amp; Agendados ↗
            </Link>
          )}
        </div>
      )}

      {step === "generating" && (
        <Card className="animate-pulse">
          <div className="grid gap-6 md:grid-cols-[320px_1fr]">
            <div className="aspect-square rounded-xl bg-surface-2" />
            <div className="space-y-3">
              <div className="h-6 w-3/4 rounded bg-surface-2" />
              <div className="h-4 w-full rounded bg-surface-2" />
              <div className="h-4 w-5/6 rounded bg-surface-2" />
              <div className="h-4 w-2/3 rounded bg-surface-2" />
            </div>
          </div>
        </Card>
      )}

      {step === "ready" && content && (
        <Card>
          <div className="grid gap-6 md:grid-cols-[320px_1fr]">
            {/* Coluna da Esquerda: Mídia (Foto/Vídeo) ou Pré-visualização de Post de Texto */}
            <div>
              {mediaType === "video" && video ? (
                <div className="relative aspect-square overflow-hidden rounded-xl bg-black">
                  <video
                    src={video.url}
                    poster={video.previewUrl}
                    controls
                    playsInline
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : mediaType === "image" && image ? (
                <div className="relative aspect-square overflow-hidden rounded-xl bg-surface-2">
                  <Image src={image.url} alt={content.title} fill unoptimized className="object-cover" />
                </div>
              ) : mediaType === "text" ? (
                <div className="flex flex-col justify-between h-full min-h-[260px] rounded-xl border border-border bg-gradient-to-br from-primary/5 via-surface-2/40 to-background p-4 shadow-xs">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                        FB
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-foreground leading-none">
                          {selectedPageNames.length > 1
                            ? `${selectedPageNames.length} Páginas Selecionadas`
                            : selectedPageNames[0] || "Sua Página"}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Post de status (Somente texto)</p>
                      </div>
                    </div>
                    <div className="rounded-lg bg-background/90 p-3.5 border border-border/60 shadow-xs">
                      <p className="text-sm font-semibold text-foreground leading-snug">{content.title}</p>
                      <p className="mt-2 text-xs text-muted-foreground leading-relaxed line-clamp-6">{content.description}</p>
                      {content.hashtags.length > 0 && (
                        <p className="mt-2 text-xs text-primary font-medium">
                          {content.hashtags.map((h) => `#${h}`).join(" ")}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge className="mt-3 self-start">📝 Post Somente Texto</Badge>
                </div>
              ) : null}

              {mediaType !== "text" && (
                <div className="mt-2 flex items-center justify-between">
                  <Badge>
                    {mediaType === "video" && video
                      ? `Vídeo ${String(video.source || (video as any).provider || "Stock").toUpperCase()}${video.duration ? ` · ${video.duration}s` : ""}`
                      : image?.source === "drive"
                        ? "Imagem do Google Drive"
                        : image?.source === "ai"
                          ? avatarName
                            ? `${avatarName} (Avatar IA)`
                            : "AI generated"
                          : "Stock photo"}
                  </Badge>
                  <button
                    type="button"
                    onClick={regenerateMedia}
                    disabled={regeneratingMedia}
                    className="flex cursor-pointer items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary transition disabled:opacity-50"
                  >
                    <ArrowClockwise size={13} className={regeneratingMedia ? "animate-spin" : ""} />
                    {regeneratingMedia
                      ? "Buscando…"
                      : mediaType === "video"
                        ? "Trocar vídeo"
                        : imageOrigin === "drive"
                          ? "Trocar imagem do Drive"
                          : "Regenerar imagem"}
                  </button>
                </div>
              )}

              {imageHint && (
                <div className="mt-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-600 dark:text-amber-400">
                  <p className="font-semibold flex items-center gap-1">⚠️ Aviso do Provedor de Imagem:</p>
                  <p className="mt-0.5 leading-relaxed text-[11px]">{imageHint}</p>
                </div>
              )}
            </div>

            {/* Coluna da Direita: Editor de Conteúdo com botão de Regenerar Texto */}
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-1 border-b border-border/40">
                <span className="text-xs font-semibold text-muted-foreground">Conteúdo e Legenda</span>
                <button
                  type="button"
                  onClick={regenerateText}
                  disabled={regeneratingText}
                  className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-2.5 py-1 text-xs font-medium text-foreground transition hover:border-primary hover:text-primary disabled:opacity-50"
                >
                  <ArrowClockwise size={12} className={regeneratingText ? "animate-spin" : ""} />
                  {regeneratingText ? "Regenerando texto…" : "Regenerar somente texto"}
                </button>
              </div>

              {content.provider === "template" ? (
                <div className="space-y-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-xs text-amber-700 dark:text-amber-400">
                  <p className="font-semibold flex items-center gap-1.5">
                    <WarningCircle size={15} />
                    Copy gerada a partir de modelo fixo (Template de Fallback).
                  </p>
                  {content.providerErrors && content.providerErrors.length > 0 && (
                    <div className="mt-1 space-y-1 rounded-lg bg-amber-500/10 p-2 text-[11px] font-mono leading-relaxed text-amber-800 dark:text-amber-300">
                      <p className="font-semibold font-sans">Diagnóstico dos provedores de IA:</p>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {content.providerErrors.map((err, idx) => (
                          <li key={idx}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <p className="pt-1 text-[11px]">
                    Dica: Salve sua chave do Google Gemini em{" "}
                    <Link href="/dashboard/settings" className="font-semibold underline">
                      Settings
                    </Link>{" "}
                    para gerar textos inteligentes automaticamente.
                  </p>
                </div>
              ) : content.provider ? (
                <div className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success">
                  <CheckCircle size={14} />
                  Copy escrita com sucesso por:{" "}
                  <strong className="capitalize">
                    {content.provider === "gemini"
                      ? "Google Gemini"
                      : content.provider === "groq"
                        ? "Groq (Llama 3)"
                        : "Pollinations AI"}
                  </strong>
                </div>
              ) : null}

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Opening hook</label>
                <input
                  value={content.title}
                  maxLength={120}
                  onChange={(e) => setContent({ ...content, title: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Description</label>
                <textarea
                  value={content.description}
                  maxLength={500}
                  rows={3}
                  onChange={(e) => setContent({ ...content, description: e.target.value })}
                  className="mt-1 w-full resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Hashtags</label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {content.hashtags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent"
                    >
                      #{tag}
                      <button onClick={() => removeHashtag(tag)} aria-label={`Remove ${tag}`} className="cursor-pointer">
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                  <input
                    value={hashtagInput}
                    onChange={(e) => setHashtagInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addHashtag())}
                    placeholder="add tag…"
                    className="w-24 rounded-full border border-dashed border-border bg-transparent px-2.5 py-1 text-xs outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Link (optional)</label>
                <input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://your-site.com/post"
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Páginas de Destino ({selectedPageIds.length} selecionada{selectedPageIds.length === 1 ? "" : "s"})
                  </label>
                  {pages.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedPageIds.length === pages.length) {
                          setSelectedPageIds([]);
                        } else {
                          setSelectedPageIds(pages.map((p) => p.page_id));
                        }
                      }}
                      className="text-xs text-primary font-medium hover:underline cursor-pointer"
                    >
                      {selectedPageIds.length === pages.length ? "Desmarcar todas" : "Selecionar todas"}
                    </button>
                  )}
                </div>

                {pages.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-3 rounded-xl border border-dashed border-border bg-surface-2/40">
                    Nenhuma Página encontrada. Conecte sua conta do Facebook nas Configurações.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 rounded-xl border border-border bg-surface-1/50">
                    {pages.map((p) => {
                      const isChecked = selectedPageIds.includes(p.page_id);
                      return (
                        <label
                          key={p.page_id}
                          className={cn(
                            "flex items-center gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition select-none",
                            isChecked
                              ? "border-primary/60 bg-primary/10 text-foreground font-semibold shadow-xs"
                              : "border-border/60 bg-background text-muted-foreground hover:bg-surface-2"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedPageIds([...selectedPageIds, p.page_id]);
                              } else {
                                setSelectedPageIds(selectedPageIds.filter((id) => id !== p.page_id));
                              }
                            }}
                            className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate leading-tight">{p.name}</p>
                            {p.category && (
                              <p className="text-[10px] text-muted-foreground font-normal truncate">
                                {p.category}
                              </p>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {scheduleOpen && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Schedule for</label>
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
                  />
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                <Button variant="secondary" onClick={() => save("draft")} disabled={saving !== null}>
                  <FloppyDisk size={16} /> Save draft
                </Button>
                {scheduleOpen ? (
                  <Button variant="secondary" onClick={() => save("schedule")} disabled={saving !== null}>
                    <CalendarPlus size={16} /> {saving === "schedule" ? "Scheduling…" : "Confirm schedule"}
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={() => setScheduleOpen(true)} disabled={saving !== null}>
                    <CalendarPlus size={16} /> Schedule
                  </Button>
                )}
                <Button onClick={() => save("post_now")} disabled={saving !== null}>
                  <Rocket size={16} weight="fill" /> {saving === "post_now" ? "Publishing…" : "Publish now"}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Modal: Escolher Imagem da Pasta Sincronizada do Drive */}
      {drivePickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-3xl p-5 sm:p-6 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Folder size={20} className="text-primary" />
                <h3 className="font-heading text-lg font-semibold text-foreground">
                  Escolher Imagem da Pasta Sincronizada
                </h3>
              </div>
              <button
                onClick={() => setDrivePickerOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="relative flex-1">
                <MagnifyingGlass size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={driveSearch}
                  onChange={(e) => setDriveSearch(e.target.value)}
                  placeholder="Buscar imagem por título ou arquivo..."
                  className="w-full rounded-xl border border-border bg-surface py-1.5 pl-8 pr-3 text-xs text-foreground focus:border-primary focus:outline-none"
                />
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={loadDriveImages}
                disabled={loadingDriveImages}
                className="h-8 text-xs"
              >
                <ArrowClockwise size={13} className={cn(loadingDriveImages && "animate-spin")} />
                Atualizar
              </Button>
            </div>

            <div className="mt-4 flex-1 overflow-y-auto pr-1">
              {loadingDriveImages ? (
                <div className="flex h-48 flex-col items-center justify-center gap-2 text-muted-foreground text-xs">
                  <ArrowClockwise size={24} className="animate-spin text-primary" />
                  <span>Carregando imagens da biblioteca...</span>
                </div>
              ) : driveImages.length === 0 ? (
                <div className="flex h-48 flex-col items-center justify-center gap-2 text-center p-4 border border-dashed border-border rounded-xl">
                  <Images size={24} className="text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">
                    Nenhuma imagem sincronizada encontrada na biblioteca.
                  </p>
                  <Link
                    href="/dashboard/batch-images"
                    className="text-xs text-primary font-medium hover:underline mt-1"
                  >
                    Ir para Lote de Imagens e sincronizar a pasta do Drive &rarr;
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {driveImages
                    .filter((img) => {
                      if (!driveSearch.trim()) return true;
                      const q = driveSearch.toLowerCase();
                      return img.title.toLowerCase().includes(q) || img.raw_filename.toLowerCase().includes(q);
                    })
                    .map((item) => {
                      const isSelected = selectedDriveImage?.id === item.id;
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleSelectDriveImage(item)}
                          className={cn(
                            "group cursor-pointer rounded-xl border p-2 transition flex flex-col justify-between overflow-hidden text-left",
                            isSelected
                              ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                              : "border-border bg-surface hover:border-primary/50 hover:bg-surface-2"
                          )}
                        >
                          <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-black/10">
                            <img
                              src={`https://lh3.googleusercontent.com/d/${item.drive_file_id}`}
                              alt={item.title}
                              loading="lazy"
                              className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = `https://drive.google.com/uc?export=download&id=${item.drive_file_id}`;
                              }}
                            />
                            {isSelected && (
                              <div className="absolute top-1.5 right-1.5 bg-primary text-white rounded-full p-0.5 shadow-sm">
                                <CheckCircle size={14} weight="bold" />
                              </div>
                            )}
                          </div>
                          <div className="mt-2">
                            <p className="text-xs font-medium text-foreground line-clamp-1" title={item.title}>
                              {item.title}
                            </p>
                            <p className="text-[10px] font-mono text-muted-foreground truncate">
                              {item.raw_filename}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-border flex justify-end">
              <Button size="sm" variant="secondary" onClick={() => setDrivePickerOpen(false)}>
                Fechar
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
