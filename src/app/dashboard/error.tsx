"use client";

import { useEffect } from "react";
import Link from "next/link";
import { WarningCircle, ArrowClockwise } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";

/**
 * Last-resort boundary. Expected failures — chiefly a database that is not set
 * up yet — are handled on the page itself, because React redacts server-side
 * error messages in production builds: whatever actually went wrong arrives
 * here as "Minified React error #441", which tells a new user nothing. So this
 * screen explains the likely causes rather than relying on `error.message`.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const redacted = /Minified React error/.test(error.message);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <WarningCircle size={28} weight="bold" />
      </div>
      <h2 className="mt-4 font-heading text-lg font-bold text-foreground">
        This page didn&apos;t load
      </h2>

      {redacted ? (
        <div className="mt-2 text-sm text-muted-foreground">
          <p>
            The server hit an error and the details are hidden in production builds. On a
            new install it is nearly always the setup:
          </p>
          <ul className="mt-3 space-y-1.5 text-left">
            <li>
              • <code className="rounded bg-surface-2 px-1 text-xs">supabase/schema.sql</code> has
              not been run in the Supabase SQL editor
            </li>
            <li>
              • <code className="rounded bg-surface-2 px-1 text-xs">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
              or{" "}
              <code className="rounded bg-surface-2 px-1 text-xs">SUPABASE_SERVICE_ROLE_KEY</code>{" "}
              is missing or wrong in Vercel — and needs a redeploy after changing
            </li>
            <li>• the Supabase project is paused</li>
          </ul>
          {error.digest && (
            <p className="mt-3 font-mono text-xs">
              Error digest: {error.digest} — search your Vercel runtime logs for it to see
              the real message.
            </p>
          )}
        </div>
      ) : (
        <p className="mt-1.5 text-sm text-muted-foreground">{error.message}</p>
      )}

      <div className="mt-5 flex gap-2">
        <Button onClick={reset} size="sm">
          <ArrowClockwise size={14} /> Try again
        </Button>
        <Link href="/dashboard/settings">
          <Button size="sm" variant="secondary">
            Open Settings
          </Button>
        </Link>
      </div>
    </div>
  );
}
