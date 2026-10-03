import { NextResponse } from "next/server";
import { rateLimit } from "@pesarc/sdk/api/guard";
import { availableAdapters, rampCountryConfig } from "@pesarc/sdk/ramp";
import { FEE_PCT } from "@pesarc/sdk/quote";
import { RAMP_ESCROW } from "@pesarc/sdk/wallet/config";
import { bachsCountries } from "@pesarc/sdk/bachs";

// Non-secret configuration facts for the Architecture reference tab. Everything
// returned here is public config (addresses, fee %, routing order, market
// lists) — NEVER secrets/keys. Gated by ADMIN_SECRET + rate-limited all the
// same, since it is an internal operator surface.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function forbidden(request: Request): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  return request.headers.get("x-admin-secret") !== secret;
}

function bachsCurrencies(): string[] {
  return (process.env.BACHS_CURRENCIES || "NGN")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

export async function GET(request: Request) {
  const limited = rateLimit(request, "admin-read", 60, 60_000);
  if (limited) return limited;
  if (forbidden(request)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const { globalOrder, perCountry } = rampCountryConfig();

  const adapters = availableAdapters().map((a) => ({
    name: a.name,
    countries: a.countries ?? null, // null = universal (e.g. the simulator)
    pollable: Boolean(a.pollable),
    // Bank + mobile-money capable providers are known from the adapter set; we
    // surface the simulator as the universal last resort.
    simulated: a.name === "simulated",
  }));

  return NextResponse.json({
    ok: true,
    escrow: RAMP_ESCROW,
    feePct: FEE_PCT,
    providerOrder: globalOrder,
    countryOrder: perCountry,
    adapters,
    bachs: {
      countries: bachsCountries(),
      currencies: bachsCurrencies(),
    },
  });
}
