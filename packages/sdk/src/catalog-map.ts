// Map admin-catalog documents (loose JSON) onto the typed shapes the public
// screens use. Tolerant of missing fields so admin-created rows render sensibly.

import type { Instrument, InstrumentType } from "./invest";
import type { Market, MarketKind, Outcome } from "./markets";

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

/** Coerce loose stored outcomes (["A","B"] or [{label,pool}]) into Outcomes. */
function toOutcomes(raw: unknown): Outcome[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((o): Outcome | null => {
      if (typeof o === "string") return o.trim() ? { label: o.trim(), pool: 0 } : null;
      if (o && typeof o === "object") {
        const label = String((o as Record<string, unknown>).label ?? "").trim();
        if (!label) return null;
        return { label, pool: Number((o as Record<string, unknown>).pool ?? 0) };
      }
      return null;
    })
    .filter(Boolean) as Outcome[];
}

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
  const outcomes = toOutcomes(data.outcomes);
  const isMulti = data.type === "multi" && outcomes.length >= 2;
  const status = data.status === "proposed" ? "proposed" : "live";
  const proposer = data.proposer ? String(data.proposer) : undefined;
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
    hedge: isMulti ? false : hedge,
    hedgeNote: !isMulti && hedge ? String(data.hedgeNote ?? "Pays out to offset the real-world move.") : undefined,
    type: isMulti ? "multi" : "binary",
    outcomes: isMulti ? outcomes : undefined,
    status,
    proposer,
  };
}
