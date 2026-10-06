import Link from "next/link";
import {
  MegaphoneSimple,
  CalendarCheck,
  ClockCountdown,
  ChartLineUp,
  Sparkle,
  ArrowRight,
  WarningCircle,
  Article,
} from "@phosphor-icons/react/dist/ssr";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { StatCard } from "@/components/dashboard/stat-card";
import { PostsChart } from "@/components/dashboard/posts-chart";
import { listPosts } from "@/lib/db/posts";
import { getSettings } from "@/lib/db/settings";
import { isFacebookConnected } from "@/lib/types";
import type { Post } from "@/lib/types";

export const runtime = "edge";
export const dynamic = "force-dynamic";

function buildChartData(posted: { posted_at: string | null }[]) {
  const days = 14;
  const counts = new Map<string, number>();
  const today = new Date();

  const labels: { date: string; label: string }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    counts.set(key, 0);
    labels.push({ date: key, label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) });
  }

  for (const post of posted) {
    if (!post.posted_at) continue;
    const key = post.posted_at.slice(0, 10);
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return labels.map((l) => ({ ...l, count: counts.get(l.date) ?? 0 }));
}

/**
 * Shown when the dashboard cannot read its own database.
 *
 * This is the first screen of a fresh install, so it has to be useful: an
 * unhandled throw here becomes React error #441, whose message production
 * deliberately redacts, leaving a new user with "Something went wrong" and
 * nothing to act on. The cause is almost always one of three setup steps, so
 * they are named directly, along with the underlying error.
 */
function SetupNeeded({ reason }: { reason: string }) {
  return (
    <div className="mx-auto max-w-2xl">
      <Card className="border-warning/40 bg-warning/5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-warning/15 text-warning">
            <WarningCircle size={22} weight="bold" />
          </div>
          <div className="min-w-0">
            <h2 className="font-heading font-bold text-foreground">
              The database isn&apos;t set up yet
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Everything else is deployed correctly — this screen just cannot read
              from Supabase. It is almost always one of these:
            </p>

            <ol className="mt-4 space-y-3 text-sm text-foreground">
              <li>
                <span className="font-semibold">The schema was never run.</span>{" "}
                <span className="text-muted-foreground">
                  In Supabase, open <strong>SQL Editor → New query</strong>, paste
                  the whole of <code className="rounded bg-surface-2 px-1 text-xs">supabase/schema.sql</code>{" "}
                  from the repository, and click Run. This is step 1 of the guide
                  and the most common thing to miss.
                </span>
              </li>
              <li>
                <span className="font-semibold">An environment variable is wrong.</span>{" "}
                <span className="text-muted-foreground">
                  In Vercel, check{" "}
                  <code className="rounded bg-surface-2 px-1 text-xs">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
                  and{" "}
                  <code className="rounded bg-surface-2 px-1 text-xs">SUPABASE_SERVICE_ROLE_KEY</code>.
                  The key must be the <strong>service_role</strong> one, not{" "}
                  <code className="rounded bg-surface-2 px-1 text-xs">anon</code>. After
                  changing either, redeploy — Vercel only applies variables to new
                  deployments.
                </span>
              </li>
              <li>
                <span className="font-semibold">The Supabase project is paused.</span>{" "}
                <span className="text-muted-foreground">
                  Free projects pause after a stretch of inactivity. Open your
                  Supabase dashboard and resume it; your data is still there.
                </span>
              </li>
            </ol>

            <p className="mt-4 rounded-lg bg-surface-2 px-3 py-2 font-mono text-xs break-words text-muted-foreground">
              {reason}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default async function DashboardOverviewPage() {
  let posts: Post[];
  let settings: Awaited<ReturnType<typeof getSettings>>;

  try {
    [posts, settings] = await Promise.all([listPosts({ limit: 200 }), getSettings()]);
  } catch (err) {
    return <SetupNeeded reason={err instanceof Error ? err.message : String(err)} />;
  }

  const posted = posts.filter((p: Post) => p.status === "posted");
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const postedThisWeek = posted.filter((p: Post) => p.posted_at && new Date(p.posted_at).getTime() > weekAgo);
  const scheduled = posts.filter((p: Post) => p.status === "scheduled");
  const failed = posts.filter((p: Post) => p.status === "failed");
  const recent = posts.slice(0, 8);
  const connected = isFacebookConnected(settings);

  const chartData = buildChartData(posted);

  return (
    <div className="space-y-6">
      {!connected && (
        <Card className="flex flex-col items-start justify-between gap-3 border-primary/30 bg-primary/5 sm:flex-row sm:items-center">
          <div>
            <p className="font-semibold text-foreground">Conecte sua Página do Facebook para publicar</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Você pode gerar textos e imagens, mas para postar é necessário conectar uma Página.
            </p>
          </div>
          <Link href="/dashboard/settings">
            <Button size="sm">
              Conectar agora <ArrowRight size={14} />
            </Button>
          </Link>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Publicados" value={posted.length} icon={MegaphoneSimple} tone="primary" />
        <StatCard label="Esta Semana" value={postedThisWeek.length} icon={CalendarCheck} tone="success" />
        <StatCard label="Fila / Agendados" value={scheduled.length} icon={ClockCountdown} tone="warning" />
        <StatCard label="Falhas" value={failed.length} icon={ChartLineUp} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-heading text-base font-bold text-foreground">Posts publicados — últimos 14 dias</h2>
          </div>
          <PostsChart data={chartData} />
        </Card>

        <Card className="flex flex-col">
          <h2 className="font-heading text-base font-bold text-foreground">Criação Rápida</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Escolha um tema e deixe a IA redigir a copy e criar a imagem/vídeo.
          </p>
          <Link href="/dashboard/generate" className="mt-4">
            <Button className="w-full">
              <Sparkle size={16} weight="fill" /> Criar novo post
            </Button>
          </Link>

          <div className="mt-5 border-t border-border pt-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Facebook</span>
              <span className={connected ? "font-medium text-success" : "font-medium text-muted-foreground"}>
                {connected ? (settings.facebook_user_name ?? "Conectado") : "Não conectado"}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-muted-foreground">Página</span>
              <span className="truncate font-medium text-foreground">
                {settings.default_page_name ?? "—"}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-muted-foreground">Piloto Automático</span>
              <span className={settings.auto_post_enabled ? "font-medium text-success" : "font-medium text-muted-foreground"}>
                {settings.auto_post_enabled ? `Ativo · ${settings.posts_per_day}/dia` : "Desligado"}
              </span>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-base font-bold text-foreground">Atividade Recente</h2>
          <Link href="/dashboard/history" className="text-sm font-semibold text-primary hover:underline">
            Ver histórico completo
          </Link>
        </div>

        {recent.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum post ainda — crie seu primeiro post para vê-lo aqui.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {recent.map((post: Post) => (
                  <tr key={post.id} className="border-b border-border last:border-0">
                    <td className="w-10 py-2.5 pr-3">
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
                        <img src={post.image_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                      )}
                    </td>
                    <td className="max-w-[220px] truncate py-2.5 pr-3 font-medium text-foreground">
                      {post.title}
                    </td>
                    <td className="hidden py-2.5 pr-3 text-muted-foreground sm:table-cell">
                      {post.page_name ?? "—"}
                    </td>
                    <td className="py-2.5 pr-3">
                      <StatusBadge status={post.status} />
                    </td>
                    <td className="py-2.5 text-right text-xs text-muted-foreground">
                      {new Date(post.created_at).toLocaleDateString("pt-BR", { month: "short", day: "numeric" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
