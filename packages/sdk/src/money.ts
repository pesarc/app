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

/** All currency codes, in declaration (region) order. */
export const ALL_CURRENCIES = Object.keys(CURRENCIES) as CurrencyCode[];

export const AFRICAN_CURRENCIES = ALL_CURRENCIES.filter((c) => CURRENCIES[c].region === "africa");
export const WESTERN_CURRENCIES = ALL_CURRENCIES.filter((c) => CURRENCIES[c].region === "western");
export const ASIAN_CURRENCIES = ALL_CURRENCIES.filter((c) => CURRENCIES[c].region === "asia");

/** What the diaspora sends from (source currencies). */
export const SEND_CURRENCIES: CurrencyCode[] = [...WESTERN_CURRENCIES, ...ASIAN_CURRENCIES];
/** What lands locally (destination currencies). */
export const RECEIVE_CURRENCIES: CurrencyCode[] = [...AFRICAN_CURRENCIES];

/** Mid-market rate: 1 unit of [from] -> X units of [to] (cross via USD). */
export function midMarketRate(from: CurrencyCode, to: CurrencyCode): number {
  const f = CURRENCIES[from]?.usdPer;
  const t = CURRENCIES[to]?.usdPer;
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

/** Plain number with grouping, no symbol — for split symbol/amount layouts. */
export function formatNumber(amount: number, code: CurrencyCode): string {
  const c = CURRENCIES[code];
  return new Intl.NumberFormat(c.locale, {
    minimumFractionDigits: c.decimals,
    maximumFractionDigits: c.decimals,
  }).format(amount);
}
