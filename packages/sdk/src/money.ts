// Money-first helpers — currencies, locale-aware formatting, and corridor FX.
// All FX values are illustrative mock mid-market rates for the demo quote engine.
//
// Coverage: the top-10 African currencies (the receive side of most corridors),
// plus the Western and Asian currencies the diaspora sends from. Rates are
// anchored to USD (usdPer = value of 1 unit in USD) so any pair cross-rates
// cleanly without an N×N table.

export type CurrencyCode =
  // African (top 10)
  | "NGN" | "ZAR" | "EGP" | "KES" | "GHS" | "MAD" | "TZS" | "UGX" | "XOF" | "ETB"
  // Western
  | "USD" | "GBP" | "EUR" | "CAD" | "AUD" | "CHF"
  // Asian / Gulf
  | "INR" | "CNY" | "JPY" | "AED" | "SGD" | "PHP";

export type CurrencyRegion = "africa" | "western" | "asia";

export type Currency = {
  code: CurrencyCode;
  symbol: string;
  name: string;
  flag: string;
  region: CurrencyRegion;
  locale: string;
  /** Whole-number display (e.g. NGN shows no decimals). */
  decimals: number;
  /** Illustrative value of 1 unit in USD (mock mid-market). */
  usdPer: number;
};

export const CURRENCIES: Record<CurrencyCode, Currency> = {
  // --- Africa (top 10) ---
  NGN: { code: "NGN", symbol: "₦", name: "Nigerian Naira", flag: "🇳🇬", region: "africa", locale: "en-NG", decimals: 0, usdPer: 1 / 1605 },
  ZAR: { code: "ZAR", symbol: "R", name: "South African Rand", flag: "🇿🇦", region: "africa", locale: "en-ZA", decimals: 2, usdPer: 1 / 18.5 },
  EGP: { code: "EGP", symbol: "E£", name: "Egyptian Pound", flag: "🇪🇬", region: "africa", locale: "ar-EG", decimals: 2, usdPer: 1 / 48 },
  KES: { code: "KES", symbol: "KSh", name: "Kenyan Shilling", flag: "🇰🇪", region: "africa", locale: "en-KE", decimals: 0, usdPer: 1 / 132 },
  GHS: { code: "GHS", symbol: "₵", name: "Ghanaian Cedi", flag: "🇬🇭", region: "africa", locale: "en-GH", decimals: 2, usdPer: 1 / 15.3 },
  MAD: { code: "MAD", symbol: "MAD ", name: "Moroccan Dirham", flag: "🇲🇦", region: "africa", locale: "fr-MA", decimals: 2, usdPer: 1 / 10 },
  TZS: { code: "TZS", symbol: "TSh", name: "Tanzanian Shilling", flag: "🇹🇿", region: "africa", locale: "en-TZ", decimals: 0, usdPer: 1 / 2650 },
  UGX: { code: "UGX", symbol: "USh", name: "Ugandan Shilling", flag: "🇺🇬", region: "africa", locale: "en-UG", decimals: 0, usdPer: 1 / 3750 },
  XOF: { code: "XOF", symbol: "CFA ", name: "West African CFA Franc", flag: "🌍", region: "africa", locale: "fr-SN", decimals: 0, usdPer: 1 / 605 },
  ETB: { code: "ETB", symbol: "Br", name: "Ethiopian Birr", flag: "🇪🇹", region: "africa", locale: "am-ET", decimals: 2, usdPer: 1 / 57 },

  // --- Western ---
  USD: { code: "USD", symbol: "$", name: "US Dollar", flag: "🇺🇸", region: "western", locale: "en-US", decimals: 2, usdPer: 1 },
  GBP: { code: "GBP", symbol: "£", name: "British Pound", flag: "🇬🇧", region: "western", locale: "en-GB", decimals: 2, usdPer: 1.27 },
  EUR: { code: "EUR", symbol: "€", name: "Euro", flag: "🇪🇺", region: "western", locale: "en-IE", decimals: 2, usdPer: 1.08 },
  CAD: { code: "CAD", symbol: "C$", name: "Canadian Dollar", flag: "🇨🇦", region: "western", locale: "en-CA", decimals: 2, usdPer: 0.74 },
  AUD: { code: "AUD", symbol: "A$", name: "Australian Dollar", flag: "🇦🇺", region: "western", locale: "en-AU", decimals: 2, usdPer: 0.66 },
  CHF: { code: "CHF", symbol: "CHF ", name: "Swiss Franc", flag: "🇨🇭", region: "western", locale: "de-CH", decimals: 2, usdPer: 1.12 },

  // --- Asia / Gulf ---
  INR: { code: "INR", symbol: "₹", name: "Indian Rupee", flag: "🇮🇳", region: "asia", locale: "en-IN", decimals: 2, usdPer: 1 / 83.3 },
  CNY: { code: "CNY", symbol: "¥", name: "Chinese Yuan", flag: "🇨🇳", region: "asia", locale: "zh-CN", decimals: 2, usdPer: 1 / 7.1 },
  JPY: { code: "JPY", symbol: "¥", name: "Japanese Yen", flag: "🇯🇵", region: "asia", locale: "ja-JP", decimals: 0, usdPer: 1 / 150 },
  AED: { code: "AED", symbol: "AED ", name: "UAE Dirham", flag: "🇦🇪", region: "asia", locale: "ar-AE", decimals: 2, usdPer: 1 / 3.6725 },
  SGD: { code: "SGD", symbol: "S$", name: "Singapore Dollar", flag: "🇸🇬", region: "asia", locale: "en-SG", decimals: 2, usdPer: 1 / 1.34 },
  PHP: { code: "PHP", symbol: "₱", name: "Philippine Peso", flag: "🇵🇭", region: "asia", locale: "en-PH", decimals: 2, usdPer: 1 / 57 },
};

/**
 * Short, colloquial money name for a currency — what a first-time user calls
 * their money ("Naira", "Shillings", "Cedis", "Dollars"). Used in consumer copy
 * in place of a bank/stablecoin ticker (Mum Test: money words, not crypto).
 */
export const CURRENCY_NAMES: Record<CurrencyCode, string> = {
  // Africa
  NGN: "Naira", ZAR: "Rand", EGP: "Egyptian Pounds", KES: "Shillings",
  GHS: "Cedis", MAD: "Dirhams", TZS: "Shillings", UGX: "Shillings",
  XOF: "CFA Francs", ETB: "Birr",
  // Western
  USD: "Dollars", GBP: "Pounds", EUR: "Euros", CAD: "Dollars",
  AUD: "Dollars", CHF: "Francs",
  // Asia / Gulf
  INR: "Rupees", CNY: "Yuan", JPY: "Yen", AED: "Dirhams",
  SGD: "Dollars", PHP: "Pesos",
};

/**
 * Resolve a currency code OR a stablecoin ticker (e.g. "cNGN", "tUSD") to a
 * user-facing money name. Falls back to the raw input if unknown.
 */
export function currencyName(codeOrTicker: string): string {
  const raw = (codeOrTicker || "").trim();
  const upper = raw.toUpperCase();
  // Direct currency code match.
  if (upper in CURRENCY_NAMES) {
    return CURRENCY_NAMES[upper as CurrencyCode];
  }
  // Stablecoin ticker like "cNGN" / "tUSD" — strip a leading c/t prefix.
  const stripped = upper.replace(/^[CT]/, "");
  if (stripped in CURRENCY_NAMES) {
    return CURRENCY_NAMES[stripped as CurrencyCode];
  }
  return raw;
}

/** All currency codes, in declaration (region) order. */
export const ALL_CURRENCIES = Object.keys(CURRENCIES) as CurrencyCode[];

export const AFRICAN_CURRENCIES = ALL_CURRENCIES.filter((c) => CURRENCIES[c].region === "africa");
export const WESTERN_CURRENCIES = ALL_CURRENCIES.filter((c) => CURRENCIES[c].region === "western");
export const ASIAN_CURRENCIES = ALL_CURRENCIES.filter((c) => CURRENCIES[c].region === "asia");

/** What the diaspora sends from (source currencies). */
export const SEND_CURRENCIES: CurrencyCode[] = [...WESTERN_CURRENCIES, ...ASIAN_CURRENCIES];
/** What lands locally (destination currencies). */
export const RECEIVE_CURRENCIES: CurrencyCode[] = [...AFRICAN_CURRENCIES];

/** The currencies we ACTUALLY settle in — each backed by a stablecoin in the
 *  registry with a corridor rate. This is the true supported set the corridor
 *  picker and the default-currency picker should offer, so users only ever see
 *  currencies we can really price and settle. Keep in sync with STABLECOINS. */
export const SUPPORTED_CURRENCIES: CurrencyCode[] = ["USD", "NGN", "KES", "GHS", "ZAR", "EGP"];

// Live mid-market rates, in the same `usdPer` convention (value of 1 unit in
// USD), fetched from the FX API (/api/fx) and set on the CLIENT only. When
// present, midMarketRate uses these real rates instead of the illustrative
// constants above, so every rate the user sees is current market — not a
// hardcoded figure. Null until loaded (and on the server), where the static
// constants stand in. Per-browser singleton; never set this server-side.
let LIVE_USD_PER: Partial<Record<CurrencyCode, number>> | null = null;

/** Install (or clear) live mid-market rates. Call only on the client. */
export function setLiveRates(usdPer: Partial<Record<CurrencyCode, number>> | null): void {
  LIVE_USD_PER = usdPer && Object.keys(usdPer).length > 0 ? usdPer : null;
}

/** True once real market rates are loaded (for a "live"/"market" badge). */
export function ratesAreLive(): boolean {
  return LIVE_USD_PER !== null;
}

/** True when THIS currency's rate came from the live market feed. Some
 *  currencies (e.g. NGN) are deliberately excluded from the feed because their
 *  official rate diverges from the settlement rate — those are priced by the
 *  on-chain oracle instead, so they must not claim a "market" rate here. */
export function rateIsLiveFor(code: CurrencyCode): boolean {
  return Boolean(LIVE_USD_PER && LIVE_USD_PER[code] !== undefined);
}

/** Mid-market rate: 1 unit of [from] -> X units of [to] (cross via USD).
 *  Uses live rates when loaded, else the illustrative constants. */
export function midMarketRate(from: CurrencyCode, to: CurrencyCode): number {
  const f = LIVE_USD_PER?.[from] ?? CURRENCIES[from]?.usdPer;
  const t = LIVE_USD_PER?.[to] ?? CURRENCIES[to]?.usdPer;
  if (!f || !t) return 1;
  return f / t;
}

/** Format an amount in its currency, locale-aware, with the right decimals. */
export function formatMoney(amount: number, code: CurrencyCode): string {
  const c = CURRENCIES[code];
  try {
    return new Intl.NumberFormat(c.locale, {
      style: "currency",
      currency: code,
      minimumFractionDigits: c.decimals,
      maximumFractionDigits: c.decimals,
    }).format(amount);
  } catch {
    // Fallback if the runtime lacks the locale/currency data.
    const n = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: c.decimals,
      maximumFractionDigits: c.decimals,
    }).format(amount);
    return `${c.symbol}${n}`;
  }
}

/** Compact money for large balances (>= 1M): $2.07B, ₦1.20M. Below 1M it defers
 *  to full formatMoney so everyday amounts stay exact. Keeps big holdings from
 *  rendering as absurd 10-digit strings. */
export function formatMoneyCompact(amount: number, code: CurrencyCode): string {
  const abs = Math.abs(amount);
  if (abs < 1_000_000) return formatMoney(amount, code);
  const sym = CURRENCIES[code].symbol;
  const [div, suffix] = abs >= 1e12 ? [1e12, "T"] : abs >= 1e9 ? [1e9, "B"] : [1e6, "M"];
  return `${sym}${(amount / div).toFixed(2)}${suffix}`;
}

/** Compact token amount (no currency): 1.20B, 12.5M, 12,500, 19.51. */
export function formatAmountCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/** Plain number with grouping, no symbol — for split symbol/amount layouts. */
export function formatNumber(amount: number, code: CurrencyCode): string {
  const c = CURRENCIES[code];
  return new Intl.NumberFormat(c.locale, {
    minimumFractionDigits: c.decimals,
    maximumFractionDigits: c.decimals,
  }).format(amount);
}
