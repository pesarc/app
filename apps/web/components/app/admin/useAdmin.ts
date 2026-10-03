"use client";

import { useCallback, useState } from "react";

// Shared admin auth: the area is gated by ADMIN_SECRET server-side. The
// passphrase is kept in localStorage and sent as `x-admin-secret` on every
// admin request (catalog, ops, architecture). A 403 flips `authed` to false so
// the whole admin shell drops back to the unlock screen.

const STORAGE_KEY = "pesarc.admin-secret";

export function useAdmin() {
  const [secret, setSecret] = useState<string>(() => {
    try {
      return typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) ?? "" : "";
    } catch {
      return "";
    }
  });
  const [authed, setAuthed] = useState(true);

  const hdr = useCallback(
    (json = false): Record<string, string> => ({
      ...(json ? { "content-type": "application/json" } : {}),
      ...(secret ? { "x-admin-secret": secret } : {}),
    }),
    [secret],
  );

  const unlock = useCallback((entry: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, entry);
    } catch {
      /* ignore */
    }
    setSecret(entry);
    setAuthed(true);
  }, []);

  return { secret, hdr, authed, setAuthed, unlock };
}

export type AdminHdr = (json?: boolean) => Record<string, string>;
