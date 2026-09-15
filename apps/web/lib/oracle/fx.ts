// Live FX source for the corridor oracle keeper. Exotic-market pairs like
// USD/NGN and USD/GHS are NOT reliably published by any decentralized on-chain
// feed (Chainlink has no NGN feed; Pyth lists FX.USD/NGN but it isn't actively
// published on the free tier). So the reference RATE is sourced off-chain here
// and pushed on-chain by the keeper — the classic "push oracle" pattern. On
// mainnet, swap this for a licensed FX data provider (or a Pyth Pro feed).

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

/**
 * Fetches the live USD→`quote` rate. Tries the primary source, then the
 * fallback; throws only if both fail so the keeper never pushes a guessed rate.
 */
export async function fetchUsdRate(quote: string): Promise<FxRate> {
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
