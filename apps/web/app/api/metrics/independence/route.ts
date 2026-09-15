import { NextResponse } from "next/server";
import { computeIndependence } from "@/lib/metrics/independence";

export const runtime = "nodejs";
// Public, read-only, and derived from chain events — cache it so the landing
// page and any pitch deck can hit it freely.
export const revalidate = 60;

/**
 * The independence metrics (docs/LOCAL_CURRENCY_SETTLEMENT.md §6). Public on
 * purpose: the claim "we don't depend on the dollar" is only worth anything if
 * anyone can check the number.
 */
export async function GET() {
  try {
    const m = await computeIndependence();
    return NextResponse.json({
      ok: true,
      ...m,
      // Percentages, for humans.
      dollarTouchedPct: Math.round(m.dollarTouched * 1000) / 10,
      dollarPricedPct: Math.round(m.dollarPriced * 1000) / 10,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message.slice(0, 160) : "metrics failed",
      },
      { status: 500 },
    );
  }
}
