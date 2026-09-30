// Selective disclosure: prove a fact about a user without storing their PII. A
// trusted issuer (the KYC/ramp partner) verifies the person once and signs an
// EIP-712 claim ("kyc"=2, "region"="NG"); the app stores the signed claim and
// later verifies it, so it can gate a corridor on "is KYC'd" without ever holding
// documents. Built on viem (already a dependency) — no zk circuit and no WASM in
// the hot path. A nullifier gives one-identity-one-action (sybil resistance)
// without revealing which identity. Full zk membership proofs (Semaphore/Noir)
// can layer on later, off this path.

import { keccak256, stringToHex, verifyTypedData } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { Attestation, Claim } from "./types";

const DOMAIN = { name: "PesarcIdentity", version: "1" } as const;
const TYPES = {
  Claim: [
    { name: "subject", type: "string" },
    { name: "kind", type: "string" },
    { name: "value", type: "string" },
    { name: "issued", type: "uint64" },
    { name: "expiry", type: "uint64" },
  ],
} as const;

/** Issue a signed attestation. `issuerPk` is the issuer's server-side key
 *  (never the user's, never client-side). */
export async function issueAttestation(issuerPk: `0x${string}`, claim: Claim): Promise<Attestation> {
  const account = privateKeyToAccount(issuerPk);
  const signature = await account.signTypedData({
    domain: DOMAIN,
    types: TYPES,
    primaryType: "Claim",
    message: { ...claim, issued: BigInt(claim.issued), expiry: BigInt(claim.expiry) },
  });
  return { claim, issuer: account.address, signature };
}

/** Verify an attestation: signature matches the issuer and it hasn't expired.
 *  The caller decides whether `issuer` is a trusted issuer. */
export async function verifyAttestation(att: Attestation): Promise<boolean> {
  if (att.claim.expiry && att.claim.expiry * 1000 < Date.now()) return false;
  try {
    return await verifyTypedData({
      address: att.issuer,
      domain: DOMAIN,
      types: TYPES,
      primaryType: "Claim",
      message: { ...att.claim, issued: BigInt(att.claim.issued), expiry: BigInt(att.claim.expiry) },
      signature: att.signature,
    });
  } catch {
    return false;
  }
}

/** The valid, non-expired attestation of `kind` from a trusted issuer, if any. */
export async function findClaim(
  atts: Attestation[] | undefined,
  kind: string,
  trustedIssuers: `0x${string}`[],
): Promise<Attestation | null> {
  const trusted = new Set(trustedIssuers.map((a) => a.toLowerCase()));
  for (const att of atts ?? []) {
    if (att.claim.kind !== kind) continue;
    if (!trusted.has(att.issuer.toLowerCase())) continue;
    if (await verifyAttestation(att)) return att;
  }
  return null;
}

/**
 * A nullifier: a deterministic, non-reversible tag that is unique per
 * (secret, scope). Store nullifiers, not identities, to enforce
 * one-person-one-action in a scope (an airdrop, a vote) without linking back to
 * who acted. `secret` is a per-identity secret held server-side, never the
 * public id — so the tag can't be recomputed by someone who only knows the id.
 */
export function nullifier(secret: string, scope: string): `0x${string}` {
  return keccak256(stringToHex(`pesarc:v1:${scope}:${secret}`));
}
