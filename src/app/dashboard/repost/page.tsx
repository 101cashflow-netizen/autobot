"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowsClockwise,
  CheckCircle,
  WarningCircle,
  ArrowSquareOut,
  Sparkle,
  GearSix,
  FloppyDisk,
  ShareFat,
  FlagBanner,
} from "@phosphor-icons/react/dist/ssr";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { facebookPostUrl } from "@/lib/types";
import type { PageCache, RepostLog } from "@/lib/types";

export default function RepostPage() {
  const [pages, setPages] = useState<PageCache[]>([]);
  const [loading, setLoading] = useState(true);

  // Repost settings
  const [enabled, setEnabled] = useState(false);
  const [sourcePageId, setSourcePageId] = useState("");
  const [targetPageIds, setTargetPageIds] = useState<string[]>([]);
  const [aiRewrite, setAiRewrite] = useState(true);
  const [aiPrompt, setAiPrompt] = useState("");
  const [lastCheckAt, setLastCheckAt] = useState<string | null>(null);

  // States
  const [savingSettings, setSavingSettings] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Logs
  const [logs, setLogs] = useState<RepostLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const [pagesRes, settingsRes] = await Promise.all([
        fetch("/api/facebook/pages"),
        fetch("/api/settings"),
      ]);

      const pagesData = await pagesRes.json();
      const settingsData = await settingsRes.json();

      const pageList: PageCache[] = pagesData.pages ?? [];
      setPages(pageList);

      setEnabled(settingsData.repost_enabled === true);

      // Default source page to saved setting, or look for "milion" in page name, or first page
      if (settingsData.repost_source_page_id) {
        setSourcePageId(settingsData.repost_source_page_id);
      } else {
        const milionario = pageList.find((p) => p.name.toLowerCase().includes("milion"));
        if (milionario) {
          setSourcePageId(milionario.page_id);
        } else if (pageList.length > 0) {
          setSourcePageId(pageList[0].page_id);
        }
      }

      setTargetPageIds(settingsData.repost_target_page_ids || []);
      setAiRewrite(settingsData.repost_ai_rewrite !== false);
      setAiPrompt(settingsData.repost_ai_prompt || "");
      setLastCheckAt(settingsData.last_repost_check_at || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }

  async function loadLogs() {
    setLoadingLogs(true);
    try {
      const res = await fetch("/api/facebook/repost/logs");
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch {} finally {
      setLoadingLogs(false);
    }
  }

  useEffect(() => {
    loadData();
    loadLogs();
  }, []);

  async function saveSettings() {
    setError(null);
    setSuccess(null);
    setSavingSettings(true);

    try {
      const sourcePage = pages.find((p) => p.page_id === sourcePageId);
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repost_enabled: enabled,
          repost_source_page_id: sourcePageId || null,
          repost_source_page_name: sourcePage?.name || null,
          repost_target_page_ids: targetPageIds,
          repost_ai_rewrite: aiRewrite,
          repost_ai_prompt: aiPrompt || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Falha ao salvar configurações.");
      }

      setSuccess("Configurações de repostagem salvas com sucesso!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSavingSettings(false);
    }
  }

  async function triggerManualSync() {
    if (!sourcePageId) {
      setError("Selecione a página de origem primeiro.");
      return;
    }
    if (targetPageIds.length === 0) {
      setError("Selecione ao menos uma página de destino.");
      return;
    }

    setError(null);
    setSuccess(null);
    setSyncing(true);

    try {
      // Save settings first to make sure source/targets are updated
      const sourcePage = pages.find((p) => p.page_id === sourcePageId);
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repost_enabled: true,
          repost_source_page_id: sourcePageId,
          repost_source_page_name: sourcePage?.name || null,
          repost_target_page_ids: targetPageIds,
          repost_ai_rewrite: aiRewrite,
          repost_ai_prompt: aiPrompt || null,
        }),
      });
      setEnabled(true);

      const res = await fetch("/api/facebook/repost/sync", {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Erro ao sincronizar posts da página.");
      }

      const reposted = data.repostedCount || 0;
      const checked = data.checkedCount || 0;
      const skipped = data.skippedCount || 0;

      if (reposted > 0) {
        setSuccess(`Sucesso! ${reposted} novo(s) post(s) repostado(s) com sucesso.`);
      } else {
        setSuccess(`Verificação concluída: ${checked} post(s) analisado(s). Nenhum post novo pendente (${skipped} já repostados anteriormente).`);
      }

      setLastCheckAt(new Date().toISOString());
      loadLogs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao sincronizar.");
    } finally {
      setSyncing(false);
    }
  }

  const availableTargets = pages.filter((p) => p.page_id !== sourcePageId);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Top Banner / Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-xl font-bold text-foreground">
            Repostagem Automática de Conteúdo
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Monitore a <strong>Página Milionário</strong> (ou outra de sua escolha) e replique seus posts nas suas outras páginas automaticamente.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            onClick={triggerManualSync}
            disabled={syncing || loading}
            className="text-xs h-9"
          >
            <ArrowsClockwise size={16} className={cn("mr-1.5", syncing && "animate-spin")} />
            {syncing ? "Verificando e Repostando…" : "Sincronizar & Repostar Agora"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3.5 text-xs text-destructive">
          <WarningCircle size={18} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-xs text-emerald-600 dark:text-emerald-400">
          <CheckCircle size={18} className="shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Main Settings Card */}
      <Card>
        <div className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ShareFat size={22} weight="bold" />
              </div>
              <div>
                <h2 className="font-heading font-bold text-foreground text-sm">
                  Configuração de Repost Automático
                </h2>
                <p className="text-xs text-muted-foreground">
                  Alinhe a origem, o destino e as diretrizes de IA para suas publicações.
                </p>
              </div>
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-xs font-semibold text-foreground">
                Ativar Repostagem Automática
              </span>
            </label>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Página de Origem */}
            <div>
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <FlagBanner size={15} className="text-primary" />
                Página de Origem (Fonte do conteúdo)
              </label>
              <p className="text-[11px] text-muted-foreground mt-0.5 mb-2">
                Página cujos posts publicados serão monitorados e capturados.
              </p>

              <select
                value={sourcePageId}
                onChange={(e) => {
                  setSourcePageId(e.target.value);
                  // Remove from targets if selected as source
                  setTargetPageIds((prev) => prev.filter((id) => id !== e.target.value));
                }}
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs outline-none focus:border-primary font-medium"
              >
                <option value="">Selecione a página de origem…</option>
                {pages.map((p) => (
                  <option key={p.page_id} value={p.page_id}>
                    {p.name} {p.name.toLowerCase().includes("milion") ? "⭐ (Página Milionário)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Status & Last Run Info */}
            <div className="rounded-xl border border-border/70 bg-surface-2/40 p-3.5 flex flex-col justify-between text-xs">
              <div>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Status do Monitoramento
                </span>
                <div className="mt-1.5 flex items-center gap-2">
                  <span
                    className={cn(
                      "h-2.5 w-2.5 rounded-full",
                      enabled ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/50"
                    )}
                  />
                  <span className="font-semibold text-foreground">
                    {enabled ? "Autopilot Ativo (Verifica automaticamente)" : "Pausado / Inativo"}
                  </span>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-border/50 text-[11px] text-muted-foreground">
                Última checagem:{" "}
                <span className="font-mono text-foreground">
                  {lastCheckAt ? new Date(lastCheckAt).toLocaleString("pt-BR") : "Ainda não verificado"}
                </span>
              </div>
            </div>
          </div>

          {/* Páginas de Destino */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-semibold text-foreground">
                  Páginas de Destino ({targetPageIds.length} selecionada{targetPageIds.length === 1 ? "" : "s"})
                </label>
                <p className="text-[11px] text-muted-foreground">
                  Escolha para quais páginas o conteúdo da página de origem será replicado.
                </p>
              </div>

              {availableTargets.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (targetPageIds.length === availableTargets.length) {
                      setTargetPageIds([]);
                    } else {
                      setTargetPageIds(availableTargets.map((p) => p.page_id));
                    }
                  }}
                  className="text-xs text-primary font-medium hover:underline cursor-pointer"
                >
                  {targetPageIds.length === availableTargets.length
                    ? "Desmarcar todas"
                    : "Selecionar todas as páginas"}
                </button>
              )}
            </div>

            {availableTargets.length === 0 ? (
              <p className="text-xs text-muted-foreground p-3 rounded-xl border border-dashed border-border bg-surface-2/40">
                Nenhuma outra página disponível como destino. Conecte mais páginas ao seu Facebook.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 p-1 rounded-xl border border-border bg-surface-1/50 max-h-56 overflow-y-auto">
                {availableTargets.map((p) => {
                  const isChecked = targetPageIds.includes(p.page_id);
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
                            setTargetPageIds([...targetPageIds, p.page_id]);
                          } else {
                            setTargetPageIds(targetPageIds.filter((id) => id !== p.page_id));
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

          {/* Opções de IA */}
          <div className="rounded-xl border border-border bg-surface-2/20 p-4 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
                  <Sparkle size={16} className="text-primary" />
                  Reescrever Texto com Inteligência Artificial (Gemini)
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Reescreve gancho, legenda e hashtags mantendo o tema central. Essencial para evitar que o algoritmo do Facebook marque o post como conteúdo duplicado, maximizando o alcance orgânico da sua página.
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={aiRewrite}
                  onChange={(e) => setAiRewrite(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            {aiRewrite && (
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground">
                  Instruções extras para a IA ao reescrever (opcional)
                </label>
                <input
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Ex: Mantenha um tom motivacional sobre finanças e riqueza, e adicione uma chamada para ação no final..."
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs outline-none focus:border-primary"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <Button
              onClick={saveSettings}
              disabled={savingSettings || loading}
              className="text-xs h-9"
            >
              <FloppyDisk size={16} className="mr-1.5" />
              {savingSettings ? "Salvando…" : "Salvar Configurações de Repost"}
            </Button>
          </div>
        </div>
      </Card>

      {/* Logs / Histórico de Repostagens */}
      <Card>
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <h2 className="font-heading font-bold text-foreground text-sm">
                Histórico de Repostagens
              </h2>
              <Badge>{logs.length} registros</Badge>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={loadLogs}
              disabled={loadingLogs}
              className="text-xs h-8"
            >
              <ArrowsClockwise size={14} className={cn("mr-1", loadingLogs && "animate-spin")} />
              Atualizar
            </Button>
          </div>

          {logs.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              Nenhuma repostagem registrada ainda. Clique em &quot;Sincronizar &amp; Repostar Agora&quot; acima para testar.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground font-semibold">
                    <th className="pb-2">Post / Gancho</th>
                    <th className="pb-2">Origem</th>
                    <th className="pb-2">Destino</th>
                    <th className="pb-2">Data</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-surface-2/30 transition-colors">
                      <td className="py-2.5 pr-2 max-w-[240px]">
                        <p className="font-semibold text-foreground truncate">
                          {log.post_title || "Publicação"}
                        </p>
                        <p className="text-[10px] font-mono text-muted-foreground truncate">
                          ID: {log.source_post_id}
                        </p>
                      </td>
                      <td className="py-2.5 pr-2 whitespace-nowrap">
                        <span className="rounded bg-surface-2 px-2 py-0.5 text-[11px] text-foreground font-medium">
                          {log.source_page_name || "Origem"}
                        </span>
                      </td>
                      <td className="py-2.5 pr-2 whitespace-nowrap">
                        <span className="rounded bg-primary/10 text-primary px-2 py-0.5 text-[11px] font-medium">
                          {log.target_page_name || log.target_page_id}
                        </span>
                      </td>
                      <td className="py-2.5 pr-2 whitespace-nowrap text-muted-foreground text-[11px]">
                        {new Date(log.reposted_at).toLocaleString("pt-BR")}
                      </td>
                      <td className="py-2.5 pr-2 whitespace-nowrap">
                        {log.status === "success" ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium text-[11px]">
                            <CheckCircle size={14} /> Publicado
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 text-destructive font-medium text-[11px]"
                            title={log.error_message || "Erro"}
                          >
                            <WarningCircle size={14} /> Falha
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 text-right whitespace-nowrap">
                        {log.target_post_id ? (
                          <Link
                            href={facebookPostUrl(log.target_post_id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            Ver no FB <ArrowSquareOut size={13} />
                          </Link>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
