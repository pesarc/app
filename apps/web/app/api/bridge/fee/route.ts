import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@pesarc/sdk/api/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IRIS = "https://iris-api.circle.com";

const schema = z.object({
  src: z.number().int().nonnegative(),
  dst: z.number().int().nonnegative(),
});

// Circle's CCTP V2 fee for a domain pair. Returns the Fast-transfer fee in bps
// (minimumFee) so the client can compute maxFee; Standard is normally 0 bps.
// Server-side to dodge CORS and keep one source of truth.
export async function POST(request: Request) {
  const limited = rateLimit(request, "bridge-fee", 60, 60_000);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid input." }, { status: 400 });
  }
  const { src, dst } = parsed.data;

  try {
    const res = await fetch(`${IRIS}/v2/burn/USDC/fees/${src}/${dst}`, { cache: "no-store" });
    if (!res.ok) return NextResponse.json({ ok: false, error: "Fee unavailable." });
    const arr = (await res.json()) as { finalityThreshold: number; minimumFee: number }[];
    const fast = arr.find((f) => f.finalityThreshold <= 1000);
    const standard = arr.find((f) => f.finalityThreshold >= 2000);
    return NextResponse.json({
      ok: true,
      fastBps: fast ? fast.minimumFee : null,
      standardBps: standard ? standard.minimumFee : 0,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Fee fetch failed." });
  }
}
