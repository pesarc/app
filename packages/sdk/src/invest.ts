// Invest catalog — stocks & ETFs across Global-South and global markets, priced
// in each market's LOCAL currency (the wedge: buy the JSE in rand, the NGX in
// naira, no dollar conversion in the path). Figures are illustrative sample
// data for the demo; a real deployment feeds live prices from a market-data
// provider and settles via a tokenized-equity / broker adapter.

import type { CurrencyCode } from "./money";

export type InstrumentType = "stock" | "etf";

export type Market = {
  code: string; // exchange MIC-ish code
  name: string;
  flag: string;
  currency: CurrencyCode;
  region: "africa" | "global";
};

export const MARKETS: Record<string, Market> = {
  NGX: { code: "NGX", name: "Nigerian Exchange", flag: "🇳🇬", currency: "NGN", region: "africa" },
  JSE: { code: "JSE", name: "Johannesburg Stock Exchange", flag: "🇿🇦", currency: "ZAR", region: "africa" },
  NSE: { code: "NSE", name: "Nairobi Securities Exchange", flag: "🇰🇪", currency: "KES", region: "africa" },
  GSE: { code: "GSE", name: "Ghana Stock Exchange", flag: "🇬🇭", currency: "GHS", region: "africa" },
  EGX: { code: "EGX", name: "Egyptian Exchange", flag: "🇪🇬", currency: "EGP", region: "africa" },
  US: { code: "US", name: "US Markets (NYSE / Nasdaq)", flag: "🇺🇸", currency: "USD", region: "global" },
};

export type Instrument = {
  symbol: string;
  name: string;
  type: InstrumentType;
  market: string; // MARKETS key
  sector: string;
  price: number; // in the market's local currency
  change: number; // 24h % change
};

// Illustrative catalog (sample prices).
export const INSTRUMENTS: Instrument[] = [
  // Nigeria — NGX
  { symbol: "DANGCEM", name: "Dangote Cement", type: "stock", market: "NGX", sector: "Industrials", price: 545.0, change: 1.8 },
  { symbol: "MTNN", name: "MTN Nigeria", type: "stock", market: "NGX", sector: "Telecom", price: 198.5, change: -0.9 },
  { symbol: "GTCO", name: "Guaranty Trust Holding", type: "stock", market: "NGX", sector: "Financials", price: 47.2, change: 2.4 },
  { symbol: "ARADEL", name: "Aradel Holdings", type: "stock", market: "NGX", sector: "Energy", price: 620.0, change: 0.6 },
  // South Africa — JSE
  { symbol: "NPN", name: "Naspers", type: "stock", market: "JSE", sector: "Technology", price: 3820.0, change: 1.1 },
  { symbol: "SOL", name: "Sasol", type: "stock", market: "JSE", sector: "Energy", price: 142.6, change: -1.4 },
  { symbol: "STXNDQ", name: "Satrix Nasdaq 100 ETF", type: "etf", market: "JSE", sector: "Index", price: 98.3, change: 0.7 },
  // Kenya — NSE
  { symbol: "SCOM", name: "Safaricom", type: "stock", market: "NSE", sector: "Telecom", price: 18.4, change: 0.5 },
  { symbol: "EQTY", name: "Equity Group Holdings", type: "stock", market: "NSE", sector: "Financials", price: 44.1, change: 1.9 },
  // Ghana — GSE
  { symbol: "MTNGH", name: "MTN Ghana", type: "stock", market: "GSE", sector: "Telecom", price: 2.65, change: 0.4 },
  // Egypt — EGX
  { symbol: "COMI", name: "Commercial Intl Bank", type: "stock", market: "EGX", sector: "Financials", price: 88.7, change: -0.3 },
  // Global / US
  { symbol: "VOO", name: "Vanguard S&P 500 ETF", type: "etf", market: "US", sector: "Index", price: 512.4, change: 0.3 },
  { symbol: "AAPL", name: "Apple", type: "stock", market: "US", sector: "Technology", price: 229.8, change: 0.9 },
  { symbol: "AFK", name: "VanEck Africa Index ETF", type: "etf", market: "US", sector: "Africa Index", price: 19.7, change: 1.2 },
];

export type InstrumentFilter = "all" | "stock" | "etf" | string; // or a MARKETS key

export function filterInstruments(f: InstrumentFilter): Instrument[] {
  if (f === "all") return INSTRUMENTS;
  if (f === "stock" || f === "etf") return INSTRUMENTS.filter((i) => i.type === f);
  return INSTRUMENTS.filter((i) => i.market === f);
}

export function instrumentBySymbol(symbol: string): Instrument | undefined {
  return INSTRUMENTS.find((i) => i.symbol === symbol);
}

export function marketOf(i: Instrument): Market {
  return MARKETS[i.market];
}
