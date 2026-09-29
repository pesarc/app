"use client";

// Per-currency holdings chips on the balance hero. Reads the REAL on-chain
// balance of each settlement stablecoin for the connected wallet and shows a chip
// only for currencies actually held (amount > 0). No wallet / nothing held ->
// renders nothing, so the hero never shows illustrative balances.

import { useLiveBalance } from "@pesarc/sdk/chain/useLiveBalance";

const FLAG: Record<string, string> = { NGN: "🇳🇬", KES: "🇰🇪", GHS: "🇬🇭", USD: "💵" };

function fmt(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 })}m`;
  if (amount >= 10_000) return `${(amount / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })}k`;
  return amount.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function LiveHoldings() {
  // Hooks called unconditionally at the top level (rules-of-hooks), one per
  // settlement currency we surface as a chip.
  const ngn = useLiveBalance("NGN");
  const kes = useLiveBalance("KES");
  const ghs = useLiveBalance("GHS");
  const balances = [
    { code: "NGN", bal: ngn },
    { code: "KES", bal: kes },
    { code: "GHS", bal: ghs },
  ];
  const held = balances.filter((b) => b.bal.available && (b.bal.amount ?? 0) > 0);

  if (held.length === 0) return null;

  return (
    <div className="flex gap-2 mt-4">
      {held.map(({ code, bal }) => (
        <div key={code} className="flex-1 rounded-2xl bg-white/[0.08] px-3 py-2.5">
          <div className="text-[11px] font-semibold text-white/60 mb-0.5">
            {FLAG[code] ?? "🌍"} {bal.symbol}
          </div>
          <div className="text-[15px] font-bold numerals">{fmt(bal.amount ?? 0)}</div>
        </div>
      ))}
    </div>
  );
}
