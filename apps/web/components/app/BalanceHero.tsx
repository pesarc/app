"use client";

// The balance hero number. Shows the CUMULATIVE value of every stablecoin the
// wallet holds across all supported chains, converted to the user's own currency
// (dynamic — USD shows in USDC terms, a naira user sees ₦, etc.), with a stylish
// per-chain / per-token breakdown. Real on-chain amounts; the single-denomination
// total uses indicative FX. No wallet -> a clean zero in the user's currency.

import { useEffect, useState } from "react";
import { ChevronDown } from "@/components/icons";
import { useWallet } from "@pesarc/sdk/wallet/WalletProvider";
import { useSmartWallet } from "@pesarc/sdk/wallet/smartWallet";
import { useSolanaSigner } from "@pesarc/sdk/wallet/solana";
import { useActiveEvmChain } from "@pesarc/sdk/chain/activeChain";
import { getActiveChainKey } from "@pesarc/sdk/chain/registry";
import { usePrefs } from "@pesarc/sdk/prefs";
import { formatMoney, CURRENCIES } from "@pesarc/sdk/money";
import {
  fetchAggregatedBalance,
  type AggregatedBalance,
} from "@pesarc/sdk/chain/aggregateBalance";
import { fetchSvmBalances } from "@pesarc/sdk/svm/balance";
import { chainLogoUrl } from "@/lib/chainLogos";

function logoKey(label: string): string {
  const l = label.toLowerCase();
  if (l.includes("arbitrum")) return "Arbitrum";
  if (l.includes("base")) return "Base";
  if (l.includes("optimism") || /\bop\b/.test(l)) return "Optimism";
  if (l.includes("polygon")) return "Polygon";
  if (l.includes("celo")) return "Celo";
  if (l.includes("arc")) return "Arc";
  if (l.includes("solana")) return "Solana";
  if (l.includes("ethereum") || l.includes("sepolia")) return "Ethereum";
  return "";
}

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

  const live = mode === "live" && authenticated && Boolean(smart.address);
  const solAddr = solana?.address ?? null;

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
      <div className="text-5xl font-extrabold tracking-tight numerals mb-2.5">
        {formatMoney(total, sendCurrency)}
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
              {holdings.map((h) => {
                const url = chainLogoUrl(logoKey(h.chainLabel));
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
                        {h.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
                        <span className="text-white/70 font-semibold">{h.symbol}</span>
                      </div>
                      <div className="text-[11px] text-white/50">{shortChain(h.chainLabel)}</div>
                    </div>
                    <div className="text-[12px] font-semibold text-white/80 numerals shrink-0">
                      ≈ {formatMoney(h.valueInDenom, sendCurrency)}
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
