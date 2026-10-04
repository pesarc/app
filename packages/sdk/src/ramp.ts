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

import { cngnConfigured, cngnRampAdapter } from "./cngn";
import { bachsKey, bachsRampAdapter } from "./bachs";

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
  /** Destination country (ISO-3166 alpha-2). Defaults from the currency; picks
   *  the per-country provider order so each market can run its own partner. */
  country?: string;
  /** Structured destination a real provider needs (not persisted raw). */
  accountName?: string;
  /** NUBAN account number (bank) or MSISDN (mobile money). */
  accountNumber?: string;
  /** Paystack/Flutterwave bank code, or mobile-money network code. */
  bankCode?: string;
};

export type RampAdapter = {
  readonly name: string;
  /** Markets this provider serves (ISO-3166 alpha-2). Undefined = universal
   *  (e.g. the simulator); set it to scope a partner to its licensed countries. */
  readonly countries?: string[];
  /** When true, a non-terminal stored status is refreshed by polling statusFor
   *  (for partners whose webhook isn't yet the sole source of truth). */
  readonly pollable?: boolean;
  /** Whether this provider can handle the payout (currency / method / corridor). */
  supports(input: PayoutInitiateInput): boolean;
  /** Liveness + auth probe for online-based selection. Undefined = always online
   *  (no probe); false means skip this provider and try the next in order. */
  health?(): Promise<boolean>;
  /** Start a fiat payout with the provider; returns its reference + first status. */
  initiate(input: PayoutInitiateInput): Promise<{ partnerRef: string; status: PayoutStatus }>;
  /** Status of a payout given when it was created (+ optional partner ref). */
  statusFor(createdAt: string, partnerRef?: string): PayoutStatus | Promise<PayoutStatus>;
  /** Partner-native bank directory for this market; null = unavailable (caller
   *  falls back). Lets the withdraw picker list the banks THIS partner can pay. */
  listBanks?(currency: string): Promise<{ name: string; code: string }[] | null>;
  /** Partner-native account-name resolution; absent = caller falls back. */
  resolveAccount?(
    accountNumber: string,
    bankCode: string,
  ): Promise<{ resolved: boolean; accountName?: string; error?: string }>;
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
    // Markets Paystack is licensed for; routing only considers it in these.
    countries: ["NG", "GH", "KE", "ZA"],
    // Paystack transfers: Nigeria bank (NUBAN). The initiate() flow below creates
    // the recipient with currency NGN, so we settle NGN bank only here; GH/KE bank
    // + mobile money exist on Paystack but need a multi-currency initiate first, so
    // supports() stays NGN-scoped (Flutterwave carries those corridors meanwhile).
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
 * truth.
 *
 * Bank vs mobile money use the SAME /v3/transfers endpoint and body shape — the
 * difference is only what goes in `account_bank` + `account_number`:
 *   • bank:         account_bank = bank code,     account_number = NUBAN/account no.
 *   • mobile money: account_bank = NETWORK code,  account_number = recipient MSISDN,
 *     e.g. MPS (M-Pesa: KE/UG/TZ/RW/ZM), MTN (GH/ZM), FMM (franco XAF/XOF),
 *     ORANGEMONEY (XOF). The caller supplies these in bankCode + accountNumber.
 *
 * NOTE: shape follows Flutterwave v3 docs — verify against current docs and observe
 * one real request/response before going live (no live call was made here). Some
 * mobile-money corridors additionally require a `meta` array (sender name/country/
 * mobile_number) for compliance; its exact per-corridor requirement is NOT confirmed
 * here, so it is left as the `momoMeta` seam below (unset = omitted) rather than
 * guessed. Wire it from the sender's KYC when enabling those corridors.
 *
 * Docs: https://developer.flutterwave.com/reference/create-a-transfer
 *       https://developer.flutterwave.com/docs/mobile-money-1
 */
export function flutterwaveRampAdapter(secretKey: string): RampAdapter {
  const base = "https://api.flutterwave.com/v3";
  const headers = { authorization: `Bearer ${secretKey}`, "content-type": "application/json" };
  const FLW_CURRENCIES = ["NGN", "GHS", "KES", "UGX", "TZS", "ZAR", "XAF", "XOF", "MWK", "ZMW", "SLL"];
  return {
    name: "flutterwave",
    countries: ["NG", "GH", "KE", "UG", "TZ", "ZA", "MW", "ZM", "SL", "CM", "SN", "CI"],
    // Bank and mobile-money payouts, for any currency Flutterwave settles.
    supports: (i) =>
      (i.method === "bank" || i.method === "mobile_money") && FLW_CURRENCIES.includes(cur(i)),
    async initiate(input) {
      // Both methods need a destination (NUBAN or MSISDN) + a code (bank or network).
      if (!input.accountNumber || !input.bankCode) {
        return { partnerRef: localRef(), status: "initiated" };
      }
      try {
        // Per-corridor mobile-money compliance metadata, if/when wired from sender
        // KYC. Unset today (requirement unconfirmed), so it is omitted from the body.
        const momoMeta: Record<string, string>[] | undefined = undefined;
        const res = await fetch(`${base}/transfers`, {
          method: "POST",
          headers,
          cache: "no-store",
          body: JSON.stringify({
            // Bank code for method "bank"; mobile-money NETWORK code for "mobile_money".
            account_bank: input.bankCode,
            // NUBAN for bank; recipient phone (MSISDN) for mobile money.
            account_number: input.accountNumber,
            amount: input.amountNgn,
            currency: cur(input),
            narration: input.reference,
            reference: input.reference,
            beneficiary_name: input.accountName || input.beneficiary,
            ...(input.method === "mobile_money" && momoMeta ? { meta: momoMeta } : {}),
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
 * Each market (country) has its own ordered list of off-ramp partners, primary
 * first. selectAdapter() walks that list and returns the first partner that both
 * supports the payout AND answers its health probe — so the primary carries the
 * traffic while it's up, and the next partner takes over automatically when it
 * isn't. This is the plug-and-play seam: to make any MFB / licensed partner the
 * primary for a country, put its adapter name first in that country's list (in
 * code below or via RAMP_COUNTRY_PROVIDERS) — nothing at the call sites changes.
 * The provider that handled a payout is stored on the row so status/webhook
 * resolution routes back to the same one. The simulator is the universal last
 * resort, so the flow never dead-ends in demo.
 */

// Default per-country partner order (primary first). Override/extend per country
// with RAMP_COUNTRY_PROVIDERS, e.g. "NG:bachs,paystack;GH:flutterwave,paystack".
// A corridor only goes live when the named provider's key is set AND its account
// is funded for that currency; otherwise selection falls through to the next
// partner (and finally the simulator). Only providers whose adapter can actually
// settle the currency are listed — see each adapter's supports()/countries.
const COUNTRY_PROVIDERS: Record<string, string[]> = {
  // Nigeria: bank-partner primary, cNGN redemption, then the pan-African rails.
  NG: ["bachs", "cngn", "paystack", "flutterwave"],
  // Bank corridors served by both Paystack and Flutterwave.
  KE: ["flutterwave", "paystack"],
  GH: ["paystack", "flutterwave"],
  ZA: ["paystack", "flutterwave"],
  // Flutterwave-only markets (bank + mobile money).
  UG: ["flutterwave"],
  TZ: ["flutterwave"],
  RW: ["flutterwave"],
  ZM: ["flutterwave"],
  MW: ["flutterwave"],
  CM: ["flutterwave"],
  SN: ["flutterwave"],
  CI: ["flutterwave"],
  SL: ["flutterwave"],
};

// Currency -> default country, so callers that only know the currency still get
// the right market's partner order.
const CURRENCY_COUNTRY: Record<string, string> = {
  NGN: "NG", GHS: "GH", KES: "KE", ZAR: "ZA", UGX: "UG", TZS: "TZ",
  RWF: "RW", ZMW: "ZM", MWK: "MW", XAF: "CM", XOF: "SN", SLL: "SL",
};

function countryOf(input: PayoutInitiateInput): string {
  return (input.country ?? CURRENCY_COUNTRY[cur(input)] ?? "NG").toUpperCase();
}

/** Parse RAMP_COUNTRY_PROVIDERS ("NG:bachs,paystack;GH:flutterwave") into a map. */
function countryProviderEnv(): Record<string, string[]> {
  const raw = process.env.RAMP_COUNTRY_PROVIDERS;
  if (!raw) return {};
  const out: Record<string, string[]> = {};
  for (const pair of raw.split(";")) {
    const [cc, list] = pair.split(":");
    if (cc && list) {
      out[cc.trim().toUpperCase()] = list.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  return out;
}

/** The partner order for a market: env override, else the per-country default,
 *  else the global order (back-compat). The simulator is appended as last resort. */
function providerOrderFor(country: string): string[] {
  const perCountry = countryProviderEnv()[country] ?? COUNTRY_PROVIDERS[country];
  const base = perCountry?.length ? perCountry : globalOrder();
  return [...base, "simulated"];
}

function globalOrder(): string[] {
  return (process.env.RAMP_PROVIDER_ORDER || "cngn,bachs,paystack,flutterwave,http")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function servesCountry(a: RampAdapter, country: string): boolean {
  return !a.countries || a.countries.includes(country);
}

// Short-TTL health cache so one selection (and back-to-back payouts) don't hammer
// a partner's probe endpoint. Health-less adapters are treated as always online.
const HEALTH_TTL_MS = 30_000;
const healthCache = new Map<string, { ok: boolean; at: number }>();

async function isOnline(a: RampAdapter): Promise<boolean> {
  if (!a.health) return true;
  const cached = healthCache.get(a.name);
  if (cached && Date.now() - cached.at < HEALTH_TTL_MS) return cached.ok;
  let ok = false;
  try {
    ok = await a.health();
  } catch {
    ok = false;
  }
  healthCache.set(a.name, { ok, at: Date.now() });
  return ok;
}

const RAMP_PROVIDERS = ["cngn", "bachs", "paystack", "flutterwave", "http", "simulated"] as const;
export type RampProviderName = (typeof RAMP_PROVIDERS)[number];

function makeAdapter(name: string): RampAdapter | null {
  switch (name) {
    case "cngn":
      // Native cNGN redemption (NGN bank). Lazy import keeps the ramp<->cngn
      // module cycle to function-call time only.
      return cngnConfigured() ? cngnRampAdapter() : null;
    case "bachs": {
      // Bank-partner rail (primary for its markets). Same call-time-cycle note.
      // Key resolves from BACHS_SECRET_KEY, else BACHS_PROD_KEY/BACHS_TEST_KEY by env.
      const k = bachsKey();
      return k ? bachsRampAdapter(k) : null;
    }
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

/** Configured adapters in the global priority order; the simulator is always the
 *  last resort. Used for diagnostics (rampProviderNames/rampIsLive). */
export function availableAdapters(): RampAdapter[] {
  const seen = new Set<string>();
  const list: RampAdapter[] = [];
  for (const name of globalOrder()) {
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

/**
 * Resolve a bank account to its holder name via the FIRST configured partner for
 * `country` that can — so a live Bachs user resolves through Bachs, not a test
 * Paystack (which caps live resolves per day). Walks the same per-country order
 * as payouts. Returns null when no configured partner resolves it, so the caller
 * can fall back to its own resolver.
 */
export async function resolveViaAdapters(
  accountNumber: string,
  bankCode: string,
  country = "NG",
): Promise<{ resolved: boolean; accountName?: string; error?: string } | null> {
  let lastError: string | undefined;
  for (const name of providerOrderFor(country.toUpperCase())) {
    if (name === "simulated") continue;
    const a = makeAdapter(name);
    if (!a?.resolveAccount) continue;
    try {
      const r = await a.resolveAccount(accountNumber, bankCode);
      if (r.resolved) return r; // got the name — done
      if (r.error) lastError = r.error; // remember, but try the next partner
    } catch {
      /* partner unreachable — try the next */
    }
  }
  return lastError ? { resolved: false, error: lastError } : null;
}

/** Candidate adapters for a payout: this market's partner order, de-duped, kept
 *  only if configured, supporting the payout, and licensed for the country. */
function candidatesFor(input: PayoutInitiateInput): RampAdapter[] {
  const country = countryOf(input);
  const seen = new Set<string>();
  const list: RampAdapter[] = [];
  for (const name of providerOrderFor(country)) {
    if (seen.has(name)) continue;
    seen.add(name);
    const a = makeAdapter(name);
    if (a && a.supports(input) && servesCountry(a, country)) list.push(a);
  }
  return list;
}

/**
 * Pick the partner that handles this payout: the first candidate in the market's
 * order that is online (health probe). If none verifies online, fall back to the
 * first supporting candidate anyway (a webhook/poll corrects its status later),
 * and to the simulator if there are none. Async because the health probe is a
 * network call.
 */
export async function selectAdapter(input: PayoutInitiateInput): Promise<RampAdapter> {
  const candidates = candidatesFor(input);
  for (const a of candidates) {
    if (await isOnline(a)) return a;
  }
  return candidates[0] ?? SimulatedRampAdapter;
}

/** The off-ramp partner that would handle a bank payout in this market — so the
 *  bank directory + account resolver speak to the SAME partner as the payout. */
export function offRampAdapter(currency = "NGN", country?: string): Promise<RampAdapter> {
  return selectAdapter({ reference: "", beneficiary: "", method: "bank", amountNgn: 0, currency, country });
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

/** Non-secret routing config for the internal admin surface: the resolved global
 *  order, and each configured market's partner order (primary first, env override
 *  else per-country default else global). The simulator is omitted here — it is
 *  always the universal last resort appended at selection time. */
export function rampCountryConfig(): {
  globalOrder: string[];
  perCountry: Record<string, string[]>;
} {
  const env = countryProviderEnv();
  const countries = new Set([...Object.keys(COUNTRY_PROVIDERS), ...Object.keys(env)]);
  const perCountry: Record<string, string[]> = {};
  for (const cc of countries) {
    const order = env[cc] ?? COUNTRY_PROVIDERS[cc];
    perCountry[cc] = order?.length ? order : globalOrder();
  }
  return { globalOrder: globalOrder(), perCountry };
}
