"use client";

// A corridor rate. It shows the REAL realized-rate-oracle rate when the corridor
// is live on the active chain (with a live pulse), otherwise the indicative
// mid-market rate clearly tagged "indicative". No fabricated movement or fake
// "live" pulse — the number only changes when the real rate does.

import { CURRENCIES, formatNumber, rateIsLiveFor, type CurrencyCode } from "@pesarc/sdk/money";
import { useCorridorRate } from "./useCorridorRate";

export function LiveRate({ from, to }: { from: CurrencyCode; to: CurrencyCode }) {
  const { rate, live } = useCorridorRate(from, to);

  return (
    <>
      <div className="text-[19px] font-extrabold tracking-tight text-harbor numerals tabular-nums">
        {CURRENCIES[to].symbol}
        {formatNumber(rate, to)}
      </div>
      {live ? (
        <div className="inline-flex items-center gap-1.5 mt-2 text-xs font-bold text-sky-deep">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-60" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current" />
          </span>
          live
        </div>
      ) : rateIsLiveFor(to) ? (
        <div className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold text-sky-deep">
          market
        </div>
      ) : (
        <div className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold text-slate">
          indicative
        </div>
      )}
    </>
  );
}
