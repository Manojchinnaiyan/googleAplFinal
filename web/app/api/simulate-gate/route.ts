import { NextResponse } from "next/server";
import { publish } from "@/lib/pubsub";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Plays back a short ticketing-anomaly sequence so the Ticketing agent gets
// pulled into the chain on the dashboard. All events have `event` set to
// something the Ticketing agent will actually act on (scan_ok is filtered
// out upstream and would just produce noise).
//
// Sequence:
//   1. duplicate scan (same ticket already entered at a different gate)
//   2. second duplicate from the same ticket — agent escalates to security
//   3. invalid ticket at a third gate
//   4. low-throughput report on a backed-up gate

type GateFrame = {
  gate_id: string;
  event: "scan_dup" | "scan_invalid" | "throughput";
  ticket_id?: string;
  throughput_per_min?: number;
  note: string;
};

const FRAMES: GateFrame[] = [
  {
    gate_id: "gate_3",
    event: "scan_dup",
    ticket_id: "T-4421",
    note: "ticket already scanned at gate_5 12s earlier",
  },
  {
    gate_id: "gate_7",
    event: "scan_dup",
    ticket_id: "T-4421",
    note: "third entry attempt from the same QR — likely shared",
  },
  {
    gate_id: "gate_4",
    event: "scan_invalid",
    ticket_id: "T-9988",
    note: "ticket not present in the issued-tickets set for this match",
  },
  {
    gate_id: "gate_2",
    event: "throughput",
    throughput_per_min: 90,
    note: "queue camera shows 220 fans waiting; throughput collapsed",
  },
];

const FRAME_INTERVAL_MS = 2200;

export async function POST(): Promise<NextResponse> {
  const messageIds: string[] = [];

  for (let i = 0; i < FRAMES.length; i++) {
    const f = FRAMES[i];
    const ts = new Date().toISOString();
    const event = { ...f, ts };

    const id = await publish("gate.event", event);
    messageIds.push(id);

    if (i < FRAMES.length - 1) {
      await new Promise((r) => setTimeout(r, FRAME_INTERVAL_MS));
    }
  }

  return NextResponse.json({
    ok: true,
    frames_published: FRAMES.length,
    message_ids: messageIds,
    note: "Ticketing agent reacts via gate.event push subscription.",
  });
}
