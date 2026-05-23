"use client";

import type { Decision } from "@/lib/types";

const AGENT_META: Record<
  string,
  { label: string; full: string; bg: string; fg: string }
> = {
  commander: {
    label: "CMD",
    full: "Commander",
    bg: "rgba(139, 92, 246, 0.15)",
    fg: "#a78bfa",
  },
  "crowd-vision": {
    label: "CV",
    full: "Crowd Vision",
    bg: "rgba(6, 182, 212, 0.15)",
    fg: "#22d3ee",
  },
  "flow-router": {
    label: "FR",
    full: "Flow Router",
    bg: "rgba(16, 185, 129, 0.15)",
    fg: "#34d399",
  },
  emergency: {
    label: "EM",
    full: "Emergency",
    bg: "rgba(239, 68, 68, 0.16)",
    fg: "#f87171",
  },
  comms: {
    label: "CO",
    full: "Comms",
    bg: "rgba(245, 158, 11, 0.16)",
    fg: "#fbbf24",
  },
  ticketing: {
    label: "TK",
    full: "Ticketing",
    bg: "rgba(244, 114, 182, 0.18)",
    fg: "#f472b6",
  },
};

function relativeTime(iso: string | undefined): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const sec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

export function ActivityFeed({ decisions }: { decisions: Decision[] }) {
  if (decisions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-center px-4">
        <div className="w-10 h-10 rounded-full border border-dashed border-[var(--border)] flex items-center justify-center mb-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-[var(--subtle)]">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v6m0 10v6M4.22 4.22l4.24 4.24m7.07 7.07l4.24 4.24M1 12h6m10 0h6M4.22 19.78l4.24-4.24m7.07-7.07l4.24-4.24" strokeLinecap="round" />
          </svg>
        </div>
        <p className="text-sm font-medium text-[var(--muted)]">Quiet stadium</p>
        <p className="text-xs text-[var(--subtle)] mt-1">Inject a scenario to start the agent chain.</p>
      </div>
    );
  }

  return (
    <ol className="flex flex-col gap-2.5 overflow-y-auto pr-1" aria-live="polite">
      {decisions.map((d, idx) => {
        const meta = AGENT_META[d.agent] ?? {
          label: d.agent.slice(0, 2).toUpperCase(),
          full: d.agent,
          bg: "rgba(113, 113, 122, 0.16)",
          fg: "var(--muted)",
        };

        return (
          <li
            key={d.id}
            data-themed
            className={`fade-in rounded-lg border border-[var(--border)] bg-[var(--card)] px-3.5 py-3 text-sm shadow-sm ${
              idx === 0 ? "ring-1 ring-[var(--accent-soft)]" : ""
            }`}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className="inline-flex items-center justify-center rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide"
                style={{ background: meta.bg, color: meta.fg }}
                title={meta.full}
              >
                {meta.label}
              </span>
              <span className="text-[var(--fg)] font-medium truncate flex-1">
                {d.input_summary}
              </span>
              <span className="text-[10px] font-mono text-[var(--subtle)] shrink-0">
                {relativeTime(d.ts)}
              </span>
            </div>
            <p className="text-xs text-[var(--muted)] leading-relaxed">{d.reasoning}</p>
          </li>
        );
      })}
    </ol>
  );
}
