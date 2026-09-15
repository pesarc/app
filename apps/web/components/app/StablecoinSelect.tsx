"use client";

import { STABLECOINS } from "@pesarc/sdk/stablecoins";

/** A pill row for choosing which stablecoin funds an action (buy/stake/deposit). */
export function StablecoinSelect({
  value,
  onChange,
  label = "Pay with",
}: {
  value: string;
  onChange: (symbol: string) => void;
  label?: string;
}) {
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-widest text-slate mb-2">{label}</div>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {STABLECOINS.map((s) => {
          const active = s.symbol === value;
          return (
            <button
              key={s.symbol}
              onClick={() => onChange(s.symbol)}
              className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-bold transition-colors ${
                active
                  ? "bg-sky-tint/50 border-sky text-sky-deep"
                  : "bg-snow border-fog text-harbor hover:border-slate/50"
              }`}
            >
              <span>{s.flag}</span> {s.symbol}
            </button>
          );
        })}
      </div>
    </div>
  );
}
