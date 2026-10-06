// Live FX source for the corridor oracle keeper. The reference RATE is sourced
// here and pushed on-chain by the keeper — the classic "push oracle" pattern,
// which also lets contract-less chains (e.g. Arc) get Chainlink-grade data.
//
// Priority: Chainlink Data Feeds (decentralized, on-chain) wherever a feed
// exists (see ./chainlink), falling back to the off-chain API for the
// currencies Chainlink doesn't cover (KES/GHS/EGP/…).
//
// NGN is special: Chainlink (and every official source) reports the OFFICIAL
// rate (~1330), but remittance settles at the PARALLEL/street rate (~1600). So
// for NGN we take the Chainlink base × NGN_PARALLEL_PREMIUM by default.
// NGN_RATE_SOURCE overrides: chainlink | parallel (Binance P2P) | premium | official.

import { chainlinkUsdPer, hasChainlinkFeed } from "./chainlink";

export type FxRate = {
  /** e.g. "NGN" */
  quote: string;
  /** Units of `quote` per 1 USD. */
  rate: number;
  /** ISO source timestamp. */
  asOf: string;
  source: string;
};

/** Free, keyless live FX (rates refresh ~daily). Good enough for testnet. */
const PRIMARY = "https://open.er-api.com/v6/latest/USD";
/** Fallback source with a different operator. */
const FALLBACK = "https://api.frankfurter.app/latest?from=USD";

/** Binance P2P public search — the USDT/<fiat> ads are a live read on the
 *  parallel/street rate (USDT ≈ USD). No key required. */
const BINANCE_P2P = "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search";

/** Median of a numeric list (robust to a few outlier ads). */
function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Parallel-market USD→fiat rate from Binance P2P (USDT as the USD proxy).
 * tradeType "SELL" = the price at which we could sell USDT for fiat — the rate
 * we can actually source the local currency at, so quoting off it doesn't
 * over-promise. Takes the median of the top ads. Throws on any failure so the
 * caller falls back to the official source.
 */
export async function fetchP2pParallelRate(fiat: string): Promise<FxRate> {
  const f = fiat.toUpperCase();
  const tradeType = (process.env.NGN_P2P_TRADE_TYPE || "SELL").toUpperCase();
  const res = await fetch(BINANCE_P2P, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // Binance's public P2P search expects browser-like headers.
      "user-agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      accept: "*/*",
      clienttype: "web",
    },
    cache: "no-store",
    body: JSON.stringify({
      asset: "USDT",
      fiat: f,
      tradeType,
      page: 1,
      rows: 10,
      payTypes: [],
      countries: [],
      publisherType: null,
    }),
  });
  if (!res.ok) throw new Error(`P2P source ${res.status} for USD/${f}`);
  const data = (await res.json()) as {
    data?: { adv?: { price?: string } }[];
  };
  const prices = (data.data ?? [])
    .map((d) => Number(d.adv?.price))
    .filter((n) => Number.isFinite(n) && n > 0);
  const rate = median(prices);
  if (rate <= 0) throw new Error(`No P2P ads for USD/${f}`);
  return { quote: f, rate, asOf: new Date().toISOString(), source: "binance-p2p" };
}

/**
 * Official rate with a configurable parallel PREMIUM — the robust fallback when
 * the live P2P source is unreachable (e.g. Binance is geo-blocked from the
 * host). Set NGN_PARALLEL_PREMIUM to the gap between official and street (e.g.
 * 0.2 ≈ +20%, turning ~1330 into ~1600) so NGN never silently reverts to the
 * understated official rate. Premium 0 (default) = pure official.
 */
async function fetchOfficialWithPremium(quote: string): Promise<FxRate> {
  const base = await fetchOfficialRate(quote);
  const premium = Number(process.env.NGN_PARALLEL_PREMIUM || 0);
  if (!Number.isFinite(premium) || premium <= 0) return base;
  return { ...base, rate: base.rate * (1 + premium), source: `${base.source}+premium` };
}

/** Apply the configured NGN parallel premium to a units-per-USD rate. */
function withPremium(rate: number, source: string, quote: string): FxRate {
  const premium = Number(process.env.NGN_PARALLEL_PREMIUM || 0);
  const p = Number.isFinite(premium) && premium > 0 ? premium : 0;
  return {
    quote,
    rate: rate * (1 + p),
    asOf: new Date().toISOString(),
    source: p > 0 ? `${source}+premium` : source,
  };
}

/** Official USD→fiat rate: open.er-api.com, then frankfurter.app. */
async function fetchOfficialRate(quote: string): Promise<FxRate> {
  const q = quote.toUpperCase();

  try {
    const res = await fetch(PRIMARY, { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as {
        rates?: Record<string, number>;
        time_last_update_utc?: string;
      };
      const rate = data.rates?.[q];
      if (rate && rate > 0) {
        return {
          quote: q,
          rate,
          asOf: data.time_last_update_utc ?? "",
          source: "open.er-api.com",
        };
      }
    }
  } catch {
    /* fall through */
  }

  const res = await fetch(`${FALLBACK}&to=${q}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`FX sources unavailable for USD/${q}`);
  const data = (await res.json()) as {
    rates?: Record<string, number>;
    date?: string;
  };
  const rate = data.rates?.[q];
  if (!rate || rate <= 0) throw new Error(`No USD/${q} rate available`);
  return { quote: q, rate, asOf: data.date ?? "", source: "frankfurter.app" };
}

/**
 * Fetches the live USD→`quote` rate. NGN defaults to the parallel-market proxy
 * (Binance P2P) so the settlement rate matches reality; set NGN_RATE_SOURCE=official
 * to force the official rate. Every other currency uses the official source.
 * Parallel failures fall back to official, so the keeper never pushes a guessed
 * rate and never silently fails.
 */
export async function fetchUsdRate(quote: string): Promise<FxRate> {
  const q = quote.toUpperCase();

  // NGN is the settlement-truth corridor. Default source = Chainlink's on-chain
  // NGN feed (decentralized, verifiable) times the parallel PREMIUM, since
  // Chainlink reports the OFFICIAL rate (~1330) and we settle at the street
  // rate (~1600). NGN_RATE_SOURCE overrides: chainlink | parallel | premium | official.
  if (q === "NGN") {
    const mode = (process.env.NGN_RATE_SOURCE || "chainlink").toLowerCase();
    if (mode === "official") return fetchOfficialRate(q);
    if (mode === "premium") return fetchOfficialWithPremium(q);
    if (mode === "parallel") {
      try {
        return await fetchP2pParallelRate(q);
      } catch {
        return fetchOfficialWithPremium(q);
      }
    }
    // "chainlink" (default): Chainlink NGN base × premium, else official × premium.
    const usdPer = await chainlinkUsdPer("NGN");
    if (usdPer && usdPer > 0) return withPremium(1 / usdPer, "chainlink", q);
    return fetchOfficialWithPremium(q);
  }

  // Every other currency: Chainlink-first where a Base feed exists (official =
  // market for these), else the off-chain API.
  if (hasChainlinkFeed(q)) {
    const usdPer = await chainlinkUsdPer(q);
    if (usdPer && usdPer > 0) {
      return { quote: q, rate: 1 / usdPer, asOf: new Date().toISOString(), source: "chainlink" };
    }
  }
  return fetchOfficialRate(q);
}
