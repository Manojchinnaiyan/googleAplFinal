import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// The full roster of agents this deployment is *supposed* to have. The
// dashboard uses the length of this list as the denominator ("3 / 5
// online"), so adding a new agent here makes the dashboard correctly
// surface a missing service even before it gets a URL.
type AgentMeta = { name: string; envVar: string; label: string };

const ROSTER: AgentMeta[] = [
  { name: "commander", envVar: "COMMANDER_URL", label: "Commander" },
  { name: "crowd-vision", envVar: "CROWD_VISION_URL", label: "Crowd Vision" },
  { name: "flow-router", envVar: "FLOW_ROUTER_URL", label: "Flow Router" },
  { name: "emergency", envVar: "EMERGENCY_URL", label: "Emergency" },
  { name: "ticketing", envVar: "TICKETING_URL", label: "Ticketing" },
];

type HealthResult = {
  name: string;
  label: string;
  url: string | null;
  online: boolean;
  latency_ms: number | null;
};

async function checkOne(meta: AgentMeta): Promise<HealthResult> {
  const url = process.env[meta.envVar];
  if (!url) {
    return { name: meta.name, label: meta.label, url: null, online: false, latency_ms: null };
  }
  const started = Date.now();
  try {
    const r = await fetch(`${url.replace(/\/$/, "")}/health`, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(3500),
    });
    return {
      name: meta.name,
      label: meta.label,
      url,
      online: r.ok,
      latency_ms: Date.now() - started,
    };
  } catch {
    return { name: meta.name, label: meta.label, url, online: false, latency_ms: null };
  }
}

export async function GET(): Promise<NextResponse> {
  const results = await Promise.all(ROSTER.map(checkOne));
  const online = results.filter((r) => r.online).length;
  return NextResponse.json({
    deployed: ROSTER.length,
    online,
    agents: results,
  });
}
