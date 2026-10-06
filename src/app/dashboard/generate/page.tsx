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
} from "@phosphor-icons/react/dist/ssr";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import type { GeneratedContent, ImageSource, ImageSourcePref, MediaType, PageCache, StockProvider, TextAiProviderPref } from "@/lib/types";

type Step = "idle" | "generating" | "ready";

export default function GeneratePage() {
  const [topic, setTopic] = useState("");
  const [mediaType, setMediaType] = useState<MediaType>("image");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [ownTopics, setOwnTopics] = useState<string[]>([]);
  const [imagePref, setImagePref] = useState<ImageSourcePref>("ai");
  const [copyAiPref, setCopyAiPref] = useState<TextAiProviderPref>("auto");
  const [avatarName, setAvatarName] = useState<string | null>("Nasha");

  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);

  const [content, setContent] = useState<GeneratedContent | null>(null);
  const [image, setImage] = useState<{ url: string; source: ImageSource } | null>(null);
  const [video, setVideo] = useState<{
    url: string;
    previewUrl?: string;
    source: StockProvider;
    duration?: number;
  } | null>(null);
  const [hashtagInput, setHashtagInput] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  const [pages, setPages] = useState<PageCache[]>([]);
  const [pageId, setPageId] = useState("");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [saving, setSaving] = useState<"draft" | "schedule" | "post_now" | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);

  useEffect(() => {
    // Arriving from the Topics screen's "write now" link. Read directly rather
    // than through useSearchParams, which would force a Suspense boundary
    // around the whole form for one optional value.
    const fromLink = new URLSearchParams(window.location.search).get("topic");
    if (fromLink) setTopic(fromLink);

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
        setPages(d.pages ?? []);
        if (d.defaultPageId) setPageId(d.defaultPageId);
      })
      .catch(() => {});
  }, []);

  const selectedPage = useMemo(() => pages.find((p) => p.page_id === pageId), [pages, pageId]);

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

    try {
      if (mediaType === "video") {
        const [contentRes, videoRes] = await Promise.all([
          fetch("/api/generate/content", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ topic, provider: copyAiPref }),
          }),
          fetch("/api/generate/video", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: topic }),
          }),
        ]);

        if (!contentRes.ok) throw new Error((await contentRes.json()).error ?? "Content generation failed.");
        if (!videoRes.ok) throw new Error((await videoRes.json()).error ?? "Video generation/search failed.");

        const contentData: GeneratedContent = await contentRes.json();
        const videoData: {
          url: string;
          previewUrl?: string;
          source: StockProvider;
          duration?: number;
        } = await videoRes.json();

        setContent(contentData);
        setVideo(videoData);
        setImage({ url: videoData.previewUrl || videoData.url, source: "stock" });
        setStep("ready");
      } else {
        const [contentRes, imageRes] = await Promise.all([
          fetch("/api/generate/content", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ topic, provider: copyAiPref }),
          }),
          fetch("/api/generate/image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: topic, source: imagePref }),
          }),
        ]);

        if (!contentRes.ok) throw new Error((await contentRes.json()).error ?? "Content generation failed.");
        if (!imageRes.ok) throw new Error((await imageRes.json()).error ?? "Image generation failed.");

        const contentData: GeneratedContent = await contentRes.json();
        const imageData: { url: string; source: ImageSource } = await imageRes.json();

        setContent(contentData);
        setImage(imageData);
        setStep("ready");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStep("idle");
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
    if (!content || (!image && !video)) return;
    if (action !== "draft" && !pageId) {
      setError("Choose a Page before scheduling or posting.");
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
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          title: content.title,
          description: content.description,
          hashtags: content.hashtags,
          imageUrl: isVideo ? (video!.previewUrl || video!.url) : image!.url,
          imageSource: isVideo ? "stock" : image!.source,
          mediaType: isVideo ? "video" : "image",
          mediaUrl: isVideo ? video!.url : undefined,
          linkUrl: linkUrl || undefined,
          pageId: pageId || selectedPage?.page_id || "unset",
          pageName: selectedPage?.name ?? "Unset",
          action,
          scheduledAt: action === "schedule" ? new Date(scheduledAt).toISOString() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save post.");

      if (action === "post_now" && data.post.status === "failed") {
        throw new Error(data.post.error_message ?? "Facebook rejected this post.");
      }

      setSuccess(
        action === "draft"
          ? "Saved as a draft."
          : action === "schedule"
            ? "Post scheduled."
            : isVideo
              ? "Video published to Facebook 🎉"
              : "Published to Facebook 🎉"
      );
      setPublishedUrl(
        action === "post_now" && data.post.facebook_post_id
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
                onClick={() => setMediaType("image")}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer",
                  mediaType === "image"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Sparkle size={14} /> Foto / Imagem
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
                <VideoCamera size={14} /> Vídeo (Pexels / Pixabay)
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">IA Redação (Copy):</span>
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
        </div>

        {mediaType === "image" && avatarName && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-purple-500/10 px-2.5 py-1 text-xs font-medium text-purple-600 dark:text-purple-400">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-pulse" />
            Avatar IA ativo: {avatarName} (consistência de personagem ligada)
          </div>
        )}

        {mediaType === "video" && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Busca de vídeo em HD no Pexels e Pixabay (publicação direta no Facebook sem timeout)
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
                : "e.g. cozy fall living room decor ideas"
            }
            className="flex-1 rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
          {mediaType === "image" && (
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
            ) : (
              <Sparkle size={16} weight="fill" />
            )}
            {step === "generating"
              ? "Generating…"
              : mediaType === "video"
                ? "Gerar Post com Vídeo"
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
          {success}
          {publishedUrl && (
            <a
              href={publishedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold underline underline-offset-2"
            >
              View post <ArrowSquareOut size={13} />
            </a>
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

      {step === "ready" && content && (image || video) && (
        <Card>
          <div className="grid gap-6 md:grid-cols-[320px_1fr]">
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
              ) : image ? (
                <div className="relative aspect-square overflow-hidden rounded-xl bg-surface-2">
                  <Image src={image.url} alt={content.title} fill unoptimized className="object-cover" />
                </div>
              ) : null}
              <div className="mt-2 flex items-center justify-between">
                <Badge>
                  {mediaType === "video" && video
                    ? `Vídeo ${video.source.toUpperCase()}${video.duration ? ` · ${video.duration}s` : ""}`
                    : image?.source === "ai"
                      ? avatarName
                        ? `${avatarName} (Avatar IA)`
                        : "AI generated"
                      : "Stock photo"}
                </Badge>
                <button
                  onClick={generate}
                  className="flex cursor-pointer items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary"
                >
                  <ArrowClockwise size={13} /> {mediaType === "video" ? "Buscar outro vídeo" : "Regenerate"}
                </button>
              </div>
            </div>

            <div className="space-y-4">
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

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Page</label>
                <select
                  value={pageId}
                  onChange={(e) => setPageId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
                >
                  <option value="">Select a Page…</option>
                  {pages.map((p) => (
                    <option key={p.page_id} value={p.page_id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {pages.length === 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    No Pages found. Connect Facebook from Settings first.
                  </p>
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
    </div>
  );
}
