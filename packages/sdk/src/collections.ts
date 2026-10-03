// Fiat collection (pay-in / add-money) provider seam — the deposit-side mirror
// of ramp.ts. Where ramp.ts moves money OUT (payouts), this picks how money
// comes IN. There are two kinds of collection method, and the seam hides which
// one a market uses behind one async selector:
//
//   • "dva"      — a dedicated account number (NUBAN) the payer transfers to.
//                  This is the existing BVN/DVA flow (see bank.ts): no amount
//                  up front, no redirect, the account is shown statically.
//   • "checkout" — a hosted checkout SESSION the payer is sent to (a URL).
//                  createCheckout() returns { sessionId, url }; the wallet is
//                  credited when the success webhook lands (collections/webhook).
//
// Each market (country) has an ordered list of methods, primary first
// (COLLECTION_COUNTRY_PROVIDERS, same pattern as RAMP_COUNTRY_PROVIDERS).
// selectCollectionAdapter() walks it and returns the first method that is
// configured, supports the deposit, serves the country AND answers its health
// probe. The DVA flow is the universal last resort so the Add-money screen
// always works (a static NUBAN) even with nothing configured — exactly how it
// behaves today. To make any method the primary for a country, put its name
// first in that country's list; nothing at the call sites changes.
//
// WHY checkout is the Nigeria primary by default: a dedicated NUBAN (DVA)
// requires an APPROVED business profile, which the live entity does not yet
// have ("Dedicated NUBAN is not available for your business"), so DVA issuance
// is gated OFF (COLLECTION_DVA_ENABLED) and hosted checkout carries pay-in until
// that approval lands — at which point reordering the list flips it back, with
// no code change.

import { bachsCheckoutAdapter, bachsCheckoutConfigured, bachsCheckoutKey } from "./bachs";

export type CollectionKind = "dva" | "checkout";

/** A collection's lifecycle, normalised across providers. */
export type CollectionStatus = "pending" | "paid" | "expired" | "failed";

/** What the app hands a provider to start (or describe) a collection. */
export type CollectionInput = {
  /** Our reference for this top-up (ADD-…). Doubles as the idempotency key. */
  reference: string;
  /** Amount to collect, in MAJOR units of `currency` (e.g. 5000 = ₦5,000). */
  amount: number;
  /** Collection currency (ISO). Defaults to NGN. */
  currency?: string;
  /** Payer country (ISO-3166 alpha-2). Defaults from the currency. */
  country?: string;
  /** Payer email (hosted checkout receipts). */
  email?: string;
  /** Where the hosted checkout returns on success / cancel. */
  successUrl?: string;
  cancelUrl?: string;
  /** Opaque key/values echoed back on the webhook (never PII). */
  metadata?: Record<string, string>;
};

/** A started hosted-checkout session. */
export type CheckoutSession = { sessionId: string; url: string; status: CollectionStatus };

/** Minimal shape for the DVA (dedicated account) creation path. */
export type DvaInput = { bvn: string; accountName?: string; email?: string; phone?: string };
export type DvaResult = { ok: boolean; error?: string; account?: unknown };

export type CollectionAdapter = {
  readonly name: string;
  /** How the payer pays: a static account number, or a hosted checkout URL. */
  readonly kind: CollectionKind;
  /** Markets this method serves (ISO-3166 alpha-2). Undefined = universal. */
  readonly countries?: string[];
  /** Whether this method can collect the deposit (currency / corridor). */
  supports(input: CollectionInput): boolean;
  /** Liveness/eligibility probe for online-based selection. Undefined = always
   *  online. false means skip this method and try the next in the order. */
  health?(): Promise<boolean>;
  /** Create/link a dedicated account number (DVA). Only on kind:"dva". */
  createDva?(account: string, input: DvaInput): Promise<DvaResult>;
  /** Start a hosted checkout session. Only on kind:"checkout". null = failed,
   *  so the route can surface a clean error (never a dead URL). */
  createCheckout?(input: CollectionInput): Promise<CheckoutSession | null>;
  /** Status of a session given its id (webhook is the source of truth; this is
   *  the poll fallback). DVA has no session, so it reports "pending". */
  statusFor(sessionId: string): CollectionStatus | Promise<CollectionStatus>;
};

const cur = (i: CollectionInput) => (i.currency ?? "NGN").toUpperCase();

/** Map a provider's collection status vocabulary onto ours. */
export function mapCollectionStatus(s: string | undefined): CollectionStatus {
  const v = (s ?? "").toLowerCase();
  if (["succeeded", "success", "successful", "paid", "complete", "completed"].includes(v)) {
    return "paid";
  }
  if (v === "expired") return "expired";
  if (["failed", "cancelled", "canceled", "declined", "underpaid"].includes(v)) return "failed";
  return "pending";
}

/* ------------------------------ DVA method ------------------------------ */

/**
 * Dedicated account number (NUBAN) collection — the existing BVN/DVA flow in
 * bank.ts. It is the UNIVERSAL FALLBACK: it needs no external key (bank.ts
 * returns a deterministic test NUBAN when unconfigured), so the Add-money
 * screen always has something to show. It is "online" only when DVA issuance is
 * actually enabled (COLLECTION_DVA_ENABLED) — off by default because the live
 * entity can't issue a DVA yet — so a configured checkout method wins over it
 * until that approval lands.
 */
export const dvaCollectionAdapter: CollectionAdapter = {
  name: "dva",
  kind: "dva",
  // A NUBAN settles NGN; scope the method to the NGN corridor.
  supports: (i) => cur(i) === "NGN",
  async health() {
    const v = (process.env.COLLECTION_DVA_ENABLED ?? "").toLowerCase();
    return v === "1" || v === "true" || v === "yes";
  },
  async createDva(account, input) {
    // Lazy import keeps the collections <-> bank module edge at call time only
    // (bank.ts pulls in the web2 account store / provider client).
    const { linkBankAccount } = await import("./bank");
    return linkBankAccount(account, input);
  },
  statusFor: () => "pending",
};

/* --------------------------- method registry ---------------------------- */

function makeAdapter(name: string): CollectionAdapter | null {
  switch (name) {
    case "bachs-checkout":
      // Hosted-checkout pay-in via the bank partner. Its own key resolver so it
      // works with the keys actually set, without touching the off-ramp path.
      return bachsCheckoutConfigured() ? bachsCheckoutAdapter(bachsCheckoutKey()) : null;
    case "dva":
      return dvaCollectionAdapter;
    default:
      return null;
  }
}

// Default per-country method order (primary first). Checkout leads in Nigeria
// because DVA issuance is gated off; override/extend with
// COLLECTION_COUNTRY_PROVIDERS, e.g. "NG:dva,bachs-checkout;GH:bachs-checkout".
const COUNTRY_PROVIDERS: Record<string, string[]> = {
  NG: ["bachs-checkout", "dva"],
};

// Currency -> default country, so callers that only know the currency still get
// the right market's method order.
const CURRENCY_COUNTRY: Record<string, string> = {
  NGN: "NG", GHS: "GH", KES: "KE", UGX: "UG", TZS: "TZ", ZAR: "ZA", XOF: "SN", XAF: "CM",
};

function countryOf(input: CollectionInput): string {
  return (input.country ?? CURRENCY_COUNTRY[cur(input)] ?? "NG").toUpperCase();
}

/** Parse COLLECTION_COUNTRY_PROVIDERS ("NG:dva,bachs-checkout;GH:…") into a map. */
function countryProviderEnv(): Record<string, string[]> {
  const raw = process.env.COLLECTION_COUNTRY_PROVIDERS;
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

function globalOrder(): string[] {
  return (process.env.COLLECTION_PROVIDER_ORDER || "bachs-checkout,dva")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** The method order for a market: env override, else the per-country default,
 *  else the global order. The DVA fallback is always appended as last resort. */
function providerOrderFor(country: string): string[] {
  const perCountry = countryProviderEnv()[country] ?? COUNTRY_PROVIDERS[country];
  const base = perCountry?.length ? perCountry : globalOrder();
  return [...base, "dva"];
}

function servesCountry(a: CollectionAdapter, country: string): boolean {
  return !a.countries || a.countries.includes(country);
}

// Short-TTL health cache so one selection doesn't hammer a partner's probe.
const HEALTH_TTL_MS = 30_000;
const healthCache = new Map<string, { ok: boolean; at: number }>();

async function isOnline(a: CollectionAdapter): Promise<boolean> {
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

/** Candidate methods for a deposit: this market's order, de-duped, kept only if
 *  configured, supporting the deposit, and serving the country. */
function candidatesFor(input: CollectionInput): CollectionAdapter[] {
  const country = countryOf(input);
  const seen = new Set<string>();
  const list: CollectionAdapter[] = [];
  for (const name of providerOrderFor(country)) {
    if (seen.has(name)) continue;
    seen.add(name);
    const a = makeAdapter(name);
    if (a && a.supports(input) && servesCountry(a, country)) list.push(a);
  }
  return list;
}

/**
 * Pick the collection method for a deposit: the first candidate in the market's
 * order that is online. If none verifies online, fall back to the first
 * supporting candidate anyway, and to the DVA fallback if there are none — so
 * the Add-money screen always has a method to render.
 */
export async function selectCollectionAdapter(input: CollectionInput): Promise<CollectionAdapter> {
  const candidates = candidatesFor(input);
  for (const a of candidates) {
    if (await isOnline(a)) return a;
  }
  return candidates[0] ?? dvaCollectionAdapter;
}

/** The collection method a market would use right now (for the UI to branch on
 *  without starting a session). */
export function collectionMethodFor(currency = "NGN", country?: string): Promise<CollectionAdapter> {
  return selectCollectionAdapter({ reference: "", amount: 0, currency, country });
}

/** Rebuild a method by stored name (webhook/status routing). */
export function collectionAdapterByName(name: string): CollectionAdapter {
  return makeAdapter(name) ?? dvaCollectionAdapter;
}

/** True when a real (non-DVA-fallback) collection method is configured. */
export function collectionsLive(): boolean {
  return bachsCheckoutConfigured();
}
