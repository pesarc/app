"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Shield, Radio } from "lucide-react";
import { MARKETS, MARKET_CATEGORIES, type Market, type MarketKind } from "@pesarc/sdk/markets";
import { toMarket } from "@pesarc/sdk/catalog-map";
import {
  fetchLiveMarketsFor,
  availableVenues,
  activeVenue,
  type LiveMarket,
  type VenueKind,
} from "@pesarc/sdk/markets.venue";
import { activeChain } from "@pesarc/sdk/chain/registry";
import { evmClaim } from "@pesarc/sdk/market-write";
import { useSmartWallet } from "@pesarc/sdk/wallet/smartWallet";
import { useSolanaSigner } from "@pesarc/sdk/wallet/solana";
import MarketCard from "./MarketCard";
import StakeSheet from "./StakeSheet";
import { overlay, displayPrices, type Side } from "./display";
import { Stagger, StaggerItem } from "@/components/motion";

type Selection = VenueKind | "all";

export default function MarketsView() {
  const smart = useSmartWallet();
  const solanaSigner = useSolanaSigner();

  const [cat, setCat] = useState<MarketKind | "all">("all");
  const [ticket, setTicket] = useState<{
    market: Market;
    live?: LiveMarket;
    side: Side;
    venueKind: VenueKind;
    marketId: number;
  } | null>(null);

  const venues = useMemo(() => availableVenues(), []);
  const [selected, setSelected] = useState<Selection>(() => activeVenue().kind);
  const [liveByVenue, setLiveByVenue] = useState<Record<string, LiveMarket[] | null>>({});
  const [claimingKey, setClaimingKey] = useState<string | null>(null);
  // Catalog from the admin store (falls back to the static list), so
  // admin-created markets show up on the board.
  const [catalog, setCatalog] = useState<Market[]>(MARKETS);

  useEffect(() => {
    let alive = true;
    fetch("/api/catalog?kind=markets")
      .then((r) => r.json())
      .then((j) => {
        if (!alive || !j.ok) return;
        const mapped = (j.items as { data: Record<string, unknown> }[])
          .map((it, i) => toMarket(it.data, i))
          .filter(Boolean) as Market[];
        if (mapped.length) setCatalog(mapped);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const venuesInScope = useMemo(
    () => (selected === "all" ? venues : venues.filter((v) => v.kind === selected)),
    [selected, venues]
  );

  useEffect(() => {
    let alive = true;
    venuesInScope.forEach((v) => {
      fetchLiveMarketsFor(v.kind).then((m) => {
        if (alive) setLiveByVenue((prev) => ({ ...prev, [v.kind]: m }));
      });
    });
    return () => {
      alive = false;
    };
  }, [venuesInScope]);

  const isLive = venuesInScope.some((v) => (liveByVenue[v.kind]?.length ?? 0) > 0);
  const soleVenue = venuesInScope.length === 1 ? venuesInScope[0] : null;

  const filtered = useMemo(
    () => (cat === "all" ? catalog : catalog.filter((m) => m.kind === cat)),
    [cat, catalog]
  );

  const cards = useMemo(
    () =>
      venuesInScope.flatMap((v) =>
        filtered.map((m) => {
          const index = catalog.indexOf(m);
          const live = overlay(liveByVenue[v.kind] ?? null, index) ?? undefined;
          return {
            key: `${v.kind}-${m.id}`,
            market: m,
            index,
            venueKind: v.kind,
            venueLabel: venuesInScope.length > 1 ? v.label : undefined,
            live,
            marketId: live?.id ?? index,
          };
        })
      ),
    [venuesInScope, filtered, liveByVenue, catalog]
  );

  async function handleClaim(venueKind: VenueKind, marketId: number, key: string) {
    setClaimingKey(key);
    try {
      if (venueKind === "evm" && smart.ready) {
        const chain = activeChain();
        if (chain.predictionMarket) {
          await evmClaim(smart, { predictionMarket: chain.predictionMarket as `0x${string}`, marketId });
        }
      } else if (venueKind === "svm" && solanaSigner) {
        const { svmClaim } = await import("@pesarc/sdk/svm/write");
        await svmClaim(solanaSigner, { marketId });
      }
      const m = await fetchLiveMarketsFor(venueKind);
      setLiveByVenue((prev) => ({ ...prev, [venueKind]: m }));
    } catch {
      /* never hard-fail */
    }
    setClaimingKey(null);
  }

  const options: { value: Selection; label: string }[] = [
    ...venues.map((v) => ({ value: v.kind as Selection, label: v.label })),
    ...(venues.length > 1 ? [{ value: "all" as Selection, label: "All" }] : []),
  ];

  return (
    <div className="mx-auto w-full max-w-md lg:max-w-3xl px-4 sm:px-6 py-6 md:py-10">
      <header className="mb-4">
        <div className="flex items-center gap-2.5">
          <h1 className="text-[27px] font-extrabold text-harbor tracking-tight">Markets</h1>
          {isLive && soleVenue && (
            <a
              href={soleVenue.explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-sky-tint/50 text-sky-deep text-[11px] font-extrabold px-2.5 py-1 hover:bg-sky-tint transition-colors"
              aria-label="View the prediction market on the block explorer"
            >
              <Radio className="w-3 h-3" /> Live · {soleVenue.label}
            </a>
          )}
          {isLive && !soleVenue && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-tint/50 text-sky-deep text-[11px] font-extrabold px-2.5 py-1">
              <Radio className="w-3 h-3" /> Live · all venues
            </span>
          )}
        </div>
        <p className="text-sm font-medium text-slate mt-1.5 leading-relaxed">
          Hedge your currency or take a view — settled in local money, never a dollar in the
          path.
        </p>

        {/* Venue switcher — one product, two homes (EVM ⇄ Solana), or All merged */}
        {options.length > 1 && (
          <div className="inline-flex items-center gap-1 rounded-full bg-black/[0.04] p-1 mt-3.5">
            {options.map((o) => {
              const active = o.value === selected;
              return (
                <button
                  key={o.value}
                  onClick={() => setSelected(o.value)}
                  className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition-colors ${
                    active ? "bg-snow text-harbor shadow-card-flat" : "text-slate hover:text-harbor"
                  }`}
                >
                  {o.label}
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
        {cards.map((card) => (
          <StaggerItem key={card.key} pop>
            <MarketCard
              market={card.market}
              live={card.live}
              venueLabel={card.venueLabel}
              claiming={claimingKey === card.key}
              onClaim={() => handleClaim(card.venueKind, card.marketId, card.key)}
              onStake={(side) =>
                setTicket({
                  market: card.market,
                  live: card.live,
                  side,
                  venueKind: card.venueKind,
                  marketId: card.marketId,
                })
              }
            />
          </StaggerItem>
        ))}
        {cards.length === 0 && (
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
            marketId={ticket.marketId}
            venueKind={ticket.venueKind}
            side={ticket.side}
            prices={displayPrices(ticket.market, ticket.live)}
            onClose={() => setTicket(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
