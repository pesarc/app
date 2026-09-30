"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence } from "framer-motion";
import { Shield, Radio, Plus } from "@/components/icons";
import { MARKET_CATEGORIES, liveMarketToMarket, type Market, type MarketKind } from "@pesarc/sdk/markets";
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
import { type Selection as StakeSelection } from "./display";
import { Pagination, usePaged } from "@/components/app/Pagination";
import ChainSelector from "@/components/app/ChainSelector";
import { useActiveEvmChain } from "@pesarc/sdk/chain/activeChain";
import { Stagger, StaggerItem } from "@/components/motion";

const PER_PAGE = 4;

type Selection = VenueKind | "all";

export default function MarketsView() {
  const smart = useSmartWallet();
  const solanaSigner = useSolanaSigner();

  const [cat, setCat] = useState<MarketKind | "all">("all");
  const [ticket, setTicket] = useState<{
    market: Market;
    live?: LiveMarket;
    selection: StakeSelection;
    venueKind: VenueKind;
    marketId: number;
  } | null>(null);

  // Re-derive venues + re-fetch live markets when the active EVM chain switches.
  const { chainKey } = useActiveEvmChain();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const venues = useMemo(() => availableVenues(), [chainKey]);
  const [selected, setSelected] = useState<Selection>(() => activeVenue().kind);
  const [liveByVenue, setLiveByVenue] = useState<Record<string, LiveMarket[] | null>>({});
  const [claimingKey, setClaimingKey] = useState<string | null>(null);
  // Catalog from the admin store only — no mock seed. Admin-created markets (and
  // their on-chain live overlay) show up here; empty until real markets exist.
  const [catalog, setCatalog] = useState<Market[]>([]);

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

  const cards = useMemo(() => {
    type Card = {
      key: string;
      market: Market;
      index: number;
      venueKind: VenueKind;
      venueLabel?: string;
      live?: LiveMarket;
      marketId: number;
    };
    const out: Card[] = [];
    for (const v of venuesInScope) {
      const label = venuesInScope.length > 1 ? v.label : undefined;
      const lives = liveByVenue[v.kind];
      if (lives && lives.length) {
        // Live-first: real on-chain markets rendered directly (need question text).
        for (const lm of lives) {
          if (!lm.question) continue;
          const market = liveMarketToMarket(lm);
          if (cat !== "all" && market.kind !== cat) continue;
          out.push({
            key: `${v.kind}-live-${lm.id}`,
            market,
            index: lm.id,
            venueKind: v.kind,
            venueLabel: label,
            live: lm,
            marketId: lm.id,
          });
        }
      } else {
        // Admin/off-chain catalog fallback (empty until markets are proposed).
        const filtered = cat === "all" ? catalog : catalog.filter((m) => m.kind === cat);
        for (const m of filtered) {
          const index = catalog.indexOf(m);
          out.push({
            key: `${v.kind}-${m.id}`,
            market: m,
            index,
            venueKind: v.kind,
            venueLabel: label,
            live: undefined,
            marketId: index,
          });
        }
      }
    }
    return out;
  }, [venuesInScope, liveByVenue, catalog, cat]);

  const paged = usePaged(cards, PER_PAGE, `${cat}|${selected}`);

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
          {!isLive && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.05] text-slate text-[11px] font-bold px-2.5 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-slate" /> Indicative prices
            </span>
          )}
          <Link
            href="/markets/propose"
            className="ml-auto shrink-0 inline-flex items-center gap-1.5 rounded-pill bg-sky text-white text-[13px] font-bold px-3.5 py-2 shadow-pop-sm hover:-translate-y-0.5 transition-transform"
          >
            <Plus className="w-4 h-4" /> Propose
          </Link>
        </div>
        <p className="text-sm font-medium text-slate mt-1.5 leading-relaxed">
          Take a view on elections, football, prices and world events. Stake and
          settle in your own currency, with no fees.
        </p>

        <ChainSelector className="mt-3.5" />

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
          <div className="text-[15px] font-extrabold mb-0.5">Always a price to trade.</div>
          <div className="text-[13px] font-medium text-white/70 leading-relaxed">
            Every market is backed by Pesarc&apos;s own on-chain liquidity, so you can
            get in or out any time. Outcomes resolve on-chain, and you stake and
            cash out in your own currency.
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
        {paged.items.map((card) => (
          <StaggerItem key={card.key} pop>
            <MarketCard
              market={card.market}
              live={card.live}
              venueLabel={card.venueLabel}
              claiming={claimingKey === card.key}
              onClaim={() => handleClaim(card.venueKind, card.marketId, card.key)}
              onStake={(selection) =>
                setTicket({
                  market: card.market,
                  live: card.live,
                  selection,
                  venueKind: card.venueKind,
                  marketId: card.marketId,
                })
              }
            />
          </StaggerItem>
        ))}
        {cards.length === 0 && (
          <div className="py-12 text-center lg:col-span-2">
            <div className="text-[15px] font-bold text-harbor">No live markets yet</div>
            <p className="text-[13px] text-slate mt-1 max-w-[280px] mx-auto">
              Markets appear here once they are live on-chain. Want one? Propose it
              and we&apos;ll list it.
            </p>
            <Link
              href="/markets/propose"
              className="inline-flex items-center gap-1.5 rounded-pill bg-sky text-white text-[13px] font-bold px-4 py-2 mt-4 shadow-pop-sm hover:-translate-y-0.5 transition-transform"
            >
              <Plus className="w-4 h-4" /> Propose a market
            </Link>
          </div>
        )}
      </Stagger>
      <Pagination page={paged.page} pageCount={paged.pageCount} onChange={paged.setPage} />

      <AnimatePresence>
        {ticket && (
          <StakeSheet
            key="stake-sheet"
            market={ticket.market}
            marketId={ticket.marketId}
            venueKind={ticket.venueKind}
            selection={ticket.selection}
            live={ticket.live}
            onClose={() => setTicket(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
