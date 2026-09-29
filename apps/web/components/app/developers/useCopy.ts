"use client";

import { useCallback, useState } from "react";

/** Copy-to-clipboard with a transient "copied" marker keyed by an id. */
export function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 1600);
    });
  }, []);
  return { copied, copy };
}

export type Copy = (text: string, id: string) => void;
