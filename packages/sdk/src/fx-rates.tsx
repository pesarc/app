"use client";

// Loads live mid-market FX rates from /api/fx into money.ts (setLiveRates) so
// every rate the app shows is current market, not a hardcoded constant. Exposes
// a version counter via context: it bumps when rates arrive, so memoised
// consumers (e.g. the send quote) can list it as a dep and recompute. Refreshes
// every 10 minutes. Fails soft — on any error the app keeps the static rates.

import { createContext, useContext, useEffect, useState } from "react";
import { setLiveRates, type CurrencyCode } from "./money";

type FxResponse = { live: boolean; usdPer: Partial<Record<CurrencyCode, number>> };

const FxVersionContext = createContext(0);

/** A counter that increments each time live rates are (re)loaded. */
export function useFxReady(): number {
  return useContext(FxVersionContext);
}

const REFRESH_MS = 10 * 60 * 1000;

export function FxRatesProvider({ children }: { children: React.ReactNode }) {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("/api/fx");
        if (!r.ok) return;
        const data = (await r.json()) as FxResponse;
        if (!alive || !data.usdPer) return;
        setLiveRates(data.usdPer);
        setVersion((v) => v + 1);
      } catch {
        /* keep static rates */
      }
    };
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return <FxVersionContext.Provider value={version}>{children}</FxVersionContext.Provider>;
}
