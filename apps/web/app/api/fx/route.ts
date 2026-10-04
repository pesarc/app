// Live mid-market FX rates for the display/indicative quote. Pulls current
// USD-based rates from a free, keyless market source (open.er-api.com, which
// covers the African currencies we settle in — NGN/KES/GHS/ZAR/EGP), converts
// them to our `usdPer` convention (value of 1 unit in USD), and returns them for
// the currencies we support. Cached so we hit the upstream at most every 10 min.
//
// Fails SOFT: if the upstream is unreachable or malformed, we return the static
// illustrative rates with live:false, so the app always has a usable quote.

import { NextResponse } from "next/server";
import { ALL_CURRENCIES, CURRENCIES, type CurrencyCode } from "@pesarc/sdk/money";

export const revalidate = 600; // 10 minutes

const UPSTREAM = "https://open.er-api.com/v6/latest/USD";

/** The static fallback, in usdPer form, for every currency we know. */
function staticUsdPer(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of ALL_CURRENCIES) out[c] = CURRENCIES[c].usdPer;
  return out;
}

export async function GET() {
  try {
    const r = await fetch(UPSTREAM, { next: { revalidate } });
    if (!r.ok) throw new Error(`fx upstream ${r.status}`);
    const data = (await r.json()) as {
      result?: string;
      rates?: Record<string, number>;
      time_last_update_unix?: number;
    };
    if (data.result !== "success" || !data.rates) throw new Error("fx upstream shape");

    // rates[code] = units of `code` per 1 USD  ->  usdPer[code] = 1 / that.
    const usdPer: Record<string, number> = {};
    for (const code of ALL_CURRENCIES as CurrencyCode[]) {
      const perUsd = data.rates[code];
      usdPer[code] =
        code === "USD" ? 1 : perUsd && perUsd > 0 ? 1 / perUsd : CURRENCIES[code].usdPer;
    }

    return NextResponse.json({
      live: true,
      source: "open.er-api.com",
      asOf: data.time_last_update_unix ? data.time_last_update_unix * 1000 : Date.now(),
      usdPer,
    });
  } catch {
    // Soft fallback — the app keeps working on the illustrative rates.
    return NextResponse.json({
      live: false,
      source: "indicative",
      asOf: Date.now(),
      usdPer: staticUsdPer(),
    });
  }
}
