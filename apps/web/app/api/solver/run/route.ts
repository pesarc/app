import { NextResponse } from "next/server";
import { requireOperator, rateLimit } from "@stablearc/sdk/api/guard";
import { previewSolver, runSolver, solverConfigured } from "@stablearc/sdk/solver/execute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * The solver, on demand (docs/LOCAL_CURRENCY_SETTLEMENT.md §2.1). Scans open
 * intents, finds settlements that clear local-to-local with no outside
 * liquidity — direct pairs first, then rings — and executes them.
 *
 * GET  = dry run: what would clear right now.
 * POST = execute (operator-guarded; spends the solver's gas).
 *
 * The scheduled counterpart is /api/cron/solve.
 */
export async function GET() {
  if (!solverConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Intent matcher is not configured." },
      { status: 501 },
    );
  }
  try {
    return NextResponse.json({ ok: true, ...(await previewSolver()) });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message.slice(0, 160) : "scan failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const denied =
    requireOperator(request) ?? rateLimit(request, "solver", 10, 60_000);
  if (denied) return denied;

  if (!solverConfigured() || !process.env.SETTLE_OPERATOR_PK) {
    return NextResponse.json(
      { ok: false, error: "Solver is not enabled on this deployment." },
      { status: 501 },
    );
  }
  try {
    return NextResponse.json({ ok: true, ...(await runSolver()) });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message.slice(0, 160) : "solver failed" },
      { status: 500 },
    );
  }
}
