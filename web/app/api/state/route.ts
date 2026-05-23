import { NextResponse } from "next/server";
import { db } from "@/lib/firestore";
import { ALL_ZONES, type Decision, type Zone } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const client = db();

  const [zoneSnaps, decisionSnap] = await Promise.all([
    Promise.all(
      ALL_ZONES.map((z) => client.collection("zones").doc(z).get()),
    ),
    client.collection("decisions").orderBy("ts", "desc").limit(25).get(),
  ]);

  const zones: Zone[] = zoneSnaps.map((snap, i) => ({
    zone: ALL_ZONES[i],
    ...(snap.exists ? (snap.data() as Omit<Zone, "zone">) : {}),
  }));

  const decisions: Decision[] = decisionSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<Decision, "id">),
  }));

  return NextResponse.json({ zones, decisions });
}
