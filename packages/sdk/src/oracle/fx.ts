// Live FX source for the corridor oracle keeper. Exotic-market pairs like
// USD/NGN and USD/GHS are NOT reliably published by any decentralized on-chain
// feed (Chainlink has no NGN feed; Pyth lists FX.USD/NGN but it isn't actively
// published on the free tier). So the reference RATE is sourced off-chain here
// and pushed on-chain by the keeper — the classic "push oracle" pattern. On
// mainnet, swap this for a licensed FX data provider (or a Pyth Pro feed).
//
// NGN is special: the OFFICIAL rate (~1330) diverges sharply from the
// PARALLEL/street rate (~1600) that remittance actually settles at. For NGN we
// therefore default to a parallel-market proxy — Binance P2P USDT/NGN, which is
// where the street rate is discovered in real time — and fall back to the
// official source only if that's unavailable. Flip back with NGN_RATE_SOURCE=official.

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
    headers: { "content-type": "application/json" },
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

  const useParallel = q === "NGN" && (process.env.NGN_RATE_SOURCE || "parallel") !== "official";
  if (useParallel) {
    try {
      return await fetchP2pParallelRate(q);
    } catch {
      // Parallel source unavailable — fall back to official rather than fail.
    }
  }

  return fetchOfficialRate(q);
}
