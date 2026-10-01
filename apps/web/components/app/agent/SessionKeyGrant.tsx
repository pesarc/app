"use client";

// Lets the user grant the agent a scoped, capped, expiring SESSION KEY so it can
// send cross-chain for them with no pop-up. Testnet + flag only (the control hides
// itself otherwise). The grant is signed in-app by the user's smart wallet; the
// server holds only a scoped key that can move at most `cap` USDC until it expires,
// and the user can revoke anytime.

import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, Sparkles } from "@/components/icons";
import { Button, Card } from "@/components/app/ui";
import { useSmartWallet } from "@pesarc/sdk/wallet/smartWallet";
import { useActiveEvmChain } from "@pesarc/sdk/chain/activeChain";
import {
  sessionKeysAllowed,
  cctpKeyFor,
  buildCrossChainScope,
} from "@pesarc/sdk/wallet/session-keys/permissions";
import { cctpChains, tokenMessengerV2 } from "@pesarc/sdk/chain/cctp/network";
import { authedFetch, authedPostJson } from "@pesarc/sdk/api/client";

type SafeGrant = {
  sessionAddress: string;
  capWei: string;
  spentWei: string;
  expirySec: number;
  status: "pending" | "active" | "revoked";
};

const fmtUsdc = (wei: string) => (Number(BigInt(wei)) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 });

export default function SessionKeyGrant() {
  const smart = useSmartWallet();
  const { chain } = useActiveEvmChain();
  const account = smart.address;
  const enabled = sessionKeysAllowed(chain.key);
  const canGrant = Boolean(account && smart.grantSession);

  const [cap, setCap] = useState("50");
  const [grant, setGrant] = useState<SafeGrant | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const refresh = useCallback(async () => {
    if (!account) return;
    try {
      const r = await authedFetch(`/api/agent/session?account=${account}&chainKey=${chain.key}`);
      const d = await r.json();
      setGrant(d.ok && d.grant ? d.grant : null);
    } catch {
      /* ignore */
    }
  }, [account, chain.key]);

  useEffect(() => {
    if (enabled) refresh();
  }, [enabled, refresh]);

  if (!enabled) return null;

  const active = grant?.status === "active" && grant.expirySec > Math.floor(Date.now() / 1000);

  const doGrant = async () => {
    if (!account || !smart.grantSession) return;
    const capUsdc = Number(cap);
    if (!(capUsdc > 0)) {
      setNote("Enter a spending cap.");
      return;
    }
    const cctpKey = cctpKeyFor(chain.key);
    const src = cctpKey ? cctpChains("testnet")[cctpKey] : undefined;
    if (!src || src.kind !== "evm") {
      setNote("This chain isn't supported for agent sends yet.");
      return;
    }
    setBusy(true);
    setNote("Setting up a secure key for the agent…");
    try {
      const created = await authedPostJson("/api/agent/session", { account, chainKey: chain.key, capUsdc }).then((r) => r.json());
      if (!created.ok) throw new Error(created.error || "Could not start.");
      const permissions = buildCrossChainScope({
        usdc: src.usdc as `0x${string}`,
        tokenMessenger: tokenMessengerV2("testnet"),
        capWei: BigInt(created.capWei),
      });
      setNote("Approve the agent's limits in your wallet…");
      const { context } = await smart.grantSession({
        key: { publicKey: created.sessionAddress as `0x${string}`, type: "secp256k1" },
        permissions,
        expirySec: created.expirySec,
      });
      const fin = await authedFetch("/api/agent/session", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account, chainKey: chain.key, sessionAddress: created.sessionAddress, context }),
      }).then((r) => r.json());
      if (!fin.ok) throw new Error(fin.error || "Could not finalize.");
      setGrant(fin.grant);
      setNote("");
    } catch (e: any) {
      setNote(e?.shortMessage || e?.message || "That didn't go through.");
    }
    setBusy(false);
  };

  const doRevoke = async () => {
    if (!account) return;
    setBusy(true);
    try {
      await authedFetch(`/api/agent/session?account=${account}&chainKey=${chain.key}`, { method: "DELETE" });
      setGrant(null);
      setNote("");
    } catch {
      /* ignore */
    }
    setBusy(false);
  };

  return (
    <Card className="p-4 border-sky/30">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-4 h-4 text-sky" />
        <span className="text-xs font-semibold text-sky uppercase tracking-widest">Agent sends · testnet</span>
      </div>
      {active && grant ? (
        <>
          <p className="text-sm text-ink">
            The agent can send up to <span className="font-semibold">{fmtUsdc(grant.capWei)} USDC</span> for you on{" "}
            {chain.label}, no pop-up. Used so far: {fmtUsdc(grant.spentWei)} USDC.
          </p>
          <p className="mt-1 text-[11px] text-slate">
            Expires {new Date(grant.expirySec * 1000).toLocaleString()}.
          </p>
          <Button variant="secondary" className="mt-3" onClick={doRevoke} disabled={busy}>
            Revoke access
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm text-slate">
            Let the agent move USDC across chains for you without a wallet pop-up, up to a limit you set. You can revoke
            anytime.
          </p>
          <div className="mt-3 flex items-end gap-2">
            <label className="text-xs font-bold text-slate">
              Spending cap (USDC)
              <input
                inputMode="decimal"
                value={cap}
                onChange={(e) => setCap(e.target.value.replace(/[^0-9.]/g, ""))}
                className="mt-1 w-28 rounded-xl border border-fog bg-snow p-2 text-lg font-bold text-ink"
                disabled={busy}
              />
            </label>
            <Button onClick={doGrant} disabled={busy || !canGrant}>
              {busy ? "Setting up…" : "Allow agent sends"}
            </Button>
          </div>
          {!canGrant && (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate">
              <ShieldCheck className="w-3.5 h-3.5 text-sky shrink-0" />
              {account
                ? "Agent sends run on an Alchemy-sponsored testnet (e.g. Base or Arbitrum Sepolia). Switch network to enable — Arc isn't supported for session keys."
                : "Sign in with your in-app wallet to enable this."}
            </p>
          )}
        </>
      )}
      {note && <p className={`mt-2 text-sm ${note.includes("didn't") ? "text-alert" : "text-slate"}`}>{note}</p>}
    </Card>
  );
}
