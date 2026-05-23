import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  const url = process.env.COMMANDER_URL;
  if (!url) {
    return NextResponse.json({ error: "COMMANDER_URL not set" }, { status: 500 });
  }
  const body = await req.json();

  const r = await fetch(`${url.replace(/\/$/, "")}/invoke`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180_000),
  });

  const data = await r.json().catch(() => ({ status: r.status }));
  return NextResponse.json(data, { status: r.status });
}
