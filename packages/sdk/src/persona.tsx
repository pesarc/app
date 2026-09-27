"use client";

// The persona chosen once at onboarding decides which experience a user lands in
// and sees. Four audiences, one app:
//   • retail    — the everyday Mum-Test experience (send, hold, pay, markets).
//   • business  — collections, supplier settlement, an API. Retail never sees it.
//   • provider  — liquidity providers / savers; lands in Earn.
//   • advanced  — power users; lands home with the Advanced UI tier on.
// Stored locally (swap for a server pref later); `ready` gates the onboarding
// picker so it doesn't flash before the saved choice is read.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type Persona = "retail" | "business" | "provider" | "advanced";

const PERSONAS: readonly Persona[] = ["retail", "business", "provider", "advanced"];

/** Where each persona lands after onboarding (and "go home"). */
export function homeFor(persona: Persona | null): string {
  switch (persona) {
    case "business":
      return "/business";
    case "provider":
      return "/earn";
    default:
      return "/home";
  }
}

type Ctx = {
  persona: Persona | null;
  ready: boolean;
  setPersona: (p: Persona) => void;
  /** Business surfaces (and the API) are shown only to this persona. */
  isBusiness: boolean;
  /** Liquidity providers / savers. */
  isProvider: boolean;
  /** Chose the advanced audience at onboarding (distinct from the UI-mode toggle). */
  isAdvancedUser: boolean;
};

const PersonaContext = createContext<Ctx | null>(null);
const KEY = "pesarc.persona";

export function PersonaProvider({ children }: { children: React.ReactNode }) {
  const [persona, setState] = useState<Persona | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(KEY) as Persona | null;
      if (saved && PERSONAS.includes(saved)) setState(saved);
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  const setPersona = useCallback((p: Persona) => {
    setState(p);
    try {
      window.localStorage.setItem(KEY, p);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <PersonaContext.Provider
      value={{
        persona,
        ready,
        setPersona,
        isBusiness: persona === "business",
        isProvider: persona === "provider",
        isAdvancedUser: persona === "advanced",
      }}
    >
      {children}
    </PersonaContext.Provider>
  );
}

export function usePersona(): Ctx {
  const c = useContext(PersonaContext);
  if (!c) throw new Error("usePersona must be used within a PersonaProvider");
  return c;
}
