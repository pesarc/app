import { type Recipient } from "@pesarc/sdk/account";
import { CURRENCIES, type CurrencyCode } from "@pesarc/sdk/money";
import type { SavedRecipient } from "@pesarc/sdk/recipients";
import { type BankDestination } from "./BankDetails";

// Infer the recipient's country + receive currency from a typed phone number's
// dialing code, so a raw number becomes a real, local-currency recipient.
export const DIAL: { code: string; country: string; flag: string; ccy: CurrencyCode }[] = [
  { code: "234", country: "Nigeria", flag: "🇳🇬", ccy: "NGN" },
  { code: "233", country: "Ghana", flag: "🇬🇭", ccy: "GHS" },
  { code: "254", country: "Kenya", flag: "🇰🇪", ccy: "KES" },
];

export type PhoneGuess = { pretty: string; country: string; flag: string; ccy: CurrencyCode };

export function detectPhone(q: string): PhoneGuess | null {
  const t = q.trim();
  if (!/^\+?\d[\d\s-]{6,}$/.test(t)) return null; // looks like a phone number
  const digits = t.replace(/\D/g, "");
  if (digits.length < 9) return null;
  const m = DIAL.find((d) => digits.startsWith(d.code)) ?? DIAL[0]; // default Nigeria for local format
  return { pretty: t, country: m.country, flag: m.flag, ccy: m.ccy };
}

export function recipientFromPhone(p: PhoneGuess): Recipient {
  return {
    id: "custom-phone",
    name: p.pretty,
    handle: p.pretty,
    country: p.country,
    flag: p.flag,
    receiveCurrency: p.ccy,
    initialsColor: "#3AA0FF",
  };
}

export function recipientFromBank(dest: BankDestination): Recipient {
  return {
    id: "custom-bank",
    name: dest.accountName || "Bank account",
    handle: "•••• " + dest.accountNumber.slice(-4),
    country: "Nigeria",
    flag: "🇳🇬",
    receiveCurrency: "NGN",
    initialsColor: "#13426f",
  };
}

export function savedToRecipient(s: SavedRecipient): Recipient {
  return {
    id: "saved-" + s.id,
    name: s.name,
    handle: s.handle,
    country: s.country ?? "",
    flag: s.flag ?? "🌍",
    receiveCurrency: s.receiveCurrency as CurrencyCode,
    recent: true,
    initialsColor: s.kind === "bank" ? "#13426f" : "#3AA0FF",
  };
}

export function flagFor(code: CurrencyCode): string {
  return CURRENCIES[code]?.flag ?? "🌍";
}
