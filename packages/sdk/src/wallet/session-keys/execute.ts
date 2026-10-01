// Session-key EXECUTOR (server only). Signs a scoped, capped cross-chain move on
// the user's behalf with their granted session key — no pop-up, no user signature
// at send time. This is the one place a server-held key signs, so every rail is
// enforced here before anything is sent:
//   - the feature must be enabled AND the chain must be testnet (permissions.ts);
//   - an active, unexpired grant with an on-chain context must exist;
//   - the move must fit under the grant's remaining cap.
// On any failure it returns {ok:false}; callers fall back to the in-app hand-off.
//
// Flow (verified against @alchemy/wallet-apis): build a client whose signer is the
// session key, prepareCalls with the grant's permission context, signPreparedCalls
// (the session key signs), sendPreparedCalls, then wait for the receipt.

import { createSmartWalletClient, alchemyWalletTransport } from "@alchemy/wallet-apis";
import { privateKeyToAccount } from "viem/accounts";
import type { LocalAccount } from "viem";
import { chainByKey } from "../../chain/registry";
import { getGasSponsor } from "../gasSponsor";
import { sessionKeysAllowed } from "./permissions";
import { getActiveGrant, openSessionKey, recordSpend, remainingWei } from "./store";

export type SessionCall = { to: `0x${string}`; data: `0x${string}`; value?: bigint };

export type SessionExecResult =
  | { ok: true; txHash?: string; sessionAddress: string }
  | { ok: false; error: string; code: "disabled" | "no-grant" | "cap" | "unsupported" | "failed" };

/**
 * Execute `calls` (e.g. CCTP approve + depositForBurn) through the user's session
 * key. `spendWei` is the USDC this move consumes, checked against the grant cap.
 */
export async function executeWithSession(p: {
  account: `0x${string}`;
  chainKey: string;
  calls: SessionCall[];
  spendWei: bigint;
}): Promise<SessionExecResult> {
  if (!sessionKeysAllowed(p.chainKey)) {
    return { ok: false, error: "Session keys are not enabled on this chain.", code: "disabled" };
  }
  const grant = await getActiveGrant(p.account, p.chainKey);
  if (!grant || !grant.context) {
    return { ok: false, error: "No active session grant for this wallet.", code: "no-grant" };
  }
  if (p.spendWei > remainingWei(grant)) {
    return { ok: false, error: "This move is over the session's spending cap.", code: "cap" };
  }

  const cfg = chainByKey(p.chainKey);
  if (!cfg) return { ok: false, error: "Unknown chain.", code: "unsupported" };
  const sponsor = getGasSponsor(cfg.key, cfg.chain.id);
  // grantPermissions / prepareCalls / sendPreparedCalls are Alchemy wallet-apis
  // features; only the Alchemy sponsor path supports them.
  if (sponsor.kind !== "alchemy") {
    return { ok: false, error: "Session signing is not supported on this chain's rails.", code: "unsupported" };
  }

  try {
    const signer = privateKeyToAccount(openSessionKey(grant)) as LocalAccount;
    const client = createSmartWalletClient({
      signer,
      transport: alchemyWalletTransport({ apiKey: sponsor.apiKey }),
      chain: cfg.chain,
      paymaster: { policyId: sponsor.policyId },
    });

    const permissions = { context: grant.context } as const;
    const prepared = await client.prepareCalls({
      account: p.account,
      calls: p.calls.map((c) => ({ to: c.to, data: c.data, value: c.value ?? 0n })),
      capabilities: { paymaster: { policyId: sponsor.policyId }, permissions },
      // The alpha types model capabilities as a broad union; the shape above is
      // the documented session-key path.
    } as never);

    const signed = await client.signPreparedCalls(prepared as never);
    const sent = (await client.sendPreparedCalls({ ...(signed as object), capabilities: { permissions } } as never)) as {
      preparedCallIds?: `0x${string}`[];
    };

    let txHash: string | undefined;
    const id = sent.preparedCallIds?.[0];
    if (id) {
      const status = (await client.waitForCallsStatus({ id } as never)) as {
        receipts?: { transactionHash?: string }[];
      };
      txHash = status.receipts?.[0]?.transactionHash;
    }

    await recordSpend(p.account, p.chainKey, p.spendWei);
    return { ok: true, txHash, sessionAddress: grant.sessionAddress };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Session send failed.", code: "failed" };
  }
}
