"use client";

// In-session EVM chain switch. Switching re-points the app's active chain — the
// markets board reads it and the smart wallet re-initialises so staking targets
// the selected chain. Only shown when more than one EVM chain is configured.

import { Layers } from "lucide-react";
import { useActiveEvmChain } from "@pesarc/sdk/chain/activeChain";

export default function ChainSelector({ className = "" }: { className?: string }) {
  const { chainKey, chains, setChainKey } = useActiveEvmChain();
  if (chains.length <= 1) return null;

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-slate">
        <Layers className="w-3 h-3" /> Chain
      </span>
      <div className="inline-flex items-center gap-1 rounded-full bg-black/[0.04] p-1">
        {chains.map((c) => {
          const active = c.key === chainKey;
          return (
            <button
              key={c.key}
              onClick={() => setChainKey(c.key)}
              className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition-colors ${
                active ? "bg-snow text-harbor shadow-card-flat" : "text-slate hover:text-harbor"
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
