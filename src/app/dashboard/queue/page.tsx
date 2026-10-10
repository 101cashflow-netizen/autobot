"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Rocket,
  Trash,
  PencilSimple,
  X,
  Check,
  Lightning,
  Article,
  ArrowsClockwise,
  ArrowSquareOut,
  Info,
  WarningCircle,
  Eye,
} from "@phosphor-icons/react/dist/ssr";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { PostDetailModal } from "@/components/dashboard/post-detail-modal";
import { cn } from "@/lib/cn";
import { facebookPostUrl } from "@/lib/types";
import type { Post } from "@/lib/types";

function toLocalInputValue(iso: string | null) {
  if (!iso) {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type QueueTab = "all" | "failed" | "scheduled" | "draft";

export default function QueuePage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<QueueTab>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTime, setDraftTime] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [dispatching, setDispatching] = useState(false);
  const [cronMessage, setCronMessage] = useState<string | null>(null);

  // Modal State
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/posts?status=draft,scheduled,failed");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao carregar a fila de posts.");
      setPosts(data.posts ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar a fila.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const now = new Date();
  const duePosts = posts.filter(
    (p) => p.status === "scheduled" && p.scheduled_at && new Date(p.scheduled_at) <= now
  );
  const failedPosts = posts.filter((p) => p.status === "failed");
  const scheduledPosts = posts.filter((p) => p.status === "scheduled");
  const draftPosts = posts.filter((p) => p.status === "draft");

  const displayedPosts = posts.filter((p) => {
    if (tab === "failed") return p.status === "failed";
    if (tab === "scheduled") return p.status === "scheduled";
    if (tab === "draft") return p.status === "draft";
    return true;
  });

  async function triggerQueue() {
    setDispatching(true);
    setCronMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/cron/process-queue");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao processar fila.");
      const count = data.processedFromQueue ?? 0;
      setCronMessage(
        count > 0
          ? `Sucesso: ${count} post(s) com horário vencido foram publicados no Facebook!`
          : "Nenhum post agendado está com horário vencido no momento."
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao disparar fila.");
    } finally {
      setDispatching(false);
    }
  }

  async function postNow(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/posts/${id}/post-now`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.post?.status === "failed") throw new Error(data.post.error_message ?? "Falha ao publicar.");
      if (data.post?.facebook_post_id) setPublishedUrl(facebookPostUrl(data.post.facebook_post_id));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao publicar.");
      throw err;
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    setBusyId(id);
    try {
      await fetch(`/api/posts/${id}`, { method: "DELETE" });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function saveSchedule(id: string, customTimeIso?: string) {
    setBusyId(id);
    setError(null);
    try {
      const timeIso = customTimeIso || (draftTime ? new Date(draftTime).toISOString() : null);
      const res = await fetch(`/api/posts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledAt: timeIso,
          status: timeIso ? "scheduled" : "draft",
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao atualizar agendamento.");
      throw err;
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Top Header Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-xl font-bold text-foreground">Fila &amp; Agendados</h1>
          <p className="text-xs text-muted-foreground">
            Gerencie posts agendados, rascunhos e posts automáticos com falha na publicação.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={load}
            disabled={loading || dispatching}
            aria-label="Atualizar lista"
          >
            <ArrowsClockwise size={15} className={loading ? "animate-spin" : ""} />
            Atualizar
          </Button>
          <Button
            size="sm"
            onClick={triggerQueue}
            disabled={dispatching || loading}
            className="bg-amber-600 hover:bg-amber-700 text-white"
            title="Executa imediatamente a fila para publicar posts cujo horário já passou"
          >
            <Lightning size={15} weight="fill" />
            {dispatching ? "Disparando…" : "Disparar Posts Vencidos"}
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-2">
        <button
          onClick={() => setTab("all")}
          className={cn(
            "cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-medium transition",
            tab === "all"
              ? "bg-primary text-primary-foreground font-semibold"
              : "border border-border text-muted-foreground hover:bg-surface-2"
          )}
        >
          Todos ({posts.length})
        </button>
        <button
          onClick={() => setTab("failed")}
          className={cn(
            "cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-medium transition flex items-center gap-1.5",
            tab === "failed"
              ? "bg-destructive text-destructive-foreground font-semibold"
              : failedPosts.length > 0
              ? "border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20 font-semibold"
              : "border border-border text-muted-foreground hover:bg-surface-2"
          )}
        >
          {failedPosts.length > 0 && <WarningCircle size={14} weight="fill" />}
          Falharam ({failedPosts.length})
        </button>
        <button
          onClick={() => setTab("scheduled")}
          className={cn(
            "cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-medium transition",
            tab === "scheduled"
              ? "bg-primary text-primary-foreground font-semibold"
              : "border border-border text-muted-foreground hover:bg-surface-2"
          )}
        >
          Agendados ({scheduledPosts.length})
        </button>
        <button
          onClick={() => setTab("draft")}
          className={cn(
            "cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-medium transition",
            tab === "draft"
              ? "bg-primary text-primary-foreground font-semibold"
              : "border border-border text-muted-foreground hover:bg-surface-2"
          )}
        >
          Rascunhos ({draftPosts.length})
        </button>
      </div>

      {/* Alert Banner for Failed Posts */}
      {failedPosts.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3.5 text-xs text-destructive">
          <WarningCircle size={18} weight="fill" className="shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold">
              Existem {failedPosts.length} post(s) que falharam ao tentar publicar no Facebook!
            </span>
            <p className="mt-0.5 text-foreground/80 leading-relaxed">
              Esses posts foram gerados pelo robô automático ou estavam na fila agendada. Você pode visualizá-los na íntegra,
              verificar o erro retornado pela Meta e <strong>reagendar</strong> ou <strong>tentar publicar agora</strong>.
            </p>
          </div>
          {tab !== "failed" && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setTab("failed")}
              className="shrink-0 border-destructive/30 text-destructive hover:bg-destructive/20"
            >
              Ver Falhas ({failedPosts.length})
            </Button>
          )}
        </div>
      )}

      {/* Overdue Notification Banner */}
      {duePosts.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-900 dark:text-amber-200">
          <Info size={18} className="shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold">
              Existem {duePosts.length} post(s) agendado(s) com horário já vencido.
            </span>{" "}
            Clique no botão <strong>&quot;Disparar Posts Vencidos&quot;</strong> acima para publicá-los agora mesmo no Facebook.
          </div>
        </div>
      )}

      {/* Cron Instruction Banner */}
      <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-xs text-foreground/90">
        <Info size={18} className="shrink-0 text-primary mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-foreground">Como funciona o disparo automático da fila:</p>
          <p className="text-muted-foreground leading-relaxed">
            Seus posts agendados são publicados automaticamente no horário configurado através da rota de cron.
            Para disparo de alta frequência (a cada 10 ou 15 min), aponte um cron gratuito (ex:{" "}
            <a
              href="https://cron-job.org"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline"
            >
              cron-job.org
            </a>
            ) para:
          </p>
          <code className="block rounded-lg bg-surface-2 px-2.5 py-1 font-mono text-[11px] text-foreground border border-border/60">
            https://autobot-5sq.pages.dev/api/cron/process-queue
          </code>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-sm text-destructive">
          {error}
        </div>
      )}

      {cronMessage && (
        <div className="rounded-xl border border-primary/30 bg-primary/10 p-3.5 text-sm text-primary">
          {cronMessage}
        </div>
      )}

      {publishedUrl && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-success/30 bg-success/10 p-3.5 text-sm text-success">
          <span>Post publicado com sucesso!</span>
          <a
            href={publishedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold underline underline-offset-2"
          >
            Ver post no Facebook <ArrowSquareOut size={13} />
          </a>
        </div>
      )}

      {/* Posts List */}
      {!error && (
        <Card>
          {loading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Carregando fila…</p>
          ) : displayedPosts.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <p className="font-semibold text-foreground">
                {tab === "failed"
                  ? "Nenhum post com falha no momento!"
                  : tab === "scheduled"
                  ? "Nenhum post agendado na fila"
                  : tab === "draft"
                  ? "Nenhum rascunho salvo"
                  : "Nenhum post na fila"}
              </p>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {tab === "failed"
                  ? "Excelente! Todos os posts gerados pelo robô foram publicados com sucesso."
                  : "Crie um post na tela Criar Post e clique em \"Agendar\" ou \"Salvar rascunho\" para vê-lo aqui."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {displayedPosts.map((post) => {
                const isOverdue =
                  post.status === "scheduled" &&
                  post.scheduled_at &&
                  new Date(post.scheduled_at) <= now;
                const isFailed = post.status === "failed";

                return (
                  <div
                    key={post.id}
                    className={cn(
                      "flex flex-col gap-3 py-4 sm:flex-row sm:items-center rounded-xl transition px-2",
                      isFailed ? "bg-destructive/5 border border-destructive/20 my-1" : ""
                    )}
                  >
                    {/* Media Thumbnail */}
                    {post.media_type === "video" ? (
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-black">
                        <video
                          src={post.media_url || post.image_url}
                          className="h-full w-full object-cover"
                          muted
                          playsInline
                        />
                        <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 text-[9px] font-bold text-white">
                          VID
                        </span>
                      </div>
                    ) : post.media_type === "text" || (!post.image_url && !post.media_url) ? (
                      <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        <Article size={24} weight="bold" />
                        <span className="text-[10px] font-bold">TEXTO</span>
                      </div>
                    ) : (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={post.image_url} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                    )}

                    {/* Content Details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium text-foreground">{post.title}</p>
                        <StatusBadge status={post.status} />
                        {isOverdue && (
                          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                            Horário vencido
                          </span>
                        )}
                        {isFailed && (
                          <span className="rounded-full bg-destructive/20 px-2 py-0.5 text-[10px] font-bold text-destructive">
                            Falhou no Facebook
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">{post.description}</p>

                      {/* Error Preview for Failed Posts */}
                      {isFailed && post.error_message && (
                        <div className="mt-1.5 flex items-start gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
                          <WarningCircle size={15} className="shrink-0 mt-0.5" />
                          <span className="line-clamp-2">
                            <strong>Erro da publicação:</strong> {post.error_message}
                          </span>
                        </div>
                      )}

                      <p className="mt-1 text-xs text-muted-foreground">
                        Página: <strong>{post.page_name ?? "Padrão"}</strong>
                        {post.scheduled_at && (
                          <>
                            {" · "}
                            Agendado para{" "}
                            <strong>
                              {new Date(post.scheduled_at).toLocaleString("pt-BR", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </strong>
                          </>
                        )}
                        {" · "}
                        Criado em: {new Date(post.created_at).toLocaleString("pt-BR")}
                      </p>

                      {/* Inline Reschedule Form */}
                      {editingId === post.id && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <input
                            type="datetime-local"
                            value={draftTime}
                            onChange={(e) => setDraftTime(e.target.value)}
                            className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary"
                          />
                          <button
                            onClick={() => saveSchedule(post.id)}
                            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-success/10 text-success hover:bg-success/20 transition"
                            aria-label="Salvar"
                            title="Salvar alteração"
                          >
                            <Check size={15} />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-surface-2 text-muted-foreground hover:bg-surface-3 transition"
                            aria-label="Cancelar"
                            title="Cancelar"
                          >
                            <X size={15} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setSelectedPost(post);
                          setModalOpen(true);
                        }}
                        title="Visualizar post completo e detalhes"
                      >
                        <Eye size={14} /> Ver Post
                      </Button>

                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setEditingId(post.id);
                          setDraftTime(toLocalInputValue(post.scheduled_at));
                        }}
                        title="Reagendar horário de publicação"
                      >
                        <PencilSimple size={14} /> Reagendar
                      </Button>

                      <Button
                        size="sm"
                        onClick={() => postNow(post.id)}
                        disabled={busyId === post.id}
                        className={isFailed ? "bg-primary hover:bg-primary/90 text-primary-foreground font-semibold" : ""}
                        title={isFailed ? "Tentar publicar novamente no Facebook" : "Publicar agora no Facebook"}
                      >
                        <Rocket size={14} weight="fill" />{" "}
                        {busyId === post.id
                          ? "Publicando…"
                          : isFailed
                          ? "Tentar Novamente"
                          : "Publicar agora"}
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => remove(post.id)}
                        disabled={busyId === post.id}
                        title="Excluir post"
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash size={14} />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* Post Detail Modal */}
      <PostDetailModal
        post={selectedPost}
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedPost(null);
        }}
        onPostNow={postNow}
        onReschedule={saveSchedule}
        onDelete={remove}
      />
    </div>
  );
}
