import { Shield, TrendingUp } from "lucide-react";
import { Card } from "@/components/app/ui";
import { type Market } from "@pesarc/sdk/markets";
import { type LiveMarket } from "@pesarc/sdk/markets.live";
import { displayPrices, displayPool, type Side } from "./display";

export default function MarketCard({
  market,
  live,
  onStake,
}: {
  market: Market;
  live?: LiveMarket;
  onStake: (side: Side) => void;
}) {
  const p = displayPrices(market, live);
  const pool = displayPool(market, live);
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3 mb-3">
        <span className="text-2xl leading-none mt-0.5">{market.flag}</span>
        <div className="flex-1">
          <p className="font-semibold text-deepink leading-snug">
            {market.question}
          </p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {market.hedge && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald/10 text-emerald text-[11px] font-semibold px-2 py-0.5">
                <Shield className="w-3 h-3" /> Hedge
              </span>
            )}
            <span className="text-[11px] text-muted">
              Resolves {market.resolves} · {market.collateral}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => onStake("yes")}
          className="rounded-xl border border-emerald/20 bg-emerald-50 hover:bg-emerald/15 transition-colors py-2.5 text-center"
        >
          <div className="text-xs font-medium text-muted">Yes</div>
          <div className="text-lg font-semibold text-emerald numerals">
            {p.yes}¢
          </div>
        </button>
        <button
          onClick={() => onStake("no")}
          className="rounded-xl border border-black/10 bg-black/[0.03] hover:bg-black/[0.06] transition-colors py-2.5 text-center"
        >
          <div className="text-xs font-medium text-muted">No</div>
          <div className="text-lg font-semibold text-deepink numerals">
            {p.no}¢
          </div>
        </button>
      </div>

      <div className="flex items-center justify-between mt-3 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1">
          <TrendingUp className="w-3 h-3" />
          {market.collateral} {pool.toLocaleString()} pooled
        </span>
        <span className="truncate max-w-[55%] text-right">
          {market.resolver.kind === "oracle"
            ? market.resolver.feed
            : market.resolver.attestor}
        </span>
      </div>

      {market.hedge && market.hedgeNote && (
        <p className="mt-2 text-[11px] text-emerald/90 bg-emerald-50 rounded-lg px-2.5 py-1.5">
          {market.hedgeNote}
        </p>
      )}
    </Card>
  );
}
