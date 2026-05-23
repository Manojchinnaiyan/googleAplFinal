"use client";

import { useState } from "react";

const SCENARIOS = [
  {
    id: "stampede",
    label: "Stampede precursor: North Stand 87%",
    message:
      "North Stand is at 87% occupancy with inward velocity 1.2 m/s, reported by crowd-vision. Take action.",
  },
  {
    id: "medical",
    label: "Medical emergency: East Stand",
    message:
      "A fan has collapsed in section E-14 of East Stand. Trigger emergency response.",
  },
  {
    id: "weather",
    label: "Rain incoming in 8 min",
    message:
      "Weather sensors report heavy rain in 8 minutes. Pre-position staff and update fans.",
  },
];

export function InjectPanel({ onInjected }: { onInjected: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [last, setLast] = useState<string | null>(null);

  async function fire(id: string, message: string) {
    setBusy(id);
    setLast(null);
    try {
      const r = await fetch("/api/inject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
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

  return (
    <div className="flex flex-col gap-2">
      {SCENARIOS.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => fire(s.id, s.message)}
          disabled={busy !== null}
          className="text-left px-3 py-2 rounded-md bg-zinc-900 ring-1 ring-zinc-800 hover:bg-zinc-800 hover:ring-zinc-700 disabled:opacity-50 transition text-sm"
        >
          <span className="text-zinc-200">{s.label}</span>
          {busy === s.id && (
            <span className="ml-2 text-amber-400 text-xs">(running…)</span>
          )}
        </button>
      ))}
      {last && (
        <div className="mt-2 text-xs text-zinc-400 bg-zinc-900/60 ring-1 ring-zinc-800 rounded-md p-2">
          {last}
        </div>
      )}
    </div>
  );
}
