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
import type { Bank } from "./banks";

const SANDBOX_BASE = "https://sandbox-api.bachs.io";
const LIVE_BASE = "https://api.bachs.io";

/** Configured when a secret key is present. */
export function bachsConfigured(): boolean {
  return Boolean(process.env.BACHS_SECRET_KEY);
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
    supports: (i) => i.method === "bank" && currencies.includes(cur(i)),

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
      // Bank payouts need a NUBAN + bank code; without them we can't reach the
      // partner, so record it as initiated and let a webhook/poll correct it.
      if (input.method !== "bank" || !input.accountNumber || !input.bankCode) {
        return { partnerRef: localRef(), status: "initiated" };
      }
      try {
        // 1) Register (and resolve) the payout destination.
        const destRes = await fetch(`${base}/v1/payouts/destinations`, {
          method: "POST",
          headers,
          cache: "no-store",
          body: JSON.stringify({
            currency: cur(input),
            account_number: input.accountNumber,
            bank_code: input.bankCode,
          }),
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
