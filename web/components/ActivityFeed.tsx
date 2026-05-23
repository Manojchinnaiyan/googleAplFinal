"use client";

import type { Decision } from "@/lib/types";

const AGENT_BADGE: Record<string, { color: string; label: string }> = {
  commander: { color: "bg-violet-500/20 text-violet-300 ring-violet-500/40", label: "CMD" },
  "crowd-vision": { color: "bg-cyan-500/20 text-cyan-300 ring-cyan-500/40", label: "CV" },
  "flow-router": { color: "bg-emerald-500/20 text-emerald-300 ring-emerald-500/40", label: "FR" },
  emergency: { color: "bg-red-500/20 text-red-300 ring-red-500/40", label: "EM" },
  comms: { color: "bg-amber-500/20 text-amber-300 ring-amber-500/40", label: "CO" },
};

function formatTime(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("en-GB", { hour12: false });
}

export function ActivityFeed({ decisions }: { decisions: Decision[] }) {
  return (
    <div className="flex flex-col gap-2 overflow-y-auto pr-1">
      {decisions.length === 0 && (
        <div className="text-zinc-500 text-sm py-8 text-center">
          No agent activity yet. Inject a scenario to start.
        </div>
      )}
      {decisions.map((d) => {
        const badge = AGENT_BADGE[d.agent] ?? {
          color: "bg-zinc-700/40 text-zinc-300 ring-zinc-600",
          label: d.agent.slice(0, 2).toUpperCase(),
        };
        return (
          <div
            key={d.id}
            className="rounded-md bg-zinc-900/70 ring-1 ring-zinc-800 px-3 py-2 text-sm"
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ring-1 ${badge.color}`}
              >
                {badge.label}
              </span>
              <span className="font-mono text-xs text-zinc-500">{formatTime(d.ts)}</span>
              <span className="text-zinc-300 font-medium truncate">{d.input_summary}</span>
            </div>
            <div className="text-zinc-400 text-xs">{d.reasoning}</div>
          </div>
        );
      })}
    </div>
  );
}
