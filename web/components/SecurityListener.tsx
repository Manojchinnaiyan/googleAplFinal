"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Decision, StateResponse } from "@/lib/types";
import { pickVoice, waitForVoices } from "@/lib/voices";

// Audio-first view for security + ticketing teams. Always polling. The big
// MUTE/UNMUTE button is the only chrome. Every NEW emergency / dispatch /
// security / ticketing decision is queued for speech and rendered as a
// live transcript that fills the screen.

const POLL_MS = 1500;

// Only these agents are relevant to the listener. Filter out routine
// commander/flow-router chatter that doesn't need to be announced over
// a PA-style channel.
const VOICED_AGENTS = new Set(["emergency", "ticketing", "crowd-vision"]);

const AGENT_LABEL: Record<string, { name: string; tone: string; ring: string }> = {
  emergency: { name: "Emergency", tone: "text-red-400", ring: "ring-red-500/40" },
  ticketing: { name: "Ticketing", tone: "text-pink-400", ring: "ring-pink-500/40" },
  "crowd-vision": { name: "Crowd Vision", tone: "text-cyan-400", ring: "ring-cyan-500/40" },
};

function announcement(d: Decision): string {
  const meta = AGENT_LABEL[d.agent];
  const who = meta?.name ?? d.agent;
  return `${who} alert. ${d.input_summary}. ${d.reasoning}`;
}

function relative(iso?: string): string {
  if (!iso) return "";
  const sec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ago`;
}

export function SecurityListener() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [muted, setMuted] = useState(true);
  const [voiceName, setVoiceName] = useState("");
  const [ready, setReady] = useState(false);

  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const spokenIds = useRef<Set<string>>(new Set());
  const queueRef = useRef<string[]>([]);
  const speakingRef = useRef(false);

  // Pick a voice once.
  useEffect(() => {
    if (typeof window === "undefined") return;
    waitForVoices().then((voices) => {
      const v = pickVoice(voices);
      voiceRef.current = v;
      setVoiceName(v ? `${v.name} (${v.lang})` : "");
      setReady(true);
    });
  }, []);

  // Live state poll.
  useEffect(() => {
    let alive = true;
    async function refresh() {
      try {
        const r = await fetch("/api/state", { cache: "no-store" });
        if (!r.ok) return;
        const data: StateResponse = await r.json();
        if (alive) setDecisions(data.decisions.filter((d) => VOICED_AGENTS.has(d.agent)));
      } catch {
        /* ignore transient errors */
      }
    }
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // When the operator first un-mutes, we deliberately don't replay the
  // backlog — they'd be hit with N synthetic announcements. Seed the
  // already-spoken set with everything visible at that moment.
  useEffect(() => {
    if (!muted && spokenIds.current.size === 0) {
      decisions.forEach((d) => spokenIds.current.add(d.id));
    }
  }, [muted, decisions]);

  const drain = useCallback(() => {
    if (speakingRef.current) return;
    const next = queueRef.current.shift();
    if (!next) return;
    speakingRef.current = true;
    const utter = new SpeechSynthesisUtterance(next);
    if (voiceRef.current) {
      utter.voice = voiceRef.current;
      utter.lang = voiceRef.current.lang;
    } else {
      utter.lang = "en-IN";
    }
    utter.rate = 1.0;
    utter.pitch = 1.0;
    utter.volume = 1.0;
    utter.onend = () => {
      speakingRef.current = false;
      drain();
    };
    utter.onerror = utter.onend;
    window.speechSynthesis.speak(utter);
  }, []);

  // Queue speech for any newly-arrived voiced decision.
  useEffect(() => {
    if (muted) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const news: Decision[] = [];
    for (let i = decisions.length - 1; i >= 0; i--) {
      const d = decisions[i];
      if (!spokenIds.current.has(d.id)) {
        news.push(d);
        spokenIds.current.add(d.id);
      }
    }
    if (news.length === 0) return;
    for (const d of news) queueRef.current.push(announcement(d));
    drain();
  }, [decisions, muted, drain]);

  useEffect(() => {
    if (!muted) return;
    if (typeof window === "undefined") return;
    window.speechSynthesis.cancel();
    queueRef.current = [];
    speakingRef.current = false;
  }, [muted]);

  const latest = useMemo(() => decisions.slice(0, 12), [decisions]);
  const top = decisions[0];

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center gap-4">
        <span className={`inline-flex w-3 h-3 rounded-full ${muted ? "bg-zinc-500" : "bg-emerald-500 animate-pulse"}`} aria-hidden />
        <div className="flex-1">
          <h1 className="text-base font-semibold tracking-tight">StadiumOS · Security Listening Post</h1>
          <p className="text-xs text-zinc-500">
            {muted ? "Audio muted" : `Live · voice: ${voiceName || "default"}`}
            <span className="mx-2 text-zinc-700">·</span>
            {ready ? "Polling every 1.5s" : "Loading voice…"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          className={`inline-flex items-center gap-2 h-12 px-6 rounded-full text-sm font-semibold transition ${
            muted
              ? "bg-emerald-500 hover:bg-emerald-400 text-black"
              : "bg-zinc-800 hover:bg-zinc-700 text-zinc-100"
          }`}
        >
          {muted ? (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="22" y1="9" x2="16" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="16" y1="9" x2="22" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>
          )}
          {muted ? "UNMUTE TO LISTEN" : "MUTE"}
        </button>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8 flex flex-col gap-6">
        {top ? (
          <section
            className={`rounded-2xl bg-zinc-900 ring-2 ${AGENT_LABEL[top.agent]?.ring ?? "ring-zinc-700"} px-8 py-6`}
          >
            <div className="flex items-baseline justify-between gap-4 mb-3">
              <span className={`text-xs font-bold uppercase tracking-widest ${AGENT_LABEL[top.agent]?.tone ?? "text-zinc-300"}`}>
                {AGENT_LABEL[top.agent]?.name ?? top.agent} · latest alert
              </span>
              <span className="text-xs font-mono text-zinc-500">{relative(top.ts)}</span>
            </div>
            <p className="text-2xl font-semibold leading-snug">{top.input_summary}</p>
            <p className="text-base text-zinc-300 mt-3 leading-relaxed">{top.reasoning}</p>
          </section>
        ) : (
          <section className="rounded-2xl bg-zinc-900 ring-1 ring-zinc-800 px-8 py-12 text-center">
            <p className="text-zinc-400 text-lg">No alerts yet.</p>
            <p className="text-zinc-600 text-sm mt-2">
              Trigger the simulators on the main dashboard; this view will announce any emergency,
              ticketing, or crowd-vision decision.
            </p>
          </section>
        )}

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">
            Recent alerts ({latest.length})
          </h2>
          <ol className="flex flex-col gap-2">
            {latest.slice(1).map((d) => (
              <li
                key={d.id}
                className={`rounded-lg bg-zinc-900 ring-1 ring-zinc-800 px-4 py-3 flex items-start gap-3`}
              >
                <span className={`shrink-0 mt-1 inline-block w-2 h-2 rounded-full bg-zinc-700`} aria-hidden />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${AGENT_LABEL[d.agent]?.tone ?? "text-zinc-400"}`}>
                      {AGENT_LABEL[d.agent]?.name ?? d.agent}
                    </span>
                    <span className="text-sm text-zinc-100 truncate">{d.input_summary}</span>
                    <span className="ml-auto text-[10px] font-mono text-zinc-500 shrink-0">{relative(d.ts)}</span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{d.reasoning}</p>
                </div>
              </li>
            ))}
          </ol>
          {latest.length === 0 && (
            <p className="text-zinc-600 text-sm text-center py-6">
              Quiet. New alerts will appear here and be announced aloud.
            </p>
          )}
        </section>
      </main>

      <footer className="border-t border-zinc-800 px-6 py-3 text-center text-xs text-zinc-600">
        Keep this tab open in your ops room. The unmute button must be clicked once to enable browser audio.
      </footer>
    </div>
  );
}
