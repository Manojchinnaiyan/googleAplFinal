import { NextResponse } from "next/server";
import { bearerHeader } from "@/lib/auth";
import { rateLimited } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  const cooldown = rateLimited("inject", 5000);
  if (cooldown !== null) {
    return NextResponse.json(
      { error: "rate_limited", retry_in_seconds: cooldown },
      { status: 429 },
    );
  }

  const url = process.env.COMMANDER_URL;
  if (!url) {
    return NextResponse.json({ error: "COMMANDER_URL not set" }, { status: 500 });
  }
  const body = await req.json();

  const r = await fetch(`${url.replace(/\/$/, "")}/invoke`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...bearerHeader() },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180_000),
  });

  const data = await r.json().catch(() => ({ status: r.status }));
  return NextResponse.json(data, { status: r.status });
}
