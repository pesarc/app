"use client";

// User preferences that reduce friction — chiefly the default currency the
// Send flow starts in, so the sender never has to pick it every time.
// Persisted locally (SSR-safe), same pattern as UIMode.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { ACCOUNT } from "./account";
import { SEND_CURRENCIES, type CurrencyCode } from "./money";

/** Identity verification (KYC) status. In demo mode this is a local,
 *  swap-in-a-provider stand-in; a real KYC provider (Persona/Sumsub/etc.) would
 *  set it from a verified webhook. Fiat payouts require "verified" in production. */
export type KycStatus = "unverified" | "pending" | "verified";

type Ctx = {
  /** The currency the user sends in by default. */
  sendCurrency: CurrencyCode;
  setSendCurrency: (c: CurrencyCode) => void;
  /** Identity verification status (KYC). */
  kyc: KycStatus;
  setKyc: (s: KycStatus) => void;
};

const PrefsContext = createContext<Ctx | null>(null);
const KEY = "pesarc.send-currency";
const KYC_KEY = "pesarc.kyc";

export function PrefsProvider({ children }: { children: React.ReactNode }) {
  const [sendCurrency, setState] = useState<CurrencyCode>(ACCOUNT.currency);
  const [kyc, setKycState] = useState<KycStatus>("unverified");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(KEY);
      if (saved && (SEND_CURRENCIES as string[]).includes(saved)) {
        setState(saved as CurrencyCode);
      }
      const k = window.localStorage.getItem(KYC_KEY);
      if (k === "verified" || k === "pending" || k === "unverified") setKycState(k);
    } catch {
      /* ignore */
    }
  }, []);

  const setSendCurrency = useCallback((c: CurrencyCode) => {
    setState(c);
    try {
      window.localStorage.setItem(KEY, c);
    } catch {
      /* ignore */
    }
  }, []);

  const setKyc = useCallback((s: KycStatus) => {
    setKycState(s);
    try {
      window.localStorage.setItem(KYC_KEY, s);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <PrefsContext.Provider value={{ sendCurrency, setSendCurrency, kyc, setKyc }}>
      {children}
    </PrefsContext.Provider>
  );
}

export function usePrefs(): Ctx {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("usePrefs must be used within PrefsProvider");
  return ctx;
}
