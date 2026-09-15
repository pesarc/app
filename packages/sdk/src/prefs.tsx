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

type Ctx = {
  /** The currency the user sends in by default. */
  sendCurrency: CurrencyCode;
  setSendCurrency: (c: CurrencyCode) => void;
};

const PrefsContext = createContext<Ctx | null>(null);
const KEY = "pesarc.send-currency";

export function PrefsProvider({ children }: { children: React.ReactNode }) {
  const [sendCurrency, setState] = useState<CurrencyCode>(ACCOUNT.currency);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(KEY);
      if (saved && (SEND_CURRENCIES as string[]).includes(saved)) {
        setState(saved as CurrencyCode);
      }
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

  return (
    <PrefsContext.Provider value={{ sendCurrency, setSendCurrency }}>
      {children}
    </PrefsContext.Provider>
  );
}

export function usePrefs(): Ctx {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("usePrefs must be used within PrefsProvider");
  return ctx;
}
