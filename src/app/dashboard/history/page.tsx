"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowSquareOut,
  Article,
  Eye,
  PencilSimple,
  Rocket,
  Trash,
  ArrowsClockwise,
  WarningCircle,
  Check,
} from "@phosphor-icons/react/dist/ssr";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { PostDetailModal } from "@/components/dashboard/post-detail-modal";
import { cn } from "@/lib/cn";
import { facebookPostUrl } from "@/lib/types";
import type { Post, PostStatus } from "@/lib/types";

const FILTERS: { label: string; value: PostStatus | "all" }[] = [
  { label: "Todos", value: "all" },
  { label: "Publicados", value: "posted" },
  { label: "Falharam", value: "failed" },
];

export default function HistoryPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [filter, setFilter] = useState<PostStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Modal State
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/posts?status=${filter === "all" ? "posted,failed" : filter}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao carregar histórico.");
      setPosts(data.posts ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar histórico.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function postNow(id: string) {
    setBusyId(id);
    setError(null);
    setActionSuccess(null);
    try {
      const res = await fetch(`/api/posts/${id}/post-now`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.post?.status === "failed") throw new Error(data.post.error_message ?? "Falha ao publicar.");
      setActionSuccess("Post publicado com sucesso no Facebook!");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao publicar.");
      throw err;
    } finally {
      setBusyId(null);
    }
  }

  async function reschedule(id: string, newDateIso: string) {
    setBusyId(id);
    setError(null);
    setActionSuccess(null);
    try {
      const res = await fetch(`/api/posts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledAt: newDateIso,
          status: "scheduled",
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setActionSuccess("Post reagendado com sucesso e enviado para a fila!");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao reagendar.");
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

  const failedCount = posts.filter((p) => p.status === "failed").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-xl font-bold text-foreground">Histórico de Publicações</h1>
          <p className="text-xs text-muted-foreground">
            Acompanhe posts publicados e posts que apresentaram falha para visualizar ou reagendar.
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={load}
          disabled={loading}
          aria-label="Atualizar histórico"
        >
          <ArrowsClockwise size={15} className={loading ? "animate-spin" : ""} />
          Atualizar
        </Button>
      </div>

      <div className="flex items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              "cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-medium transition",
              filter === f.value
                ? "bg-primary text-primary-foreground font-semibold"
                : "border border-border text-muted-foreground hover:bg-surface-2"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {actionSuccess && (
        <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 p-3.5 text-xs font-semibold text-success">
          <Check size={16} /> {actionSuccess}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-sm text-destructive">
          {error}
        </div>
      )}

      {!error && (
        <Card>
          {loading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Carregando histórico…</p>
          ) : posts.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Nenhum post encontrado nesta categoria.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2 font-medium">Post</th>
                    <th className="hidden pb-2 font-medium sm:table-cell">Página</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Data</th>
                    <th className="pb-2 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map((post) => {
                    const isFailed = post.status === "failed";

                    return (
                      <tr
                        key={post.id}
                        className={cn(
                          "border-b border-border last:border-0 transition",
                          isFailed ? "bg-destructive/5" : ""
                        )}
                      >
                        <td className="max-w-[280px] py-3 pr-3">
                          <div className="flex items-center gap-3">
                            {post.media_type === "video" ? (
                              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-black">
                                <video
                                  src={post.media_url || post.image_url}
                                  className="h-full w-full object-cover"
                                  muted
                                  playsInline
                                />
                              </div>
                            ) : post.media_type === "text" || (!post.image_url && !post.media_url) ? (
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                <Article size={18} weight="bold" />
                              </div>
                            ) : (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img src={post.image_url} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                            )}
                            <div className="min-w-0">
                              <p className="truncate font-medium text-foreground">{post.title}</p>
                              {isFailed && post.error_message && (
                                <p className="truncate text-xs text-destructive font-mono" title={post.error_message}>
                                  Erro: {post.error_message}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="hidden py-3 pr-3 text-muted-foreground sm:table-cell">
                          {post.page_name ?? "—"}
                        </td>
                        <td className="py-3 pr-3">
                          <StatusBadge status={post.status} />
                        </td>
                        <td className="py-3 pr-3 text-xs text-muted-foreground">
                          {new Date(post.posted_at ?? post.created_at).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedPost(post);
                                setModalOpen(true);
                              }}
                              title="Visualizar post completo e erro"
                              className="h-8 px-2 text-xs"
                            >
                              <Eye size={14} /> Ver
                            </Button>

                            {isFailed && (
                              <>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => {
                                    setSelectedPost(post);
                                    setModalOpen(true);
                                  }}
                                  title="Reagendar horário deste post"
                                  className="h-8 px-2 text-xs text-warning"
                                >
                                  <PencilSimple size={13} /> Reagendar
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => postNow(post.id)}
                                  disabled={busyId === post.id}
                                  title="Tentar publicar agora"
                                  className="h-8 px-2 text-xs bg-primary text-primary-foreground font-semibold"
                                >
                                  <Rocket size={13} weight="fill" /> Tentar agora
                                </Button>
                              </>
                            )}

                            {post.facebook_post_id && (
                              <a
                                href={facebookPostUrl(post.facebook_post_id)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs font-semibold text-primary hover:bg-surface-2 transition"
                              >
                                Ver post <ArrowSquareOut size={12} />
                              </a>
                            )}

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => remove(post.id)}
                              disabled={busyId === post.id}
                              title="Excluir post"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                            >
                              <Trash size={14} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
        onReschedule={reschedule}
        onDelete={remove}
      />
    </div>
  );
}
