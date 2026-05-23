"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { StateResponse } from "@/lib/types";
import { Stadium } from "./Stadium";
import { ActivityFeed } from "./ActivityFeed";
import { InjectPanel } from "./InjectPanel";
import { ThemeToggle } from "./ThemeToggle";

const POLL_MS = 1500;

export function Dashboard() {
  const [state, setState] = useState<StateResponse>({ zones: [], decisions: [] });
  const [error, setError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [monitoring, setMonitoring] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/state", { cache: "no-store" });
      if (!r.ok) throw new Error(`state ${r.status}`);
      setState(await r.json());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  // Always do one initial fetch so the dashboard isn't empty on first paint,
  // even when monitoring starts paused. Polling timer only runs while on.
  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!monitoring) return;
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [monitoring, refresh]);

  async function reset() {
    if (!confirm("Wipe all decisions and zone state? This can't be undone.")) return;
    setResetting(true);
    try {
      await fetch("/api/reset", { method: "POST" });
      await refresh();
    } finally {
      setResetting(false);
    }
  }

  const stats = useMemo(() => {
    const totalAgents = new Set(state.decisions.map((d) => d.agent)).size;
    const dangerous = state.zones.filter((z) => (z.pressure_index ?? 0) >= 0.6).length;
    const activePlans = state.zones.filter((z) => z.active_route_plan).length;
    return { totalAgents, dangerous, activePlans, decisions: state.decisions.length };
  }, [state]);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      <header
        data-themed
        className="sticky top-0 z-10 backdrop-blur bg-[color-mix(in_oklab,var(--bg)_85%,transparent)] border-b border-[var(--border)]"
      >
        <div className="max-w-7xl mx-auto px-5 lg:px-8 py-3.5 flex items-center gap-4">
          <Logo />
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold tracking-tight text-[var(--fg)]">StadiumOS</h1>
            <p className="text-xs text-[var(--muted)] truncate">
              Agentic command — live from Firestore every {POLL_MS / 1000}s
            </p>
          </div>
          {error && (
            <span className="hidden sm:inline-block text-xs font-mono text-red-500">{error}</span>
          )}
          <button
            type="button"
            onClick={() => {
              if (!monitoring) refresh();
              setMonitoring((v) => !v);
            }}
            data-themed
            className="inline-flex items-center gap-2 h-8 px-3 rounded-full border border-[var(--border)] bg-[var(--card)] text-xs font-medium text-[var(--fg)] hover:bg-[var(--card-soft)] transition"
            title={monitoring ? "Pause live polling" : "Resume live polling"}
            aria-pressed={monitoring}
          >
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                monitoring ? "bg-emerald-500 animate-pulse" : "bg-zinc-400"
              }`}
              aria-hidden
            />
            {monitoring ? "Monitoring" : "Paused"}
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-[var(--muted)]">
              {monitoring ? (
                <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
              ) : (
                <path d="M8 5v14l11-7z" />
              )}
            </svg>
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={resetting}
            data-themed
            className="hidden sm:inline-flex items-center gap-2 h-8 px-3 rounded-full border border-[var(--border)] bg-[var(--card)] text-xs font-medium text-[var(--muted)] hover:text-[var(--fg)] disabled:opacity-50 transition"
            title="Wipe Firestore decisions + zones for a clean demo"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
              <path d="M3 12a9 9 0 1 0 3.5-7.1L3 8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3 3v5h5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {resetting ? "Resetting…" : "Reset demo"}
          </button>
          <ThemeToggle />
        </div>

        <div className="max-w-7xl mx-auto px-5 lg:px-8 pb-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat label="Agents active" value={stats.totalAgents} />
          <Stat label="Decisions" value={stats.decisions} />
          <Stat label="At risk" value={stats.dangerous} accent={stats.dangerous > 0} />
          <Stat label="Routing plans" value={stats.activePlans} accent={stats.activePlans > 0} />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 lg:gap-8">
        <section className="flex flex-col gap-6">
          <Panel title="Stadium digital twin" subtitle="Occupancy + routing arrows from Firestore">
            <Stadium zones={state.zones} />
            <Legend />
          </Panel>

          <Panel title="Inject scenario" subtitle="POSTs to the Commander; chain animates above">
            <InjectPanel onInjected={refresh} />
          </Panel>
        </section>

        <aside>
          <Panel title="Agent activity" subtitle="Last 25 decisions, newest first" sticky>
            <ActivityFeed decisions={state.decisions} />
          </Panel>
        </aside>
      </main>
    </div>
  );
}

function Logo() {
  return (
    <div
      data-themed
      className="shrink-0 w-9 h-9 rounded-xl bg-[var(--accent-soft)] flex items-center justify-center"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-5 h-5 text-[var(--accent)]">
        <ellipse cx="12" cy="12" rx="10" ry="6" />
        <ellipse cx="12" cy="12" rx="4" ry="2.5" />
      </svg>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div
      data-themed
      className={`rounded-lg border border-[var(--border)] px-3 py-2 ${
        accent ? "bg-[var(--accent-soft)]" : "bg-[var(--card)]"
      }`}
    >
      <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold">
        {label}
      </div>
      <div
        className={`text-lg font-semibold mt-0.5 ${
          accent ? "text-[var(--accent)]" : "text-[var(--fg)]"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
  sticky,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  sticky?: boolean;
}) {
  return (
    <section
      data-themed
      className={`rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm ${
        sticky ? "lg:sticky lg:top-44" : ""
      }`}
    >
      <header className="px-5 pt-4 pb-2">
        <h2 className="text-sm font-semibold tracking-tight text-[var(--fg)]">{title}</h2>
        {subtitle && <p className="text-xs text-[var(--muted)] mt-0.5">{subtitle}</p>}
      </header>
      <div className="px-5 pb-5 pt-2">{children}</div>
    </section>
  );
}

function Legend() {
  const items: { color: string; label: string }[] = [
    { color: "var(--occ-low)", label: "< 50%" },
    { color: "var(--occ-mid)", label: "50–75%" },
    { color: "var(--occ-high)", label: "75–90%" },
    { color: "var(--occ-critical)", label: "> 90%" },
  ];
  return (
    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 justify-center text-xs text-[var(--muted)]">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-3 rounded-sm border border-[var(--border)]"
            style={{ background: i.color }}
          />
          {i.label}
        </span>
      ))}
    </div>
  );
}
