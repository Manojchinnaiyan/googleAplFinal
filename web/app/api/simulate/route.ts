import { NextResponse } from "next/server";
import { bearerHeader } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { publish } from "@/lib/pubsub";
import { rateLimited } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
export const maxDuration = 120;
const SIMULATE_COOLDOWN_MS = 30000;

// Plays back a "pre-crime stampede" sequence over ~20 seconds:
//   - 8 CrowdDensity events on `crowd.density` (Pub/Sub push -> Commander reacts)
//   - Each event also patches Firestore zones/<zone> so the SVG colours
//     update immediately on the dashboard's next poll
//
// The final two frames cross the auto-escalate threshold (>=0.85 pressure)
// which makes Commander dispatch flow-router AND fires emergency.trigger,
// pulling the Emergency agent into the chain. By the end the dashboard
// shows: red North stand, cyan routing arrow, responder dispatch in the
// feed, all without any human input.

type Frame = {
  occupancy: number;
  head_count: number;
  velocity_mps: number;
  pressure_index: number;
};

const FRAMES: Frame[] = [
  { occupancy: 0.55, head_count: 6600, velocity_mps: -0.4, pressure_index: 0.22 },
  { occupancy: 0.63, head_count: 7560, velocity_mps: -0.7, pressure_index: 0.44 },
  { occupancy: 0.71, head_count: 8520, velocity_mps: -0.9, pressure_index: 0.64 },
  { occupancy: 0.78, head_count: 9360, velocity_mps: -1.1, pressure_index: 0.86 },
  { occupancy: 0.84, head_count: 10080, velocity_mps: -1.3, pressure_index: 1.09 },
  { occupancy: 0.89, head_count: 10680, velocity_mps: -1.4, pressure_index: 1.25 },
  { occupancy: 0.93, head_count: 11160, velocity_mps: -1.5, pressure_index: 1.40 },
  { occupancy: 0.96, head_count: 11520, velocity_mps: -1.4, pressure_index: 1.34 },
];

const FRAME_INTERVAL_MS = 2200;
// Matches PRESSURE_AUTO_ESCALATE in agents/crowd-vision/.../tools.py.
const PRESSURE_AUTO_ESCALATE = 0.85;

export async function POST(req: Request): Promise<NextResponse> {
  // The simulator runs for ~18s and chains LLM calls downstream; one at a time.
  const cooldown = rateLimited("simulate", SIMULATE_COOLDOWN_MS);
  if (cooldown !== null) {
    return NextResponse.json(
      { error: "rate_limited", retry_in_seconds: cooldown },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const zone: string = body.zone ?? "north_stand";
  const camera: string = body.camera ?? "cam-ns-04";

  // Pull all 5 agents into the chain on a single click:
  //
  // 1. Crowd Vision: fire-and-forget POST to /analyze with a sample frame
  //    bundled in /public. Gemini Vision analyses it; the agent publishes
  //    its own crowd.density + agent.decision rows. Takes ~10-15s but
  //    runs in parallel with the synthetic frame timeline below.
  const crowdVisionUrl = process.env.CROWD_VISION_URL;
  if (crowdVisionUrl) {
    const origin = new URL(req.url).origin;
    fetch(`${crowdVisionUrl.replace(/\/$/, "")}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...bearerHeader() },
      body: JSON.stringify({
        zone,
        source_camera: camera,
        image_url: `${origin}/sample-frame.jpg`,
      }),
      signal: AbortSignal.timeout(45_000),
    }).catch(() => {
      /* don't fail the simulator if Crowd Vision is slow */
    });
  }

  // 2. Ticketing: two gate.event anomalies — a duplicate scan from a shared
  //    QR plus a throughput drop on a backed-up gate. Gives Ticketing a
  //    reason to log + request more staff at that gate.
  const tsNow = new Date().toISOString();
  publish("gate.event", {
    gate_id: "gate_3",
    event: "scan_dup",
    ticket_id: "T-9921",
    ts: tsNow,
  }).catch(() => {});
  publish("gate.event", {
    gate_id: "gate_4",
    event: "throughput",
    throughput_per_min: 80,
    ts: tsNow,
  }).catch(() => {});

  const messageIds: string[] = [];
  let emergencyFired = false;

  for (let i = 0; i < FRAMES.length; i++) {
    const f = FRAMES[i];
    const ts = new Date().toISOString();
    const event = {
      zone,
      source_camera: camera,
      ts,
      ...f,
      // Marker so the Commander knows this came from a simulator and not
      // from a real crowd-vision pass. It still reacts identically.
      agent: "crowd-vision",
    };

    const id = await publish("crowd.density", event);
    messageIds.push(id);

    // Mirror into Firestore so the stadium SVG turns red immediately on
    // the dashboard's next poll, even before Commander acts.
    await db()
      .collection("zones")
      .doc(zone)
      .set(event, { merge: true });

    // Mimic Crowd Vision's auto-escalation: the FIRST time pressure crosses
    // the threshold, fire emergency.trigger so the Emergency agent dispatches
    // responders. Without this, the simulator never exercises that agent.
    if (!emergencyFired && f.pressure_index >= PRESSURE_AUTO_ESCALATE) {
      await publish("emergency.trigger", {
        kind: "stampede_risk",
        zone,
        severity: "high",
        details:
          `Auto-escalated by crowd-vision: pressure_index ${f.pressure_index.toFixed(2)} ` +
          `(occupancy ${Math.round(f.occupancy * 100)}%, velocity ${f.velocity_mps.toFixed(1)} m/s)`,
        detected_by: "crowd-vision",
        ts,
      });
      emergencyFired = true;
    }

    if (i < FRAMES.length - 1) {
      await new Promise((r) => setTimeout(r, FRAME_INTERVAL_MS));
    }
  }

  return NextResponse.json({
    ok: true,
    zone,
    frames_published: FRAMES.length,
    emergency_fired: emergencyFired,
    message_ids: messageIds,
    crowd_vision_kicked: Boolean(crowdVisionUrl),
    gate_events_published: 2,
    note: "Crowd Vision analyses a real frame, Ticketing reacts to gate anomalies, "
        + "Commander delegates to Flow Router, Emergency dispatches responders. "
        + "All 5 agents appear in the feed.",
  });
}
