"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  VideoCamera,
  ArrowsClockwise,
  Rocket,
  Trash,
  PencilSimple,
  CheckCircle,
  WarningCircle,
  ArrowSquareOut,
  MagnifyingGlass,
  Check,
  X,
  GearSix,
  Folder,
  Info,
  Plus,
  LinkSimple,
  Copy,
  Code,
  CaretDown,
  CaretUp,
} from "@phosphor-icons/react/dist/ssr";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { facebookPostUrl } from "@/lib/types";
import type { VideoLibraryItem, VideoLibraryStatus } from "@/lib/types";

type FilterTab = "all" | "pending" | "published" | "failed";

const APPS_SCRIPT_CODE = `// 1. Cole aqui o ID ou link da sua pasta do Google Drive (ou passe ?folderId= na URL)
var FOLDER_ID = ""; // Exemplo: "1a2B3c4D5e..." ou link completo da pasta

function doGet(e) {
  var folderParam = (e && e.parameter && (e.parameter.folderId || e.parameter.id)) || FOLDER_ID;
  if (!folderParam) {
    return ContentService.createTextOutput(JSON.stringify({ 
      error: "Informe o ID da pasta na variavel FOLDER_ID no topo do script ou adicione ?folderId=SEU_ID no final da URL." 
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // Extrai o ID caso seja um link completo do Drive
  var match = folderParam.match(/\\/folders\\/([a-zA-Z0-9_-]+)/);
  var folderId = match ? match[1] : folderParam.trim();

  try {
    var folder = DriveApp.getFolderById(folderId);
    var files = folder.getFiles();
    var list = [];
    while (files.hasNext()) {
      var f = files.next();
      var mime = f.getMimeType();
      var name = f.getName();
      if (mime.indexOf("video/") === 0 || /\\.(mp4|mov|mkv|webm|avi|m4v)$/i.test(name)) {
        list.push({ id: f.getId(), name: name, size: f.getSize(), mimeType: mime });
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ files: list }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
`;

export default function ReelsLibraryPage() {
  const [videos, setVideos] = useState<VideoLibraryItem[]>([]);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [appsScriptUrl, setAppsScriptUrl] = useState<string | null>(null);
  const [autoPostEnabled, setAutoPostEnabled] = useState(false);
  const [postsPerDay, setPostsPerDay] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  // Syncing state
  const [syncing, setSyncing] = useState(false);
  const [inputFolderId, setInputFolderId] = useState("");
  const [showScriptHelp, setShowScriptHelp] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Link import modal
  const [linksModalOpen, setLinksModalOpen] = useState(false);
  const [linksInput, setLinksInput] = useState("");
  const [importingLinks, setImportingLinks] = useState(false);

  // Filter & Search
  const [tab, setTab] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");

  // Item actions state
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<{ id: string; title: string } | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const cleanDisplayFolderId = useMemo(() => {
    if (!folderId) return null;
    const match = folderId.match(/[?&]folderId=([a-zA-Z0-9_-]+)/i) || folderId.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (match) return match[1];
    if (!folderId.includes("script.google.com")) return folderId;
    return null;
  }, [folderId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/reels");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao carregar biblioteca de vídeos.");
      setVideos(data.videos ?? []);
      setFolderId(data.folder_id ?? null);
      setAppsScriptUrl(data.apps_script_url ?? null);
      setAutoPostEnabled(data.auto_post_enabled === true);
      setPostsPerDay(data.posts_per_day || 1);
      if (data.folder_id && !inputFolderId) {
        setInputFolderId(data.folder_id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar vídeos.");
    } finally {
      setLoading(false);
    }
  }, [inputFolderId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSync() {
    setSyncing(true);
    setSyncNotice(null);
    setError(null);
    try {
      const res = await fetch("/api/reels/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder_id: inputFolderId.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao sincronizar pasta do Google Drive.");

      setSyncNotice(
        `Sincronização concluída! ${data.inserted ?? data.added ?? 0} novos vídeos adicionados (Total na pasta: ${data.found ?? 0}).`
      );
      await load();
      setTimeout(() => setSyncNotice(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro na sincronização.");
    } finally {
      setSyncing(false);
    }
  }

  async function handleImportLinks() {
    if (!linksInput.trim()) return;
    setImportingLinks(true);
    setError(null);
    try {
      const res = await fetch("/api/reels/import-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ links: linksInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao importar links.");

      const msg = `Sucesso: ${data.inserted ?? 0} vídeo(s) importado(s) para a biblioteca! ${
        data.existing > 0 ? `(${data.existing} já existiam)` : ""
      }`;
      setActionSuccess(msg);
      setLinksInput("");
      setLinksModalOpen(false);
      await load();
      setTimeout(() => setActionSuccess(null), 6000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao importar links.");
    } finally {
      setImportingLinks(false);
    }
  }

  async function handlePublishNow(item: VideoLibraryItem) {
    if (!confirm(`Deseja gerar a copy com IA e publicar o vídeo "${item.title}" agora no Facebook Reels?`)) {
      return;
    }
    setPublishingId(item.id);
    setActionSuccess(null);
    setError(null);
    try {
      const res = await fetch(`/api/reels/${item.id}/post-now`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao publicar Reel no Facebook.");

      setActionSuccess(`Reel "${item.title}" publicado com sucesso no Facebook!`);
      await load();
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao publicar Reel.");
      await load();
    } finally {
      setPublishingId(null);
    }
  }

  async function handleDelete(item: VideoLibraryItem) {
    if (!confirm(`Tem certeza que deseja remover o vídeo "${item.title}" da biblioteca? O arquivo continuará salvo no seu Google Drive.`)) {
      return;
    }
    setDeletingId(item.id);
    try {
      const res = await fetch(`/api/reels/${item.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Falha ao excluir item.");
      }
      setVideos((prev) => prev.filter((v) => v.id !== item.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao excluir item.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSaveTitle() {
    if (!editingItem) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/reels/${editingItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editingItem.title.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Falha ao atualizar título.");
      }
      setVideos((prev) =>
        prev.map((v) => (v.id === editingItem.id ? { ...v, title: editingItem.title.trim() } : v))
      );
      setEditingItem(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao atualizar título.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleResetToPending(item: VideoLibraryItem) {
    try {
      const res = await fetch(`/api/reels/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "pending" }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Falha ao redefinir status.");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao redefinir status.");
    }
  }

  function copyScriptCode() {
    navigator.clipboard.writeText(APPS_SCRIPT_CODE);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  }

  // Counts
  const pendingCount = videos.filter((v) => v.status === "pending").length;
  const publishedCount = videos.filter((v) => v.status === "published").length;
  const failedCount = videos.filter((v) => v.status === "failed").length;

  const filteredVideos = useMemo(() => {
    return videos.filter((v) => {
      if (tab === "pending" && v.status !== "pending") return false;
      if (tab === "published" && v.status !== "published") return false;
      if (tab === "failed" && v.status !== "failed") return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesTitle = v.title.toLowerCase().includes(q);
        const matchesFile = v.raw_filename.toLowerCase().includes(q);
        return matchesTitle || matchesFile;
      }
      return true;
    });
  }, [videos, tab, search]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-bold text-foreground">
              Biblioteca de Vídeos &amp; Reels
            </h1>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              Google Drive &amp; Gemini 3.6
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Vídeos curtos (Google Flow) armazenados no Google Drive, legendados com IA e publicados nos Reels sem consumir storage do Supabase.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => setLinksModalOpen(true)}
            className="gap-1.5 shadow"
          >
            <Plus size={16} weight="bold" />
            Adicionar Vídeos (Colar Links)
          </Button>

          <Button
            size="sm"
            variant="secondary"
            onClick={handleSync}
            disabled={syncing}
            className="gap-1.5"
          >
            <ArrowsClockwise size={16} className={cn(syncing && "animate-spin")} />
            {syncing ? "Sincronizando…" : "Sincronizar Pasta"}
          </Button>

          <Link href="/dashboard/settings">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <GearSix size={16} />
              Configurar Autopilot
            </Button>
          </Link>
        </div>
      </div>

      {/* Notices & Errors */}
      {error && (
        <div className="flex items-center justify-between rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-sm text-destructive">
          <div className="flex items-center gap-2">
            <WarningCircle size={18} className="shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="p-1 text-destructive/80 hover:text-destructive">
            <X size={16} />
          </button>
        </div>
      )}

      {syncNotice && (
        <div className="flex items-center justify-between rounded-xl border border-success/30 bg-success/10 p-3.5 text-sm text-success">
          <div className="flex items-center gap-2">
            <CheckCircle size={18} className="shrink-0" />
            <span>{syncNotice}</span>
          </div>
          <button onClick={() => setSyncNotice(null)} className="p-1 text-success/80 hover:text-success">
            <X size={16} />
          </button>
        </div>
      )}

      {actionSuccess && (
        <div className="flex items-center justify-between rounded-xl border border-success/30 bg-success/10 p-3.5 text-sm text-success">
          <div className="flex items-center gap-2">
            <CheckCircle size={18} className="shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="p-1 text-success/80 hover:text-success">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Total na Biblioteca</span>
            <VideoCamera size={18} />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{videos.length}</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Pendentes</span>
            <Folder size={18} />
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-500">{pendingCount}</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Publicados no Facebook</span>
            <CheckCircle size={18} />
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-500">{publishedCount}</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Falhas</span>
            <WarningCircle size={18} />
          </div>
          <p className="mt-2 text-2xl font-bold text-destructive">{failedCount}</p>
        </Card>
      </div>

      {/* Drive Folder Connection Banner */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Folder size={20} weight="fill" />
            </div>
            <div>
              <h3 className="font-heading text-sm font-semibold text-foreground">
                Pasta Sincronizada do Google Drive
              </h3>
              <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2 mt-0.5">
                {cleanDisplayFolderId ? (
                  <span className="flex items-center gap-1.5">
                    Pasta: <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-foreground">{cleanDisplayFolderId}</code>
                    <a
                      href={`https://drive.google.com/drive/folders/${cleanDisplayFolderId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-0.5"
                    >
                      Abrir no Drive
                      <ArrowSquareOut size={12} />
                    </a>
                  </span>
                ) : folderId ? (
                  <span>
                    Pasta atual: <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-foreground text-[11px] truncate max-w-[280px] inline-block align-middle">{folderId}</code>
                  </span>
                ) : (
                  <span>Nenhuma pasta configurada. Você pode colar o link da pasta abaixo ou em Configurações.</span>
                )}

                {(appsScriptUrl || (folderId && folderId.includes("script.google.com"))) && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                    <Check size={11} />
                    Ponte Apps Script Ativa
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1 w-full sm:w-auto">
            <div className="flex w-full items-center gap-2">
              <input
                type="text"
                value={inputFolderId}
                onChange={(e) => setInputFolderId(e.target.value)}
                placeholder={folderId ? "Digite para trocar de pasta (ou vazio para usar a atual)" : "Link da pasta do Google Drive"}
                className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary sm:w-80"
              />
              <Button
                size="sm"
                onClick={handleSync}
                disabled={syncing || (!inputFolderId.trim() && !folderId && !appsScriptUrl)}
                className="shrink-0"
              >
                {syncing ? "Sincronizando…" : "Sincronizar"}
              </Button>
            </div>
            {inputFolderId.includes("script.google.com/macros/s/") &&
              !inputFolderId.includes("folderId=") &&
              !inputFolderId.includes("id=") && (
                <p className="text-[11px] text-amber-500">
                  ⚠️ Adicione <code>?folderId=ID_OU_LINK_DA_PASTA</code> no final da URL para que o script saiba qual pasta ler!
                </p>
              )}
          </div>
        </div>

        {/* Quick helper for Apps Script Bridge */}
        <div className="mt-3 border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setShowScriptHelp(!showScriptHelp)}
            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <Code size={14} />
            <span>
              {showScriptHelp
                ? "Ocultar instruções de sincronização automática via Google Apps Script"
                : "💡 Quer sincronização 100% automática da pasta sem restrições de API Key? Veja como (1 minuto, gratuito)"}
            </span>
            {showScriptHelp ? <CaretUp size={12} /> : <CaretDown size={12} />}
          </button>

          {showScriptHelp && (
            <div className="mt-3 rounded-xl border border-border bg-surface-2/60 p-3.5 text-xs text-muted-foreground space-y-2">
              <p className="font-semibold text-foreground">
                Por que o Google Drive rejeita buscas de pastas com API Key?
              </p>
              <p>
                O Google Drive bloqueou a listagem de pastas por chave de API simples (exige OAuth2 de usuário ou Service Account).
                A forma mais fácil e sem burocracia de contornar isso para ler pastas inteiras é criando um <strong>Google Apps Script Web App</strong> em sua conta Google:
              </p>
              <ol className="list-decimal list-inside space-y-1 pl-1">
                <li>
                  Acesse <a href="https://script.google.com/home/start" target="_blank" rel="noopener noreferrer" className="text-primary underline">script.google.com</a> e clique em <strong>+ Novo projeto</strong>.
                </li>
                <li>
                  Cole o código abaixo substituindo o conteúdo padrão:
                </li>
              </ol>

              <div className="relative rounded-lg bg-background p-2.5 font-mono text-[11px] text-foreground border border-border">
                <button
                  type="button"
                  onClick={copyScriptCode}
                  className="absolute right-2 top-2 rounded bg-surface px-2 py-1 text-[11px] text-primary hover:bg-border flex items-center gap-1"
                >
                  {copiedCode ? <Check size={12} /> : <Copy size={12} />}
                  {copiedCode ? "Copiado!" : "Copiar Código"}
                </button>
                <pre className="overflow-x-auto pr-24 whitespace-pre-wrap">{APPS_SCRIPT_CODE}</pre>
              </div>

              <ol start={3} className="list-decimal list-inside space-y-1 pl-1">
                <li>
                  No topo, clique em <strong>Implantar &gt; Nova implantação</strong>.
                </li>
                <li>
                  Em <em>Tipo de implantação</em> (ícone de engrenagem), selecione <strong>App da Web</strong>.
                </li>
                <li>
                  Em <em>Executar como</em> selecione <strong>Eu</strong>, e em <em>Quem pode acessar</em> selecione <strong>Qualquer pessoa</strong>. Clique em <strong>Implantar</strong>.
                </li>
                <li>
                  Copie o link gerado (termina em <code>/exec</code>) e cole no campo de pasta acima adicionando <code>?folderId=ID_DA_PASTA</code> no final (ex: <code>https://script.google.com/.../exec?folderId=1a2B3c...</code>) ou preencha <code>var FOLDER_ID = &quot;...&quot;</code> no topo do script.
                </li>
              </ol>
            </div>
          )}
        </div>

        {/* Autopilot Status Strip */}
        <div className="mt-3 flex flex-wrap items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                autoPostEnabled ? "bg-success" : "bg-muted-foreground"
              )}
            />
            <span>
              Autopilot de Reels:{" "}
              <strong className="text-foreground">
                {autoPostEnabled ? `Ativo (${postsPerDay}x ao dia)` : "Desativado"}
              </strong>
            </span>
          </div>

          <Link href="/dashboard/settings" className="font-medium text-primary hover:underline">
            Ajustar horários no Autopilot ↗
          </Link>
        </div>
      </Card>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-1.5 overflow-x-auto rounded-xl border border-border bg-surface p-1">
          <button
            onClick={() => setTab("all")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition",
              tab === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-surface-2"
            )}
          >
            Todos ({videos.length})
          </button>
          <button
            onClick={() => setTab("pending")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition",
              tab === "pending" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-surface-2"
            )}
          >
            Pendentes ({pendingCount})
          </button>
          <button
            onClick={() => setTab("published")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition",
              tab === "published" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-surface-2"
            )}
          >
            Publicados ({publishedCount})
          </button>
          <button
            onClick={() => setTab("failed")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition",
              tab === "failed" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-surface-2"
            )}
          >
            Falhas ({failedCount})
          </button>
        </div>

        <div className="relative">
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título ou arquivo…"
            className="w-full rounded-xl border border-border bg-surface pl-9 pr-3 py-1.5 text-xs outline-none focus:border-primary sm:w-64"
          />
        </div>
      </div>

      {/* Video List */}
      {loading ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          Carregando biblioteca de vídeos…
        </Card>
      ) : filteredVideos.length === 0 ? (
        <Card className="p-12 text-center">
          <VideoCamera size={36} className="mx-auto text-muted-foreground/50" />
          <h3 className="mt-3 font-heading text-base font-semibold text-foreground">
            Nenhum vídeo encontrado
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {videos.length === 0
              ? "Sua biblioteca está vazia. Adicione os links dos seus vídeos acima para começar a publicar."
              : "Nenhum vídeo corresponde ao filtro ou busca selecionada."}
          </p>
          {videos.length === 0 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <Button size="sm" onClick={() => setLinksModalOpen(true)} className="gap-1.5">
                <Plus size={15} />
                Adicionar Vídeos (Colar Links)
              </Button>
            </div>
          )}
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredVideos.map((item) => {
            const isPublishing = publishingId === item.id;
            const isDeleting = deletingId === item.id;

            return (
              <Card
                key={item.id}
                className={cn(
                  "flex flex-col gap-4 p-4 transition md:flex-row md:items-center md:justify-between",
                  item.status === "failed" && "border-destructive/30 bg-destructive/5"
                )}
              >
                {/* Left: Video Info */}
                <div className="flex min-w-0 flex-1 items-start gap-3.5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-primary">
                    <VideoCamera size={24} weight="duotone" />
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-heading text-sm font-bold text-foreground">
                        {item.title}
                      </h4>

                      {/* Status Badges */}
                      {item.status === "pending" && (
                        <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                          Pendente
                        </span>
                      )}
                      {item.status === "published" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                          <CheckCircle size={12} weight="fill" />
                          Publicado no Facebook
                        </span>
                      )}
                      {item.status === "failed" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                          <WarningCircle size={12} weight="fill" />
                          Falha no Envio
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono text-[11px]">{item.raw_filename}</span>
                      {item.file_size ? (
                        <span>· {(item.file_size / (1024 * 1024)).toFixed(1)} MB</span>
                      ) : null}
                      <span>·</span>
                      <a
                        href={item.video_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        Ver no Drive
                        <ArrowSquareOut size={12} />
                      </a>
                    </div>

                    {/* Published details */}
                    {item.status === "published" && item.facebook_post_id && (
                      <div className="pt-1 text-xs text-muted-foreground">
                        <span>Post ID: </span>
                        <a
                          href={facebookPostUrl(item.facebook_post_id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-primary hover:underline"
                        >
                          Abrir no Facebook ↗
                        </a>
                        {item.published_at && (
                          <span className="ml-2 text-[11px]">
                            ({new Date(item.published_at).toLocaleString("pt-BR")})
                          </span>
                        )}
                      </div>
                    )}

                    {/* Failure details */}
                    {item.status === "failed" && item.error_message && (
                      <p className="rounded-lg bg-destructive/10 p-2 text-xs text-destructive">
                        <strong>Erro:</strong> {item.error_message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex shrink-0 flex-wrap items-center gap-2 self-end md:self-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingItem({ id: item.id, title: item.title })}
                    title="Editar título/assunto do vídeo"
                    className="h-8 px-2 text-xs"
                  >
                    <PencilSimple size={14} />
                    <span className="ml-1 hidden sm:inline">Editar</span>
                  </Button>

                  {item.status === "failed" && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleResetToPending(item)}
                      title="Voltar para status pendente"
                      className="h-8 px-2 text-xs"
                    >
                      <ArrowsClockwise size={14} />
                      <span className="ml-1">Reagendar</span>
                    </Button>
                  )}

                  {item.status !== "published" && (
                    <Button
                      size="sm"
                      onClick={() => handlePublishNow(item)}
                      disabled={isPublishing}
                      className="h-8 gap-1.5 text-xs"
                    >
                      <Rocket size={14} />
                      {isPublishing ? "Publicando…" : "Publicar Agora"}
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(item)}
                    disabled={isDeleting}
                    title="Excluir da biblioteca"
                    className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10"
                  >
                    <Trash size={14} />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal Importar Links */}
      {linksModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-border bg-surface p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LinkSimple size={20} className="text-primary" />
                <h3 className="font-heading text-base font-bold text-foreground">
                  Adicionar Vídeos (Colar Links)
                </h3>
              </div>
              <button
                onClick={() => setLinksModalOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Cole os links de compartilhamento dos seus vídeos do Google Drive abaixo. Você pode colar <strong>vários links de uma vez</strong> (um por linha). Se desejar, pode incluir o título desejado após o link na mesma linha.
            </p>

            <div>
              <label className="text-xs font-semibold text-muted-foreground">
                Links dos Vídeos
              </label>
              <textarea
                rows={6}
                value={linksInput}
                onChange={(e) => setLinksInput(e.target.value)}
                placeholder={`https://drive.google.com/file/d/1ABC123xyz.../view?usp=sharing\nhttps://drive.google.com/file/d/2DEF456uvw.../view Aula 02 - Dicas de Marketing\nhttps://drive.google.com/file/d/3GHI789rst.../view`}
                className="mt-1 w-full rounded-xl border border-border bg-background p-3 font-mono text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                autoFocus
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Dica: Certifique-se de que os vídeos estejam com acesso &ldquo;Qualquer pessoa com o link pode ver&rdquo; no Google Drive.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLinksModalOpen(false)}
                disabled={importingLinks}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleImportLinks}
                disabled={importingLinks || !linksInput.trim()}
                className="gap-1.5"
              >
                <Plus size={15} />
                {importingLinks ? "Importando…" : "Importar Vídeos para a Biblioteca"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Title Editor Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-base font-bold text-foreground">
                Editar Assunto / Título do Vídeo
              </h3>
              <button
                onClick={() => setEditingItem(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            <p className="mt-1 text-xs text-muted-foreground">
              Este título é utilizado pela IA Gemini 3.6-Flash para entender o tema do vídeo e redigir a legenda, chamada para ação (CTA) e hashtags alinhadas.
            </p>

            <div className="mt-4">
              <label className="text-xs font-semibold text-muted-foreground">
                Título descritivo
              </label>
              <input
                type="text"
                value={editingItem.title}
                onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm outline-none focus:border-primary"
                autoFocus
              />
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingItem(null)}
                disabled={savingEdit}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleSaveTitle}
                disabled={savingEdit || !editingItem.title.trim()}
              >
                {savingEdit ? "Salvando…" : "Salvar Alterações"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Helpful Tips Card */}
      <Card className="p-4 text-xs text-muted-foreground">
        <div className="flex items-start gap-2.5">
          <Info size={18} className="mt-0.5 shrink-0 text-primary" />
          <div className="space-y-1">
            <h4 className="font-semibold text-foreground">Como funciona a Automação de Reels com Google Drive?</h4>
            <p>
              1. <strong>Gere seus vídeos:</strong> Salve os vídeos gerados no Google Flow ou seu editor na pasta compartilhada do seu Google Drive.
            </p>
            <p>
              2. <strong>Importação sem esforço:</strong> Cole os links de compartilhamento pelo botão <em>&ldquo;Adicionar Vídeos (Colar Links)&rdquo;</em> ou use o Google Apps Script para sincronização de pastas. Os vídeos NÃO ocupam o armazenamento do Supabase, pois são transmitidos diretamente do Google Drive para o Facebook via link de streaming seguro.
            </p>
            <p>
              3. <strong>Copywriting Inteligente:</strong> Ao publicar, o bot lê o assunto do vídeo e aciona o Gemini 3.6-Flash para criar uma copy persuasiva de alta conversão para o formato Reels.
            </p>
            <p>
              4. <strong>Proteção contra duplicidade:</strong> Após postado com sucesso, o vídeo é marcado permanentemente como &ldquo;Publicado&rdquo; para que nunca seja postado novamente de forma automática.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
