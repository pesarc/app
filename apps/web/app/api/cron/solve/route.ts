import { NextResponse } from "next/server";
import { runSolver, solverConfigured } from "@stablearc/sdk/solver/execute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Scheduled solver run (see vercel.json). Keeps intents clearing continuously
 * so a local-currency send settles without anyone pressing a button — the
 * standing counterpart to /api/solver/run.
 *
 * Vercel Cron calls this with `Authorization: Bearer $CRON_SECRET`. In
 * production CRON_SECRET must be set: without it we refuse rather than expose
 * an unauthenticated endpoint that spends the operator's gas.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET is not configured." },
      { status: 503 },
    );
  }
  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  if (!solverConfigured() || !process.env.SETTLE_OPERATOR_PK) {
    return NextResponse.json(
      { ok: false, error: "Solver is not enabled on this deployment." },
      { status: 501 },
    );
  }

  try {
    const result = await runSolver();
    // Cron output lands in Vercel logs — keep it terse and useful.
    console.log(
      `[cron/solve] open=${result.openIntents} settled=${result.settled.length} skipped=${result.skipped.length}`,
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[cron/solve] failed", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message.slice(0, 160) : "solver failed" },
      { status: 500 },
    );
  }
}
