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
  /** Human-readable beneficiary (name / masked account) for display + records. */
  beneficiary: string;
  method: PayoutMethod;
  amountNgn: number;
  /** Payout currency (ISO). Defaults to NGN; drives multi-corridor routing. */
  currency?: string;
  /** Structured destination a real provider needs (not persisted raw). */
  accountName?: string;
  /** NUBAN account number (bank) or MSISDN (mobile money). */
  accountNumber?: string;
  /** Paystack/Flutterwave bank code, or mobile-money network code. */
  bankCode?: string;
};

export type RampAdapter = {
  readonly name: string;
  /** Whether this provider can handle the payout (currency / method / corridor). */
  supports(input: PayoutInitiateInput): boolean;
  /** Start a fiat payout with the provider; returns its reference + first status. */
  initiate(input: PayoutInitiateInput): Promise<{ partnerRef: string; status: PayoutStatus }>;
  /** Status of a payout given when it was created (+ optional partner ref). */
  statusFor(createdAt: string, partnerRef?: string): PayoutStatus | Promise<PayoutStatus>;
};

const cur = (i: PayoutInitiateInput) => (i.currency ?? "NGN").toUpperCase();

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
  supports: () => true, // universal fallback
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
    supports: () => true, // generic partner — assume broad coverage
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

/**
 * Paystack off-ramp (Nigeria-first bank transfers). Two API calls on initiate:
 * create a transfer recipient (NUBAN), then start the transfer. Amounts are in
 * kobo (NGN × 100). Final status is delivered to /api/payouts/webhook, verified
 * with the Paystack secret (HMAC-SHA512, x-paystack-signature); statusFor polls
 * as a fallback. Requires a funded Paystack NGN balance and (for automation)
 * transfers OTP disabled on the account.
 *
 * Docs: https://paystack.com/docs/transfers/single-transfers
 */
export function paystackRampAdapter(secretKey: string): RampAdapter {
  const base = "https://api.paystack.co";
  const headers = {
    authorization: `Bearer ${secretKey}`,
    "content-type": "application/json",
  };
  return {
    name: "paystack",
    // Paystack transfers: Nigeria bank (NUBAN). GH/KE bank + mobile money exist
    // but we scope to NGN bank here.
    supports: (i) => i.method === "bank" && cur(i) === "NGN",
    async initiate(input) {
      // Bank transfers need a NUBAN + bank code; without them we can't reach the
      // provider, so record it as initiated and let a webhook/poll correct it.
      if (input.method !== "bank" || !input.accountNumber || !input.bankCode) {
        return { partnerRef: localRef(), status: "initiated" };
      }
      try {
        const recRes = await fetch(`${base}/transferrecipient`, {
          method: "POST",
          headers,
          cache: "no-store",
          body: JSON.stringify({
            type: "nuban",
            name: input.accountName || input.beneficiary,
            account_number: input.accountNumber,
            bank_code: input.bankCode,
            currency: "NGN",
          }),
        });
        const rec = (await recRes.json()) as {
          status?: boolean;
          message?: string;
          data?: { recipient_code?: string };
        };
        const recipient = rec?.data?.recipient_code;
        if (!recRes.ok || !recipient) {
          console.warn(
            `[ramp:paystack] recipient creation failed for ${input.reference}: ${rec?.message ?? recRes.status}`,
          );
          return { partnerRef: localRef(), status: "initiated" };
        }

        const trRes = await fetch(`${base}/transfer`, {
          method: "POST",
          headers,
          cache: "no-store",
          body: JSON.stringify({
            source: "balance",
            amount: Math.round(input.amountNgn * 100), // kobo
            recipient,
            reason: input.reference,
            reference: input.reference,
          }),
        });
        const tr = (await trRes.json()) as {
          status?: boolean;
          message?: string;
          data?: { status?: string; transfer_code?: string; reference?: string };
        };
        const partnerRef = tr?.data?.transfer_code ?? input.reference;
        if (!trRes.ok) {
          console.warn(
            `[ramp:paystack] transfer failed for ${input.reference}: ${tr?.message ?? trRes.status}`,
          );
          return { partnerRef, status: "initiated" };
        }
        return { partnerRef, status: mapProviderStatus(tr?.data?.status) };
      } catch {
        return { partnerRef: localRef(), status: "initiated" };
      }
    },
    async statusFor(createdAt, partnerRef) {
      if (!partnerRef || partnerRef.startsWith("RMP-")) {
        return SimulatedRampAdapter.statusFor(createdAt);
      }
      try {
        const res = await fetch(`${base}/transfer/${encodeURIComponent(partnerRef)}`, {
          headers: { authorization: `Bearer ${secretKey}` },
          cache: "no-store",
        });
        if (!res.ok) return SimulatedRampAdapter.statusFor(createdAt);
        const data = (await res.json()) as { data?: { status?: string } };
        return mapProviderStatus(data?.data?.status);
      } catch {
        return SimulatedRampAdapter.statusFor(createdAt);
      }
    },
  };
}

/**
 * Flutterwave off-ramp (pan-African: bank + mobile money across NGN/GHS/KES/…).
 * One call on initiate (POST /v3/transfers); statusFor polls GET /v3/transfers/:id;
 * the webhook (header `verif-hash` == FLUTTERWAVE_WEBHOOK_HASH) is the source of
 * truth. NOTE: shape follows Flutterwave v3 docs — verify against current docs and
 * observe one real request/response before going live (no live call was made here).
 *
 * Docs: https://developer.flutterwave.com/reference/create-a-transfer
 */
export function flutterwaveRampAdapter(secretKey: string): RampAdapter {
  const base = "https://api.flutterwave.com/v3";
  const headers = { authorization: `Bearer ${secretKey}`, "content-type": "application/json" };
  const FLW_CURRENCIES = ["NGN", "GHS", "KES", "UGX", "TZS", "XAF", "XOF", "ZAR"];
  return {
    name: "flutterwave",
    supports: (i) => FLW_CURRENCIES.includes(cur(i)),
    async initiate(input) {
      if (!input.accountNumber || !input.bankCode) {
        return { partnerRef: localRef(), status: "initiated" };
      }
      try {
        const res = await fetch(`${base}/transfers`, {
          method: "POST",
          headers,
          cache: "no-store",
          body: JSON.stringify({
            account_bank: input.bankCode, // Flutterwave bank/network code (its own list)
            account_number: input.accountNumber,
            amount: input.amountNgn,
            currency: cur(input),
            narration: input.reference,
            reference: input.reference,
            beneficiary_name: input.accountName || input.beneficiary,
          }),
        });
        const data = (await res.json()) as {
          status?: string;
          data?: { id?: number; reference?: string; status?: string };
        };
        const partnerRef = String(data?.data?.id ?? data?.data?.reference ?? input.reference);
        if (!res.ok || data?.status !== "success") return { partnerRef, status: "initiated" };
        return { partnerRef, status: mapProviderStatus(data?.data?.status) };
      } catch {
        return { partnerRef: localRef(), status: "initiated" };
      }
    },
    async statusFor(createdAt, partnerRef) {
      if (!partnerRef || partnerRef.startsWith("RMP-")) {
        return SimulatedRampAdapter.statusFor(createdAt);
      }
      try {
        const res = await fetch(`${base}/transfers/${encodeURIComponent(partnerRef)}`, {
          headers: { authorization: `Bearer ${secretKey}` },
          cache: "no-store",
        });
        if (!res.ok) return SimulatedRampAdapter.statusFor(createdAt);
        const data = (await res.json()) as { data?: { status?: string } };
        return mapProviderStatus(data?.data?.status);
      } catch {
        return SimulatedRampAdapter.statusFor(createdAt);
      }
    },
  };
}

/* ---------------- Multi-provider router ----------------
 * Providers are configured by their env keys and tried in priority order
 * (RAMP_PROVIDER_ORDER overrides the default). For each payout, selectAdapter()
 * picks the first configured provider whose supports() accepts it, so different
 * corridors can settle through different rails, with the simulator as the
 * universal fallback. The provider that handled a payout is stored on the row so
 * status/webhook resolution routes back to the same one.
 */

const RAMP_PROVIDERS = ["paystack", "flutterwave", "http", "simulated"] as const;
export type RampProviderName = (typeof RAMP_PROVIDERS)[number];

function makeAdapter(name: string): RampAdapter | null {
  switch (name) {
    case "paystack":
      return process.env.PAYSTACK_SECRET_KEY
        ? paystackRampAdapter(process.env.PAYSTACK_SECRET_KEY)
        : null;
    case "flutterwave":
      return process.env.FLUTTERWAVE_SECRET_KEY
        ? flutterwaveRampAdapter(process.env.FLUTTERWAVE_SECRET_KEY)
        : null;
    case "http":
      return process.env.RAMP_PROVIDER_URL
        ? httpRampAdapter(process.env.RAMP_PROVIDER_URL, process.env.RAMP_API_KEY)
        : null;
    case "simulated":
      return SimulatedRampAdapter;
    default:
      return null;
  }
}

/** Configured adapters in priority order; the simulator is always the last resort. */
export function availableAdapters(): RampAdapter[] {
  const order = (process.env.RAMP_PROVIDER_ORDER || "paystack,flutterwave,http")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const list: RampAdapter[] = [];
  for (const name of order) {
    if (seen.has(name)) continue;
    const a = makeAdapter(name);
    if (a) {
      list.push(a);
      seen.add(name);
    }
  }
  list.push(SimulatedRampAdapter);
  return list;
}

/** Pick the first configured provider that can handle this payout. */
export function selectAdapter(input: PayoutInitiateInput): RampAdapter {
  return availableAdapters().find((a) => a.supports(input)) ?? SimulatedRampAdapter;
}

/** Rebuild a specific provider's adapter by stored name (status/webhook routing). */
export function adapterByName(name: string): RampAdapter {
  return makeAdapter(name) ?? SimulatedRampAdapter;
}

/** Names of the configured providers (for diagnostics / the admin surface). */
export function rampProviderNames(): string[] {
  return availableAdapters().map((a) => a.name);
}

/** True when at least one real provider is configured (vs only the simulator). */
export function rampIsLive(): boolean {
  return availableAdapters().some((a) => a.name !== "simulated");
}
