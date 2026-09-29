// Pure helpers, constants and per-device history storage for the agent chat.

import type { DraftRow } from "@pesarc/sdk/agent/files";
import type { Msg, Thread } from "./types";

/** Pull the first amount out of a message, e.g. "send 50,000 naira" → 50000. */
export function parseAmount(text: string): number {
  const m = text.replace(/,/g, "").match(/\d+(\.\d+)?/);
  return m ? Number(m[0]) : 0;
}

export const EXAMPLES = [
  "Send 50,000 naira to Ghana",
  "Buy 1GB of MTN data for 08031234567",
  "Pay 5k Ikeja electricity, meter 04123456789",
  "Create a market: will USD/NGN cross ₦2,000 by June?",
];

export const GREETING: Msg = {
  role: "agent",
  text:
    "Hi, I'm Pesarc's agent. Tell me what to send between naira, cedis and shillings and I'll settle it peer-to-peer in local currency, buy airtime, data or pay an electricity bill, or spin up a prediction market. Type it or tap the mic and speak. Try an example below.",
};

export const HISTORY_KEY = "pesarc.agent.threads";
export const MAX_THREADS = 30;

export function loadThreads(): Thread[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    const list = raw ? (JSON.parse(raw) as Thread[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveThreads(list: Thread[]) {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, MAX_THREADS)));
  } catch {
    /* ignore */
  }
}

export function relativeTime(ts: number): string {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/* A bulk action the agent drafted from an uploaded file. Read + draft ONLY:
   every row hands off to the Send flow, where the user confirms and it settles
   gaslessly. Nothing is paid from this preview. */
export function sendHref(r: DraftRow): string {
  const p = new URLSearchParams();
  p.set("amount", String(r.amount || ""));
  p.set("ccy", r.currency);
  if (r.method === "mobile_money" && r.phone) { p.set("method", "phone"); p.set("to", r.phone); }
  else if (r.method === "bank" && r.account) { p.set("method", "bank"); p.set("to", r.account); if (r.bank) p.set("bank", r.bank); }
  if (r.name) p.set("name", r.name);
  return `/send?${p.toString()}`;
}
