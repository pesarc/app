// The local-currency stablecoins Pesarc settles in. Any of these can fund a
// stock purchase, a market stake, or an Earn deposit — the amount is shown in
// the instrument/market's native currency and the equivalent in the chosen
// stablecoin (cross-FX via midMarketRate); a real swap routes it to the
// underlying collateral. No dollar in the path unless you pick cUSD.

import { CURRENCIES, type CurrencyCode } from "./money";

export type Stablecoin = {
  symbol: string; // e.g. "cNGN"
  currency: CurrencyCode; // the fiat it tracks
  name: string;
  flag: string;
};

export const STABLECOINS: Stablecoin[] = [
  { symbol: "cUSD", currency: "USD", name: "USD stablecoin", flag: "🇺🇸" },
  { symbol: "cNGN", currency: "NGN", name: "Naira stablecoin", flag: "🇳🇬" },
  { symbol: "cKES", currency: "KES", name: "Shilling stablecoin", flag: "🇰🇪" },
  { symbol: "cGHS", currency: "GHS", name: "Cedi stablecoin", flag: "🇬🇭" },
  { symbol: "cZAR", currency: "ZAR", name: "Rand stablecoin", flag: "🇿🇦" },
  { symbol: "cEGP", currency: "EGP", name: "Egyptian pound stablecoin", flag: "🇪🇬" },
];

export function stablecoinBySymbol(symbol: string): Stablecoin | undefined {
  return STABLECOINS.find((s) => s.symbol === symbol);
}

export function stablecoinByCurrency(c: CurrencyCode): Stablecoin | undefined {
  return STABLECOINS.find((s) => s.currency === c);
}

/** Best default stablecoin for a user whose home currency is `pref`. */
export function defaultStablecoin(pref: CurrencyCode): Stablecoin {
  return stablecoinByCurrency(pref) ?? STABLECOINS[0];
}

/** Symbol of the currency backing a stablecoin (for formatting). */
export function currencyOf(sym: string): CurrencyCode {
  return stablecoinBySymbol(sym)?.currency ?? "USD";
}

export { CURRENCIES };
