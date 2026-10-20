"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Images,
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
  Clock,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { facebookPostUrl } from "@/lib/types";
import type { ImageLibraryItem, ImageLibraryStatus } from "@/lib/types";

type FilterTab = "all" | "pending" | "published" | "failed";

const APPS_SCRIPT_IMAGES_CODE = `// Script Unificado do Google Apps Script para o Autobot (Vídeos & Imagens)
var FOLDER_ID = ""; // Opcional: Cole aqui o ID ou link da pasta (ou passe ?folderId= na URL)

function doGet(e) {
  var folderParam = (e && e.parameter && (e.parameter.folderId || e.parameter.id)) || FOLDER_ID;
  if (!folderParam) {
    return ContentService.createTextOutput(JSON.stringify({ 
      error: "Informe o ID da pasta na variavel FOLDER_ID no topo do script ou adicione ?folderId=SEU_ID na URL." 
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // Extrai o ID caso seja um link completo do Drive
  var match = folderParam.match(/\\/folders\\/([a-zA-Z0-9_-]+)/);
  var folderId = match ? match[1] : folderParam.trim();

  // Tipo solicitado pelo bot: 'image', 'video' ou 'all'
  var type = (e && e.parameter && e.parameter.type) ? e.parameter.type.toLowerCase() : "all";

  try {
    var folder = DriveApp.getFolderById(folderId);
    var files = folder.getFiles();
    var list = [];
    while (files.hasNext()) {
      var f = files.next();
      var mime = f.getMimeType();
      var name = f.getName();
      var isVideo = mime.indexOf("video/") === 0 || /\\.(mp4|mov|mkv|webm|avi|m4v)$/i.test(name);
      var isImage = mime.indexOf("image/") === 0 || /\\.(jpe?g|png|webp|gif|bmp|tiff|svg)$/i.test(name);

      if (type === "image" && isImage) {
        list.push({ id: f.getId(), name: name, size: f.getSize(), mimeType: mime });
      } else if (type === "video" && isVideo) {
        list.push({ id: f.getId(), name: name, size: f.getSize(), mimeType: mime });
      } else if (type === "all" && (isVideo || isImage)) {
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

export default function BatchImagesLibraryPage() {
  const [images, setImages] = useState<ImageLibraryItem[]>([]);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [appsScriptUrl, setAppsScriptUrl] = useState<string | null>(null);
  const [autoPostEnabled, setAutoPostEnabled] = useState(false);
  const [postsPerDay, setPostsPerDay] = useState(2);
  const [postingHours, setPostingHours] = useState<number[]>([10, 16]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  // Syncing state
  const [syncing, setSyncing] = useState(false);
  const [inputFolderId, setInputFolderId] = useState("");
  const [showScriptHelp, setShowScriptHelp] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Quick settings modal
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [modalFolderId, setModalFolderId] = useState("");
  const [modalAppsScriptUrl, setModalAppsScriptUrl] = useState("");
  const [modalAutoPost, setModalAutoPost] = useState(false);
  const [modalPostsPerDay, setModalPostsPerDay] = useState(2);
  const [modalPostingHours, setModalPostingHours] = useState<number[]>([10, 16]);

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
    const match =
      folderId.match(/[?&]folderId=([a-zA-Z0-9_-]+)/i) || folderId.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (match) return match[1];
    if (!folderId.includes("script.google.com")) return folderId;
    return null;
  }, [folderId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/batch-images");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao carregar lote de imagens.");
      setImages(data.images ?? []);
      setFolderId(data.folder_id ?? null);
      setAppsScriptUrl(data.apps_script_url ?? null);
      setAutoPostEnabled(data.auto_post_enabled === true);
      setPostsPerDay(data.posts_per_day || 2);
      setPostingHours(data.posting_hours || [10, 16]);
      if (data.folder_id && !inputFolderId) {
        setInputFolderId(data.folder_id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar lote de imagens.");
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
      const res = await fetch("/api/batch-images/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: inputFolderId.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao sincronizar pasta do Google Drive.");

      setSyncNotice(
        `Sincronização concluída! ${data.inserted ?? data.added ?? 0} novas imagens adicionadas (Total encontrado: ${data.found ?? 0}).`
      );
      await load();
      setTimeout(() => setSyncNotice(null), 6000);
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
      const res = await fetch("/api/batch-images/import-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ links: linksInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao importar links.");

      const msg = `Sucesso: ${data.inserted ?? 0} imagem(ns) importada(s) para o lote! ${
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

  async function handlePublishNow(item: ImageLibraryItem) {
    if (!confirm(`Deseja gerar a copy com IA e publicar a imagem "${item.title}" agora no Facebook?`)) {
      return;
    }
    setPublishingId(item.id);
    setActionSuccess(null);
    setError(null);
    try {
      const res = await fetch(`/api/batch-images/${item.id}/post-now`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao publicar imagem no Facebook.");

      setActionSuccess(`Imagem "${item.title}" publicada com sucesso no Facebook!`);
      await load();
      setTimeout(() => setActionSuccess(null), 6000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao publicar imagem.");
      await load();
    } finally {
      setPublishingId(null);
    }
  }

  async function handleDelete(item: ImageLibraryItem) {
    if (
      !confirm(
        `Tem certeza que deseja remover a imagem "${item.title}" do lote? O arquivo continuará salvo no seu Google Drive.`
      )
    ) {
      return;
    }
    setDeletingId(item.id);
    try {
      const res = await fetch(`/api/batch-images/${item.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Falha ao excluir imagem.");
      }
      setImages((prev) => prev.filter((i) => i.id !== item.id));
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
      const res = await fetch(`/api/batch-images/${editingItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editingItem.title.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Falha ao atualizar título.");
      }
      setImages((prev) =>
        prev.map((i) => (i.id === editingItem.id ? { ...i, title: editingItem.title.trim() } : i))
      );
      setEditingItem(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao atualizar título.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleResetToPending(item: ImageLibraryItem) {
    try {
      const res = await fetch(`/api/batch-images/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "pending" }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Falha ao repor para pendente.");
      }
      setImages((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: "pending", error_message: null } : i))
      );
      setActionSuccess(`Imagem "${item.title}" marcada novamente como pendente para a fila.`);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao alterar status.");
    }
  }

  function openSettingsModal() {
    setModalFolderId(folderId || "");
    setModalAppsScriptUrl(appsScriptUrl || "");
    setModalAutoPost(autoPostEnabled);
    setModalPostsPerDay(postsPerDay);
    setModalPostingHours(postingHours);
    setSettingsModalOpen(true);
  }

  async function handleSaveSettings() {
    setSavingSettings(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          google_drive_images_folder_id: modalFolderId.trim(),
          google_apps_script_images_url: modalAppsScriptUrl.trim(),
          images_auto_post_enabled: modalAutoPost,
          images_posts_per_day: Number(modalPostsPerDay) || 2,
          images_posting_hours: modalPostingHours,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao salvar configurações.");

      setFolderId(modalFolderId.trim() || null);
      setAppsScriptUrl(modalAppsScriptUrl.trim() || null);
      setAutoPostEnabled(modalAutoPost);
      setPostsPerDay(Number(modalPostsPerDay) || 2);
      setPostingHours(modalPostingHours);
      setSettingsModalOpen(false);
      setActionSuccess("Configurações de agendamento salvas com sucesso!");
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar configurações.");
    } finally {
      setSavingSettings(false);
    }
  }

  function toggleHour(hour: number) {
    const has = modalPostingHours.includes(hour);
    const next = has
      ? modalPostingHours.filter((h) => h !== hour)
      : [...modalPostingHours, hour].sort((a, b) => a - b);
    setModalPostingHours(next);
  }

  function copyCode() {
    navigator.clipboard.writeText(APPS_SCRIPT_IMAGES_CODE);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  }

  const counts = useMemo(() => {
    return {
      all: images.length,
      pending: images.filter((i) => i.status === "pending").length,
      published: images.filter((i) => i.status === "published").length,
      failed: images.filter((i) => i.status === "failed").length,
    };
  }, [images]);

  const filteredImages = useMemo(() => {
    return images.filter((img) => {
      if (tab !== "all" && img.status !== tab) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return img.title.toLowerCase().includes(q) || img.raw_filename.toLowerCase().includes(q);
    });
  }, [images, tab, search]);

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Lote de Imagens (Google Drive)
            </h1>
            <Badge className="border-primary/30 bg-primary/10 text-primary">
              Autopilot
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Sincronize imagens geradas em lote no Google Drive e publique-as automaticamente com cópia gerada por IA.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={openSettingsModal}
            className="flex items-center gap-1.5"
          >
            <GearSix size={16} />
            Agendamento &amp; Pasta
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setLinksModalOpen(true)}
            className="flex items-center gap-1.5"
          >
            <Plus size={16} />
            Colar Links
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5"
          >
            <ArrowsClockwise size={16} className={cn(syncing && "animate-spin")} />
            {syncing ? "Sincronizando..." : "Sincronizar Pasta"}
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <WarningCircle size={20} className="shrink-0" />
          <div className="flex-1">{error}</div>
          <button onClick={() => setError(null)} className="opacity-70 hover:opacity-100">
            <X size={16} />
          </button>
        </div>
      )}

      {actionSuccess && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle size={20} className="shrink-0" />
          <div className="flex-1">{actionSuccess}</div>
          <button onClick={() => setActionSuccess(null)} className="opacity-70 hover:opacity-100">
            <X size={16} />
          </button>
        </div>
      )}

      {syncNotice && (
        <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm text-primary">
          <Info size={20} className="shrink-0" />
          <div className="flex-1">{syncNotice}</div>
          <button onClick={() => setSyncNotice(null)} className="opacity-70 hover:opacity-100">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Status Bar / Setup info */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">Status do Autopilot:</span>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                  autoPostEnabled
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    : "bg-surface-2 text-muted-foreground"
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    autoPostEnabled ? "bg-emerald-500" : "bg-muted-foreground"
                  )}
                />
                {autoPostEnabled ? "Ativado" : "Pausado"}
              </span>
            </div>

            <span className="hidden text-muted-foreground/40 md:inline">|</span>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock size={15} />
              <span>
                {postsPerDay} post(s)/dia nos horários:{" "}
                <strong className="text-foreground">{postingHours.map((h) => `${h}h`).join(", ")}</strong>
              </span>
            </div>

            <span className="hidden text-muted-foreground/40 md:inline">|</span>

            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Folder size={15} />
              <span>
                Pasta Drive:{" "}
                {cleanDisplayFolderId ? (
                  <span className="font-mono text-foreground">{cleanDisplayFolderId}</span>
                ) : (
                  <span className="italic text-amber-500">Não configurada</span>
                )}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowScriptHelp(!showScriptHelp)}
              className="text-xs"
            >
              <Code size={14} className="mr-1" />
              {showScriptHelp ? "Ocultar Script Drive" : "Ver Script do Apps Script"}
              {showScriptHelp ? <CaretUp size={12} className="ml-1" /> : <CaretDown size={12} className="ml-1" />}
            </Button>
          </div>
        </div>

        {/* Apps script drawer */}
        {showScriptHelp && (
          <div className="mt-4 border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Google Apps Script (Web App para Leitura da Pasta de Imagens)
                </h4>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Permite que o bot liste os arquivos da sua pasta do Google Drive sem restrições ou chaves de API complexas.
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={copyCode} className="h-7 text-xs">
                {copiedCode ? <Check size={13} className="mr-1 text-emerald-500" /> : <Copy size={13} className="mr-1" />}
                {copiedCode ? "Copiado!" : "Copiar Código"}
              </Button>
            </div>
            <pre className="mt-2 max-h-48 overflow-x-auto rounded-lg bg-surface-2 p-3 font-mono text-xs text-foreground">
              {APPS_SCRIPT_IMAGES_CODE}
            </pre>
          </div>
        )}
      </Card>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1 rounded-xl bg-surface p-1 border border-border">
          <button
            onClick={() => setTab("all")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition",
              tab === "all"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Todas <span className="opacity-80">({counts.all})</span>
          </button>
          <button
            onClick={() => setTab("pending")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition",
              tab === "pending"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Pendentes <span className="opacity-80">({counts.pending})</span>
          </button>
          <button
            onClick={() => setTab("published")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition",
              tab === "published"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Publicadas <span className="opacity-80">({counts.published})</span>
          </button>
          <button
            onClick={() => setTab("failed")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition",
              tab === "failed"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Falhas <span className="opacity-80">({counts.failed})</span>
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título ou arquivo..."
            className="w-full rounded-xl border border-border bg-surface py-1.5 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      {/* Grid of Images */}
      {loading ? (
        <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-surface/50 text-muted-foreground">
          <ArrowsClockwise size={28} className="animate-spin text-primary" />
          <span className="text-sm">Carregando lote de imagens...</span>
        </div>
      ) : filteredImages.length === 0 ? (
        <div className="flex h-72 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-surface/50 p-6 text-center text-muted-foreground">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 text-muted-foreground">
            <Images size={28} />
          </div>
          <div>
            <h3 className="font-heading text-base font-semibold text-foreground">Nenhuma imagem encontrada</h3>
            <p className="mt-1 text-xs text-muted-foreground max-w-sm">
              {tab !== "all"
                ? `Não há imagens com o status "${tab}". Alterne a aba acima.`
                : "Sincronize sua pasta do Google Drive ou cole os links das imagens geradas em lote para começar."}
            </p>
          </div>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="primary" onClick={handleSync} disabled={syncing}>
              <ArrowsClockwise size={15} className={cn("mr-1.5", syncing && "animate-spin")} />
              Sincronizar Pasta
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setLinksModalOpen(true)}>
              <Plus size={15} className="mr-1.5" />
              Colar Links
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {filteredImages.map((item) => {
            const isPublishing = publishingId === item.id;
            const isDeleting = deletingId === item.id;
            const isEditing = editingItem?.id === item.id;

            return (
              <Card
                key={item.id}
                className="group flex flex-col overflow-hidden transition-all duration-200 hover:border-primary/40 hover:shadow-md"
              >
                {/* Image Preview Box */}
                <div className="relative aspect-square w-full overflow-hidden bg-black/10">
                  <img
                    src={`https://lh3.googleusercontent.com/d/${item.drive_file_id}`}
                    alt={item.title}
                    loading="lazy"
                    onError={(e) => {
                      // Fallback to direct uc download url if lh3 preview fails
                      (e.target as HTMLImageElement).src = `https://drive.google.com/uc?export=download&id=${item.drive_file_id}`;
                    }}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />

                  {/* Status Badge */}
                  <div className="absolute right-2 top-2">
                    {item.status === "published" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/90 px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm backdrop-blur-sm">
                        <CheckCircle size={12} weight="bold" />
                        Publicada
                      </span>
                    )}
                    {item.status === "pending" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/90 px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm backdrop-blur-sm">
                        <Clock size={12} weight="bold" />
                        Pendente
                      </span>
                    )}
                    {item.status === "failed" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/90 px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm backdrop-blur-sm">
                        <WarningCircle size={12} weight="bold" />
                        Falha
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Content */}
                <div className="flex flex-1 flex-col justify-between p-3.5">
                  <div className="space-y-1.5">
                    {/* Title or Inline Edit */}
                    {isEditing ? (
                      <div className="space-y-1.5">
                        <input
                          type="text"
                          value={editingItem.title}
                          onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                          className="w-full rounded-lg border border-primary bg-surface px-2 py-1 text-xs text-foreground focus:outline-none"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveTitle();
                            if (e.key === "Escape") setEditingItem(null);
                          }}
                        />
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={handleSaveTitle}
                            disabled={savingEdit}
                            className="h-6 px-2 text-[11px]"
                          >
                            Salvar
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setEditingItem(null)}
                            className="h-6 px-2 text-[11px]"
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-1.5">
                        <h4
                          className="font-medium text-xs text-foreground line-clamp-2 leading-snug"
                          title={item.title}
                        >
                          {item.title}
                        </h4>
                        <button
                          onClick={() => setEditingItem({ id: item.id, title: item.title })}
                          className="shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground transition"
                          title="Editar título"
                        >
                          <PencilSimple size={13} />
                        </button>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className="truncate max-w-[150px] font-mono opacity-80" title={item.raw_filename}>
                        {item.raw_filename}
                      </span>
                      {item.file_size && (
                        <>
                          <span>•</span>
                          <span>{(item.file_size / (1024 * 1024)).toFixed(1)} MB</span>
                        </>
                      )}
                    </div>

                    {item.error_message && (
                      <p
                        className="rounded bg-destructive/10 px-2 py-1 text-[11px] text-destructive line-clamp-2"
                        title={item.error_message}
                      >
                        {item.error_message}
                      </p>
                    )}
                  </div>

                  {/* Actions footer */}
                  <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2.5">
                    <div className="flex items-center gap-1">
                      {item.status === "published" && item.facebook_post_id && (
                        <a
                          href={facebookPostUrl(item.facebook_post_id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                        >
                          <ArrowSquareOut size={13} />
                          Ver Post
                        </a>
                      )}
                      {(item.status === "failed" || item.status === "published") && (
                        <button
                          onClick={() => handleResetToPending(item)}
                          className="text-[11px] text-muted-foreground hover:text-foreground transition"
                          title="Marcar como pendente para re-publicar"
                        >
                          Re-enfileirar
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleDelete(item)}
                        disabled={isDeleting}
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition"
                        title="Remover da lista"
                      >
                        <Trash size={14} />
                      </button>

                      {item.status !== "published" && (
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => handlePublishNow(item)}
                          disabled={isPublishing}
                          className="h-7 px-2.5 text-[11px] flex items-center gap-1"
                        >
                          {isPublishing ? (
                            <ArrowsClockwise size={12} className="animate-spin" />
                          ) : (
                            <Rocket size={12} />
                          )}
                          {isPublishing ? "Publicando..." : "Publicar"}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal: Adicionar Imagens por Link */}
      {linksModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-lg p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <LinkSimple size={20} className="text-primary" />
                <h3 className="font-heading text-lg font-semibold text-foreground">
                  Adicionar Imagens (Colar Links)
                </h3>
              </div>
              <button
                onClick={() => setLinksModalOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            <p className="mt-3 text-xs text-muted-foreground">
              Cole links de imagens do Google Drive (um por linha). Se desejar, coloque o tema/título personalizado na mesma linha após o link.
            </p>

            <textarea
              rows={6}
              value={linksInput}
              onChange={(e) => setLinksInput(e.target.value)}
              placeholder={`https://drive.google.com/file/d/1ABC... Dicas de Liderança\nhttps://drive.google.com/file/d/1XYZ... Como começar a investir`}
              className="mt-3 w-full rounded-xl border border-border bg-surface p-3 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
            />

            <div className="mt-4 flex items-center justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setLinksModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleImportLinks}
                disabled={importingLinks || !linksInput.trim()}
              >
                {importingLinks ? "Importando..." : "Importar Imagens"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Modal: Configuração de Pasta e Agendamento */}
      {settingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-xl p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <GearSix size={20} className="text-primary" />
                <h3 className="font-heading text-lg font-semibold text-foreground">
                  Configurar Pasta e Agendamento do Lote
                </h3>
              </div>
              <button
                onClick={() => setSettingsModalOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {/* Folder ID */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Link ou ID da Pasta do Google Drive
                </label>
                <input
                  type="text"
                  value={modalFolderId}
                  onChange={(e) => setModalFolderId(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/1aBcD... ou ID da pasta"
                  className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  A pasta onde suas imagens geradas em lote estão salvas. Deve estar compartilhada como &quot;Qualquer pessoa com o link pode ver&quot;.
                </p>
              </div>

              {/* Apps Script URL */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  URL do Google Apps Script (Web App)
                </label>
                <input
                  type="text"
                  value={modalAppsScriptUrl}
                  onChange={(e) => setModalAppsScriptUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Opcional, mas altamente recomendado para listar imagens sem restrições de cota ou APIs do Google.
                </p>
              </div>

              {/* Autopilot Toggle */}
              <div className="rounded-xl border border-border bg-surface-2/40 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">Publicação Automática (Autopilot)</h4>
                    <p className="text-xs text-muted-foreground">
                      Publica as imagens pendentes automaticamente respeitando o agendamento diário.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={modalAutoPost}
                    onClick={() => setModalAutoPost(!modalAutoPost)}
                    className={cn(
                      "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200",
                      modalAutoPost ? "bg-primary" : "bg-surface-2 border border-border"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 mt-1",
                        modalAutoPost ? "translate-x-6" : "translate-x-1"
                      )}
                    />
                  </button>
                </div>

                {modalAutoPost && (
                  <div className="mt-4 space-y-3 border-t border-border/60 pt-3">
                    <div>
                      <label className="text-xs font-medium text-foreground">
                        Imagens por dia: <span className="font-bold text-primary">{modalPostsPerDay}</span>
                      </label>
                      <input
                        type="range"
                        min={1}
                        max={10}
                        value={modalPostsPerDay}
                        onChange={(e) => setModalPostsPerDay(Number(e.target.value))}
                        className="mt-1 w-full accent-primary"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-foreground">
                        Horários permitidos (horário local configurado):
                      </label>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {Array.from({ length: 24 }).map((_, h) => {
                          const active = modalPostingHours.includes(h);
                          return (
                            <button
                              key={h}
                              type="button"
                              onClick={() => toggleHour(h)}
                              className={cn(
                                "h-7 w-8 rounded-lg text-xs font-medium transition",
                                active
                                  ? "bg-primary text-primary-foreground shadow-sm"
                                  : "border border-border bg-surface text-muted-foreground hover:text-foreground"
                              )}
                            >
                              {h}h
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2 border-t border-border pt-4">
              <Button variant="secondary" size="sm" onClick={() => setSettingsModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveSettings}
                disabled={savingSettings}
              >
                {savingSettings ? "Salvando..." : "Salvar Configurações"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
