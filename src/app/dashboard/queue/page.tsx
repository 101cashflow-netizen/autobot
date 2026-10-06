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
} from "@phosphor-icons/react/dist/ssr";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { facebookPostUrl } from "@/lib/types";
import type { Post } from "@/lib/types";

function toLocalInputValue(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function QueuePage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTime, setDraftTime] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [dispatching, setDispatching] = useState(false);
  const [cronMessage, setCronMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/posts?status=draft,scheduled");
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

  async function saveSchedule(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/posts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledAt: draftTime ? new Date(draftTime).toISOString() : null,
          status: draftTime ? "scheduled" : "draft",
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao atualizar agendamento.");
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
            Gerencie rascunhos e posts agendados para publicação na sua Página.
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
          >
            <Lightning size={16} weight="fill" className={dispatching ? "animate-pulse" : ""} />
            {dispatching ? "Publicando..." : "Disparar Posts Vencidos"}
            {duePosts.length > 0 && (
              <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.2 text-[11px] font-bold">
                {duePosts.length}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Explanatory banner */}
      <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-xs text-foreground/90">
        <Info size={20} className="mt-0.5 shrink-0 text-primary" weight="fill" />
        <div className="space-y-1">
          <p className="font-semibold text-primary">Como funciona o agendamento?</p>
          <p className="text-muted-foreground leading-relaxed">
            Seus posts agendados ficam guardados nesta fila até a data/hora programada. No Cloudflare Pages, para que a publicação seja feita 100% no piloto automático sem precisar manter o painel aberto, basta cadastrar um serviço gratuito de cron (ex:{" "}
            <a
              href="https://cron-job.org"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline underline-offset-2"
            >
              cron-job.org ↗
            </a>
            ) apontando para a URL{" "}
            <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[11px] text-foreground">
              https://autobot-5sq.pages.dev/api/cron/process-queue
            </code>{" "}
            a cada 10 ou 15 minutos. Você também pode disparar os posts vencidos a qualquer momento pelo botão acima.
          </p>
        </div>
      </div>

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
          Publicado no Facebook com sucesso 🎉
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

      {!error && (
        <Card>
          {loading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Carregando fila…</p>
          ) : posts.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <p className="font-semibold text-foreground">Nenhum post na fila</p>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Crie um post na tela <strong>Criar Post</strong> e clique em &quot;Agendar&quot; ou &quot;Salvar rascunho&quot; para vê-lo aqui.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {posts.map((post) => {
                const isOverdue =
                  post.status === "scheduled" &&
                  post.scheduled_at &&
                  new Date(post.scheduled_at) <= now;

                return (
                  <div key={post.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
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

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium text-foreground">{post.title}</p>
                        <StatusBadge status={post.status} />
                        {isOverdue && (
                          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                            Horário vencido
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">{post.description}</p>
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
                      </p>

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

                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setEditingId(post.id);
                          setDraftTime(toLocalInputValue(post.scheduled_at));
                        }}
                      >
                        <PencilSimple size={14} /> Reagendar
                      </Button>
                      <Button size="sm" onClick={() => postNow(post.id)} disabled={busyId === post.id}>
                        <Rocket size={14} weight="fill" /> {busyId === post.id ? "Publicando…" : "Publicar agora"}
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
    </div>
  );
}
