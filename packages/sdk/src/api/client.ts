"use client";

// Authenticated fetch for our own API.
//
// Attaches the Privy access token so the server can scope DB rows to the
// signed-in user (lib/api/auth.ts). Without this the server can't tell callers
// apart and everyone lands in the shared demo bucket — so any client call that
// reads or writes user data should go through here.

import { getAccessToken } from "@privy-io/react-auth";

/** fetch() with the caller's Privy token attached when signed in. */
export async function authedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  try {
    const token = await getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  } catch {
    // Not signed in / mock mode — the server falls back to the demo account.
  }
  return fetch(input, { ...init, headers });
}

/** POST JSON with auth attached. */
export function authedPostJson(url: string, body: unknown): Promise<Response> {
  return authedFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
