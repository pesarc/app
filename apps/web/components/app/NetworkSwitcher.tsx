"use client";

// A MetaMask-style network picker: shows the active network and lets the user
// switch which network (and therefore which on-chain balance) they're looking
// at. Backed by the app-wide unified network state — every EVM chain PLUS
// Solana — so switching re-points reads and the smart wallet, and selecting
// Solana flips the flows to their demo/SVM path.
import { useState } from "react";
import { ChevronDown, Check } from "@/components/icons";
import { useActiveNetwork } from "@pesarc/sdk/chain/activeNetwork";

// Brand-ish dot per chain so the list reads at a glance.
const DOT: Record<string, string> = {
  ethereum: "#8AA0FF",
  base: "#4F86FF",
  arc: "#3AA0FF",
  solana: "#14F195",
  celo: "#FBCC5C",
  arbitrum: "#5AB6F5",
  optimism: "#FF6B6B",
  polygon: "#A98BFF",
};
function dotFor(key: string): string {
  const base = key.split("-")[0];
  return DOT[base] ?? "#3AA0FF";
}

export default function NetworkSwitcher({ className = "" }: { className?: string }) {
  const { networks, active: current, setNetwork } = useActiveNetwork();
  const [open, setOpen] = useState(false);

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-full border border-fog bg-snow px-3 py-1.5 text-[13px] font-bold text-harbor hover:border-slate/40 transition-colors"
      >
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: dotFor(current.key) }} />
        {current.label}
        <ChevronDown className={`w-3.5 h-3.5 text-slate transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="listbox"
            className="absolute right-0 mt-2 z-20 w-60 rounded-2xl border border-fog bg-snow shadow-pop-sm p-1.5 max-h-72 overflow-auto"
          >
            <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate">Network</p>
            {networks.map((c) => {
              const active = c.key === current.key;
              return (
                <button
                  key={c.key}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    setNetwork(c.key);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors ${
                    active ? "bg-sky-tint/40" : "hover:bg-cream"
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: dotFor(c.key) }} />
                  <span className="flex-1 text-[14px] font-semibold text-harbor">{c.label}</span>
                  {c.testnet && (
                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate">test</span>
                  )}
                  {active && <Check className="w-4 h-4 text-sky shrink-0" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
