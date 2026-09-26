"use client";

// Retail vs business persona, chosen once at onboarding. Retail users never see
// the business experience; business users land on the business surface. Stored
// locally (swap for a server pref later); `ready` gates the onboarding picker so
// it doesn't flash before the saved choice is read.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type Persona = "retail" | "business";

type Ctx = {
  persona: Persona | null;
  ready: boolean;
  setPersona: (p: Persona) => void;
  isBusiness: boolean;
};

const PersonaContext = createContext<Ctx | null>(null);
const KEY = "pesarc.persona";

export function PersonaProvider({ children }: { children: React.ReactNode }) {
  const [persona, setState] = useState<Persona | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(KEY);
      if (saved === "retail" || saved === "business") setState(saved);
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
      value={{ persona, ready, setPersona, isBusiness: persona === "business" }}
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
