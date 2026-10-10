"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  FacebookLogo,
  CheckCircle,
  WarningCircle,
  LinkSimple,
  LinkBreak,
  Key,
  Copy,
  Check,
  Sparkle,
  User,
  VideoCamera,
  Robot,
  Camera,
  Lightning,
} from "@phosphor-icons/react/dist/ssr";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { CopyLanguage, CopyLength, CopyTone, ImageSourcePref, TextAiProviderPref } from "@/lib/types";

const TIMEZONES = [
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Dhaka",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Australia/Sydney",
  "UTC",
];

interface SettingsState {
  facebook_connected: boolean;
  /** False when the deployment has no real Meta app credentials. */
  facebook_configured?: boolean;
  facebook_app_id: string | null;
  facebook_config_id: string | null;
  /** The secret itself never reaches the browser — only whether one is stored. */
  facebook_app_secret_set?: boolean;
  facebook_user_name: string | null;
  default_page_name: string | null;
  gemini_api_key_set?: boolean;
  gemini_configured_source?: "database" | "env" | "none";
  groq_api_key_set?: boolean;
  groq_configured_source?: "database" | "env" | "none";
  text_provider_pref?: TextAiProviderPref;
  gemini_enabled?: boolean;
  groq_enabled?: boolean;
  pollinations_enabled?: boolean;
  copy_language?: CopyLanguage;
  copy_length?: CopyLength;
  copy_tone?: CopyTone;
  copy_custom_rules?: string | null;
  avatar_enabled?: boolean;
  avatar_name?: string | null;
  avatar_prompt?: string | null;
  pexels_api_key_set?: boolean;
  pixabay_api_key_set?: boolean;
  stock_provider?: "pexels" | "pixabay" | "any";
  cloudflare_account_id?: string;
  cloudflare_configured?: boolean;
  pollinations_api_key_set?: boolean;
  image_source: ImageSourcePref;
  utm_suffix: string;
  auto_post_enabled: boolean;
  posts_per_day: number;
  posting_hours: number[];
  timezone: string;
  topic_source?: "mine" | "trending" | "mixed";
  google_drive_folder_id?: string;
  google_apps_script_url?: string;
  google_drive_api_key_set?: boolean;
  reels_auto_post_enabled?: boolean;
  reels_posts_per_day?: number;
  reels_posting_hours?: number[];
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <SettingsForm />
    </Suspense>
  );
}

function SettingsForm() {
  const params = useSearchParams();
  const [settings, setSettings] = useState<SettingsState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [configId, setConfigId] = useState("");
  const [savingCreds, setSavingCreds] = useState(false);
  const [credsError, setCredsError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"uri" | "domain" | null>(null);

  const [geminiKeyInput, setGeminiKeyInput] = useState("");
  const [savingGeminiKey, setSavingGeminiKey] = useState(false);
  const [geminiKeyError, setGeminiKeyError] = useState<string | null>(null);
  const [geminiKeySaved, setGeminiKeySaved] = useState(false);

  const [groqKeyInput, setGroqKeyInput] = useState("");
  const [savingGroqKey, setSavingGroqKey] = useState(false);
  const [groqKeyError, setGroqKeyError] = useState<string | null>(null);
  const [groqKeySaved, setGroqKeySaved] = useState(false);

  const [textProviderPref, setTextProviderPref] = useState<TextAiProviderPref>("auto");
  const [geminiEnabled, setGeminiEnabled] = useState(true);
  const [groqEnabled, setGroqEnabled] = useState(true);
  const [pollinationsEnabled, setPollinationsEnabled] = useState(true);

  const [copyLanguage, setCopyLanguage] = useState<CopyLanguage>("auto");
  const [copyLength, setCopyLength] = useState<CopyLength>("medium");
  const [copyTone, setCopyTone] = useState<CopyTone>("conversational");
  const [copyCustomRules, setCopyCustomRules] = useState("");
  const [savingGuidelines, setSavingGuidelines] = useState(false);
  const [guidelinesError, setGuidelinesError] = useState<string | null>(null);
  const [guidelinesSaved, setGuidelinesSaved] = useState(false);

  const [avatarEnabled, setAvatarEnabled] = useState(true);
  const [avatarName, setAvatarName] = useState("Nasha");
  const [avatarPrompt, setAvatarPrompt] = useState("");
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarSaved, setAvatarSaved] = useState(false);

  const [pexelsKeyInput, setPexelsKeyInput] = useState("");
  const [pixabayKeyInput, setPixabayKeyInput] = useState("");
  const [stockProvider, setStockProvider] = useState<"pexels" | "pixabay" | "any">("any");
  const [savingStockKeys, setSavingStockKeys] = useState(false);
  const [stockKeysError, setStockKeysError] = useState<string | null>(null);
  const [stockKeysSaved, setStockKeysSaved] = useState(false);

  const [cfAccountIdInput, setCfAccountIdInput] = useState("");
  const [cfApiTokenInput, setCfApiTokenInput] = useState("");
  const [pollinationsKeyInput, setPollinationsKeyInput] = useState("");
  const [savingImageAiKeys, setSavingImageAiKeys] = useState(false);
  const [imageAiKeysError, setImageAiKeysError] = useState<string | null>(null);
  const [imageAiKeysSaved, setImageAiKeysSaved] = useState(false);

  const [driveFolderId, setDriveFolderId] = useState("");
  const [appsScriptUrl, setAppsScriptUrl] = useState("");
  const [driveApiKeyInput, setDriveApiKeyInput] = useState("");
  const [savingDrive, setSavingDrive] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [driveSaved, setDriveSaved] = useState(false);
  const [reelsAutoPostEnabled, setReelsAutoPostEnabled] = useState(false);
  const [reelsPostsPerDay, setReelsPostsPerDay] = useState(1);
  const [reelsPostingHours, setReelsPostingHours] = useState<number[]>([11, 17]);
  // Read from the browser rather than configured, so they always match the
  // hostname the user is actually on — the values Facebook compares against.
  const [redirectUri, setRedirectUri] = useState("");
  const [appDomain, setAppDomain] = useState("");

  useEffect(() => {
    setRedirectUri(`${window.location.origin}/api/facebook/oauth/callback`);
    setAppDomain(window.location.hostname);
  }, []);

  const oauthStatus = params.get("facebook");
  const oauthMessage = params.get("message");

  useEffect(() => {
    fetch("/api/settings")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Failed to load settings.");
        setSettings(data);
        setAppId(data.facebook_app_id ?? "");
        setConfigId(data.facebook_config_id ?? "");
        setTextProviderPref(data.text_provider_pref ?? "auto");
        setGeminiEnabled(data.gemini_enabled !== false);
        setGroqEnabled(data.groq_enabled !== false);
        setPollinationsEnabled(data.pollinations_enabled !== false);
        setCopyLanguage(data.copy_language ?? "auto");
        setCopyLength(data.copy_length ?? "medium");
        setCopyTone(data.copy_tone ?? "conversational");
        setCopyCustomRules(data.copy_custom_rules ?? "");
        setAvatarEnabled(data.avatar_enabled !== false);
        setAvatarName(data.avatar_name ?? "Nasha");
        setAvatarPrompt(data.avatar_prompt ?? "");
        setStockProvider(data.stock_provider ?? "any");
        setCfAccountIdInput(data.cloudflare_account_id ?? "");
        setDriveFolderId(data.google_drive_folder_id ?? "");
        setAppsScriptUrl(data.google_apps_script_url ?? "");
        setReelsAutoPostEnabled(data.reels_auto_post_enabled === true);
        setReelsPostsPerDay(data.reels_posts_per_day || 1);
        setReelsPostingHours(data.reels_posting_hours || [11, 17]);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Failed to load settings."));
  }, []);

  async function saveCredentials() {
    setCredsError(null);
    if (!appId.trim()) {
      setCredsError("Enter the App ID from your Meta app.");
      return;
    }
    // An already-stored secret is left alone unless a new one is typed, so the
    // masked field does not have to round-trip the real value.
    if (!appSecret.trim() && !settings?.facebook_app_secret_set) {
      setCredsError("Enter the App Secret from App settings > Basic.");
      return;
    }

    setSavingCreds(true);
    try {
      const res = await fetch("/api/facebook/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appId: appId.trim(),
          appSecret: appSecret.trim() || undefined,
          configId: configId.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save those credentials.");

      setAppSecret("");
      setSettings((s) =>
        s
          ? {
              ...s,
              facebook_app_id: appId.trim(),
              facebook_config_id: configId.trim() || null,
              facebook_app_secret_set: true,
              facebook_configured: true,
            }
          : s
      );
    } catch (err) {
      setCredsError(err instanceof Error ? err.message : "Couldn't save those credentials.");
    } finally {
      setSavingCreds(false);
    }
  }

  async function copyValue(value: string, which: "uri" | "domain") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCredsError("Copying failed — select the field and copy manually.");
    }
  }

  async function saveGeminiKey() {
    setGeminiKeyError(null);
    setGeminiKeySaved(false);
    if (!geminiKeyInput.trim() && !settings?.gemini_api_key_set) {
      setGeminiKeyError("Informe sua chave Gemini API.");
      return;
    }
    setSavingGeminiKey(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gemini_api_key: geminiKeyInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar chave.");
      setSettings((s) => (s ? { ...s, ...data } : s));
      setGeminiKeyInput("");
      setGeminiKeySaved(true);
      setTimeout(() => setGeminiKeySaved(false), 3000);
    } catch (err) {
      setGeminiKeyError(err instanceof Error ? err.message : "Erro ao salvar chave.");
    } finally {
      setSavingGeminiKey(false);
    }
  }

  async function saveGroqKey() {
    setGroqKeyError(null);
    setGroqKeySaved(false);
    if (!groqKeyInput.trim() && !settings?.groq_api_key_set) {
      setGroqKeyError("Informe sua chave Groq API.");
      return;
    }
    setSavingGroqKey(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groq_api_key: groqKeyInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar chave da Groq.");
      setSettings((s) => (s ? { ...s, ...data } : s));
      setGroqKeyInput("");
      setGroqKeySaved(true);
      setTimeout(() => setGroqKeySaved(false), 3000);
    } catch (err) {
      setGroqKeyError(err instanceof Error ? err.message : "Erro ao salvar chave da Groq.");
    } finally {
      setSavingGroqKey(false);
    }
  }

  async function saveAvatar() {
    setAvatarError(null);
    setAvatarSaved(false);
    setSavingAvatar(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          avatar_enabled: avatarEnabled,
          avatar_name: avatarName.trim(),
          avatar_prompt: avatarPrompt.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar avatar.");
      setSettings((s) => (s ? { ...s, ...data } : s));
      setAvatarSaved(true);
      setTimeout(() => setAvatarSaved(false), 3000);
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "Erro ao salvar avatar.");
    } finally {
      setSavingAvatar(false);
    }
  }

  async function saveStockKeys() {
    setStockKeysError(null);
    setStockKeysSaved(false);
    setSavingStockKeys(true);
    try {
      const payload: Record<string, any> = {
        stock_provider: stockProvider,
      };
      if (pexelsKeyInput.trim()) {
        payload.pexels_api_key = pexelsKeyInput.trim();
      }
      if (pixabayKeyInput.trim()) {
        payload.pixabay_api_key = pixabayKeyInput.trim();
      }
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar chaves de bancos de mídia.");
      setSettings((s) => (s ? { ...s, ...data } : s));
      setPexelsKeyInput("");
      setPixabayKeyInput("");
      setStockKeysSaved(true);
      setTimeout(() => setStockKeysSaved(false), 3000);
    } catch (err) {
      setStockKeysError(err instanceof Error ? err.message : "Erro ao salvar chaves.");
    } finally {
      setSavingStockKeys(false);
    }
  }

  async function saveImageAiKeys() {
    setImageAiKeysError(null);
    setImageAiKeysSaved(false);
    setSavingImageAiKeys(true);
    try {
      const payload: Record<string, string> = {
        cloudflare_account_id: cfAccountIdInput.trim(),
      };
      if (cfApiTokenInput.trim()) {
        payload.cloudflare_api_token = cfApiTokenInput.trim();
      }
      if (pollinationsKeyInput.trim()) {
        payload.pollinations_api_key = pollinationsKeyInput.trim();
      }

      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar chaves.");
      setSettings((s) => (s ? { ...s, ...data } : s));
      setCfApiTokenInput("");
      setPollinationsKeyInput("");
      setImageAiKeysSaved(true);
      setTimeout(() => setImageAiKeysSaved(false), 3000);
    } catch (err) {
      setImageAiKeysError(err instanceof Error ? err.message : "Erro ao salvar chaves de imagem.");
    } finally {
      setSavingImageAiKeys(false);
    }
  }

  async function saveGuidelines() {
    setGuidelinesError(null);
    setGuidelinesSaved(false);
    setSavingGuidelines(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          copy_language: copyLanguage,
          copy_length: copyLength,
          copy_tone: copyTone,
          copy_custom_rules: copyCustomRules.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar diretrizes de redação.");
      setSettings((s) => (s ? { ...s, ...data } : s));
      setGuidelinesSaved(true);
      setTimeout(() => setGuidelinesSaved(false), 3000);
    } catch (err) {
      setGuidelinesError(err instanceof Error ? err.message : "Erro ao salvar diretrizes.");
    } finally {
      setSavingGuidelines(false);
    }
  }

  async function save(patch: Partial<SettingsState>) {
    setSaving(true);
    setSaved(false);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const data = await res.json();
      setSettings((s) => (s ? { ...s, ...data } : s));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  }

  async function disconnect() {
    setDisconnecting(true);
    await fetch("/api/facebook/disconnect", { method: "POST" });
    setSettings((s) =>
      s ? { ...s, facebook_connected: false, facebook_user_name: null, default_page_name: null } : s
    );
    setDisconnecting(false);
  }

  function toggleHour(hour: number) {
    if (!settings) return;
    const has = settings.posting_hours.includes(hour);
    const next = has ? settings.posting_hours.filter((h) => h !== hour) : [...settings.posting_hours, hour].sort((a, b) => a - b);
    setSettings({ ...settings, posting_hours: next });
    save({ posting_hours: next });
  }

  async function saveDriveSettings() {
    setDriveError(null);
    setDriveSaved(false);
    setSavingDrive(true);
    try {
      const payload: Record<string, any> = {
        google_drive_folder_id: driveFolderId.trim(),
        google_apps_script_url: appsScriptUrl.trim(),
        reels_auto_post_enabled: reelsAutoPostEnabled,
        reels_posts_per_day: Number(reelsPostsPerDay) || 1,
        reels_posting_hours: reelsPostingHours,
      };
      if (driveApiKeyInput.trim()) {
        payload.google_drive_api_key = driveApiKeyInput.trim();
      }
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar configurações do Google Drive.");
      setSettings((s) => (s ? { ...s, ...data } : s));
      setDriveApiKeyInput("");
      setDriveSaved(true);
      setTimeout(() => setDriveSaved(false), 3000);
    } catch (err) {
      setDriveError(err instanceof Error ? err.message : "Erro ao salvar configurações do Google Drive.");
    } finally {
      setSavingDrive(false);
    }
  }

  function toggleReelsHour(hour: number) {
    const has = reelsPostingHours.includes(hour);
    const next = has ? reelsPostingHours.filter((h) => h !== hour) : [...reelsPostingHours, hour].sort((a, b) => a - b);
    setReelsPostingHours(next);
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-sm text-destructive">
        {loadError}
      </div>
    );
  }

  if (!settings) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {oauthStatus === "connected" && (
        <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 p-3.5 text-sm text-success">
          <CheckCircle size={18} /> Facebook account connected.
        </div>
      )}
      {oauthStatus === "error" && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-sm text-destructive">
          <WarningCircle size={18} /> {oauthMessage ?? "Couldn't connect Facebook."}
        </div>
      )}

      {/* Facebook connection */}
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FacebookLogo size={22} weight="fill" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-foreground">Facebook account</h2>
              {settings.facebook_connected ? (
                <p className="mt-0.5 text-sm text-success">
                  Connected as {settings.facebook_user_name ?? "your account"}
                </p>
              ) : settings.facebook_configured === false ? (
                <p className="mt-0.5 max-w-md text-sm text-muted-foreground">
                  Add your Meta App ID and secret below to enable connecting.
                  Everything else works without them.
                </p>
              ) : (
                <p className="mt-0.5 text-sm text-muted-foreground">Not connected yet</p>
              )}
            </div>
          </div>
          {settings.facebook_connected ? (
            <Button size="sm" variant="secondary" onClick={disconnect} disabled={disconnecting}>
              <LinkBreak size={14} /> Disconnect
            </Button>
          ) : (
            // A plain anchor on purpose: this route answers with a redirect to
            // Facebook, which needs a full page navigation. <Link> would try to
            // route it client-side.
            // eslint-disable-next-line @next/next/no-html-link-for-pages
            <a
              href="/api/facebook/oauth/start"
              aria-disabled={settings.facebook_configured === false}
              className={settings.facebook_configured === false ? "pointer-events-none" : undefined}
            >
              <Button size="sm" disabled={settings.facebook_configured === false}>
                <LinkSimple size={14} /> Connect
              </Button>
            </a>
          )}
        </div>
      </Card>

      {/* Meta app credentials */}
      <Card>
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-2 text-muted-foreground">
            <Key size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-heading font-bold text-foreground">Meta app</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Create one at{" "}
              <a
                href="https://developers.facebook.com/apps"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary hover:underline"
              >
                developers.facebook.com/apps
              </a>{" "}
              with the <strong>&quot;Manage everything on your Page&quot;</strong> use case — not
              the Facebook Login one, which Meta treats as incompatible with Page
              management. Posting to a Page you administer needs no App Review.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">App ID</label>
                <input
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                  placeholder="1234567890123456"
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">App Secret</label>
                <input
                  type="password"
                  value={appSecret}
                  onChange={(e) => setAppSecret(e.target.value)}
                  placeholder={
                    settings.facebook_app_secret_set ? "•••• saved — type to replace" : "from App settings > Basic"
                  }
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="text-xs font-semibold text-muted-foreground">
                Login configuration ID
              </label>
              <input
                value={configId}
                onChange={(e) => setConfigId(e.target.value)}
                placeholder="required if your app uses Facebook Login for Business"
                className="mt-1 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Apps created with the &quot;Manage everything on your Page&quot; use case use
                Facebook Login for Business, where this replaces the permission list.
                Find it under <strong>Facebook Login for Business → Configurations</strong>.
                Leave blank for classic Facebook Login.
              </p>
            </div>

            <div className="mt-3">
              <label className="text-xs font-semibold text-muted-foreground">
                Redirect URI — paste this into your Meta app&apos;s login settings, under Valid OAuth Redirect URIs
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  readOnly
                  value={redirectUri}
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 font-mono text-xs text-muted-foreground outline-none"
                />
                <Button size="sm" variant="secondary" onClick={() => copyValue(redirectUri, "uri")}>
                  {copied === "uri" ? <Check size={14} /> : <Copy size={14} />}
                  {copied === "uri" ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>

            <div className="mt-3">
              <label className="text-xs font-semibold text-muted-foreground">
                App Domain — paste this into App settings &gt; Basic &gt; App Domains
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  readOnly
                  value={appDomain}
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 font-mono text-xs text-muted-foreground outline-none"
                />
                <Button size="sm" variant="secondary" onClick={() => copyValue(appDomain, "domain")}>
                  {copied === "domain" ? <Check size={14} /> : <Copy size={14} />}
                  {copied === "domain" ? "Copied" : "Copy"}
                </Button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Without this, Facebook refuses the login with
                &quot;Can&apos;t load URL: the domain of this URL isn&apos;t included in the
                app&apos;s domains&quot;. No <code className="rounded bg-surface-2 px-1 text-[11px]">https://</code>,
                no trailing slash.
              </p>
            </div>

            {credsError && <p className="mt-2 text-xs text-destructive">{credsError}</p>}

            <div className="mt-4 flex items-center gap-2">
              <Button size="sm" onClick={saveCredentials} disabled={savingCreds}>
                {savingCreds ? "Saving…" : "Save credentials"}
              </Button>
              {settings.facebook_configured && (
                <span className="text-xs font-medium text-success">Credentials stored</span>
              )}
            </div>

            {/* Once the App ID is known these can be built for this exact app,
                which saves hunting through the Meta dashboard for the three
                screens this setup touches. */}
            {settings.facebook_app_id && (
              <div className="mt-4 border-t border-border pt-3">
                <p className="text-xs font-semibold text-muted-foreground">
                  Open in your Meta app
                </p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
                  {[
                    {
                      label: "Basic settings — App Domains",
                      href: `https://developers.facebook.com/apps/${settings.facebook_app_id}/settings/basic/`,
                    },
                    {
                      label: "Use cases — add permissions",
                      href: `https://developers.facebook.com/apps/${settings.facebook_app_id}/use_cases/`,
                    },
                    {
                      label: "Login settings — Redirect URIs",
                      href: `https://developers.facebook.com/apps/${settings.facebook_app_id}/fb-login/settings/`,
                    },
                    {
                      label: "Login configurations",
                      href: `https://developers.facebook.com/apps/${settings.facebook_app_id}/fb-login/configurations/`,
                    },
                    {
                      label: "App dashboard",
                      href: `https://developers.facebook.com/apps/${settings.facebook_app_id}/`,
                    },
                  ].map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      {link.label} ↗
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Provedores de IA para Redação (Copy) */}
      <Card>
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Robot size={22} weight="fill" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-heading font-bold text-foreground">Provedores de IA para Redação (Copy)</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Escolha qual inteligência artificial deve escrever o título, legenda e hashtags dos seus posts, ou ative/desative cada uma.
                </p>
              </div>
              <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                Texto dos Posts
              </span>
            </div>

            <div className="mt-4">
              <label className="text-xs font-semibold text-muted-foreground">
                Provedor de Redação Padrão / Prioridade
              </label>
              <select
                value={textProviderPref}
                onChange={(e) => {
                  const val = e.target.value as TextAiProviderPref;
                  setTextProviderPref(val);
                  save({ text_provider_pref: val });
                }}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary sm:w-96"
              >
                <option value="auto">Automático (Gemini &gt; Groq &gt; Pollinations)</option>
                <option value="gemini">Forçar Google Gemini</option>
                <option value="groq">Forçar Groq (Llama 3)</option>
                <option value="pollinations">Forçar Pollinations (Gratuito sem chave)</option>
              </select>
            </div>

            <div className="mt-4 divide-y divide-border/60 rounded-xl border border-border bg-surface-2/40">
              {/* Google Gemini */}
              <div className="flex items-center justify-between p-3.5">
                <div className="pr-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">Google Gemini AI</span>
                    {settings.gemini_api_key_set ? (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                        <CheckCircle size={11} /> Chave salva
                      </span>
                    ) : (
                      <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning">
                        Sem chave
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Melhor qualidade e tom natural em português. Requer chave configurada no cartão abaixo.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = !geminiEnabled;
                    setGeminiEnabled(next);
                    save({ gemini_enabled: next });
                  }}
                  aria-label="Habilitar Google Gemini"
                  className={cn(
                    "relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition",
                    geminiEnabled ? "bg-primary" : "bg-muted-foreground/30"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition",
                      geminiEnabled ? "left-5.5" : "left-0.5"
                    )}
                  />
                </button>
              </div>

              {/* Groq */}
              <div className="flex items-center justify-between p-3.5">
                <div className="pr-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">Groq (Llama 3)</span>
                    {settings.groq_api_key_set ? (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                        <CheckCircle size={11} /> Chave salva
                      </span>
                    ) : (
                      <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning">
                        Sem chave
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Geração ultra rápida via nuvem da Groq.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = !groqEnabled;
                    setGroqEnabled(next);
                    save({ groq_enabled: next });
                  }}
                  aria-label="Habilitar Groq"
                  className={cn(
                    "relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition",
                    groqEnabled ? "bg-primary" : "bg-muted-foreground/30"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition",
                      groqEnabled ? "left-5.5" : "left-0.5"
                    )}
                  />
                </button>
              </div>

              {/* Pollinations */}
              <div className="flex items-center justify-between p-3.5">
                <div className="pr-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">Pollinations AI</span>
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                      Gratuito (Sem chave)
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Serviço comunitário público sem necessidade de nenhuma chave de API.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = !pollinationsEnabled;
                    setPollinationsEnabled(next);
                    save({ pollinations_enabled: next });
                  }}
                  aria-label="Habilitar Pollinations"
                  className={cn(
                    "relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition",
                    pollinationsEnabled ? "bg-primary" : "bg-muted-foreground/30"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition",
                      pollinationsEnabled ? "left-5.5" : "left-0.5"
                    )}
                  />
                </button>
              </div>
            </div>

            <p className="mt-3 text-[11px] text-muted-foreground">
              * Se todos os provedores estiverem desabilitados ou indisponíveis, o bot utilizará um modelo fixo (Template) estruturado para não interromper a publicação.
            </p>

            {/* Diretrizes de Copywriting (Idioma, Tamanho, Tom, Regras) */}
            <div className="mt-6 border-t border-border pt-4">
              <h3 className="text-sm font-bold text-foreground">Diretrizes de Redação Padrão</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Configure como as IAs (Gemini, Groq ou Pollinations) devem estruturar o texto, idioma e estilo das copys.
              </p>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {/* Idioma */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">
                    Idioma da Redação
                  </label>
                  <select
                    value={copyLanguage}
                    onChange={(e) => setCopyLanguage(e.target.value as CopyLanguage)}
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  >
                    <option value="auto">Automático (Detectar do tema)</option>
                    <option value="pt">Português (Brasil)</option>
                    <option value="en">Inglês (English)</option>
                    <option value="es">Espanhol (Español)</option>
                  </select>
                </div>

                {/* Tamanho */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">
                    Tamanho do Texto
                  </label>
                  <select
                    value={copyLength}
                    onChange={(e) => setCopyLength(e.target.value as CopyLength)}
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  >
                    <option value="random">🎲 Aleatório (Variar a cada post)</option>
                    <option value="short">Curto (1-2 frases impactantes)</option>
                    <option value="medium">Médio (2-3 frases / Padrão)</option>
                    <option value="long">Longo (Storytelling até 500 carac.)</option>
                  </select>
                </div>

                {/* Tom de Voz */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">
                    Tom de Voz / Estilo
                  </label>
                  <select
                    value={copyTone}
                    onChange={(e) => setCopyTone(e.target.value as CopyTone)}
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  >
                    <option value="random">🎲 Aleatório (Variar estilos a cada post)</option>
                    <option value="conversational">Conversacional (Amigável &amp; Natural)</option>
                    <option value="persuasive">Persuasivo / Vendas (Foco em conversão &amp; CTA)</option>
                    <option value="informative">Informativo / Educativo (Dicas práticas)</option>
                    <option value="inspirational">Inspiracional / Motivacional</option>
                    <option value="humorous">Divertido / Bem-humorado</option>
                    <option value="professional">Profissional / Corporativo</option>
                  </select>
                </div>
              </div>

              {/* Regras Personalizadas */}
              <div className="mt-3">
                <label className="text-xs font-semibold text-muted-foreground">
                  Instruções ou Regras Personalizadas Adicionais (opcional)
                </label>
                <textarea
                  rows={2}
                  value={copyCustomRules}
                  onChange={(e) => setCopyCustomRules(e.target.value)}
                  placeholder="Ex: Termine sempre com uma pergunta instigante; use no máximo 2 emojis; mencione benefícios práticos..."
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm outline-none focus:border-primary"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Estas instruções serão injetadas diretamente no prompt do Gemini, Groq e Pollinations.
                </p>
              </div>

              {guidelinesError && (
                <p className="mt-2 text-xs text-destructive">{guidelinesError}</p>
              )}

              <div className="mt-3 flex items-center gap-2">
                <Button size="sm" onClick={saveGuidelines} disabled={savingGuidelines}>
                  {savingGuidelines ? "Salvando diretrizes…" : "Salvar Diretrizes de Redação"}
                </Button>
                {guidelinesSaved && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                    <CheckCircle size={14} /> Diretrizes salvas com sucesso!
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Google Gemini AI */}
      <Card>
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkle size={22} weight="fill" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-heading font-bold text-foreground">Google Gemini AI (Texto e Imagem)</h2>
              {settings.gemini_api_key_set ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
                  <CheckCircle size={13} />
                  {settings.gemini_configured_source === "env"
                    ? "Configurada via Variável de Ambiente"
                    : "Configurada e Salva no Banco"}
                </span>
              ) : (
                <span className="rounded-full bg-warning/10 px-2.5 py-0.5 text-xs font-medium text-warning">
                  Chave não configurada
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Utilizada para criar os textos dos posts (título, legenda e hashtags) e também para gerar imagens
              com alta fidelidade via Imagen 3 / 4. Obtenha sua chave gratuita no{" "}
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary hover:underline"
              >
                Google AI Studio ↗
              </a>.
            </p>

            <div className="mt-4">
              <label className="text-xs font-semibold text-muted-foreground">Chave de API do Gemini (GEMINI_API_KEY)</label>
              <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                <input
                  type="password"
                  value={geminiKeyInput}
                  onChange={(e) => setGeminiKeyInput(e.target.value)}
                  placeholder={
                    settings.gemini_api_key_set
                      ? "•••• chave configurada — digite para substituir"
                      : "Cole aqui sua chave (ex: AIzaSy...)"
                  }
                  className="flex-1 rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
                <Button size="sm" onClick={saveGeminiKey} disabled={savingGeminiKey}>
                  {savingGeminiKey ? "Salvando…" : "Salvar chave"}
                </Button>
              </div>
            </div>

            {geminiKeyError && (
              <p className="mt-2 text-xs text-destructive">{geminiKeyError}</p>
            )}
            {geminiKeySaved && (
              <p className="mt-2 text-xs font-medium text-success">Chave salva com sucesso! ✓</p>
            )}
          </div>
        </div>
      </Card>

      {/* Groq AI (Llama 3 Copywriting) */}
      <Card>
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400">
            <Lightning size={22} weight="fill" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-heading font-bold text-foreground">Groq AI (Llama 3 Copywriting Ultra-Rápido)</h2>
              {settings.groq_api_key_set ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
                  <CheckCircle size={13} />
                  {settings.groq_configured_source === "env"
                    ? "Configurada via Variável de Ambiente"
                    : "Configurada e Salva no Banco"}
                </span>
              ) : (
                <span className="rounded-full bg-warning/10 px-2.5 py-0.5 text-xs font-medium text-warning">
                  Chave não configurada
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              A Groq oferece inferência ultra rápida com os modelos de ponta Llama 3.3 70B e Llama 3.1 8B da Meta.
              Excelente para redação de posts dinâmicos, magnéticos e com respostas em milissegundos.
              Obtenha sua chave gratuita no{" "}
              <a
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary hover:underline"
              >
                Groq Console ↗
              </a>.
            </p>

            <div className="mt-4">
              <label className="text-xs font-semibold text-muted-foreground">Chave de API da Groq (GROQ_API_KEY)</label>
              <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                <input
                  type="password"
                  value={groqKeyInput}
                  onChange={(e) => setGroqKeyInput(e.target.value)}
                  placeholder={
                    settings.groq_api_key_set
                      ? "•••• chave configurada — digite para substituir"
                      : "Cole aqui sua chave (ex: gsk_...)"
                  }
                  className="flex-1 rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
                <Button size="sm" onClick={saveGroqKey} disabled={savingGroqKey}>
                  {savingGroqKey ? "Salvando…" : "Salvar chave da Groq"}
                </Button>
              </div>
            </div>

            {groqKeyError && (
              <p className="mt-2 text-xs text-destructive">{groqKeyError}</p>
            )}
            {groqKeySaved && (
              <p className="mt-2 text-xs font-medium text-success">Chave da Groq salva com sucesso! ✓</p>
            )}
          </div>
        </div>
      </Card>

      {/* Avatar IA — Consistência de Personagem (Nasha) */}
      <Card>
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <User size={22} weight="fill" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-heading font-bold text-foreground">Avatar IA — Consistência de Personagem</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Mantém a identidade visual, traços físicos e estilo da sua personagem ({avatarName || "Nasha"}) em todas as imagens geradas por IA.
                </p>
              </div>
              <button
                onClick={() => {
                  const next = !avatarEnabled;
                  setAvatarEnabled(next);
                  save({ avatar_enabled: next });
                }}
                aria-label="Ativar Avatar IA"
                className={cn(
                  "relative h-7 w-12 shrink-0 cursor-pointer rounded-full transition",
                  avatarEnabled ? "bg-primary" : "bg-surface-2"
                )}
              >
                <span
                  className={cn(
                    "absolute top-1 h-5 w-5 rounded-full bg-white shadow transition",
                    avatarEnabled ? "left-6" : "left-1"
                  )}
                />
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Nome da Personagem</label>
                <input
                  value={avatarName}
                  onChange={(e) => setAvatarName(e.target.value)}
                  placeholder="Ex: Nasha"
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-muted-foreground">Status de Aplicação</label>
                <div className="mt-1 flex items-center h-[42px] px-3.5 rounded-xl border border-border bg-surface-2 text-xs text-muted-foreground">
                  {avatarEnabled
                    ? "✓ O DNA visual do avatar será aplicado automaticamente a cada foto gerada com IA"
                    : "Desativado — as imagens serão ilustrações genéricas do tema"}
                </div>
              </div>
            </div>

            <div className="mt-3">
              <label className="text-xs font-semibold text-muted-foreground">
                Prompt Descritivo (DNA Visual da Personagem)
              </label>
              <textarea
                rows={5}
                value={avatarPrompt}
                onChange={(e) => setAvatarPrompt(e.target.value)}
                placeholder="Cole aqui o prompt descritivo da personagem..."
                className="mt-1 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs font-mono leading-relaxed outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Ao gerar posts com IA, este prompt é combinado com o contexto e a ação de cada tema.
              </p>
            </div>

            {avatarError && (
              <p className="mt-2 text-xs text-destructive">{avatarError}</p>
            )}
            {avatarSaved && (
              <p className="mt-2 text-xs font-medium text-success">Configurações do avatar salvas com sucesso! ✓</p>
            )}

            <div className="mt-4 flex items-center gap-2">
              <Button size="sm" onClick={saveAvatar} disabled={savingAvatar}>
                {savingAvatar ? "Salvando…" : "Salvar Avatar"}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Provedores de Imagem e Avatar IA (Cloudflare Workers AI FLUX & Pollinations) */}
      <Card>
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Camera size={22} weight="fill" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-heading font-bold text-foreground">
                Provedores de Imagem e Avatar IA (Fotos Hiper-realistas)
              </h2>
              <div className="flex flex-wrap gap-1.5">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
                    settings.cloudflare_configured
                      ? "bg-success/10 text-success"
                      : "bg-surface-2 text-muted-foreground"
                  )}
                >
                  {settings.cloudflare_configured ? <CheckCircle size={13} /> : null}
                  Cloudflare FLUX: {settings.cloudflare_configured ? "Ativo (Recomendado)" : "Não configurado"}
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
                    settings.pollinations_api_key_set
                      ? "bg-success/10 text-success"
                      : "bg-surface-2 text-muted-foreground"
                  )}
                >
                  {settings.pollinations_api_key_set ? <CheckCircle size={13} /> : null}
                  Pollinations Key: {settings.pollinations_api_key_set ? "Ativo" : "Público (Anônimo)"}
                </span>
              </div>
            </div>

            <p className="mt-0.5 text-sm text-muted-foreground">
              Para fotos ultra-realistas da <strong>{avatarName || "Nasha"}</strong> sem aspecto de desenho ou borrões:
              o Google Gemini gratuito possui limite de 0 imagens/min. Configure o <strong>Cloudflare Workers AI</strong> (10.000 neurônios/dia grátis na sua conta Cloudflare) para geração com o modelo de ponta <strong>FLUX.1 Schnell</strong>.
            </p>

            {/* Cloudflare Workers AI */}
            <div className="mt-4 rounded-xl border border-border bg-surface-2/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    ⚡ Cloudflare Workers AI — FLUX.1 Schnell
                    <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                      100% Gratuito (10.000 neurônios/dia)
                    </span>
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Como o seu site já está no Cloudflare Pages, basta copiar o Account ID no painel e criar um API Token com permissão &quot;Workers AI: Read&quot;.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">
                    Cloudflare Account ID
                  </label>
                  <input
                    value={cfAccountIdInput}
                    onChange={(e) => setCfAccountIdInput(e.target.value)}
                    placeholder="Ex: 8f2a1b3c4d5e6f7a8b9c0d1e2f3a4b5c"
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-mono outline-none focus:border-primary"
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Encontrado na URL do painel Cloudflare ou na barra lateral &quot;Account ID&quot;.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground">
                    Cloudflare API Token (Workers AI)
                  </label>
                  <input
                    type="password"
                    value={cfApiTokenInput}
                    onChange={(e) => setCfApiTokenInput(e.target.value)}
                    placeholder={
                      settings.cloudflare_configured
                        ? "•••• Token configurado — digite para substituir"
                        : "Cole seu API Token do Cloudflare"
                    }
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-mono outline-none focus:border-primary"
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Criado em Cloudflare &gt; My Profile &gt; API Tokens &gt; Create Token (Template: &quot;Workers AI&quot;).
                  </p>
                </div>
              </div>
            </div>

            {/* Pollinations API Key */}
            <div className="mt-3 rounded-xl border border-border bg-surface-2/40 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-foreground">
                    Pollinations.ai API Key (Opcional)
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Caso possua chave da plataforma Pollinations (obtida em{" "}
                    <a
                      href="https://enter.pollinations.ai"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-primary hover:underline"
                    >
                      enter.pollinations.ai ↗
                    </a>
                    ), cole aqui para desbloquear modelos FLUX e Seedream sem marca d&apos;água.
                  </p>
                </div>
              </div>

              <div className="mt-2.5">
                <input
                  type="password"
                  value={pollinationsKeyInput}
                  onChange={(e) => setPollinationsKeyInput(e.target.value)}
                  placeholder={
                    settings.pollinations_api_key_set
                      ? "•••• Chave Pollinations salva — digite para substituir"
                      : "Cole aqui sua chave (ex: sk_...)"
                  }
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-mono outline-none focus:border-primary"
                />
              </div>
            </div>

            {imageAiKeysError && (
              <p className="mt-2 text-xs text-destructive">{imageAiKeysError}</p>
            )}
            {imageAiKeysSaved && (
              <p className="mt-2 text-xs font-medium text-success">
                Configurações de imagem salvas com sucesso! ✓
              </p>
            )}

            <div className="mt-4 flex items-center gap-2">
              <Button size="sm" onClick={saveImageAiKeys} disabled={savingImageAiKeys}>
                {savingImageAiKeys ? "Salvando…" : "Salvar Provedores de Imagem"}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Pexels & Pixabay (Bancos de Fotos e Vídeos) */}
      <Card>
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <VideoCamera size={22} weight="fill" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-heading font-bold text-foreground">
                Pexels &amp; Pixabay (Fotos e Vídeos Gratuitos)
              </h2>
              <div className="flex flex-wrap gap-1.5">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
                    settings.pexels_api_key_set
                      ? "bg-success/10 text-success"
                      : "bg-surface-2 text-muted-foreground"
                  )}
                >
                  {settings.pexels_api_key_set ? <CheckCircle size={13} /> : null}
                  Pexels: {settings.pexels_api_key_set ? "Ativo" : "Sem chave"}
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
                    settings.pixabay_api_key_set
                      ? "bg-success/10 text-success"
                      : "bg-surface-2 text-muted-foreground"
                  )}
                >
                  {settings.pixabay_api_key_set ? <CheckCircle size={13} /> : null}
                  Pixabay: {settings.pixabay_api_key_set ? "Ativo" : "Sem chave"}
                </span>
              </div>
            </div>

            <p className="mt-0.5 text-sm text-muted-foreground">
              Utilize acervos profissionais gratuitos para obter fotos e vídeos em alta resolução. Os vídeos são publicados no Facebook por link direto do CDN, garantindo publicação instantânea sem estourar limites do Cloudflare.
            </p>

            <div className="mt-3 flex flex-wrap gap-4 text-xs">
              <a
                href="https://www.pexels.com/api/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary hover:underline"
              >
                Obter chave Pexels (Gratuito) ↗
              </a>
              <a
                href="https://pixabay.com/api/docs/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary hover:underline"
              >
                Obter chave Pixabay (Gratuito) ↗
              </a>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">
                  Chave Pexels (PEXELS_API_KEY)
                </label>
                <input
                  type="password"
                  value={pexelsKeyInput}
                  onChange={(e) => setPexelsKeyInput(e.target.value)}
                  placeholder={
                    settings.pexels_api_key_set
                      ? "•••• chave configurada — digite para substituir"
                      : "Cole sua chave da API Pexels"
                  }
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">
                  Chave Pixabay (PIXABAY_API_KEY)
                </label>
                <input
                  type="password"
                  value={pixabayKeyInput}
                  onChange={(e) => setPixabayKeyInput(e.target.value)}
                  placeholder={
                    settings.pixabay_api_key_set
                      ? "•••• chave configurada — digite para substituir"
                      : "Cole sua chave da API Pixabay"
                  }
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="text-xs font-semibold text-muted-foreground">
                Provedor de Mídia Preferencial
              </label>
              <select
                value={stockProvider}
                onChange={(e) => setStockProvider(e.target.value as "pexels" | "pixabay" | "any")}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary sm:w-80"
              >
                <option value="any">Ambos (Fallback inteligente entre Pexels e Pixabay)</option>
                <option value="pexels">Priorizar Pexels</option>
                <option value="pixabay">Priorizar Pixabay</option>
              </select>
            </div>

            {stockKeysError && (
              <p className="mt-2 text-xs text-destructive">{stockKeysError}</p>
            )}
            {stockKeysSaved && (
              <p className="mt-2 text-xs font-medium text-success">
                Chaves e preferências de bancos de mídia salvas com sucesso! ✓
              </p>
            )}

            <div className="mt-4 flex items-center gap-2">
              <Button size="sm" onClick={saveStockKeys} disabled={savingStockKeys}>
                {savingStockKeys ? "Salvando…" : "Salvar chaves de mídia"}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Biblioteca de Vídeos & Reels (Google Drive) */}
      <Card>
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <VideoCamera size={22} weight="fill" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-heading font-bold text-foreground">
                Biblioteca de Vídeos &amp; Reels (Google Drive)
              </h2>
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
                    driveFolderId
                      ? "bg-success/10 text-success"
                      : "bg-surface-2 text-muted-foreground"
                  )}
                >
                  {driveFolderId ? <CheckCircle size={13} /> : null}
                  Pasta: {driveFolderId ? "Configurada" : "Não configurada"}
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
                    reelsAutoPostEnabled
                      ? "bg-primary/10 text-primary"
                      : "bg-surface-2 text-muted-foreground"
                  )}
                >
                  Automação: {reelsAutoPostEnabled ? "Ativada" : "Pausada"}
                </span>
              </div>
            </div>

            <p className="mt-0.5 text-sm text-muted-foreground">
              Conecte uma pasta pública do Google Drive para importar seus vídeos curtos (ex: gerados no Google Flow). O bot sincroniza a biblioteca, gera copy contextual via Gemini 3.6-Flash e publica diretamente nos Reels do Facebook via link direto, sem consumir storage do Supabase.
            </p>

            <div className="mt-3 flex flex-wrap gap-4 text-xs">
              <Link
                href="/dashboard/reels"
                className="font-medium text-primary hover:underline"
              >
                Gerenciar Biblioteca de Vídeos &amp; Reels ↗
              </Link>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">
                  Link ou ID da Pasta do Google Drive
                </label>
                <input
                  type="text"
                  value={driveFolderId}
                  onChange={(e) => setDriveFolderId(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/1ABC... ou ID da pasta"
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Cole o link ou ID da sua pasta do Google Drive.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">
                  URL do Google Apps Script (Web App)
                </label>
                <input
                  type="text"
                  value={appsScriptUrl}
                  onChange={(e) => setAppsScriptUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  O bot injeta o ID da pasta do Drive acima nesta URL automaticamente a cada sincronização.
                </p>
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-muted-foreground">
                  Chave API Google Drive (Opcional)
                </label>
                <input
                  type="password"
                  value={driveApiKeyInput}
                  onChange={(e) => setDriveApiKeyInput(e.target.value)}
                  placeholder={
                    settings?.google_drive_api_key_set
                      ? "•••• chave salva — digite para substituir"
                      : "Opcional (se vazio, reutiliza sua chave Gemini)"
                  }
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Utilizada caso não utilize o Google Apps Script e sua chave Gemini tenha permissão da Drive API v3.
                </p>
              </div>
            </div>

            {/* Configurações de Autopilot de Reels */}
            <div className="mt-5 border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Publicação Automática de Reels (Autopilot)
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Publica automaticamente o próximo vídeo pendente da biblioteca nos horários programados.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setReelsAutoPostEnabled(!reelsAutoPostEnabled)}
                  aria-label="Alternar autopost de Reels"
                  className={cn(
                    "relative h-7 w-12 shrink-0 cursor-pointer rounded-full transition",
                    reelsAutoPostEnabled ? "bg-primary" : "bg-surface-2"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-1 h-5 w-5 rounded-full bg-white shadow transition",
                      reelsAutoPostEnabled ? "left-6" : "left-1"
                    )}
                  />
                </button>
              </div>

              {reelsAutoPostEnabled && (
                <div className="mt-4 space-y-4">
                  <div className="max-w-xs">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Reels por dia
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={reelsPostsPerDay}
                      onChange={(e) => setReelsPostsPerDay(Number(e.target.value))}
                      className="mt-1 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">
                      Horários permitidos para publicação de Reels (horário local)
                    </label>
                    <div className="mt-1.5 grid grid-cols-6 gap-1.5 sm:grid-cols-12">
                      {Array.from({ length: 24 }, (_, h) => h).map((h) => (
                        <button
                          key={h}
                          type="button"
                          onClick={() => toggleReelsHour(h)}
                          className={cn(
                            "cursor-pointer rounded-lg py-1.5 text-xs font-medium transition",
                            reelsPostingHours.includes(h)
                              ? "bg-primary text-primary-foreground"
                              : "bg-surface-2 text-muted-foreground hover:bg-border"
                          )}
                        >
                          {h}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {driveError && (
              <p className="mt-3 text-xs text-destructive">{driveError}</p>
            )}
            {driveSaved && (
              <p className="mt-3 text-xs font-medium text-success">
                Configurações do Google Drive e Reels salvas com sucesso! ✓
              </p>
            )}

            <div className="mt-4 flex items-center gap-2">
              <Button size="sm" onClick={saveDriveSettings} disabled={savingDrive}>
                {savingDrive ? "Salvando…" : "Salvar Configurações do Google Drive & Reels"}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Generation preferences */}
      <Card>
        <h2 className="font-heading font-bold text-foreground">Generation preferences</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Every source here is free — no paid API keys required.
        </p>

        <div className="mt-4">
          <label className="text-xs font-semibold text-muted-foreground">Default image source</label>
          <select
            value={settings.image_source}
            onChange={(e) => {
              const v = e.target.value as ImageSourcePref;
              setSettings({ ...settings, image_source: v });
              save({ image_source: v });
            }}
            className="mt-1 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary sm:w-64"
          >
            <option value="ai">AI-generated image</option>
            <option value="stock">Free stock photo</option>
            <option value="mixed">Mix of both</option>
          </select>
        </div>

        <div className="mt-4">
          <label className="text-xs font-semibold text-muted-foreground">
            Text appended to every post (optional, e.g. a UTM link or sign-off)
          </label>
          <input
            value={settings.utm_suffix}
            onChange={(e) => setSettings({ ...settings, utm_suffix: e.target.value })}
            onBlur={(e) => save({ utm_suffix: e.target.value })}
            placeholder="via mysite.com"
            className="mt-1 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
          />
        </div>
      </Card>

      {/* Autopilot */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-heading font-bold text-foreground">Autopilot</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Let the bot pick a topic and post on its own, with no one clicking anything.
            </p>
            <p className="mt-1.5 text-sm text-foreground">
              Writing about:{" "}
              <span className="font-semibold">
                {settings.topic_source === "trending"
                  ? "trending ideas"
                  : settings.topic_source === "mixed"
                    ? "a mix of your topics and trending ideas"
                    : "your topics"}
              </span>{" "}
              ·{" "}
              <Link href="/dashboard/topics" className="font-medium text-primary hover:underline">
                Manage topics
              </Link>
            </p>
          </div>
          <button
            onClick={() => {
              const next = !settings.auto_post_enabled;
              setSettings({ ...settings, auto_post_enabled: next });
              save({ auto_post_enabled: next });
            }}
            aria-label="Toggle autopilot"
            className={cn(
              "relative h-7 w-12 shrink-0 cursor-pointer rounded-full transition",
              settings.auto_post_enabled ? "bg-primary" : "bg-surface-2"
            )}
          >
            <span
              className={cn(
                "absolute top-1 h-5 w-5 rounded-full bg-white shadow transition",
                settings.auto_post_enabled ? "left-6" : "left-1"
              )}
            />
          </button>
        </div>

        {!settings.default_page_name && (
          <p className="mt-3 text-xs text-warning">
            Set a default Page on the Pages screen — autopilot needs one to post to.
          </p>
        )}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Posts per day</label>
            <input
              type="number"
              min={1}
              max={20}
              value={settings.posts_per_day}
              onChange={(e) => setSettings({ ...settings, posts_per_day: Number(e.target.value) })}
              onBlur={(e) => save({ posts_per_day: Number(e.target.value) })}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Timezone</label>
            <select
              value={settings.timezone}
              onChange={(e) => {
                setSettings({ ...settings, timezone: e.target.value });
                save({ timezone: e.target.value });
              }}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label className="text-xs font-semibold text-muted-foreground">
            Allowed posting hours (local time)
          </label>
          <div className="mt-1.5 grid grid-cols-6 gap-1.5 sm:grid-cols-12">
            {Array.from({ length: 24 }, (_, h) => h).map((h) => (
              <button
                key={h}
                onClick={() => toggleHour(h)}
                className={cn(
                  "cursor-pointer rounded-lg py-1.5 text-xs font-medium transition",
                  settings.posting_hours.includes(h)
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface-2 text-muted-foreground hover:bg-border"
                )}
              >
                {h}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <div className="h-4 text-right text-xs text-muted-foreground">
        {saving ? "Saving…" : saved ? "Saved ✓" : ""}
      </div>
    </div>
  );
}
