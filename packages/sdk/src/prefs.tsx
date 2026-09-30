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
import { countryByCode } from "./countries";

/** Identity verification (KYC) status. In demo mode this is a local,
 *  swap-in-a-provider stand-in; a real KYC provider (Persona/Sumsub/etc.) would
 *  set it from a verified webhook. Fiat payouts require "verified" in production. */
export type KycStatus = "unverified" | "pending" | "verified";

type Ctx = {
  /** The currency the user sends in by default. */
  sendCurrency: CurrencyCode;
  setSendCurrency: (c: CurrencyCode) => void;
  /** The user's country (ISO-2), chosen at onboarding. null until chosen. */
  country: string | null;
  setCountry: (code: string) => void;
  /** Identity verification status (KYC). */
  kyc: KycStatus;
  setKyc: (s: KycStatus) => void;
  /** The user's self-custody Algorand address (public only — the recovery phrase
   *  is shown once at creation and never stored by us). null until created. */
  algoAddress: string | null;
  setAlgoAddress: (addr: string | null) => void;
  /** True once persisted prefs have loaded (avoids onboarding flashes). */
  ready: boolean;
};

const PrefsContext = createContext<Ctx | null>(null);
const KEY = "pesarc.send-currency";
const KYC_KEY = "pesarc.kyc";
const COUNTRY_KEY = "pesarc.country";
const ALGO_KEY = "pesarc.algo.address";

export function PrefsProvider({ children }: { children: React.ReactNode }) {
  const [sendCurrency, setState] = useState<CurrencyCode>(ACCOUNT.currency);
  const [country, setCountryState] = useState<string | null>(null);
  const [kyc, setKycState] = useState<KycStatus>("unverified");
  const [algoAddress, setAlgoAddressState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(KEY);
      if (saved && (SEND_CURRENCIES as string[]).includes(saved)) {
        setState(saved as CurrencyCode);
      }
      const c = window.localStorage.getItem(COUNTRY_KEY);
      if (c) setCountryState(c);
      const k = window.localStorage.getItem(KYC_KEY);
      if (k === "verified" || k === "pending" || k === "unverified") setKycState(k);
      const a = window.localStorage.getItem(ALGO_KEY);
      if (a) setAlgoAddressState(a);
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  const setAlgoAddress = useCallback((addr: string | null) => {
    setAlgoAddressState(addr);
    try {
      if (addr) window.localStorage.setItem(ALGO_KEY, addr);
      else window.localStorage.removeItem(ALGO_KEY);
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

  // Picking a country also sets the default send currency (the user can still
  // change it, and held balances supersede it elsewhere).
  const setCountry = useCallback((code: string) => {
    setCountryState(code);
    try {
      window.localStorage.setItem(COUNTRY_KEY, code);
    } catch {
      /* ignore */
    }
    const cur = countryByCode(code)?.currency;
    if (cur && (SEND_CURRENCIES as string[]).includes(cur)) setSendCurrency(cur);
  }, [setSendCurrency]);

  const setKyc = useCallback((s: KycStatus) => {
    setKycState(s);
    try {
      window.localStorage.setItem(KYC_KEY, s);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <PrefsContext.Provider
      value={{ sendCurrency, setSendCurrency, country, setCountry, kyc, setKyc, algoAddress, setAlgoAddress, ready }}
    >
      {children}
    </PrefsContext.Provider>
  );
}

export function usePrefs(): Ctx {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("usePrefs must be used within PrefsProvider");
  return ctx;
}
