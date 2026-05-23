// Dumb in-memory cooldown limiter for the dashboard's POST API routes.
//
// On a single Cloud Run instance this is enough to stop accidental
// double-clicks and casual abuse during the live demo. With multiple
// instances the limit is per-instance, which is fine for demo scale (we
// pin max-instances=5). For real production you'd back this with Redis
// or Cloud Memorystore — out of scope here.

const lastHit = new Map<string, number>();

export function rateLimited(key: string, cooldownMs: number): number | null {
  const now = Date.now();
  const prev = lastHit.get(key);
  if (prev !== undefined && now - prev < cooldownMs) {
    return Math.ceil((cooldownMs - (now - prev)) / 1000);
  }
  lastHit.set(key, now);
  return null;
}
