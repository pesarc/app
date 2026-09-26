"use client";

// In-app voice input via the browser's Web Speech API. Fully client-side (no
// server, no key). Degrades silently: `supported` is false where the API is
// missing (e.g. Firefox), so callers just hide the mic. Reusable by any agent
// surface.

import { useCallback, useEffect, useRef, useState } from "react";

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: any) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

export function useSpeechInput(onTranscript: (text: string, final: boolean) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<Recognition | null>(null);
  // Keep the latest callback without recreating the recognizer each render.
  const cbRef = useRef(onTranscript);
  useEffect(() => {
    cbRef.current = onTranscript;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SRClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SRClass) return;
    setSupported(true);

    const rec: Recognition = new SRClass();
    rec.lang = navigator.language || "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e: any) => {
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      if (final) cbRef.current(final.trim(), true);
      else if (interim) cbRef.current(interim.trim(), false);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;

    return () => {
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const start = useCallback(() => {
    if (!recRef.current || listening) return;
    try {
      recRef.current.start();
      setListening(true);
    } catch {
      /* already started */
    }
  }, [listening]);

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    setListening(false);
  }, []);

  const toggle = useCallback(() => (listening ? stop() : start()), [listening, start, stop]);

  return { supported, listening, start, stop, toggle };
}
