"use client";

import { useState } from "react";

type Scenario = {
  id: string;
  label: string;
  description: string;
  message: string;
  icon: React.ReactNode;
  tone: "warn" | "danger" | "info";
};

const SCENARIOS: Scenario[] = [
  {
    id: "stampede",
    label: "Stampede precursor",
    description: "North Stand at 87%, inward velocity 1.2 m/s",
    message:
      "North Stand is at 87% occupancy with inward velocity 1.2 m/s, reported by crowd-vision. Take action.",
    tone: "warn",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "medical",
    label: "Medical emergency",
    description: "Fan collapsed in East Stand section E-14",
    message: "A fan has collapsed in section E-14 of East Stand. Trigger emergency response.",
    tone: "danger",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M22 4 12 14.01l-3-3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "weather",
    label: "Rain incoming",
    description: "Storm front arriving in 8 minutes",
    message: "Weather sensors report heavy rain in 8 minutes. Pre-position staff and update fans.",
    tone: "info",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
        <path d="M20 16.2A4.5 4.5 0 0 0 17.5 8h-1.8A7 7 0 1 0 4 14.9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 19v2M12 19v2M16 19v2" strokeLinecap="round" />
      </svg>
    ),
  },
];

const TONE_RING: Record<Scenario["tone"], string> = {
  warn: "hover:border-amber-500/40",
  danger: "hover:border-red-500/40",
  info: "hover:border-sky-500/40",
};

const TONE_FG: Record<Scenario["tone"], string> = {
  warn: "text-amber-500",
  danger: "text-red-500",
  info: "text-sky-500",
};

export function InjectPanel({ onInjected }: { onInjected: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [last, setLast] = useState<string | null>(null);

  async function fire(scenario: Scenario) {
    setBusy(scenario.id);
    setLast(null);
    try {
      const r = await fetch("/api/inject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: scenario.message }),
      });
      const data = await r.json();
      setLast(data.response ?? data.error ?? "ok");
      onInjected();
    } catch (e) {
      setLast(`error: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  async function simulate() {
    setBusy("simulate");
    setLast(null);
    try {
      const r = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zone: "north_stand" }),
      });
      const data = await r.json();
      setLast(
        data.ok
          ? `Published ${data.frames_published} frames. Watch the chain react above.`
          : (data.error ?? "ok"),
      );
      onInjected();
    } catch (e) {
      setLast(`error: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  async function simulateGate() {
    setBusy("simulate-gate");
    setLast(null);
    try {
      const r = await fetch("/api/simulate-gate", { method: "POST" });
      const data = await r.json();
      setLast(
        data.ok
          ? `Published ${data.frames_published} gate anomalies. Ticketing agent reacting…`
          : (data.error ?? "ok"),
      );
      onInjected();
    } catch (e) {
      setLast(`error: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  const simulating = busy === "simulate";
  const simulatingGate = busy === "simulate-gate";

  return (
    <div className="flex flex-col gap-2.5">
      <button
        type="button"
        onClick={simulate}
        disabled={busy !== null}
        data-themed
        className="group flex items-center gap-3 w-full text-left px-3.5 py-3 rounded-lg border border-[var(--accent)] bg-[var(--accent-soft)] disabled:opacity-60 disabled:cursor-not-allowed transition"
      >
        <span className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-md bg-[var(--card)] text-[var(--accent)]">
          {simulating ? (
            <Spinner />
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <polygon points="5 3 19 12 5 21 5 3" strokeLinejoin="round" />
            </svg>
          )}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold text-[var(--accent)]">
            Pre-Crime stampede simulator
            {simulating && <span className="ml-2 text-[10px] font-normal">running ~20s…</span>}
          </span>
          <span className="block text-xs text-[var(--muted)] truncate">
            Publishes 8 rising crowd frames → triggers the full agent chain
          </span>
        </span>
      </button>

      <button
        type="button"
        onClick={simulateGate}
        disabled={busy !== null}
        data-themed
        className="group flex items-center gap-3 w-full text-left px-3.5 py-3 rounded-lg border border-pink-400/50 bg-pink-400/10 disabled:opacity-60 disabled:cursor-not-allowed transition"
      >
        <span className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-md bg-[var(--card)] text-pink-500">
          {simulatingGate ? (
            <Spinner />
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="M3 10h18M8 5v14" strokeLinecap="round" />
            </svg>
          )}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold text-pink-500">
            Ticketing anomaly simulator
            {simulatingGate && <span className="ml-2 text-[10px] font-normal">running ~9s…</span>}
          </span>
          <span className="block text-xs text-[var(--muted)] truncate">
            Duplicate scans + invalid ticket + gate bottleneck
          </span>
        </span>
      </button>

      {SCENARIOS.map((s) => {
        const isBusy = busy === s.id;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => fire(s)}
            disabled={busy !== null}
            data-themed
            className={`group flex items-center gap-3 w-full text-left px-3.5 py-3 rounded-lg border border-[var(--border)] bg-[var(--card)] disabled:opacity-60 disabled:cursor-not-allowed transition ${TONE_RING[s.tone]}`}
          >
            <span
              className={`shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-md bg-[var(--card-soft)] ${TONE_FG[s.tone]}`}
            >
              {isBusy ? <Spinner /> : s.icon}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-medium text-[var(--fg)] truncate">
                {s.label}
                {isBusy && <span className="ml-2 text-[10px] text-[var(--muted)]">running…</span>}
              </span>
              <span className="block text-xs text-[var(--muted)] truncate">{s.description}</span>
            </span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="w-4 h-4 text-[var(--subtle)] group-hover:text-[var(--fg)] transition"
            >
              <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        );
      })}

      {last && (
        <div
          data-themed
          className="fade-in mt-1 text-xs text-[var(--fg)] bg-[var(--card-soft)] border border-[var(--border)] rounded-md p-3 leading-relaxed"
        >
          <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)] mb-1">
            Commander response
          </div>
          {last}
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 animate-spin" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
