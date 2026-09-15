// Mock quote engine. Mirrors the shape a real intent/quote service would return
// so the Send UI can be swapped onto live infrastructure later without UI changes.

import {
  type CurrencyCode,
  midMarketRate,
} from "./money";

export type PayoutMethod = "bank" | "mobile_money" | "wallet";

export const PAYOUT_METHODS: { id: PayoutMethod; label: string; hint: string }[] = [
  { id: "bank", label: "Bank account", hint: "Pay into any local bank" },
  { id: "mobile_money", label: "Mobile money", hint: "M-Pesa, Airtel, OPay" },
  { id: "wallet", label: "Pesarc balance", hint: "Instant in-app credit" },
];

/** All-in fee folded into the FX spread (PRD: 0.5–1% vs 8.78% legacy). */
const FEE_PCT = 0.005;

export type QuoteInput = {
  /** Amount the sender pays, in the send currency. */
  sendAmount: number;
  sendCurrency: CurrencyCode;
  receiveCurrency: CurrencyCode;
  payout: PayoutMethod;
};

export type Quote = {
  sendAmount: number;
  sendCurrency: CurrencyCode;
  receiveCurrency: CurrencyCode;
  /** What the recipient gets, all-in. */
  receiveAmount: number;
  payout: PayoutMethod;

  // Advanced breakdown
  midRate: number;
  effectiveRate: number;
  feePct: number;
  feeAmount: number; // in send currency
  route: string; // e.g. "CoW match" / "Circle CCTP V2"
  slippagePct: number;
  etaSeconds: number;
  legacyFeePct: number; // for "you save" comparison
  legacyReceiveAmount: number;
  /** True when the numbers came from the live on-chain hub pool. */
  live?: boolean;
};

export function getQuote(input: QuoteInput): Quote {
  const { sendAmount, sendCurrency, receiveCurrency, payout } = input;
  const midRate = midMarketRate(sendCurrency, receiveCurrency);
  const effectiveRate = midRate * (1 - FEE_PCT);
  const receiveAmount = round(sendAmount * effectiveRate, receiveCurrency);
  const feeAmount = round(sendAmount * FEE_PCT, sendCurrency);

  // Small transfers settle optimistically via matched flows; larger ones bridge.
  const matched = sendAmount <= 250;
  const route = matched ? "CoW match · optimistic credit" : "Circle CCTP V2 Fast";
  const etaSeconds = payout === "wallet" ? 8 : matched ? 15 : 30;

  // Legacy remittance comparison (PRD: ~8.78% Sub-Saharan average).
  const legacyFeePct = 0.0878;
  const legacyReceiveAmount = round(
    sendAmount * midRate * (1 - legacyFeePct),
    receiveCurrency
  );

  return {
    sendAmount,
    sendCurrency,
    receiveCurrency,
    receiveAmount,
    payout,
    midRate,
    effectiveRate,
    feePct: FEE_PCT,
    feeAmount,
    route,
    slippagePct: 0.1,
    etaSeconds,
    legacyFeePct,
    legacyReceiveAmount,
  };
}

/**
 * Overlays live on-chain pool numbers onto a mock quote, keeping the
 * mock-only fields (route copy, ETA, payout) intact.
 */
export function applyLivePool(
  quote: Quote,
  live: {
    midRate: number;
    receiveAmount: number;
    effectiveRate: number;
    feePct: number;
    route: string;
  }
): Quote {
  return {
    ...quote,
    live: true,
    midRate: live.midRate,
    effectiveRate: live.effectiveRate,
    receiveAmount: round(live.receiveAmount, quote.receiveCurrency),
    feePct: live.feePct,
    feeAmount: round(quote.sendAmount * live.feePct, quote.sendCurrency),
    route: live.route,
    legacyReceiveAmount: round(
      quote.sendAmount * live.midRate * (1 - quote.legacyFeePct),
      quote.receiveCurrency
    ),
  };
}

function round(value: number, code: CurrencyCode): number {
  const decimals = code === "NGN" || code === "KES" ? 0 : 2;
  const f = Math.pow(10, decimals);
  return Math.round(value * f) / f;
}
