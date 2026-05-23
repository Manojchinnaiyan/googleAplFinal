import { NextResponse } from "next/server";
import { db } from "@/lib/firestore";
import { pubsub } from "@/lib/pubsub";
import { rateLimited } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

// Push subscriptions we drain before wiping Firestore — otherwise in-flight
// Pub/Sub messages from earlier simulator runs keep arriving after Reset and
// re-trigger Emergency / Ticketing against the freshly-empty state, making
// "Reset" feel like it didn't work.
const SUBSCRIPTIONS_TO_DRAIN = [
  "commander-crowd-density",
  "commander-emergency",
  "emergency-trigger-handler",
  "ticketing-gate-event-handler",
];

// Hard-resets the live demo state. Hackathon demo button — don't ship in prod.
export async function POST(): Promise<NextResponse> {
  const cooldown = rateLimited("reset", 5000);
  if (cooldown !== null) {
    return NextResponse.json(
      { error: "rate_limited", retry_in_seconds: cooldown },
      { status: 429 },
    );
  }

  // 1. Seek every push subscription to "now" so backlog messages get skipped.
  const subResults: Array<{ name: string; ok: boolean; error?: string }> = [];
  const now = new Date();
  await Promise.all(
    SUBSCRIPTIONS_TO_DRAIN.map(async (name) => {
      try {
        await pubsub().subscription(name).seek(now);
        subResults.push({ name, ok: true });
      } catch (e) {
        subResults.push({ name, ok: false, error: (e as Error).message });
      }
    }),
  );

  // 2. Delete every Firestore doc the dashboard reads. Firestore caps each
  //    write batch at 500 operations; with a busy demo the `decisions`
  //    collection blows past that, so we chunk.
  const client = db();
  const BATCH_LIMIT = 400;
  let deleted = 0;
  for (const coll of ["decisions", "zones", "ticket_anomalies", "gates"] as const) {
    const snap = await client.collection(coll).get();
    if (snap.empty) continue;
    for (let i = 0; i < snap.docs.length; i += BATCH_LIMIT) {
      const batch = client.batch();
      snap.docs.slice(i, i + BATCH_LIMIT).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    deleted += snap.size;
  }

  return NextResponse.json({ ok: true, deleted, subscriptions: subResults });
}
