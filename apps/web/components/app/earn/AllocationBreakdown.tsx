"use client";

// "Where your money is working" — reads the live CorridorVault and shows how the
// pooled deposits are split: idle (ready to withdraw), working in each market
// (strategy adapter), and any settlement inventory. Read-only; the operator moves
// funds with scripts/vault-allocate.ts. Hidden until a vault has real strategies
// or deployment to show, so it never renders an empty shell.

import { useEffect, useState } from "react";
import { chainByKey } from "@pesarc/sdk/chain/registry";
import { fetchVaultAllocation, type VaultAllocation } from "@pesarc/sdk/chain/vault-read";
import { Card } from "@/components/app/ui";

const usd = (n: number) => "$" + n.toLocaleString(undefined, { maximumFractionDigits: 2 });
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export default function AllocationBreakdown({ vault, chainKey }: { vault: `0x${string}`; chainKey: string }) {
  const [a, setA] = useState<VaultAllocation | null>(null);
  useEffect(() => {
    const cfg = chainByKey(chainKey);
    if (!cfg) return;
    let ok = true;
    fetchVaultAllocation(cfg, vault).then((r) => ok && setA(r));
    return () => {
      ok = false;
    };
  }, [vault, chainKey]);

  if (!a || a.tvl <= 0) return null;
  const working = a.strategies.reduce((s, x) => s + x.assets, 0);
  // Nothing allocated yet and nothing lent out: the breakdown would just say
  // "100% idle" — not worth a card. Show it once money is actually at work.
  if (working <= 0 && a.deployedSettlement <= 0) return null;

  const rows: { label: string; value: number; color: string }[] = [
    ...a.strategies
      .filter((s) => s.assets > 0)
      .map((s, i) => ({ label: `Market ${i + 1} · ${short(s.address)}`, value: s.assets, color: ["#2e96ff", "#0254a5", "#50a7ff", "#13426f"][i % 4] })),
    ...(a.deployedSettlement > 0 ? [{ label: "Settlement inventory", value: a.deployedSettlement, color: "#C8A24B" }] : []),
    { label: "Idle (ready to withdraw)", value: a.idle, color: "#d0d5dd" },
  ];
  const total = rows.reduce((s, r) => s + r.value, 0) || 1;

  return (
    <Card className="p-4 mb-7 border-sky/30">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-sky">Where your money is working</span>
        <span className="text-xs text-slate">{usd(a.tvl)} pooled</span>
      </div>
      {/* Stacked bar */}
      <div className="flex h-3 w-full overflow-hidden rounded-full">
        {rows.map((r, i) => (
          <div key={i} style={{ width: `${(r.value / total) * 100}%`, background: r.color }} />
        ))}
      </div>
      <ul className="mt-3 space-y-1.5">
        {rows.map((r, i) => (
          <li key={i} className="flex items-center justify-between text-[13px]">
            <span className="flex items-center gap-2 text-slate">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.color }} />
              {r.label}
            </span>
            <span className="font-semibold text-ink numerals">{usd(r.value)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] leading-relaxed text-slate/80">
        Deposits pool in the vault, then the platform puts the deployable portion to work in these markets and keeps a
        buffer idle so you can withdraw anytime. Read live from the vault.
      </p>
    </Card>
  );
}
