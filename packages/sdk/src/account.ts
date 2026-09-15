// Mock account + recipient data for the demo Send flow.

import type { CurrencyCode } from "./money";

export type Account = {
  name: string;
  balance: number;
  currency: CurrencyCode;
};

// USD to match the on-chain hub corridor (test-USD token0 → cNGN token1).
export const ACCOUNT: Account = {
  name: "You",
  balance: 1840.5,
  currency: "USD",
};

export type Recipient = {
  id: string;
  name: string;
  handle: string; // phone / alias
  country: string;
  flag: string;
  receiveCurrency: CurrencyCode;
  recent?: boolean;
  initialsColor: string;
};

export const RECIPIENTS: Recipient[] = [
  {
    id: "r1",
    name: "Mum",
    handle: "+234 803 555 0142",
    country: "Nigeria",
    flag: "🇳🇬",
    receiveCurrency: "NGN",
    recent: true,
    initialsColor: "#EA580C",
  },
  {
    id: "r2",
    name: "Chidi Okafor",
    handle: "@chidi",
    country: "Nigeria",
    flag: "🇳🇬",
    receiveCurrency: "NGN",
    recent: true,
    initialsColor: "#E0A82E",
  },
  {
    id: "r3",
    name: "Amara Njoku",
    handle: "+254 712 555 0198",
    country: "Kenya",
    flag: "🇰🇪",
    receiveCurrency: "KES",
    recent: true,
    initialsColor: "#5a7a8a",
  },
  {
    id: "r4",
    name: "Kwame Mensah",
    handle: "@kwame.gh",
    country: "Ghana",
    flag: "🇬🇭",
    receiveCurrency: "GHS",
    initialsColor: "#8b3a3a",
  },
];

export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// The user's payment alias (resolves to their smart-account wallet).
export const ALIAS = "@datum";

export type Activity = {
  id: string;
  kind: "sent" | "received";
  counterparty: string;
  amount: number; // in account currency (GBP)
  currency: CurrencyCode;
  when: string;
  flag: string;
};

export const ACTIVITY: Activity[] = [
  {
    id: "a1",
    kind: "sent",
    counterparty: "Mum",
    amount: 100,
    currency: "GBP",
    when: "Today, 09:14",
    flag: "🇳🇬",
  },
  {
    id: "a2",
    kind: "received",
    counterparty: "Chidi Okafor",
    amount: 45,
    currency: "GBP",
    when: "Yesterday",
    flag: "🇳🇬",
  },
  {
    id: "a3",
    kind: "sent",
    counterparty: "Amara Njoku",
    amount: 60,
    currency: "GBP",
    when: "Mon",
    flag: "🇰🇪",
  },
  {
    id: "a4",
    kind: "sent",
    counterparty: "Kwame Mensah",
    amount: 30,
    currency: "GBP",
    when: "Last week",
    flag: "🇬🇭",
  },
];
