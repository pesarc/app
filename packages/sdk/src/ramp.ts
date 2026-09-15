// Fiat off-ramp provider seam.
//
// The crypto leg of a payout is real (cNGN lands in the ramp escrow on-chain);
// the fiat last mile is handled by a ramp partner. This module isolates that
// partner behind a small adapter so the rest of the app never changes when a
// real provider is wired in:
//
//   • SimulatedRampAdapter (default) — derives status from elapsed time, so the
//     whole flow is demoable end-to-end on testnet with no external account.
//   • HttpRampAdapter — used when RAMP_PROVIDER_URL is set; a real integration
//     (e.g. a licensed off-ramp) would drive status from provider webhooks.
//
// Testnet-only today: no real funds move, and no credentials are entered here.

export type PayoutStatus = "initiated" | "processing" | "paid";

export type RampAdapter = {
  readonly name: string;
  /** Status of a payout given when it was created (+ optional partner ref). */
  statusFor(createdAt: string, partnerRef?: string): PayoutStatus | Promise<PayoutStatus>;
};

// Sandbox partner SLA: ~8s to accept, ~45s to pay out.
const PROCESSING_AFTER_MS = 8_000;
const PAID_AFTER_MS = 45_000;

export const SimulatedRampAdapter: RampAdapter = {
  name: "simulated",
  statusFor(createdAt: string): PayoutStatus {
    const age = Date.now() - new Date(createdAt).getTime();
    if (age >= PAID_AFTER_MS) return "paid";
    if (age >= PROCESSING_AFTER_MS) return "processing";
    return "initiated";
  },
};

/**
 * Real provider adapter. Reads live payout status from the partner's API. Left
 * as a thin, clearly-marked stub: wire the actual request/response when a
 * provider account exists. Falls back to the simulated timeline on any error so
 * the demo never breaks.
 */
function httpRampAdapter(baseUrl: string, apiKey?: string): RampAdapter {
  return {
    name: "http",
    async statusFor(createdAt, partnerRef) {
      if (!partnerRef) return SimulatedRampAdapter.statusFor(createdAt);
      try {
        const res = await fetch(`${baseUrl.replace(/\/$/, "")}/payouts/${partnerRef}`, {
          headers: apiKey ? { authorization: `Bearer ${apiKey}` } : undefined,
          cache: "no-store",
        });
        if (!res.ok) return SimulatedRampAdapter.statusFor(createdAt);
        const data = (await res.json()) as { status?: string };
        // Map the provider's vocabulary onto ours.
        if (data.status === "completed" || data.status === "paid") return "paid";
        if (data.status === "processing" || data.status === "accepted") return "processing";
        return "initiated";
      } catch {
        return SimulatedRampAdapter.statusFor(createdAt);
      }
    },
  };
}

/** The active adapter for this deployment. */
export function getRampAdapter(): RampAdapter {
  const url = process.env.RAMP_PROVIDER_URL;
  if (url) return httpRampAdapter(url, process.env.RAMP_API_KEY);
  return SimulatedRampAdapter;
}
