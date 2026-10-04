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

/** True for a well-formed EVM (0x + 40 hex) address. */
export function isEvmAddress(a: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(a.trim());
}

/** True for a plausible Solana (base58, 32–44 chars) address. */
export function isSolanaAddress(a: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a.trim());
}

/** True for a plausible Algorand (base32, 58 chars) address. */
export function isAlgorandAddress(a: string): boolean {
  return /^[A-Z2-7]{58}$/.test(a.trim());
}

/** The rail an address belongs to, by format. */
export function addressRail(a: string): "evm" | "solana" | "algorand" | null {
  const s = a.trim();
  if (isEvmAddress(s)) return "evm";
  if (isAlgorandAddress(s)) return "algorand";
  if (isSolanaAddress(s)) return "solana";
  return null;
}

/** True for a wallet address we can actually send on today (EVM or Solana). */
export function isWalletAddress(a: string): boolean {
  return isEvmAddress(a) || isSolanaAddress(a);
}

/** True when the EVM address has bytecode (i.e. it's a contract, not a wallet). */
export async function isEvmContract(address: string): Promise<boolean> {
  try {
    const { activeChain, publicClientFor } = await import("@pesarc/sdk/chain/registry");
    const code = await publicClientFor(activeChain()).getBytecode({
      address: address as `0x${string}`,
    });
    return Boolean(code && code !== "0x");
  } catch {
    return false;
  }
}

/** A recipient that is a raw on-chain wallet address. Both EVM and Solana wallets
 *  receive the actual token the sender holds (USDC/USD) directly — a plain
 *  transfer, not the local-currency corridor swap. */
export function recipientFromAddress(addr: string): Recipient {
  const a = addr.trim();
  const solana = isSolanaAddress(a) && !isEvmAddress(a);
  return {
    id: `wallet:${a.toLowerCase()}`,
    name: `${a.slice(0, 6)}…${a.slice(-4)}`,
    handle: a,
    country: solana ? "Solana wallet" : "On-chain wallet",
    flag: solana ? "◎" : "🔗",
    receiveCurrency: "USD",
    initialsColor: "#6b4ef0",
  };
}

/** True when a recipient is a raw on-chain wallet address (vs contact/bank/phone).
 *  Also detects a SAVED/recent wallet recipient, whose id is "saved-…" but whose
 *  handle is the on-chain address — otherwise re-selecting a wallet from Recent
 *  would wrongly show the bank "Payout to" selector and misroute the send. */
export function isWalletRecipient(r: { id: string; handle?: string }): boolean {
  return r.id.startsWith("wallet:") || (!!r.handle && isWalletAddress(r.handle));
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
    defaultPayout:
      s.payoutMethod && s.accountNumber
        ? {
            method: s.payoutMethod,
            bankCode: s.bankCode,
            accountNumber: s.accountNumber,
            accountName: s.accountName,
          }
        : undefined,
  };
}

export function flagFor(code: CurrencyCode): string {
  return CURRENCIES[code]?.flag ?? "🌍";
}
