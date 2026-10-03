"use client";

// The balance hero number. Shows the value of every stablecoin the wallet holds,
// converted to the user's own currency (dynamic — USD in USDC terms, ₦ for a
// naira user, etc.), with a per-chain / per-token breakdown. It defaults to LIVE
// (mainnet) money — real balances only — and a clean Filter icon lets you add
// testnet, or slice by chain and token. Real on-chain amounts; the single-
// denomination total uses indicative FX. No wallet -> a clean zero.

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Eye, EyeOff, Filter } from "@/components/icons";
import { useWallet } from "@pesarc/sdk/wallet/WalletProvider";
import { useSmartWallet } from "@pesarc/sdk/wallet/smartWallet";
import { useSolanaSigner } from "@pesarc/sdk/wallet/solana";
import { useActiveEvmChain } from "@pesarc/sdk/chain/activeChain";
import { getActiveChainKey } from "@pesarc/sdk/chain/registry";
import { usePrefs } from "@pesarc/sdk/prefs";
import { formatMoneyCompact, formatAmountCompact, CURRENCIES } from "@pesarc/sdk/money";
import {
  fetchAggregatedBalance,
  type AggregatedBalance,
} from "@pesarc/sdk/chain/aggregateBalance";
import { fetchSvmBalances } from "@pesarc/sdk/svm/balance";
import { chainLogoUrlForLabel } from "@/lib/chainLogos";

const shortChain = (label: string) =>
  label.replace(/\s*(mainnet|testnet|sepolia|devnet)\s*/gi, "").trim() || label;

// Auto-pick the default network once per load — only if the user hasn't chosen one.
let autoNetworkDone = false;

type Filters = { network: "all" | "mainnet" | "testnet"; chain: string; token: string };

// A dark-card-friendly filter: a round trigger on the navy hero, a light popover.
function FilterMenu({
  chains,
  tokens,
  hasBothNetworks,
  value,
  onChange,
}: {
  chains: { key: string; label: string; testnet: boolean }[];
  tokens: string[];
  hasBothNetworks: boolean;
  value: Filters;
  onChange: (f: Filters) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const active = value.network !== "mainnet" || value.chain !== "all" || value.token !== "all";
  const chip = (on: boolean) =>
    `px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors ${
      on ? "bg-harbor text-white" : "bg-black/[0.05] text-slate hover:bg-black/[0.08]"
    }`;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Filter balance"
        className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
          active ? "bg-white text-harbor" : "bg-white/10 text-white/70 hover:bg-white/20"
        }`}
      >
        <Filter className="w-4 h-4" />
        {active && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-sky" />}
      </button>
      {open && (
        <div className="animate-dropdown absolute right-0 mt-2 z-30 w-64 rounded-2xl border border-fog bg-snow shadow-pop-sm p-3 space-y-3">
          {hasBothNetworks && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate mb-1.5">Network</div>
              <div className="flex flex-wrap gap-1.5">
                {(["mainnet", "testnet", "all"] as const).map((n) => (
                  <button
                    key={n}
                    className={chip(value.network === n)}
                    onClick={() => onChange({ ...value, network: n, chain: "all", token: "all" })}
                  >
                    {n === "mainnet" ? "Live" : n === "testnet" ? "Testnet" : "All"}
                  </button>
                ))}
              </div>
            </div>
          )}
          {chains.length > 1 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate mb-1.5">Chain</div>
              <div className="flex flex-wrap gap-1.5">
                <button className={chip(value.chain === "all")} onClick={() => onChange({ ...value, chain: "all" })}>
                  All
                </button>
                {chains.map((c) => (
                  <button key={c.key} className={chip(value.chain === c.key)} onClick={() => onChange({ ...value, chain: c.key })}>
                    {shortChain(c.label)}
                    <span className={`ml-1 text-[9px] ${c.testnet ? "text-amber-500" : "text-emerald-500"}`}>
                      {c.testnet ? "test" : "live"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {tokens.length > 1 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate mb-1.5">Token</div>
              <div className="flex flex-wrap gap-1.5">
                <button className={chip(value.token === "all")} onClick={() => onChange({ ...value, token: "all" })}>
                  All
                </button>
                {tokens.map((t) => (
                  <button key={t} className={chip(value.token === t)} onClick={() => onChange({ ...value, token: t })}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function BalanceHero() {
  const { mode, authenticated } = useWallet();
  const smart = useSmartWallet();
  const solana = useSolanaSigner();
  const { setChainKey } = useActiveEvmChain();
  const { sendCurrency } = usePrefs();
  const [data, setData] = useState<AggregatedBalance | null>(null);
  // True once balances have been fetched at least once, so the hero shows a
  // skeleton (not a premature "$0.00 / No stablecoins") until real values load.
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  // Default to LIVE (mainnet) money; testnet is opt-in via the filter.
  const [filters, setFilters] = useState<Filters>({ network: "mainnet", chain: "all", token: "all" });

  const live = mode === "live" && authenticated && Boolean(smart.address);
  const solAddr = solana?.address ?? null;

  // Remember the user's hide-balance choice per device.
  useEffect(() => {
    try {
      setHidden(localStorage.getItem("pesarc.hideBalance") === "1");
    } catch {
      /* ignore */
    }
  }, []);
  const toggleHidden = () => {
    setHidden((h) => {
      const next = !h;
      try {
        localStorage.setItem("pesarc.hideBalance", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  useEffect(() => {
    if (!live || !smart.address) {
      setData(null);
      return;
    }
    let active = true;
    // EVM stablecoins across all chains + Solana devnet SPL stablecoins, merged.
    Promise.all([
      fetchAggregatedBalance(smart.address as `0x${string}`, sendCurrency),
      solAddr ? fetchSvmBalances(solAddr, sendCurrency, "testnet") : Promise.resolve([]),
    ])
      .then(([evm, svm]) => {
        if (!active) return;
        const holdings = [...evm.holdings, ...svm].sort((a, b) => b.valueInDenom - a.valueInDenom);
        const total = holdings.reduce((s, h) => s + h.valueInDenom, 0);
        setData({ denom: sendCurrency, total, holdings });
        setLoaded(true);

        // Default the network to the MAINNET EVM chain that actually holds funds
        // (fall back to any chain) — once, and only if the user hasn't picked one.
        if (!autoNetworkDone && !getActiveChainKey()) {
          const byChain = new Map<string, number>();
          for (const h of evm.holdings) {
            if (h.testnet) continue;
            byChain.set(h.chainKey, (byChain.get(h.chainKey) ?? 0) + h.valueInDenom);
          }
          if (byChain.size === 0)
            for (const h of evm.holdings)
              byChain.set(h.chainKey, (byChain.get(h.chainKey) ?? 0) + h.valueInDenom);
          const richest = [...byChain.entries()].sort((a, b) => b[1] - a[1])[0];
          if (richest && richest[1] > 0) {
            autoNetworkDone = true;
            setChainKey(richest[0]);
          }
        }
      })
      .catch(() => {
        if (!active) return;
        setData(null);
        setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [live, smart.address, solAddr, sendCurrency, setChainKey]);

  const holdings = data?.holdings ?? [];
  const hasBothNetworks = holdings.some((h) => h.testnet) && holdings.some((h) => !h.testnet);

  // Options reflect the chosen network, so "Live" only offers live chains.
  const inNetwork = holdings.filter(
    (h) => filters.network === "all" || (filters.network === "testnet" ? h.testnet : !h.testnet),
  );
  const chainOpts = Array.from(
    new Map(inNetwork.map((h) => [h.chainKey, { key: h.chainKey, label: h.chainLabel, testnet: h.testnet }])).values(),
  );
  const tokenOpts = Array.from(new Set(inNetwork.map((h) => h.symbol)));

  const filtered = inNetwork.filter(
    (h) =>
      (filters.chain === "all" || h.chainKey === filters.chain) &&
      (filters.token === "all" || h.symbol === filters.token),
  );
  const shownTotal = filtered.reduce((s, h) => s + h.valueInDenom, 0);
  const shownChains = new Set(filtered.map((h) => h.chainKey));

  // A mainnet-empty wallet that has testnet money: offer a one-tap reveal.
  const testnetOnly = filters.network === "mainnet" && filtered.length === 0 && holdings.some((h) => h.testnet);

  // Skeleton while the first balance read is in flight (light bars on the navy hero).
  if (live && !loaded) {
    return (
      <div aria-busy="true" aria-label="Loading balance">
        <div className="flex items-center gap-3 mb-2.5">
          <div className="h-12 w-52 rounded-xl bg-white/10 animate-pulse" />
        </div>
        <div className="h-4 w-40 rounded bg-white/10 animate-pulse" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-2.5">
        <div className="text-5xl font-extrabold tracking-tight numerals">
          {hidden ? "••••••" : formatMoneyCompact(shownTotal, sendCurrency)}
        </div>
        <button
          onClick={toggleHidden}
          aria-label={hidden ? "Show balance" : "Hide balance"}
          className="shrink-0 w-9 h-9 rounded-full text-white/60 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors"
        >
          {hidden ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
        </button>
      </div>

      {holdings.length > 0 ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => setOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-white/70 hover:text-white transition-colors"
              aria-expanded={open}
            >
              {filtered.length} {filtered.length === 1 ? "token" : "tokens"} across {shownChains.size}{" "}
              {shownChains.size === 1 ? "chain" : "chains"}
              {filters.network === "mainnet" && hasBothNetworks && <span className="text-white/40"> · Live</span>}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            <FilterMenu
              chains={chainOpts}
              tokens={tokenOpts}
              hasBothNetworks={hasBothNetworks}
              value={filters}
              onChange={setFilters}
            />
          </div>

          {open && (
            <div className="mt-3 space-y-2">
              {testnetOnly ? (
                <div className="rounded-2xl bg-white/[0.06] px-3 py-3 text-[12px] text-white/70">
                  No live balances yet. You have testnet funds —{" "}
                  <button
                    className="font-bold text-white underline underline-offset-2"
                    onClick={() => setFilters((f) => ({ ...f, network: "testnet", chain: "all", token: "all" }))}
                  >
                    show testnet
                  </button>
                  .
                </div>
              ) : (
                filtered.map((h) => {
                  const url = chainLogoUrlForLabel(h.chainLabel);
                  return (
                    <div
                      key={`${h.chainKey}-${h.symbol}`}
                      className="flex items-center gap-3 rounded-2xl bg-white/[0.06] px-3 py-2.5"
                    >
                      <span className="w-7 h-7 rounded-full bg-white flex items-center justify-center overflow-hidden shrink-0">
                        {url ? (
                          // eslint-disable-next-line @next/next/no-img-element -- tiny chain logo
                          <img src={url} alt="" width={18} height={18} style={{ objectFit: "contain" }} />
                        ) : null}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-bold text-white leading-tight">
                          {hidden ? "••••" : formatAmountCompact(h.amount)}{" "}
                          <span className="text-white/70 font-semibold">{h.symbol}</span>
                        </div>
                        <div className="text-[11px] text-white/50">
                          {shortChain(h.chainLabel)}
                          {h.testnet && <span className="ml-1 text-amber-300/80">testnet</span>}
                        </div>
                      </div>
                      <div className="text-[12px] font-semibold text-white/80 numerals shrink-0">
                        ≈ {hidden ? "••••" : formatMoneyCompact(h.valueInDenom, sendCurrency)}
                      </div>
                    </div>
                  );
                })
              )}
              <p className="text-[10px] text-white/40 px-1">
                Amounts are on-chain; the total uses indicative FX.
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="text-[12px] font-medium text-white/55">
          {live ? "No stablecoins yet — add money to get started." : `Your balance, in ${CURRENCIES[sendCurrency].name}.`}
        </div>
      )}
    </div>
  );
}
