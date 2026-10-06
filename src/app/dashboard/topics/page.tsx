"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ListBullets,
  Shuffle,
  TrendUp,
  Plus,
  Trash,
  PencilSimpleLine,
  WarningCircle,
  CheckCircle,
} from "@phosphor-icons/react/dist/ssr";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { Topic, TopicSource } from "@/lib/types";

const SOURCES: {
  value: TopicSource;
  title: string;
  body: string;
  icon: typeof ListBullets;
}[] = [
  {
    value: "mine",
    title: "Your topics",
    body: "Works through your list, least recently used first. Falls back to trending ideas only while the list is empty.",
    icon: ListBullets,
  },
  {
    value: "mixed",
    title: "Mix of both",
    body: "Roughly half from your list, half trending ideas.",
    icon: Shuffle,
  },
  {
    value: "trending",
    title: "Trending ideas",
    body: "Google Trends plus a built-in list of evergreen ideas. Your list is kept but not used.",
    icon: TrendUp,
  },
];

const PLACEHOLDER = `Instagram Reels ideas for small businesses
How to plan a month of social media posts
Mistakes brands make on Facebook ads
Why consistency beats virality`;

function relativeTime(iso: string): string {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

export default function TopicsPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [source, setSource] = useState<TopicSource>("mine");
  const [nextId, setNextId] = useState<string | null>(null);
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [savingSource, setSavingSource] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/topics");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't load your topics.");
      setTopics(data.topics ?? []);
      setSource(data.source ?? "mine");
      setNextId(data.nextId ?? null);
      setUpgradeMessage(data.ready === false ? data.message : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your topics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pendingLines = useMemo(
    () => draft.split(/\r?\n/).map((l) => l.trim()).filter(Boolean),
    [draft]
  );
  const activeCount = topics.filter((t) => t.enabled).length;

  async function add() {
    if (pendingLines.length === 0) return;
    setAdding(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts: pendingLines }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't add those topics.");

      const parts = [`Added ${data.added} topic${data.added === 1 ? "" : "s"}`];
      if (data.skipped) parts.push(`skipped ${data.skipped} already on your list`);
      setNotice(parts.join(", ") + ".");
      setDraft("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add those topics.");
    } finally {
      setAdding(false);
    }
  }

  async function toggle(topic: Topic) {
    setBusyId(topic.id);
    setError(null);
    setTopics((list) => list.map((t) => (t.id === topic.id ? { ...t, enabled: !t.enabled } : t)));
    try {
      const res = await fetch(`/api/topics/${topic.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !topic.enabled }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Couldn't update that topic.");
      // "Next up" can move when a topic is switched on or off.
      await load();
    } catch (err) {
      setTopics((list) => list.map((t) => (t.id === topic.id ? topic : t)));
      setError(err instanceof Error ? err.message : "Couldn't update that topic.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/topics/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Couldn't delete that topic.");
      setConfirmingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete that topic.");
    } finally {
      setBusyId(null);
    }
  }

  async function chooseSource(value: TopicSource) {
    if (value === source) return;
    const previous = source;
    setSource(value);
    setSavingSource(true);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic_source: value }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Couldn't save that choice.");
    } catch (err) {
      setSource(previous);
      setError(err instanceof Error ? err.message : "Couldn't save that choice.");
    } finally {
      setSavingSource(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (upgradeMessage) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card className="border-warning/40 bg-warning/5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-warning/15 text-warning">
              <WarningCircle size={22} weight="bold" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-foreground">One database step to enable topics</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Your database was created before topics existed. Open Supabase, go to{" "}
                <strong>SQL Editor → New query</strong>, paste the whole of{" "}
                <code className="rounded bg-surface-2 px-1 text-xs">supabase/schema.sql</code> from
                your repository again, and click <strong>Run</strong>.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                It is safe to re-run: it only adds what is missing and leaves your posts,
                settings and connection untouched. Until then, autopilot keeps working with
                trending ideas.
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-sm text-destructive"
        >
          <WarningCircle size={18} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Where autopilot's subjects come from */}
      <Card>
        <h2 className="font-heading font-bold text-foreground">What autopilot writes about</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Each automatic post takes one subject. Pick where those come from.
        </p>

        <div role="radiogroup" aria-label="Topic source" className="mt-4 grid gap-3 sm:grid-cols-3">
          {SOURCES.map((option) => {
            const selected = option.value === source;
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={savingSource}
                onClick={() => chooseSource(option.value)}
                className={cn(
                  "flex cursor-pointer flex-col items-start gap-2 rounded-xl border p-3.5 text-left transition",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  selected
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40 hover:bg-surface-2"
                )}
              >
                <Icon
                  size={20}
                  weight={selected ? "fill" : "regular"}
                  className={selected ? "text-primary" : "text-muted-foreground"}
                />
                <span className="text-sm font-semibold text-foreground">{option.title}</span>
                <span className="text-xs leading-relaxed text-muted-foreground">{option.body}</span>
              </button>
            );
          })}
        </div>

        {source !== "trending" && activeCount === 0 && (
          <p className="mt-3 text-xs text-warning">
            Your list has no active topics, so autopilot is using trending ideas until you add some.
          </p>
        )}
        {source === "trending" && activeCount > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            Your {activeCount} topic{activeCount === 1 ? " is" : "s are"} saved but not used while
            this is set to trending ideas.
          </p>
        )}
      </Card>

      {/* Add */}
      <Card>
        <label htmlFor="new-topics" className="font-heading font-bold text-foreground">
          Add topics
        </label>
        <p className="mt-0.5 text-sm text-muted-foreground">
          One per line — a keyword or a full idea both work. Paste a whole list at once;
          anything already on your list is skipped.
        </p>
        <textarea
          id="new-topics"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setNotice(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) add();
          }}
          rows={5}
          placeholder={PLACEHOLDER}
          className="mt-3 w-full resize-y rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm leading-relaxed outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button onClick={add} disabled={adding || pendingLines.length === 0}>
            <Plus size={16} weight="bold" />
            {adding
              ? "Adding…"
              : pendingLines.length > 1
                ? `Add ${pendingLines.length} topics`
                : "Add topic"}
          </Button>
          {notice && (
            <span role="status" className="flex items-center gap-1.5 text-sm text-success">
              <CheckCircle size={16} /> {notice}
            </span>
          )}
        </div>
      </Card>

      {/* List */}
      <Card>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-heading font-bold text-foreground">Your topics</h2>
          {topics.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {activeCount} of {topics.length} active
            </span>
          )}
        </div>

        {topics.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No topics yet. Add a few above and autopilot will start writing about them.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {topics.map((topic) => {
              const isNext = topic.id === nextId && source !== "trending";
              const confirming = confirmingId === topic.id;
              return (
                <li key={topic.id} className="flex items-center gap-3 py-3">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={topic.enabled}
                    aria-label={`${topic.enabled ? "Pause" : "Use"} “${topic.text}”`}
                    disabled={busyId === topic.id}
                    onClick={() => toggle(topic)}
                    className={cn(
                      "relative h-6 w-10 shrink-0 cursor-pointer rounded-full transition",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                      topic.enabled ? "bg-primary" : "bg-surface-2"
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-[left]",
                        topic.enabled ? "left-5" : "left-1"
                      )}
                    />
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p
                        className={cn(
                          "break-words text-sm font-medium",
                          topic.enabled ? "text-foreground" : "text-muted-foreground line-through"
                        )}
                      >
                        {topic.text}
                      </p>
                      {isNext && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                          Next up
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {topic.use_count > 0 && topic.last_used_at
                        ? `Used ${topic.use_count}× · last ${relativeTime(topic.last_used_at)}`
                        : "Not used yet"}
                    </p>
                  </div>

                  {confirming ? (
                    <div className="flex shrink-0 gap-1.5">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => remove(topic.id)}
                        disabled={busyId === topic.id}
                        className="text-destructive"
                      >
                        Delete
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmingId(null)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex shrink-0 items-center gap-1">
                      <Link
                        href={`/dashboard/generate?topic=${encodeURIComponent(topic.text)}`}
                        aria-label={`Write a post about “${topic.text}” now`}
                        title="Write a post about this now"
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-surface-2 hover:text-primary"
                      >
                        <PencilSimpleLine size={17} />
                      </Link>
                      <button
                        type="button"
                        onClick={() => setConfirmingId(topic.id)}
                        aria-label={`Delete “${topic.text}”`}
                        title="Delete"
                        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash size={17} />
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
