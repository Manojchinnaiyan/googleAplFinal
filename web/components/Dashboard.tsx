"use client";

import { useCallback, useEffect, useState } from "react";
import type { StateResponse } from "@/lib/types";
import { Stadium } from "./Stadium";
import { ActivityFeed } from "./ActivityFeed";
import { InjectPanel } from "./InjectPanel";

const POLL_MS = 1500;

export function Dashboard() {
  const [state, setState] = useState<StateResponse>({ zones: [], decisions: [] });
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-baseline justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">StadiumOS</h1>
            <p className="text-xs text-zinc-500">
              Agentic command platform — live agent activity from Firestore
            </p>
          </div>
          {error && (
            <span className="text-xs text-red-400 font-mono">{error}</span>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8">
        <section>
          <h2 className="text-sm font-semibold text-zinc-400 mb-3 uppercase tracking-wide">
            Stadium digital twin
          </h2>
          <div className="rounded-xl bg-zinc-900/60 ring-1 ring-zinc-800 p-6">
            <Stadium zones={state.zones} />
            <div className="mt-4 flex gap-4 justify-center text-xs text-zinc-500">
              <Legend color="#10b981" label="< 50%" />
              <Legend color="#f59e0b" label="50–75%" />
              <Legend color="#f97316" label="75–90%" />
              <Legend color="#ef4444" label="> 90%" />
            </div>
          </div>

          <h2 className="text-sm font-semibold text-zinc-400 mt-8 mb-3 uppercase tracking-wide">
            Inject scenario
          </h2>
          <div className="rounded-xl bg-zinc-900/60 ring-1 ring-zinc-800 p-4">
            <InjectPanel onInjected={refresh} />
          </div>
        </section>

        <aside>
          <h2 className="text-sm font-semibold text-zinc-400 mb-3 uppercase tracking-wide">
            Agent activity
          </h2>
          <div className="rounded-xl bg-zinc-900/60 ring-1 ring-zinc-800 p-4 max-h-[80vh]">
            <ActivityFeed decisions={state.decisions} />
          </div>
        </aside>
      </main>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="inline-block w-3 h-3 rounded-sm ring-1 ring-zinc-700"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}
