"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

// PRD §9.7 — the one app ships in two UI tiers, a single toggle apart.
// Basic is the default and passes the Mum Test; Advanced is opt-in.
export type UIMode = "basic" | "advanced";

type Ctx = {
  mode: UIMode;
  setMode: (m: UIMode) => void;
  toggle: () => void;
  isAdvanced: boolean;
};

const UIModeContext = createContext<Ctx | null>(null);
const STORAGE_KEY = "luberty.ui-mode";

export function UIModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<UIMode>("basic");

  // Restore preference after mount (SSR-safe).
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "advanced" || saved === "basic") setModeState(saved);
    } catch {
      /* ignore */
    }
  }, []);

  const setMode = useCallback((m: UIMode) => {
    setModeState(m);
    try {
      window.localStorage.setItem(STORAGE_KEY, m);
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(
    () => setMode(mode === "basic" ? "advanced" : "basic"),
    [mode, setMode]
  );

  return (
    <UIModeContext.Provider
      value={{ mode, setMode, toggle, isAdvanced: mode === "advanced" }}
    >
      {children}
    </UIModeContext.Provider>
  );
}

export function useUIMode(): Ctx {
  const ctx = useContext(UIModeContext);
  if (!ctx) throw new Error("useUIMode must be used within UIModeProvider");
  return ctx;
}
