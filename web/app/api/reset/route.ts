import { NextResponse } from "next/server";
import { db } from "@/lib/firestore";

export const dynamic = "force-dynamic";

// Hard-resets the live demo state: deletes every doc in `decisions/` and
// `zones/`. Intentionally not idempotent-friendly (no auth either) — it's a
// hackathon demo button. Don't ship this in production.
export async function POST(): Promise<NextResponse> {
  const client = db();
  let deleted = 0;

  for (const coll of ["decisions", "zones"] as const) {
    const snap = await client.collection(coll).get();
    if (snap.empty) continue;
    const batch = client.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    deleted += snap.size;
  }

  return NextResponse.json({ ok: true, deleted });
}
