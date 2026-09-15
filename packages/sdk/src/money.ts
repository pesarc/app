// Money-first helpers — currencies, locale-aware formatting, and corridor FX.
// All FX values are illustrative mock mid-market rates for the demo quote engine.

export type CurrencyCode = "GBP" | "USD" | "EUR" | "NGN" | "KES" | "GHS";

export type Currency = {
  code: CurrencyCode;
  symbol: string;
  name: string;
  locale: string;
  /** Whole-number display (e.g. NGN shows no decimals). */
  decimals: number;
};

export const CURRENCIES: Record<CurrencyCode, Currency> = {
  GBP: { code: "GBP", symbol: "£", name: "British Pound", locale: "en-GB", decimals: 2 },
  USD: { code: "USD", symbol: "$", name: "US Dollar", locale: "en-US", decimals: 2 },
  EUR: { code: "EUR", symbol: "€", name: "Euro", locale: "en-IE", decimals: 2 },
  NGN: { code: "NGN", symbol: "₦", name: "Nigerian Naira", locale: "en-NG", decimals: 0 },
  KES: { code: "KES", symbol: "KSh", name: "Kenyan Shilling", locale: "en-KE", decimals: 0 },
  GHS: { code: "GHS", symbol: "₵", name: "Ghanaian Cedi", locale: "en-GH", decimals: 2 },
};

export const SEND_CURRENCIES: CurrencyCode[] = ["GBP", "USD", "EUR"];
export const RECEIVE_CURRENCIES: CurrencyCode[] = ["NGN", "KES", "GHS"];

// Mid-market rates: 1 unit of [from] -> X units of [to]. Mock values.
const MID_MARKET: Record<string, number> = {
  "GBP-NGN": 1974.0,
  "USD-NGN": 1605.0,
  "EUR-NGN": 1720.0,
  "GBP-KES": 168.0,
  "USD-KES": 132.0,
  "EUR-KES": 146.0,
  "GBP-GHS": 19.4,
  "USD-GHS": 15.3,
  "EUR-GHS": 16.9,
};

export function midMarketRate(from: CurrencyCode, to: CurrencyCode): number {
  return MID_MARKET[`${from}-${to}`] ?? 1;
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
