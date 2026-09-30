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

