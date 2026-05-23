import { NextResponse } from "next/server";
import { db } from "@/lib/firestore";
import { rateLimited } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

// Hard-resets the live demo state: deletes every doc in `decisions/`,
// `zones/`, `ticket_anomalies/`, `gates/`. Hackathon demo button —
// don't ship this in production.
export async function POST(): Promise<NextResponse> {
  const cooldown = rateLimited("reset", 5000);
  if (cooldown !== null) {
    return NextResponse.json(
      { error: "rate_limited", retry_in_seconds: cooldown },
      { status: 429 },
    );
  }

  const client = db();
  let deleted = 0;

  for (const coll of ["decisions", "zones", "ticket_anomalies", "gates"] as const) {
    const snap = await client.collection(coll).get();
    if (snap.empty) continue;
    const batch = client.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    deleted += snap.size;
  }

  return NextResponse.json({ ok: true, deleted });
}
