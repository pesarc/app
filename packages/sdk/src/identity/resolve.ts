// The resolver + router: turn any handle a user types (phone, @username, a 0x or
// Solana address, or a bank account number) into a destination and the rail that
// reaches it. This is the "chain abstraction" seam — the app asks "where does
// this go?" and never has to know the chain itself.

import { findIdentity } from "./store";
import type { HandleKind, ResolvedDestination } from "./types";

const EVM = /^0x[0-9a-fA-F]{40}$/;
const SOLANA = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/; // base58, no 0OIl
const NUBAN = /^\d{10}$/;

/**
 * Normalize a phone to E.164 so the local and international forms of the same
 * number map to one identity. Nigeria-first default: a local number like
 * "08031234567" drops the trunk 0 and gains the country code -> "+2348031234567".
 * A number typed with "+" or a "00" prefix is treated as already international.
 */
export function normalizePhone(raw: string, defaultCc = "234"): string {
  const isIntl = raw.trim().startsWith("+");
  let d = raw.replace(/[^\d]/g, "");
  if (!d) return "";
  if (isIntl) return `+${d}`;
  if (d.startsWith("00")) return `+${d.slice(2)}`; // 00 = international access prefix
  if (d.startsWith("0")) d = d.slice(1); // drop the local trunk 0
  if (!d.startsWith(defaultCc)) d = defaultCc + d; // add the country code if missing
  return `+${d}`;
}

/** What kind of handle is this? */
export function classifyHandle(handle: string): HandleKind {
  const h = handle.trim();
  if (EVM.test(h)) return "evm";
  if (h.startsWith("@")) return "username";
  // A bare 10-digit number is a NUBAN (Nigerian account numbers are 10 digits;
  // local phones are 11). Check it before the looser phone pattern.
  if (NUBAN.test(h)) return "nuban";
  if (/^(\+|00)?\d[\d\s()-]{6,}$/.test(h)) return "phone";
  if (SOLANA.test(h)) return "solana";
  return "username";
}

/**
 * Resolve a handle to a destination. `preferChain` picks the chain for an EVM
 * identity that holds several. A raw address resolves directly even with no
 * identity on file; a phone / username / nuban needs a registered identity.
 */
export async function resolveHandle(
  handle: string,
  opts: { preferChain?: string } = {},
): Promise<ResolvedDestination> {
  const h = handle.trim();
  const kind = classifyHandle(h);

  // A raw address is already a destination.
  if (kind === "evm" || kind === "solana") {
    const idty = await findIdentity(h, "address").catch(() => null);
    return {
      identityId: idty?.id,
      kind,
      rail: "onchain",
      chain: kind === "solana" ? "solana" : opts.preferChain,
      address: h,
      display: idty?.username ? `@${idty.username}` : `${h.slice(0, 6)}…${h.slice(-4)}`,
    };
  }

  // Handle -> identity.
  const lookup =
    kind === "phone"
      ? { value: normalizePhone(h), by: "phone" as const }
      : kind === "nuban"
        ? { value: h, by: "nuban" as const }
        : { value: h.replace(/^@/, ""), by: "username" as const };
  const idty = await findIdentity(lookup.value, lookup.by).catch(() => null);

  if (!idty) {
    return { kind, rail: "unknown", display: h };
  }

  // Prefer an on-chain address (chain-abstracted); fall back to the bank rail.
  const addr =
    idty.addresses.find((a) => a.chain === opts.preferChain) ??
    idty.addresses.find((a) => a.chain !== "solana" && a.chain !== "algorand") ??
    idty.addresses[0];
  if (addr) {
    return {
      identityId: idty.id,
      kind,
      rail: "onchain",
      chain: addr.chain,
      address: addr.address,
      display: idty.username ? `@${idty.username}` : idty.phone ?? h,
    };
  }
  if (idty.bank) {
    return {
      identityId: idty.id,
      kind,
      rail: "fiat",
      nuban: idty.bank.number,
      display: idty.username ? `@${idty.username}` : idty.phone ?? h,
    };
  }
  return { identityId: idty.id, kind, rail: "unknown", display: idty.username ? `@${idty.username}` : h };
}
