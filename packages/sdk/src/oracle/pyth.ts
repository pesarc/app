// Pyth Network FX rates via the Hermes REST API (off-chain, no on-chain contract
// needed — right for the keeper and the /api/fx route). Pyth has the widest FX
// catalog, including many emerging-market pairs Chainlink doesn't cover. One
// adapter, same `usdPer` shape as chainlink.ts, so the aggregator can treat them
// uniformly.
//
// Fill a currency's Pyth price-feed id from https://pyth.network/price-feeds
// (FX section). Ids are 32-byte hex (with or without 0x). `invert` is true when
// the feed is quoted as USD-per-unit already (then usdPer = price); false when
// it's unit-per-USD (then usdPer = 1/price). Most Pyth FX majors are quoted as
// base/USD (e.g. EUR/USD = USD per 1 EUR), i.e. invert=true.

const HERMES = "https://hermes.pyth.network/v2/updates/price/latest";
const MAX_AGE_MS = 2 * 60 * 60_000; // 2h freshness

type FeedCfg = { id: string; invert: boolean };

/** currency -> Pyth price feed. TODO: fill ids from pyth.network/price-feeds.
 *  Entries with an empty id are skipped (adapter returns null → fallback). */
export const PYTH_FX: Record<string, FeedCfg> = {
  // --- majors (Pyth publishes these as <CUR>/USD = USD per unit) ---
  EUR: { id: "", invert: true }, // TODO: EUR/USD feed id
  GBP: { id: "", invert: true }, // TODO
  JPY: { id: "", invert: false }, // JPY/USD is usually USD/JPY = JPY per USD
  AUD: { id: "", invert: true }, // TODO
  CAD: { id: "", invert: false }, // USD/CAD = CAD per USD
  CHF: { id: "", invert: false }, // USD/CHF = CHF per USD
  // --- emerging markets (Pyth's edge over Chainlink) ---
  NGN: { id: "", invert: false }, // USD/NGN = NGN per USD  (official; parallel still via push-oracle)
  KES: { id: "", invert: false }, // TODO
  ZAR: { id: "", invert: false }, // TODO
  GHS: { id: "", invert: false }, // TODO
  PHP: { id: "", invert: false }, // TODO
  SGD: { id: "", invert: false }, // TODO
  INR: { id: "", invert: false }, // TODO
  BRL: { id: "", invert: false }, // TODO
  MXN: { id: "", invert: false }, // TODO
  COP: { id: "", invert: false }, // TODO
  IDR: { id: "", invert: false }, // TODO
  TRY: { id: "", invert: false }, // TODO
};

/** True when a Pyth feed id is configured for this currency. */
export function hasPythFeed(currency: string): boolean {
  const c = PYTH_FX[currency.toUpperCase()];
  return Boolean(c && c.id);
}

/** USD per 1 unit of `currency` from Pyth (the `usdPer` convention), or null
 *  when no id is configured, the price is stale, or the fetch fails. */
export async function pythUsdPer(currency: string): Promise<number | null> {
  const cfg = PYTH_FX[currency.toUpperCase()];
  if (!cfg || !cfg.id) return null;
  try {
    const id = cfg.id.startsWith("0x") ? cfg.id.slice(2) : cfg.id;
    const res = await fetch(`${HERMES}?ids[]=${id}&parsed=true`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      parsed?: { price?: { price?: string; expo?: number; publish_time?: number } }[];
    };
    const p = data.parsed?.[0]?.price;
    if (!p || p.price == null || p.expo == null) return null;
    if (p.publish_time && Date.now() - p.publish_time * 1000 > MAX_AGE_MS) return null; // stale
    const value = Number(p.price) * Math.pow(10, p.expo); // the raw feed value
    if (!(value > 0)) return null;
    // Normalise to USD per 1 unit of `currency`.
    return cfg.invert ? value : 1 / value;
  } catch {
    return null;
  }
}
