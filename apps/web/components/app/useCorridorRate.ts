"use client";

// One honest corridor rate for the whole app. It reads the REAL realized-rate
// oracle for the active chain when that corridor has a seeded rate (live=true);
// otherwise it returns the indicative mid-market rate (live=false) so callers can
// label it "Indicative". No fabricated movement: the value is static until the
// corridor changes. Any read error degrades silently to the indicative rate.

import { useEffect, useState } from "react";
import { midMarketRate, type CurrencyCode } from "@pesarc/sdk/money";
import { useFxReady } from "@pesarc/sdk/fx-rates";
import { activeChain } from "@pesarc/sdk/chain/registry";
import { realizedRateOn, tokenByCode } from "@pesarc/sdk/chain/evm-settle";

export type CorridorRate = { rate: number; live: boolean; indicative: number };

export function useCorridorRate(from: CurrencyCode, to: CurrencyCode): CorridorRate {
  // Re-render when live FX rates load so the indicative recomputes to market.
  useFxReady();
  const indicative = midMarketRate(from, to);
  const [rate, setRate] = useState(indicative);
  const [live, setLive] = useState(false);

  useEffect(() => {
    setRate(indicative);
    setLive(false);
    let active = true;
    (async () => {
      try {
        const chain = activeChain();
        const f = tokenByCode(chain, from);
        const t = tokenByCode(chain, to);
        if (!f || !t) return;
        const r = await realizedRateOn(chain, f.address, t.address);
        if (active && r > 0) {
          setRate(r);
          setLive(true);
        }
      } catch {
        /* keep the indicative rate */
      }
    })();
    return () => {
      active = false;
    };
  }, [from, to, indicative]);

  return { rate, live, indicative };
}
