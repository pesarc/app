"use client";

// Home activity feed: the real merged stream (on-chain across every chain the
// wallet holds + fiat bank payouts), most recent first, with a Filter icon and a
// "See all activity" link to the /history page. The heavy lifting lives in
// ./activity/ActivityList; this wrapper keeps the type exports the home page uses.

import { ActivityList } from "./activity/ActivityList";

export type ActivityType = "send" | "receive" | "bank" | "bill" | "earn" | "swap" | "pay";

/** Kept for the home page's server-provided fallback rows type. */
export type FallbackItem = {
  id: string;
  kind: "sent" | "received";
  counterparty: string;
  amountLabel: string;
  when: string;
  flag: string;
  type: ActivityType;
};

// `fallback` is retained for call-site compatibility; the live merged feed is now
// the source of truth, and its own empty state covers the no-activity case.
export function ActivityFeed(_props: { fallback?: FallbackItem[] }) {
  return <ActivityList mode="home" />;
}
