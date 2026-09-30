"use client";

import { STABLECOINS } from "@pesarc/sdk/stablecoins";
import { currencyName } from "@pesarc/sdk/money";
import { Dropdown } from "./Dropdown";

/** A styled dropdown for choosing which stablecoin funds an action (buy/stake/deposit). */
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
      <Dropdown
        value={value}
        onChange={onChange}
        ariaLabel={label}
        options={STABLECOINS.map((s) => ({
          value: s.symbol,
          label: `${s.flag}  ${currencyName(s.currency)}`,
          hint: s.symbol,
        }))}
      />
    </div>
  );
}
