// Algorand gasless — fee pooling, in-house (no third party). In an atomic group,
// one account can pay the fees for all txns: the user's txns carry fee 0 and a
// sponsor "fee-cover" txn carries enough to cover the whole group. The client
// builds the group (user txns + one sponsor self-payment), signs its own txns,
// and sends the ordered group here; the relayer co-signs ONLY its own fee-cover
// txn and submits.
//
// Safety (same spirit as /api/svm/sponsor): the sponsor signs nothing except a
// self-payment of amount 0, so it can never be tricked into moving its funds —
// its only exposure is the pooled fee, which is capped. Optionally restrict the
// user txns to allow-listed app ids so the sponsor isn't used to subsidize spam.

import algosdk from "algosdk";

const MIN_FEE = 1000; // microAlgos per txn (Algorand protocol minimum)

export function sponsorConfigured(): boolean {
  return Boolean(process.env.ALGO_SPONSOR_MNEMONIC);
}

function sponsorAccount(): { addr: string; sk: Uint8Array } | null {
  const m = process.env.ALGO_SPONSOR_MNEMONIC;
  if (!m) return null;
  try {
    return algosdk.mnemonicToSecretKey(m.trim());
  } catch {
    return null;
  }
}

/** The public sponsor address the client builds the fee-cover txn from. */
export function sponsorAddress(): string | null {
  return sponsorAccount()?.addr ?? null;
}

function algod(): algosdk.Algodv2 {
  const url =
    process.env.NEXT_PUBLIC_ALGOD_URL ||
    (process.env.NEXT_PUBLIC_ALGO_NETWORK === "mainnet"
      ? "https://mainnet-api.algonode.cloud"
      : "https://testnet-api.algonode.cloud");
  const token = process.env.ALGOD_TOKEN || "";
  return new algosdk.Algodv2(token, url, "");
}

/** Max microAlgos the sponsor will pay in one group (anti-drain ceiling). */
function maxFee(): number {
  return Number(process.env.ALGO_SPONSOR_MAX_FEE || 100_000); // 0.1 ALGO
}

/** Optional allow-list of app ids the sponsor will cover (empty = allow any). */
function allowedApps(): Set<number> {
  const raw = process.env.ALGO_SPONSOR_ALLOWED_APPS || "";
  return new Set(
    raw
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0),
  );
}

/** Fee the sponsor must carry to cover `n` txns via pooling. */
export function poolFee(n: number): number {
  return n * MIN_FEE;
}

export type SponsorResult = { ok: true; txId: string } | { ok: false; error: string };
type CoSign = { ok: true; blob: Uint8Array; txId: string } | { ok: false; error: string };

/**
 * Validate the group and co-sign ONLY the sponsor's fee-cover txn. Pure (no
 * network) so it's unit-testable. `ordered` is the full group in group order:
 * user txns already SIGNED, and exactly one UNSIGNED sponsor self-payment.
 */
export function coSignGroup(ordered: string[]): CoSign {
  const sponsor = sponsorAccount();
  if (!sponsor) return { ok: false, error: "Sponsor not configured." };
  if (!ordered.length || ordered.length > 16) {
    return { ok: false, error: "Invalid group size." };
  }

  const allow = allowedApps();
  const outSigned: Uint8Array[] = [];
  let coveredUnsigned = 0;
  let groupId: string | null = null;
  let leadTxId = "";

  for (let i = 0; i < ordered.length; i++) {
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(Buffer.from(ordered[i], "base64"));
    } catch {
      return { ok: false, error: "Malformed txn." };
    }
    const obj = algosdk.decodeObj(bytes) as Record<string, unknown>;
    const isSigned = obj && typeof obj === "object" && "txn" in obj;

    if (isSigned) {
      // A user (or already-signed) txn: keep as-is, but validate the target.
      const st = algosdk.decodeSignedTransaction(bytes);
      const t = st.txn;
      groupId = checkGroup(groupId, t);
      if (!groupId) return { ok: false, error: "Txns are not in one group." };
      if (t.appIndex && allow.size && !allow.has(Number(t.appIndex))) {
        return { ok: false, error: "App is not allow-listed for sponsorship." };
      }
      if (!leadTxId) leadTxId = t.txID();
      outSigned.push(bytes);
      continue;
    }

    // Unsigned: must be the sponsor's own benign fee-cover self-payment.
    const t = algosdk.decodeUnsignedTransaction(bytes);
    const from = algosdk.encodeAddress(t.from.publicKey);
    if (from !== sponsor.addr) {
      return { ok: false, error: "Unsigned txn is not the sponsor's." };
    }
    if (t.type !== "pay") return { ok: false, error: "Sponsor txn must be a payment." };
    const to = t.to ? algosdk.encodeAddress(t.to.publicKey) : "";
    if (to !== sponsor.addr || Number(t.amount ?? 0) !== 0) {
      return { ok: false, error: "Sponsor txn must be a zero self-payment." };
    }
    if (Number(t.fee) > maxFee()) {
      return { ok: false, error: "Sponsor fee exceeds the ceiling." };
    }
    if (t.reKeyTo) return { ok: false, error: "Rekey not allowed." };
    groupId = checkGroup(groupId, t);
    if (!groupId) return { ok: false, error: "Txns are not in one group." };
    if (!leadTxId) leadTxId = t.txID();
    outSigned.push(t.signTxn(sponsor.sk));
    coveredUnsigned++;
  }

  if (coveredUnsigned !== 1) {
    return { ok: false, error: "Exactly one sponsor fee-cover txn is required." };
  }
  return { ok: true, blob: concat(outSigned), txId: leadTxId };
}

/** Co-sign the group (coSignGroup) and submit it to algod. */
export async function coSignAndSubmit(ordered: string[]): Promise<SponsorResult> {
  const signed = coSignGroup(ordered);
  if (!signed.ok) return signed;
  try {
    const { txId } = await algod().sendRawTransaction(signed.blob).do();
    return { ok: true, txId: txId || signed.txId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.slice(0, 160) : "submit failed" };
  }
}

/** Ensure every txn shares one non-empty group id; returns it (or null). */
function checkGroup(current: string | null, t: algosdk.Transaction): string | null {
  const g = t.group ? Buffer.from(t.group).toString("base64") : "";
  if (!g) return null;
  if (current && current !== g) return null;
  return g;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
