// Broker / market-data provider seam for Invest. The catalog + paper-trade are
// the default (SimulatedBroker) so the whole flow is demoable with no account;
// set BROKER_API_URL to route quotes and orders to a real tokenized-equity or
// licensed-broker provider. Same pattern as the ramp adapter (ramp.ts).
//
// Testnet/demo today: SimulatedBroker places no real order.

import { INSTRUMENTS, MARKETS } from "./invest";
import type { CurrencyCode } from "./money";

export type Quote = { symbol: string; price: number; currency: CurrencyCode; ts: number };

export type Order = { symbol: string; shares: number; side: "buy" | "sell"; currency?: string };

export type OrderResult = {
  ok: boolean;
  orderId?: string;
  filledPrice?: number;
  error?: string;
};

export type BrokerAdapter = {
  readonly name: string;
  /** true when quotes/orders come from a real provider. */
  readonly live: boolean;
  getQuote(symbol: string): Promise<Quote | null>;
  placeOrder(order: Order): Promise<OrderResult>;
};

const catalogQuote = (symbol: string): Quote | null => {
  const i = INSTRUMENTS.find((x) => x.symbol === symbol);
  if (!i) return null;
  return { symbol, price: i.price, currency: MARKETS[i.market].currency, ts: Date.now() };
};

export const SimulatedBroker: BrokerAdapter = {
  name: "simulated",
  live: false,
  async getQuote(symbol) {
    return catalogQuote(symbol);
  },
  async placeOrder(order) {
    const q = catalogQuote(order.symbol);
    if (!q) return { ok: false, error: "unknown symbol" };
    return {
      ok: true,
      orderId: `SIM-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
      filledPrice: q.price,
    };
  },
};

function httpBroker(baseUrl: string, apiKey?: string): BrokerAdapter {
  const headers = apiKey ? { authorization: `Bearer ${apiKey}` } : undefined;
  const root = baseUrl.replace(/\/$/, "");
  return {
    name: "http",
    live: true,
    async getQuote(symbol) {
      try {
        const res = await fetch(`${root}/quotes/${encodeURIComponent(symbol)}`, {
          headers,
          cache: "no-store",
        });
        if (!res.ok) return catalogQuote(symbol);
        return (await res.json()) as Quote;
      } catch {
        return catalogQuote(symbol);
      }
    },
    async placeOrder(order) {
      try {
        const res = await fetch(`${root}/orders`, {
          method: "POST",
          headers: { "content-type": "application/json", ...(headers ?? {}) },
          body: JSON.stringify(order),
        });
        if (!res.ok) return { ok: false, error: `broker ${res.status}` };
        return (await res.json()) as OrderResult;
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "broker error" };
      }
    },
  };
}

/** The active broker for this deployment. */
export function getBroker(): BrokerAdapter {
  const url = process.env.NEXT_PUBLIC_BROKER_API_URL || process.env.BROKER_API_URL;
  if (url) return httpBroker(url, process.env.NEXT_PUBLIC_BROKER_API_KEY);
  return SimulatedBroker;
}
