// Bank-partner off-ramp adapter (MFB / licensed partner). The primary Nigeria
// rail, written to a plug-and-play shape so any partner bank can take its place
// per country — see ramp.ts's per-country provider config. A payout is two
// calls: register a payout DESTINATION (which also resolves + verifies the
// account name), then create the PAYOUT against it under an idempotency key.
//
// Two things set this partner apart from the others in ramp.ts:
//   • amounts are MAJOR-unit decimal strings in the payout currency ("9000.00"),
//     NOT minor units (kobo/cents);
//   • the partner exposes its own bank directory + account resolver, so the
//     withdraw picker speaks to the SAME partner that will move the money.
//
// NOTE: coded to the published API shape; no live call was made from here.
// Verify against the current docs and observe one real request/response before
// going live. Every network error degrades to a local "initiated" ref so the
// flow never dead-ends — a webhook or the status poll corrects it afterwards.

import { mapProviderStatus, type RampAdapter, type PayoutInitiateInput, type PayoutStatus } from "./ramp";
import {
  mapCollectionStatus,
  type CollectionAdapter,
  type CollectionInput,
  type CheckoutSession,
} from "./collections";
import type { Bank } from "./banks";

const SANDBOX_BASE = "https://sandbox-api.bachs.io";
const LIVE_BASE = "https://api.bachs.io";

/** Live (production) vs sandbox: BACHS_ENV wins ("live"|"sandbox"), else it
 *  follows NODE_ENV (production => live). Drives which key/webhook secret to use. */
export function bachsLive(): boolean {
  const env = process.env.BACHS_ENV?.toLowerCase();
  if (env === "live" || env === "production") return true;
  if (env === "sandbox" || env === "test") return false;
  return process.env.NODE_ENV === "production";
}

/** Resolve the Bachs secret key: an explicit BACHS_SECRET_KEY overrides, else the
 *  live or sandbox key by environment. (The base URL still follows the key's own
 *  sk_live_/sk_sandbox_ prefix, so a mismatched env can't hit the wrong host.) */
export function bachsKey(): string | undefined {
  return (
    process.env.BACHS_SECRET_KEY ||
    (bachsLive() ? process.env.BACHS_PROD_KEY : process.env.BACHS_TEST_KEY) ||
    undefined
  );
}

/** Configured when a secret key is resolvable for the current environment. */
export function bachsConfigured(): boolean {
  return Boolean(bachsKey());
}

/** Live vs sandbox follows the key prefix; BACHS_BASE_URL overrides. */
function bachsBase(key: string): string {
  if (process.env.BACHS_BASE_URL) return process.env.BACHS_BASE_URL.replace(/\/$/, "");
  return key.startsWith("sk_live_") ? LIVE_BASE : SANDBOX_BASE;
}

/** Markets this partner serves (ISO-3166 alpha-2). Override with BACHS_COUNTRIES. */
export function bachsCountries(): string[] {
  return (process.env.BACHS_COUNTRIES || "NG")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

/** Payout currencies this partner handles. Override with BACHS_CURRENCIES. */
function bachsCurrencies(): string[] {
  return (process.env.BACHS_CURRENCIES || "NGN")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

function localRef(): string {
  return `BCH-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
}

/** fetch with a hard timeout — a health probe must never hang the selector. */
async function timedFetch(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export type BachsBalance = { currency: string; available: number };

/** The partner float: available balances by currency (major units) from
 *  GET /v1/balances. Used by the admin treasury view. null = not configured or
 *  the call failed; shape is parsed defensively since the field names vary. */
export async function bachsBalances(): Promise<BachsBalance[] | null> {
  const key = bachsKey();
  if (!key) return null;
  const base = bachsBase(key);
  try {
    const res = await timedFetch(
      `${base}/v1/balances`,
      { headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, cache: "no-store" },
      3000,
    );
    if (!res.ok) return null;
    const json: unknown = await res.json().catch(() => null);
    const arr = Array.isArray(json)
      ? json
      : ((json as { balances?: unknown[]; data?: unknown[] })?.balances ??
         (json as { data?: unknown[] })?.data ??
         []);
    if (!Array.isArray(arr)) return null;
    return arr
      .map((b) => {
        const o = b as Record<string, unknown>;
        return {
          currency: String(o.currency ?? o.code ?? "").toUpperCase(),
          available: Number(o.available ?? o.available_balance ?? o.balance ?? o.amount ?? 0),
        };
      })
      .filter((b) => b.currency);
  } catch {
    return null;
  }
}

export function bachsRampAdapter(secretKey: string): RampAdapter {
  const base = bachsBase(secretKey);
  const headers = { authorization: `Bearer ${secretKey}`, "content-type": "application/json" };
  const currencies = bachsCurrencies();
  const cur = (i: PayoutInitiateInput) => (i.currency ?? "NGN").toUpperCase();

  return {
    name: "bachs",
    countries: bachsCountries(),
    // The partner's webhook isn't the sole source of truth yet, so a non-terminal
    // status is refreshed by polling GET /v1/payouts/{id} (see resolveStatus).
    pollable: true,
    supports: (i) =>
      (i.method === "bank" || i.method === "mobile_money") && currencies.includes(cur(i)),

    // Liveness + auth probe for online-based selection. A cheap authenticated
    // GET: if it answers 2xx the partner is up and the key is good.
    async health() {
      try {
        const res = await timedFetch(`${base}/v1/balances`, { headers, cache: "no-store" }, 2500);
        return res.ok;
      } catch {
        return false;
      }
    },

    async initiate(input) {
      // Bank payouts carry a NUBAN + bank code; mobile money carries a phone +
      // network code (both in accountNumber + bankCode). Without them we can't
      // reach the partner, so record it as initiated and let a webhook/poll fix it.
      if (
        (input.method !== "bank" && input.method !== "mobile_money") ||
        !input.accountNumber ||
        !input.bankCode
      ) {
        return { partnerRef: localRef(), status: "initiated" };
      }
      try {
        // 1) Register (and resolve) the payout destination. Bank destinations send
        // account_number + bank_code (no type field); mobile money sends
        // type:"mobile_money" + phone_number + mobile_provider.
        const destBody =
          input.method === "mobile_money"
            ? {
                currency: cur(input),
                type: "mobile_money",
                phone_number: input.accountNumber,
                mobile_provider: input.bankCode,
              }
            : {
                currency: cur(input),
                account_number: input.accountNumber,
                bank_code: input.bankCode,
              };
        const destRes = await fetch(`${base}/v1/payouts/destinations`, {
          method: "POST",
          headers,
          cache: "no-store",
          body: JSON.stringify(destBody),
        });
        const dest = (await destRes.json()) as {
          id?: string;
          account_name?: string;
          detail?: string;
          message?: string;
          error_code?: string;
        };
        if (!destRes.ok || !dest.id) {
          console.warn(
            `[ramp:bachs] destination failed for ${input.reference}: ${dest?.detail ?? dest?.message ?? dest?.error_code ?? destRes.status}`,
          );
          return { partnerRef: localRef(), status: "initiated" };
        }

        // 2) Create the payout against the destination. The idempotency key makes
        // a retried request return the same payout instead of paying twice.
        const payRes = await fetch(`${base}/v1/payouts`, {
          method: "POST",
          headers: { ...headers, "idempotency-key": input.reference },
          cache: "no-store",
          body: JSON.stringify({
            destination: dest.id,
            amount: input.amountNgn.toFixed(2), // MAJOR units, decimal string
            reference: input.reference,
          }),
        });
        const pay = (await payRes.json()) as {
          id?: string;
          status?: string;
          detail?: string;
          message?: string;
          error_code?: string;
        };
        const partnerRef = pay.id ?? input.reference;
        if (!payRes.ok || !pay.id) {
          console.warn(
            `[ramp:bachs] payout failed for ${input.reference}: ${pay?.detail ?? pay?.message ?? pay?.error_code ?? payRes.status}`,
          );
          return { partnerRef, status: "initiated" };
        }
        return { partnerRef, status: mapProviderStatus(pay.status) };
      } catch {
        return { partnerRef: localRef(), status: "initiated" };
      }
    },

    async statusFor(_createdAt, partnerRef): Promise<PayoutStatus> {
      // No real payout id yet (we degraded to a local ref) — still initiating.
      if (!partnerRef || partnerRef.startsWith("BCH-")) return "initiated";
      try {
        const res = await fetch(`${base}/v1/payouts/${encodeURIComponent(partnerRef)}`, {
          headers,
          cache: "no-store",
        });
        if (!res.ok) return "initiated";
        const data = (await res.json()) as { status?: string };
        return mapProviderStatus(data.status);
      } catch {
        return "initiated";
      }
    },

    // Partner-native bank directory — so the withdraw picker lists the banks THIS
    // partner can actually pay into. Returns null on any failure to let the
    // caller fall back to another source.
    async listBanks(): Promise<Bank[] | null> {
      try {
        const res = await fetch(`${base}/v1/reference/banks`, { headers, cache: "no-store" });
        if (!res.ok) return null;
        const data = (await res.json()) as {
          data?: { name?: string; code?: string }[];
          banks?: { name?: string; code?: string }[];
        };
        const rows = data.data ?? data.banks ?? [];
        const banks = rows
          .map((b) => ({ name: String(b.name ?? "").trim(), code: String(b.code ?? "") }))
          .filter((b) => b.name && b.code);
        return banks.length ? banks : null;
      } catch {
        return null;
      }
    },

    async resolveAccount(accountNumber, bankCode) {
      try {
        const res = await fetch(`${base}/v1/misc/bank-accounts/resolve`, {
          method: "POST",
          headers,
          cache: "no-store",
          body: JSON.stringify({ account_number: accountNumber, bank_code: bankCode }),
        });
        // Resolve returns HTTP 200 even when it can't verify, with resolved:false
        // and the reason under `message` (business errors use message; auth errors
        // use detail), so honour the flag and read both.
        const data = (await res.json()) as {
          resolved?: boolean;
          account_name?: string;
          message?: string;
          detail?: string;
        };
        if (!res.ok || data.resolved === false || !data.account_name) {
          return { resolved: false, error: data.message || data.detail || "Couldn't verify this account." };
        }
        return { resolved: true, accountName: data.account_name };
      } catch {
        return { resolved: false, error: "Couldn't reach the bank right now." };
      }
    },
  };
}

/* --------------------- collections (pay-in / add-money) ------------------ */
// The partner's collections are HOSTED CHECKOUT, not a dedicated account
// number: create a checkout session, then send the payer to its hosted URL.
// Confirmed against the published docs AND a live sandbox call:
//   POST /v1/checkout-sessions
//     req  { pricing: { currency, amount }, reference, success_url?, cancel_url?,
//            metadata?, customer? }
//     resp { checkout_id: "chk_…", checkout_url: "https://…/c/…",
//            status: "open", amount, currency, reference, expires_at, … }
//   GET  /v1/checkout-sessions/{id}
//     resp { status, payment_status, charge, completed_at, … }
// Amounts are MAJOR-unit decimal strings ("5000.00"), same as the payout side.
// The source of truth for fulfilment is the collection.succeeded webhook (see
// /api/collections/webhook); the GET poll below is the fallback.

/**
 * Secret key for the COLLECTIONS path. Deliberately separate from the off-ramp's
 * BACHS_SECRET_KEY lookup so pay-in works with the keys the founder actually
 * sets (BACHS_TEST_KEY for sandbox, BACHS_PROD_KEY for live) without changing
 * off-ramp selection. The key prefix still drives sandbox vs live (bachsBase),
 * so a sk_sandbox_ test key routes to the sandbox host — which is all Claude
 * ever uses; the founder sets a sk_live_ key for mainnet.
 */
export function bachsCheckoutKey(): string {
  return (
    process.env.BACHS_SECRET_KEY ||
    process.env.BACHS_TEST_KEY ||
    process.env.BACHS_PROD_KEY ||
    ""
  );
}

/** Configured when any collections key is present. */
export function bachsCheckoutConfigured(): boolean {
  return Boolean(bachsCheckoutKey());
}

/** Map the checkout session's own status vocabulary onto ours. "open" means the
 *  session is live but unpaid, so it is still "pending" for us. */
function mapCheckoutStatus(status?: string, paymentStatus?: string): CheckoutSession["status"] {
  const s = (status ?? "").toLowerCase();
  if (s === "open" || s === "created") {
    return mapCollectionStatus(paymentStatus) === "paid" ? "paid" : "pending";
  }
  return mapCollectionStatus(status);
}

export function bachsCheckoutAdapter(secretKey: string): CollectionAdapter {
  const base = bachsBase(secretKey);
  const headers = { authorization: `Bearer ${secretKey}`, "content-type": "application/json" };
  const currencies = bachsCurrencies();
  const cur = (i: CollectionInput) => (i.currency ?? "NGN").toUpperCase();

  return {
    name: "bachs-checkout",
    kind: "checkout",
    countries: bachsCountries(),
    supports: (i) => currencies.includes(cur(i)),

    // Same cheap authenticated GET the payout adapter uses: a 2xx means the
    // partner is up and the key is good.
    async health() {
      try {
        const res = await timedFetch(`${base}/v1/balances`, { headers, cache: "no-store" }, 2500);
        return res.ok;
      } catch {
        return false;
      }
    },

    async createCheckout(input): Promise<CheckoutSession | null> {
      try {
        const res = await fetch(`${base}/v1/checkout-sessions`, {
          method: "POST",
          // The idempotency key makes a retried create return the SAME session
          // instead of opening a second one.
          headers: { ...headers, "idempotency-key": input.reference },
          cache: "no-store",
          body: JSON.stringify({
            pricing: { currency: cur(input), amount: input.amount.toFixed(2) }, // MAJOR units
            reference: input.reference,
            ...(input.email ? { customer: { email: input.email } } : {}),
            ...(input.successUrl ? { success_url: input.successUrl } : {}),
            ...(input.cancelUrl ? { cancel_url: input.cancelUrl } : {}),
            ...(input.metadata ? { metadata: input.metadata } : {}),
          }),
        });
        const data = (await res.json()) as {
          checkout_id?: string;
          checkout_url?: string;
          status?: string;
          detail?: string;
          message?: string;
          error_code?: string;
        };
        if (!res.ok || !data.checkout_id || !data.checkout_url) {
          console.warn(
            `[collections:bachs] checkout failed for ${input.reference}: ${data?.detail ?? data?.message ?? data?.error_code ?? res.status}`,
          );
          return null;
        }
        return {
          sessionId: data.checkout_id,
          url: data.checkout_url,
          status: mapCheckoutStatus(data.status),
        };
      } catch (e) {
        console.warn(`[collections:bachs] checkout threw for ${input.reference}: ${(e as Error).message}`);
        return null;
      }
    },

    async statusFor(sessionId) {
      if (!sessionId) return "pending";
      try {
        const res = await fetch(`${base}/v1/checkout-sessions/${encodeURIComponent(sessionId)}`, {
          headers,
          cache: "no-store",
        });
        if (!res.ok) return "pending";
        const data = (await res.json()) as { status?: string; payment_status?: string; charge?: unknown };
        const mapped = mapCheckoutStatus(data.status, data.payment_status);
        // A settled charge is a definitive paid, even if `status` lags.
        if (mapped !== "paid" && data.charge) return "paid";
        return mapped;
      } catch {
        return "pending";
      }
    },
  };
}
