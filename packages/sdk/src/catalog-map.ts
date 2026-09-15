// Map admin-catalog documents (loose JSON) onto the typed shapes the public
// screens use. Tolerant of missing fields so admin-created rows render sensibly.

import type { Instrument, InstrumentType } from "./invest";
import type { Market, MarketKind } from "./markets";

export function toInstrument(data: Record<string, unknown>): Instrument | null {
  const symbol = String(data.symbol ?? "").trim();
  if (!symbol) return null;
  return {
    symbol,
    name: String(data.name ?? symbol),
    type: (data.type === "etf" ? "etf" : "stock") as InstrumentType,
    market: String(data.market ?? "US"),
    sector: String(data.sector ?? "—"),
    price: Number(data.price ?? 0),
    change: Number(data.change ?? 0),
  };
}

const KINDS: MarketKind[] = ["fx", "macro", "sports", "politics"];

export function toMarket(data: Record<string, unknown>, index: number): Market | null {
  const question = String(data.question ?? "").trim();
  if (!question) return null;
  const kind = (KINDS.includes(data.kind as MarketKind) ? data.kind : "macro") as MarketKind;
  const collateral = (["cNGN", "cKES", "cGHS"].includes(String(data.collateral))
    ? data.collateral
    : "cNGN") as Market["collateral"];
  const poolYes = Number(data.poolYes ?? 5_000_000);
  const poolNo = Number(data.poolNo ?? 5_000_000);
  const hedge = data.hedge != null ? Boolean(data.hedge) : kind === "fx" || kind === "macro";
  return {
    id: `catalog-${index}`,
    kind,
    question,
    collateral,
    flag: String(data.flag ?? "🌍"),
    poolYes,
    poolNo,
    closes: String(data.closes ?? "TBD"),
    resolves: String(data.resolves ?? "TBD"),
    resolver:
      data.resolver === "oracle"
        ? { kind: "oracle", feed: "RealizedRateOracle" }
        : { kind: "attested", attestor: "Pesarc · bonded + dispute" },
    hedge,
    hedgeNote: hedge ? String(data.hedgeNote ?? "Pays out to offset the real-world move.") : undefined,
  };
}
