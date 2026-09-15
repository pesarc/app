"use client";

import { useEffect, useMemo, useState } from "react";
import { Shield, Radio } from "lucide-react";
import { Card } from "@/components/app/ui";
import { MARKETS, MARKET_CATEGORIES, type Market, type MarketKind } from "@pesarc/sdk/markets";
import { fetchLiveMarkets, type LiveMarket } from "@pesarc/sdk/markets.live";
import { CELO, celoExplorerAddress } from "@pesarc/sdk/celo/config";
import MarketCard from "./MarketCard";
import StakeSheet from "./StakeSheet";
import { overlay, displayPrices, type Side } from "./display";

export default function MarketsView() {
  const [cat, setCat] = useState<MarketKind | "all">("all");
  const [ticket, setTicket] = useState<{ market: Market; live?: LiveMarket; side: Side } | null>(
    null
  );
  const [live, setLive] = useState<LiveMarket[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetchLiveMarkets().then((m) => {
      if (alive) setLive(m);
    });
    return () => {
      alive = false;
    };
  }, []);

  const isLive = Boolean(live && live.length > 0);

  const list = useMemo(
    () =>
      (cat === "all" ? MARKETS : MARKETS.filter((m) => m.kind === cat)).map((m) => ({
        market: m,
        index: MARKETS.indexOf(m),
      })),
    [cat]
  );

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-8 md:py-12">
      <header className="mb-5">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold text-deepink tracking-tight">Markets</h1>
          {isLive && (
            <a
              href={celoExplorerAddress(CELO.predictionMarket)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-full bg-emerald/10 text-emerald text-[11px] font-semibold px-2 py-0.5 hover:bg-emerald/20 transition-colors"
              aria-label="View the prediction market contract on the Celo explorer"
            >
              <Radio className="w-3 h-3" /> Live · Celo
            </a>
          )}
        </div>
        <p className="text-sm text-muted mt-1">
          Hedge your currency or take a view — settled in local money, never a dollar in the
          path.
        </p>
      </header>

      {/* Hedge explainer — the wedge, in one line. */}
      <Card className="p-4 mb-5 flex items-start gap-3 bg-emerald-50 border-emerald/10">
        <span className="w-9 h-9 rounded-full bg-emerald/15 flex items-center justify-center text-emerald shrink-0">
          <Shield className="w-4 h-4" />
        </span>
        <div className="text-sm text-deepink">
          <span className="font-semibold">A hedge, not a bet.</span> FX and macro markets
          resolve from Pesarc&apos;s own realized rate. Back the side that offsets your
          real-world risk and you&apos;re insured, in your own currency.
        </div>
      </Card>

      {/* Category filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4 -mx-1 px-1">
        {MARKET_CATEGORIES.map((c) => {
          const active = c.value === cat;
          return (
            <button
              key={c.value}
              onClick={() => setCat(c.value)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                active ? "bg-emerald text-white" : "bg-black/[0.04] text-muted hover:text-deepink"
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        {list.map(({ market: m, index }) => {
          const lm = overlay(live, index);
          return (
            <MarketCard
              key={m.id}
              market={m}
              live={lm}
              onStake={(side) => setTicket({ market: m, live: lm, side })}
            />
          );
        })}
        {list.length === 0 && (
          <p className="text-sm text-muted py-8 text-center">No markets in this category yet.</p>
        )}
      </div>

      {ticket && (
        <StakeSheet
          market={ticket.market}
          side={ticket.side}
          prices={displayPrices(ticket.market, ticket.live)}
          onClose={() => setTicket(null)}
        />
      )}
    </div>
  );
}
