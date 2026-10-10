"use client";

import { useState } from "react";
import {
  X,
  Rocket,
  Trash,
  PencilSimple,
  Check,
  WarningCircle,
  ArrowSquareOut,
  Article,
  CalendarBlank,
  FlagBanner,
  LinkSimple,
} from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { facebookPostUrl } from "@/lib/types";
import type { Post } from "@/lib/types";

interface PostDetailModalProps {
  post: Post | null;
  isOpen: boolean;
  onClose: () => void;
  onPostNow?: (id: string) => Promise<void>;
  onReschedule?: (id: string, newDateIso: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

function toLocalInputValue(iso: string | null) {
  if (!iso) {
    const d = new Date(Date.now() + 60 * 60 * 1000); // 1h from now default
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function PostDetailModal({
  post,
  isOpen,
  onClose,
  onPostNow,
  onReschedule,
  onDelete,
}: PostDetailModalProps) {
  const [rescheduling, setRescheduling] = useState(false);
  const [newTime, setNewTime] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !post) return null;

  async function handlePostNow() {
    if (!onPostNow || !post) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      await onPostNow(post.id);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Falha ao publicar post.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveReschedule() {
    if (!onReschedule || !post || !newTime) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const iso = new Date(newTime).toISOString();
      await onReschedule(post.id, iso);
      setRescheduling(false);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Falha ao reagendar post.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!onDelete || !post) return;
    if (!confirm("Tem certeza que deseja excluir este post?")) return;
    setBusy(true);
    try {
      await onDelete(post.id);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Falha ao excluir post.");
    } finally {
      setBusy(false);
    }
  }

  const isVideo = post.media_type === "video";
  const isText = post.media_type === "text" || (!post.image_url && !post.media_url);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-surface shadow-2xl p-6 space-y-5"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <StatusBadge status={post.status} />
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <FlagBanner size={13} /> {post.page_name ?? "Página Padrão"}
              </span>
            </div>
            <h2 className="text-lg font-bold text-foreground leading-tight">{post.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface-2 hover:text-foreground transition cursor-pointer"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Global Error Banner */}
        {errorMsg && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
            <WarningCircle size={16} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Failure Diagnostic Alert */}
        {post.status === "failed" && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 space-y-2">
            <div className="flex items-center gap-2 text-destructive font-semibold text-sm">
              <WarningCircle size={18} weight="fill" />
              <span>Falha na Publicação pelo Robô</span>
            </div>
            <p className="text-xs text-foreground/90 font-mono leading-relaxed bg-background/60 p-2.5 rounded-lg border border-destructive/20 whitespace-pre-wrap">
              {post.error_message || "Erro desconhecido retornado pela API do Facebook ao tentar publicar."}
            </p>
            <p className="text-[11px] text-muted-foreground">
              💡 Você pode verificar suas permissões ou chave nas <strong>Configurações</strong> e clicar em{" "}
              <strong>Tentar Publicar Agora</strong> ou <strong>Reagendar</strong> para tentar mais tarde.
            </p>
          </div>
        )}

        {/* Media Preview */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">Mídia do Post</label>
          <div className="overflow-hidden rounded-xl border border-border bg-background/50 flex items-center justify-center min-h-[160px]">
            {isVideo ? (
              <video
                src={post.media_url || post.image_url}
                controls
                className="max-h-[300px] w-full rounded-xl object-contain bg-black"
              />
            ) : isText ? (
              <div className="py-10 text-center space-y-2">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
                  <Article size={26} weight="bold" />
                </div>
                <p className="text-xs text-muted-foreground">Post no formato Apenas Texto (sem imagem)</p>
              </div>
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={post.image_url}
                alt={post.title}
                className="max-h-[320px] w-full object-contain rounded-xl"
              />
            )}
          </div>
        </div>

        {/* Copy Text / Description */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">Texto / Copywriting</label>
          <div className="rounded-xl border border-border bg-background p-3.5 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
            {post.description}
          </div>
        </div>

        {/* Hashtags */}
        {post.hashtags && post.hashtags.length > 0 && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Hashtags</label>
            <div className="flex flex-wrap gap-1.5">
              {post.hashtags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md bg-surface-2 px-2 py-0.5 text-xs font-medium text-primary"
                >
                  {tag.startsWith("#") ? tag : `#${tag}`}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Additional Metadata */}
        <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground pt-1">
          <div>
            <span className="font-medium text-foreground">Tema/Tópico:</span> {post.topic}
          </div>
          <div>
            <span className="font-medium text-foreground">Criado em:</span>{" "}
            {new Date(post.created_at).toLocaleString("pt-BR")}
          </div>
          {post.scheduled_at && (
            <div className="col-span-2 flex items-center gap-1.5">
              <CalendarBlank size={14} className="text-warning" />
              <span>
                Agendado para:{" "}
                <strong className="text-foreground">
                  {new Date(post.scheduled_at).toLocaleString("pt-BR")}
                </strong>
              </span>
            </div>
          )}
          {post.facebook_post_id && (
            <div className="col-span-2">
              <a
                href={facebookPostUrl(post.facebook_post_id)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
              >
                Ver publicação oficial no Facebook <ArrowSquareOut size={13} />
              </a>
            </div>
          )}
          {post.link_url && (
            <div className="col-span-2 flex items-center gap-1 truncate">
              <LinkSimple size={14} className="shrink-0" />
              <span className="truncate">Link: {post.link_url}</span>
            </div>
          )}
        </div>

        {/* Inline Reschedule Form */}
        {rescheduling && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 space-y-2">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <CalendarBlank size={14} /> Selecione o novo dia e horário para publicar:
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="datetime-local"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-primary"
              />
              <Button
                size="sm"
                onClick={handleSaveReschedule}
                disabled={busy || !newTime}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Check size={14} /> {busy ? "Salvando…" : "Confirmar Reagendamento"}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setRescheduling(false)}
                disabled={busy}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
          <div className="flex items-center gap-2">
            {onDelete && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDelete}
                disabled={busy}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash size={14} /> Excluir
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onReschedule && !rescheduling && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setNewTime(toLocalInputValue(post.scheduled_at));
                  setRescheduling(true);
                }}
                disabled={busy}
              >
                <PencilSimple size={14} /> Reagendar
              </Button>
            )}

            {onPostNow && (
              <Button
                size="sm"
                onClick={handlePostNow}
                disabled={busy}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Rocket size={14} weight="fill" />
                {busy
                  ? "Publicando…"
                  : post.status === "failed"
                  ? "Tentar Publicar Agora"
                  : "Publicar Agora"}
              </Button>
            )}

            <Button size="sm" variant="secondary" onClick={onClose} disabled={busy}>
              Fechar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
