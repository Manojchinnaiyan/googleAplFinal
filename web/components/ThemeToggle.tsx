"use client";

import { useTheme } from "./ThemeProvider";

const ORDER = ["light", "dark", "system"] as const;
type Opt = (typeof ORDER)[number];

function Icon({ kind }: { kind: Opt }) {
  if (kind === "light") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "dark") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
        <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    );
  }
  // system
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" strokeLinecap="round" />
    </svg>
  );
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      data-themed
      className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--card)] p-0.5 text-[var(--muted)]"
    >
      {ORDER.map((opt) => (
        <button
          key={opt}
          type="button"
          aria-label={`${opt} theme`}
          onClick={() => setTheme(opt)}
          className={`relative inline-flex items-center justify-center w-7 h-7 rounded-full transition ${
            theme === opt
              ? "bg-[var(--accent-soft)] text-[var(--accent)]"
              : "hover:text-[var(--fg)]"
          }`}
        >
          <Icon kind={opt} />
        </button>
      ))}
    </div>
  );
}
