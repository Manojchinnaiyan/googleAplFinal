"use client";

import { useEffect, useRef } from "react";
import type { Decision } from "@/lib/types";

type Props = {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  decisions: Decision[];
};

const AGENT_PROSE: Record<string, string> = {
  commander: "Commander",
  "crowd-vision": "Crowd Vision",
  "flow-router": "Flow Router",
  emergency: "Emergency",
  ticketing: "Ticketing",
};

// Read aloud: "<agent>: <input_summary>. <reasoning>".
function decisionToSpeech(d: Decision): string {
  const who = AGENT_PROSE[d.agent] ?? d.agent;
  return `${who}: ${d.input_summary}. ${d.reasoning}`;
}

export function SpeechToggle({ enabled, setEnabled, decisions }: Props) {
  // Track which decision ids we've already spoken so toggling on doesn't
  // replay the entire backlog, and re-fetches don't spam.
  const spokenIds = useRef<Set<string>>(new Set());
  const queueRef = useRef<string[]>([]);
  const speakingRef = useRef(false);

  // Seed the "already spoken" set with whatever's on screen when speech is
  // first switched on — only NEW decisions after that point get read.
  useEffect(() => {
    if (enabled && spokenIds.current.size === 0) {
      decisions.forEach((d) => spokenIds.current.add(d.id));
    }
  }, [enabled, decisions]);

  // Drain the queue one utterance at a time (Web Speech can chunk badly if
  // you submit several at once; queueing is far smoother).
  function drain() {
    if (speakingRef.current) return;
    const next = queueRef.current.shift();
    if (!next) return;
    speakingRef.current = true;
    const utter = new SpeechSynthesisUtterance(next);
    utter.rate = 1.05;
    utter.pitch = 1.0;
    utter.lang = "en-IN";
    utter.onend = () => {
      speakingRef.current = false;
      drain();
    };
    utter.onerror = utter.onend;
    window.speechSynthesis.speak(utter);
  }

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    // New decisions arrive at index 0 (newest-first). Walk from the end so
    // we speak them in chronological order.
    const news: Decision[] = [];
    for (let i = decisions.length - 1; i >= 0; i--) {
      const d = decisions[i];
      if (!spokenIds.current.has(d.id)) {
        news.push(d);
        spokenIds.current.add(d.id);
      }
    }
    if (news.length === 0) return;
    for (const d of news) queueRef.current.push(decisionToSpeech(d));
    drain();
  }, [decisions, enabled]);

  // When disabled, cancel anything mid-utterance and drop the queue.
  useEffect(() => {
    if (enabled) return;
    if (typeof window === "undefined") return;
    window.speechSynthesis.cancel();
    queueRef.current = [];
    speakingRef.current = false;
  }, [enabled]);

  return (
    <button
      type="button"
      onClick={() => setEnabled(!enabled)}
      data-themed
      className="inline-flex items-center gap-2 h-8 px-3 rounded-full border border-[var(--border)] bg-[var(--card)] text-xs font-medium text-[var(--fg)] hover:bg-[var(--card-soft)] transition"
      title={enabled ? "Mute spoken alerts" : "Speak agent decisions aloud"}
      aria-pressed={enabled}
    >
      {enabled ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-emerald-500">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
          <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" strokeLinecap="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-[var(--muted)]">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
          <line x1="22" y1="9" x2="16" y2="15" strokeLinecap="round" />
          <line x1="16" y1="9" x2="22" y2="15" strokeLinecap="round" />
        </svg>
      )}
      {enabled ? "Speaking" : "Muted"}
    </button>
  );
}
