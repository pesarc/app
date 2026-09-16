import { Shield, Sun, Users, Link2 } from "lucide-react";
import { isMulti, outcomePrices, type Market } from "@pesarc/sdk/markets";
import { type LiveMarket } from "@pesarc/sdk/markets.live";
import { displayPrices, displayPool, type Selection } from "./display";

const COLLATERAL_SYMBOL: Record<string, string> = {
  cNGN: "₦",
  cKES: "KSh ",
  cGHS: "₵ ",
};

function compact(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 2) + "m";
  if (n >= 1_000) return Math.round(n / 1_000) + "k";
  return String(n);
}

export default function MarketCard({
  market,
  live,
  onStake,
  venueLabel,
  onClaim,
  claiming,
}: {
  market: Market;
  live?: LiveMarket;
  onStake: (sel: Selection) => void;
  /** When set, show a venue chip (used on the merged multi-venue board). */
  venueLabel?: string;
  /** When set and the market is finalized, show a Claim button. */
  onClaim?: () => void;
  claiming?: boolean;
}) {
  const p = displayPrices(market, live);
  const pool = displayPool(market, live);
  const sym = COLLATERAL_SYMBOL[market.collateral] ?? "";
  const oracle = market.resolver.kind === "oracle";
  const finalized = live?.status === 3;
  const multi = isMulti(market);
  const community = market.status === "proposed";

  return (
    <div className="bg-snow border border-fog rounded-card p-[18px] shadow-card-flat">
      {/* Header */}
      <div className="flex gap-3 mb-3.5">
        <span className="w-10 h-10 rounded-[13px] bg-cream flex items-center justify-center text-xl shrink-0">
          {market.flag}
        </span>
        <div>
          <div className="text-[15px] font-extrabold text-harbor leading-snug">
            {market.question}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            {market.hedge ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-tint/50 text-sky-deep text-[11px] font-bold px-2.5 py-0.5">
                <Shield className="w-[11px] h-[11px]" />
                {market.kind === "fx" ? "FX hedge" : "Cover"}
              </span>
            ) : (
              <span className="text-[11px] font-bold text-slate">
                {cap(market.kind)} · settled in {market.collateral}
              </span>
            )}
            {community && (
              <span className="inline-flex items-center gap-1 rounded-full bg-harbor/10 text-harbor text-[11px] font-bold px-2 py-0.5">
                <Users className="w-[11px] h-[11px]" /> Community
              </span>
            )}
            {market.txUrl && (
              <a
                href={market.txUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-full bg-sky-tint/50 text-sky-deep text-[11px] font-bold px-2 py-0.5 hover:bg-sky-tint transition-colors"
              >
                <Link2 className="w-[11px] h-[11px]" /> On-chain
              </a>
            )}
          </div>
        </div>
        {venueLabel && (
          <span className="ml-auto shrink-0 self-start inline-flex items-center rounded-full bg-black/[0.05] text-slate text-[10px] font-bold uppercase tracking-wide px-2 py-0.5">
            {venueLabel}
          </span>
        )}
      </div>

      {market.hedge && market.hedgeNote && (
        <div className="text-[12.5px] italic font-medium text-slate mb-3.5">
          {market.hedgeNote}
        </div>
      )}

      {multi ? (
        /* Multi-outcome: one row per choice with implied odds + a Back button */
        <div className="space-y-2 mb-3.5">
          {(market.outcomes ?? []).map((o, i) => {
            const pct = outcomePrices(market)[i] ?? 0;
            return (
              <button
                key={`${o.label}-${i}`}
                onClick={() => onStake({ kind: "multi", outcome: i })}
                className="group w-full text-left rounded-2xl border-[1.5px] border-fog bg-snow px-3.5 py-2.5 hover:border-sky/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[13.5px] font-bold text-harbor truncate pr-2">{o.label}</span>
                  <span className="text-[13px] font-extrabold text-sky-deep numerals shrink-0">{pct}%</span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-fog overflow-hidden">
                  <div className="h-full bg-sky rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <>
          {/* Parimutuel split bar */}
          <div className="flex h-2.5 rounded-full overflow-hidden mb-2">
            <div className="bg-sky" style={{ width: `${p.yes}%` }} />
            <div className="bg-fog" style={{ width: `${p.no}%` }} />
          </div>
          <div className="flex justify-between mb-4 numerals">
            <span className="text-[12.5px] font-bold text-sky-deep">Yes {p.yes}%</span>
            <span className="text-[12.5px] font-bold text-slate">No {p.no}%</span>
          </div>

          {/* Stake buttons — or Claim on a finalized market */}
          {finalized && onClaim ? (
            <button
              onClick={onClaim}
              disabled={claiming}
              className="w-full rounded-2xl bg-sky text-white py-3 text-sm font-extrabold shadow-pop-sm hover:-translate-y-0.5 transition-transform disabled:opacity-60 mb-3.5"
            >
              {claiming ? "Claiming…" : `Claim winnings · ${live?.outcome === 1 ? "Yes" : live?.outcome === 2 ? "No" : "resolved"}`}
            </button>
          ) : (
            <div className="flex gap-2.5 mb-3.5">
              <button
                onClick={() => onStake({ kind: "binary", side: "yes" })}
                className="flex-1 rounded-2xl bg-sky text-white py-3 text-sm font-extrabold shadow-pop-sm hover:-translate-y-0.5 transition-transform"
              >
                Yes · <span className="numerals">{p.yes}¢</span>
              </button>
              <button
                onClick={() => onStake({ kind: "binary", side: "no" })}
                className="flex-1 rounded-2xl bg-snow text-harbor border-[1.5px] border-fog py-3 text-sm font-extrabold hover:border-slate/50 transition-colors"
              >
                No · <span className="numerals">{p.no}¢</span>
              </button>
            </div>
          )}
        </>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3.5 border-t border-cream">
        <span className="text-[12.5px] font-semibold text-slate numerals">
          {sym}
          {compact(pool)} pool · closes {market.closes}
        </span>
        <span
          className={`inline-flex items-center gap-1.5 text-[11px] font-bold ${
            oracle ? "text-sky-deep" : "text-slate"
          }`}
        >
          {oracle ? <Sun className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
          {oracle ? "Realized-rate oracle" : "Bonded attestor"}
        </span>
      </div>
    </div>
  );
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
