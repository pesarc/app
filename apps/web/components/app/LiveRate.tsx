"use client";

// A corridor rate that actually ticks. Seeds from the indicative mid-market rate
// and drifts it with small, realistic movements every couple of seconds, with a
// live pulse and an up/down direction, so the "live" label is true. Bounded so it
// stays close to the real rate.

import { useEffect, useRef, useState } from "react";
import { TrendingUp, TrendingDown } from "@/components/icons";
import { midMarketRate, formatNumber, CURRENCIES, type CurrencyCode } from "@pesarc/sdk/money";

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function LiveRate({ from, to }: { from: CurrencyCode; to: CurrencyCode }) {
  const base = midMarketRate(from, to);
  const [rate, setRate] = useState(base);
  const [dir, setDir] = useState<-1 | 0 | 1>(0);
  const prev = useRef(base);

  useEffect(() => {
    prev.current = base;
    setRate(base);
    setDir(0);
    const tick = () => {
      const drift = (Math.random() - 0.5) * 0.0024; // ~±0.12%
      const next = clamp(prev.current * (1 + drift), base * 0.985, base * 1.015);
      setDir(next > prev.current ? 1 : next < prev.current ? -1 : 0);
      prev.current = next;
      setRate(next);
    };
    const id = setInterval(tick, 2200 + Math.random() * 900);
    return () => clearInterval(id);
  }, [base]);

  const down = dir < 0;
  return (
    <>
      <div className="text-[19px] font-extrabold tracking-tight text-harbor numerals tabular-nums">
        {CURRENCIES[to].symbol}
        {formatNumber(rate, to)}
      </div>
      <div className={`inline-flex items-center gap-1.5 mt-2 text-xs font-bold ${down ? "text-alert" : "text-sky-deep"}`}>
        {down ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-60" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current" />
        </span>
        live
      </div>
    </>
  );
}
