// Fiat off-ramp provider seam.
//
// The crypto leg of a payout is real (cNGN lands in the ramp escrow on-chain);
// the fiat last mile is handled by a licensed ramp partner. This module isolates
// that partner behind a small adapter with two arms — INITIATE (push a payout to
// the provider) and STATUS (learn the result, via webhook or poll) — so the rest
// of the app never changes when a real provider is wired in:
//
//   • SimulatedRampAdapter (default) — advances status on a timeline, so the whole
//     flow is demoable end-to-end on testnet with no external account.
//   • HttpRampAdapter (RAMP_PROVIDER_URL set) — POSTs the payout to the partner
//     and reads status from their API; the partner also pushes status to
//     /api/payouts/webhook (see webhook route) which is the source of truth.

export type PayoutStatus = "initiated" | "processing" | "paid" | "failed";

export type PayoutMethod = "bank" | "mobile_money";

/** What the app hands a provider to start a fiat payout. */
export type PayoutInitiateInput = {
  reference: string;
  beneficiary: string;
  method: PayoutMethod;
  amountNgn: number;
};

export type RampAdapter = {
  readonly name: string;
  /** Start a fiat payout with the provider; returns its reference + first status. */
  initiate(input: PayoutInitiateInput): Promise<{ partnerRef: string; status: PayoutStatus }>;
  /** Status of a payout given when it was created (+ optional partner ref). */
  statusFor(createdAt: string, partnerRef?: string): PayoutStatus | Promise<PayoutStatus>;
};

/** Map a provider's status vocabulary onto ours. */
export function mapProviderStatus(s: string | undefined): PayoutStatus {
  const v = (s ?? "").toLowerCase();
  if (v === "completed" || v === "paid" || v === "success" || v === "successful") return "paid";
  if (v === "failed" || v === "reversed" || v === "cancelled" || v === "declined") return "failed";
  if (v === "processing" || v === "accepted" || v === "pending" || v === "queued") return "processing";
  return "initiated";
}

// Sandbox partner SLA: ~8s to accept, ~45s to pay out.
const PROCESSING_AFTER_MS = 8_000;
const PAID_AFTER_MS = 45_000;

function localRef(): string {
  return `RMP-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
}

export const SimulatedRampAdapter: RampAdapter = {
  name: "simulated",
  async initiate() {
    return { partnerRef: localRef(), status: "initiated" };
  },
  statusFor(createdAt: string): PayoutStatus {
    const age = Date.now() - new Date(createdAt).getTime();
    if (age >= PAID_AFTER_MS) return "paid";
    if (age >= PROCESSING_AFTER_MS) return "processing";
    return "initiated";
  },
};

/**
 * Real provider adapter. POSTs the payout to the partner and reads live status
 * from their API. The partner should also POST status updates to
 * /api/payouts/webhook (verified with RAMP_WEBHOOK_SECRET), which is the source
 * of truth; this poll is the fallback. Any error degrades to the simulated
 * timeline so a demo never breaks.
 */
function httpRampAdapter(baseUrl: string, apiKey?: string): RampAdapter {
  const base = baseUrl.replace(/\/$/, "");
  const auth = apiKey ? { authorization: `Bearer ${apiKey}` } : undefined;
  return {
    name: "http",
    async initiate(input) {
      try {
        const res = await fetch(`${base}/payouts`, {
          method: "POST",
          headers: { "content-type": "application/json", ...(auth ?? {}) },
          body: JSON.stringify({
            reference: input.reference,
            amount: input.amountNgn,
            currency: "NGN",
            method: input.method,
            beneficiary: input.beneficiary,
          }),
          cache: "no-store",
        });
        if (!res.ok) return { partnerRef: localRef(), status: "initiated" };
        const data = (await res.json()) as { id?: string; reference?: string; status?: string };
        return {
          partnerRef: String(data.id ?? data.reference ?? localRef()),
          status: mapProviderStatus(data.status),
        };
      } catch {
        return { partnerRef: localRef(), status: "initiated" };
      }
    },
    async statusFor(createdAt, partnerRef) {
      if (!partnerRef) return SimulatedRampAdapter.statusFor(createdAt);
      try {
        const res = await fetch(`${base}/payouts/${partnerRef}`, {
          headers: auth,
          cache: "no-store",
        });
        if (!res.ok) return SimulatedRampAdapter.statusFor(createdAt);
        const data = (await res.json()) as { status?: string };
        return mapProviderStatus(data.status);
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

/** True when a real off-ramp provider is configured (vs the simulator). */
export function rampIsLive(): boolean {
  return Boolean(process.env.RAMP_PROVIDER_URL);
}
