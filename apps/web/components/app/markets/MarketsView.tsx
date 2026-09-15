"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Shield, Radio } from "lucide-react";
import { MARKETS, MARKET_CATEGORIES, type Market, type MarketKind } from "@pesarc/sdk/markets";
import {
  fetchLiveMarketsFor,
  availableVenues,
  activeVenue,
  type LiveMarket,
  type VenueKind,
} from "@pesarc/sdk/markets.venue";
import MarketCard from "./MarketCard";
import StakeSheet from "./StakeSheet";
import { overlay, displayPrices, type Side } from "./display";
import { Stagger, StaggerItem } from "@/components/motion";

export default function MarketsView() {
  const [cat, setCat] = useState<MarketKind | "all">("all");
  const [ticket, setTicket] = useState<{ market: Market; live?: LiveMarket; side: Side } | null>(
    null
  );
  const [live, setLive] = useState<LiveMarket[] | null>(null);

  const venues = useMemo(() => availableVenues(), []);
  const [venueKind, setVenueKind] = useState<VenueKind>(() => activeVenue().kind);
  const venue = venues.find((v) => v.kind === venueKind) ?? venues[0];

  useEffect(() => {
    let alive = true;
    setLive(null);
    fetchLiveMarketsFor(venueKind).then((m) => {
      if (alive) setLive(m);
    });
    return () => {
      alive = false;
    };
  }, [venueKind]);

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
    <div className="mx-auto w-full max-w-md lg:max-w-3xl px-4 sm:px-6 py-6 md:py-10">
      <header className="mb-4">
        <div className="flex items-center gap-2.5">
          <h1 className="text-[27px] font-extrabold text-harbor tracking-tight">Markets</h1>
          {isLive && venue && (
            <a
              href={venue.explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-sky-tint/50 text-sky-deep text-[11px] font-extrabold px-2.5 py-1 hover:bg-sky-tint transition-colors"
              aria-label="View the prediction market on the block explorer"
            >
              <Radio className="w-3 h-3" /> Live · {venue.label}
            </a>
          )}
        </div>
        <p className="text-sm font-medium text-slate mt-1.5 leading-relaxed">
          Hedge your currency or take a view — settled in local money, never a dollar in the
          path.
        </p>

        {/* Venue switcher — one product, two homes (EVM ⇄ Solana) */}
        {venues.length > 1 && (
          <div className="inline-flex items-center gap-1 rounded-full bg-black/[0.04] p-1 mt-3.5">
            {venues.map((v) => {
              const active = v.kind === venueKind;
              return (
                <button
                  key={v.kind}
                  onClick={() => setVenueKind(v.kind)}
                  className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition-colors ${
                    active ? "bg-snow text-harbor shadow-card-flat" : "text-slate hover:text-harbor"
                  }`}
                >
                  {v.label}
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* Hedge explainer — the wedge, in a navy block. */}
      <div className="flex gap-3.5 rounded-card bg-harbor text-white p-[18px] mb-5 shadow-[rgba(19,66,111,0.28)_0px_8px_0px_0px]">
        <span className="w-10 h-10 rounded-full bg-sky/20 flex items-center justify-center text-sky-tint shrink-0">
          <Shield className="w-5 h-5" />
        </span>
        <div>
          <div className="text-[15px] font-extrabold mb-0.5">A hedge, not a bet.</div>
          <div className="text-[13px] font-medium text-white/70 leading-relaxed">
            Markets resolve from Pesarc&apos;s own realized rate. Back the side that offsets
            your real-world risk — you&apos;re insured, in your own currency.
          </div>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 mb-4 -mx-4 sm:-mx-6 px-4 sm:px-6">
        {MARKET_CATEGORIES.map((c) => {
          const active = c.value === cat;
          return (
            <button
              key={c.value}
              onClick={() => setCat(c.value)}
              className={`shrink-0 rounded-full px-[18px] py-2 text-[13.5px] font-bold transition-colors ${
                active
                  ? "bg-harbor text-white"
                  : "bg-snow border border-fog text-slate hover:text-harbor"
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      <Stagger className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        {list.map(({ market: m, index }) => {
          const lm = overlay(live, index);
          return (
            <StaggerItem key={m.id} pop>
              <MarketCard
                market={m}
                live={lm}
                onStake={(side) => setTicket({ market: m, live: lm, side })}
              />
            </StaggerItem>
          );
        })}
        {list.length === 0 && (
          <p className="text-sm text-slate py-8 text-center lg:col-span-2">
            No markets in this category yet.
          </p>
        )}
      </Stagger>

      <AnimatePresence>
        {ticket && (
          <StakeSheet
            key="stake-sheet"
            market={ticket.market}
            marketId={ticket.live?.id ?? MARKETS.indexOf(ticket.market)}
            venueKind={venueKind}
            side={ticket.side}
            prices={displayPrices(ticket.market, ticket.live)}
            onClose={() => setTicket(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
