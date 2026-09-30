"use client";

// The balance hero number. Shows the CUMULATIVE value of every stablecoin the
// wallet holds across all supported chains, converted to the user's own currency
// (dynamic — USD shows in USDC terms, a naira user sees ₦, etc.), with a stylish
// per-chain / per-token breakdown. Real on-chain amounts; the single-denomination
// total uses indicative FX. No wallet -> a clean zero in the user's currency.

import { useEffect, useState } from "react";
import { ChevronDown, Eye, EyeOff } from "@/components/icons";
import { useWallet } from "@pesarc/sdk/wallet/WalletProvider";
import { useSmartWallet } from "@pesarc/sdk/wallet/smartWallet";
import { useSolanaSigner } from "@pesarc/sdk/wallet/solana";
import { useActiveEvmChain } from "@pesarc/sdk/chain/activeChain";
import { getActiveChainKey } from "@pesarc/sdk/chain/registry";
import { usePrefs } from "@pesarc/sdk/prefs";
import { formatMoney, formatMoneyCompact, formatAmountCompact, CURRENCIES } from "@pesarc/sdk/money";
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

export function BalanceHero() {
  const { mode, authenticated } = useWallet();
  const smart = useSmartWallet();
  const solana = useSolanaSigner();
  const { setChainKey } = useActiveEvmChain();
  const { sendCurrency } = usePrefs();
  const [data, setData] = useState<AggregatedBalance | null>(null);
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [chainFilter, setChainFilter] = useState<string>("all");
  const [tokenFilter, setTokenFilter] = useState<string>("all");

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

        // Default the network to the EVM chain that actually holds funds — once,
        // and only if the user hasn't already picked a network this session.
        if (!autoNetworkDone && !getActiveChainKey()) {
          const byChain = new Map<string, number>();
          for (const h of evm.holdings)
            byChain.set(h.chainKey, (byChain.get(h.chainKey) ?? 0) + h.valueInDenom);
          const richest = [...byChain.entries()].sort((a, b) => b[1] - a[1])[0];
          if (richest && richest[1] > 0) {
            autoNetworkDone = true;
            setChainKey(richest[0]);
          }
        }
      })
      .catch(() => active && setData(null));
    return () => {
      active = false;
    };
  }, [live, smart.address, solAddr, sendCurrency, setChainKey]);

  const total = data?.total ?? 0;
  const holdings = data?.holdings ?? [];
  const chains = Array.from(new Set(holdings.map((h) => h.chainKey)));

  return (
    <div>
      <div className="flex items-center gap-3 mb-2.5">
        <div className="text-5xl font-extrabold tracking-tight numerals">
          {hidden ? "••••••" : formatMoneyCompact(total, sendCurrency)}
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
          <button
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-white/70 hover:text-white transition-colors"
            aria-expanded={open}
          >
            {holdings.length} {holdings.length === 1 ? "token" : "tokens"} across {chains.length}{" "}
            {chains.length === 1 ? "chain" : "chains"}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>

          {open && (
            <div className="mt-3 space-y-2">
              {/* Filter by chain + token. Chips only show when there's more than
                  one option, so a single-chain wallet stays clean. */}
              {(() => {
                const chainOpts = Array.from(
                  new Map(holdings.map((h) => [h.chainKey, shortChain(h.chainLabel)])).entries(),
                );
                const tokenOpts = Array.from(new Set(holdings.map((h) => h.symbol)));
                const chip = (active: boolean) =>
                  `px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors ${
                    active ? "bg-white text-harbor" : "bg-white/10 text-white/70 hover:bg-white/20"
                  }`;
                return (
                  <>
                    {chainOpts.length > 1 && (
                      <div className="flex flex-wrap gap-1.5 pb-1">
                        <button className={chip(chainFilter === "all")} onClick={() => setChainFilter("all")}>
                          All chains
                        </button>
                        {chainOpts.map(([key, label]) => (
                          <button key={key} className={chip(chainFilter === key)} onClick={() => setChainFilter(key)}>
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                    {tokenOpts.length > 1 && (
                      <div className="flex flex-wrap gap-1.5 pb-1">
                        <button className={chip(tokenFilter === "all")} onClick={() => setTokenFilter("all")}>
                          All tokens
                        </button>
                        {tokenOpts.map((sym) => (
                          <button key={sym} className={chip(tokenFilter === sym)} onClick={() => setTokenFilter(sym)}>
                            {sym}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
              {holdings
                .filter(
                  (h) =>
                    (chainFilter === "all" || h.chainKey === chainFilter) &&
                    (tokenFilter === "all" || h.symbol === tokenFilter),
                )
                .map((h) => {
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
                      <div className="text-[11px] text-white/50">{shortChain(h.chainLabel)}</div>
                    </div>
                    <div className="text-[12px] font-semibold text-white/80 numerals shrink-0">
                      ≈ {hidden ? "••••" : formatMoneyCompact(h.valueInDenom, sendCurrency)}
                    </div>
                  </div>
                );
              })}
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
