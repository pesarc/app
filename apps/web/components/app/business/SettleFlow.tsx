"use client";

// Business / Settle console, wired to the live SettlementNetting contract on
// the hub chain: shows the netting set's members, open obligations, and the
// gross→net compression; members record invoices gaslessly and a settlement
// cycle can be run on demand (testnet stand-in for the netting CRON).

import { useCallback, useEffect, useMemo, useState } from "react";
import { encodeFunctionData, parseUnits } from "viem";
import {
  ArrowRight,
  Building2,
  Check,
  ExternalLink,
  FileText,
  Landmark,
  Loader2,
  RefreshCw,
  Shuffle,
} from "lucide-react";
import { Button, Card, Select } from "@/components/app/ui";
import { useWallet } from "@pesarc/sdk/wallet/WalletProvider";
import { useSmartWallet } from "@pesarc/sdk/wallet/smartWallet";
import { CONTRACTS } from "@pesarc/sdk/chain/contracts";
import { chainLabel, explorerTxUrl } from "@pesarc/sdk/chain/chains";
import { settlementNettingAbi } from "@pesarc/abi";
import { erc20Abi } from "@pesarc/abi";
import {
  fetchNettingSnapshot,
  nettingAvailable,
  shortAddr,
  NETTING_SET_ID,
  type NettingSnapshot,
} from "@pesarc/sdk/chain/netting";

export default function SettleFlow() {
  const { mode, authenticated } = useWallet();
  const smart = useSmartWallet();
  const me = smart.address?.toLowerCase();
  const live = mode === "live" && authenticated && Boolean(smart.address);

  const [snap, setSnap] = useState<NettingSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; tx?: string } | null>(
    null
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setSnap(await fetchNettingSnapshot());
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isMember = useMemo(
    () => Boolean(me && snap?.members.some((m) => m.address.toLowerCase() === me)),
    [me, snap]
  );

  // Invoice form
  const [creditor, setCreditor] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [ref, setRef] = useState("");
  const amount = parseFloat(amountStr) || 0;

  const otherMembers = useMemo(
    () => (snap?.members ?? []).filter((m) => m.address.toLowerCase() !== me),
    [snap, me]
  );

  const join = useCallback(async () => {
    if (!smart.address) return;
    setBusy("join");
    setNotice(null);
    try {
      const res = await fetch("/api/netting/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: smart.address }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setNotice({
        text:
          data.status === "already"
            ? "This wallet is already a member."
            : "Wallet approved into the netting set.",
        tx: data.tx,
      });
      await refresh();
    } catch (e) {
      setNotice({ text: e instanceof Error ? e.message : "Join failed." });
    }
    setBusy(null);
  }, [smart.address, refresh]);

  const recordInvoice = useCallback(async () => {
    if (!creditor || amount <= 0) return;
    setBusy("invoice");
    setNotice(null);
    try {
      const amountWei = parseUnits(amount.toFixed(6), 18);
      const refHex = Array.from(new TextEncoder().encode(ref.slice(0, 32)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
        .padEnd(64, "0")
        .slice(0, 64);
      const refBytes = `0x${refHex}` as `0x${string}`;
      // Approve alongside recording so a future settle can pull this
      // wallet's net debit without another interaction.
      const tx = await smart.sendCalls([
        {
          to: CONTRACTS.tokenUsd as `0x${string}`,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: "approve",
            args: [
              CONTRACTS.settlementNetting as `0x${string}`,
              2n ** 200n, // effectively unlimited, testnet
            ],
          }),
        },
        {
          to: CONTRACTS.settlementNetting as `0x${string}`,
          data: encodeFunctionData({
            abi: settlementNettingAbi,
            functionName: "recordObligation",
            args: [NETTING_SET_ID, creditor as `0x${string}`, amountWei, refBytes],
          }),
        },
      ]);
      setNotice({ text: "Invoice recorded on-chain.", tx });
      setAmountStr("");
      setRef("");
      await refresh();
    } catch (e) {
      setNotice({
        text: e instanceof Error ? e.message.slice(0, 140) : "Recording failed.",
      });
    }
    setBusy(null);
  }, [creditor, amount, ref, smart, refresh]);

  const runSettlement = useCallback(async () => {
    setBusy("settle");
    setNotice(null);
    try {
      const res = await fetch("/api/netting/settle", { method: "POST" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Settlement failed.");
      setNotice({ text: "Cycle settled — only net positions moved.", tx: data.tx });
      await refresh();
    } catch (e) {
      setNotice({
        text: e instanceof Error ? e.message.slice(0, 140) : "Settlement failed.",
      });
    }
    setBusy(null);
  }, [refresh]);

  const efficiency =
    snap && snap.gross > 0
      ? Math.max(0, Math.round((1 - snap.netToMove / snap.gross) * 100))
      : null;

  if (!nettingAvailable()) {
    return (
      <Shell>
        <Card className="p-6 text-slate text-sm">
          The settlement contract isn&apos;t configured on this deployment yet
          (set <code>NEXT_PUBLIC_ARB_SETTLEMENT_NETTING</code>).
        </Card>
      </Shell>
    );
  }

  return (
    <Shell>
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Stat label="Cycle" value={snap ? `#${snap.cycle}` : "—"} />
        <Stat
          label="Gross obligations"
          value={snap ? fmt(snap.gross) : "—"}
          sub="tUSD"
        />
        <Stat
          label="Net to move"
          value={snap ? fmt(snap.netToMove) : "—"}
          sub="tUSD"
        />
        <Stat
          label="Netting efficiency"
          value={efficiency !== null ? `${efficiency}%` : "—"}
          accent
        />
      </div>

      {notice && (
        <Card className="p-3.5 mb-4 flex items-center gap-2 text-sm">
          <Check className="w-4 h-4 text-sky shrink-0" />
          <span className="text-ink flex-1">{notice.text}</span>
          {notice.tx && (
            <a
              href={explorerTxUrl(notice.tx)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sky font-medium hover:underline"
            >
              tx <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4 items-start">
        {/* Members + positions */}
        <Card className="p-5">
          <SectionTitle icon={Landmark} title={`Netting set · ${chainLabel()}`}>
            <button
              onClick={refresh}
              aria-label="Refresh"
              className="text-slate hover:text-ink transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </SectionTitle>

          <div className="space-y-2">
            {(snap?.members ?? []).map((m) => {
              const mine = m.address.toLowerCase() === me;
              return (
                <div
                  key={m.address}
                  className={`flex items-center justify-between rounded-field border px-3.5 py-2.5 text-sm ${
                    mine ? "border-sky/40 bg-sky-tint/50" : "border-black/[0.06] bg-snow"
                  }`}
                >
                  <div className="min-w-0">
                    <span className="font-mono text-ink">{shortAddr(m.address)}</span>
                    {mine && <Badge>You</Badge>}
                    {m.isOperator && <Badge>Operator</Badge>}
                  </div>
                  <span
                    className={`font-semibold numerals ${
                      m.net > 0 ? "text-success" : m.net < 0 ? "text-alert" : "text-slate"
                    }`}
                  >
                    {m.net > 0 ? "+" : ""}
                    {fmt(m.net)}
                  </span>
                </div>
              );
            })}
            {snap && snap.members.length === 0 && (
              <p className="text-sm text-slate">No members yet.</p>
            )}
          </div>

          {live && !isMember && (
            <Button block className="mt-4" onClick={join} disabled={busy === "join"}>
              {busy === "join" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Building2 className="w-4 h-4" />
              )}
              Join netting set (testnet KYB)
            </Button>
          )}
          {!live && (
            <p className="text-xs text-slate mt-4">
              Sign in with a live wallet to join the set and record invoices.
            </p>
          )}
        </Card>

        {/* Record invoice + open obligations */}
        <div className="space-y-4">
          {live && isMember && (
            <Card className="p-5">
              <SectionTitle icon={FileText} title="Record invoice" />
              <label className="block text-xs font-semibold text-slate uppercase tracking-widest mb-1.5">
                Owed to
              </label>
              <Select
                value={creditor}
                onChange={(e) => setCreditor(e.target.value)}
                aria-label="Creditor"
                className="mb-3"
              >
                <option value="">Select member…</option>
                {otherMembers.map((m) => (
                  <option key={m.address} value={m.address}>
                    {shortAddr(m.address)}
                    {m.isOperator ? " (operator)" : ""}
                  </option>
                ))}
              </Select>
              <div className="flex gap-2 mb-3">
                <input
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value.replace(/[^0-9.]/g, ""))}
                  inputMode="decimal"
                  placeholder="Amount (tUSD)"
                  aria-label="Invoice amount"
                  className="flex-1 bg-snow rounded-field border border-fog px-3.5 py-2.5 text-sm text-ink numerals focus:outline-none focus:border-sky/50"
                />
                <input
                  value={ref}
                  onChange={(e) => setRef(e.target.value)}
                  placeholder="Ref (INV-042)"
                  aria-label="Invoice reference"
                  className="w-32 bg-snow rounded-field border border-fog px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:border-sky/50"
                />
              </div>
              <Button
                block
                disabled={!creditor || amount <= 0 || busy === "invoice"}
                onClick={recordInvoice}
              >
                {busy === "invoice" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
                Record gaslessly
              </Button>
            </Card>
          )}

          <Card className="p-5">
            <SectionTitle icon={Shuffle} title="Open obligations" />
            {(snap?.obligations ?? []).length === 0 ? (
              <p className="text-sm text-slate">
                None this cycle — record an invoice to see netting in action.
              </p>
            ) : (
              <div className="space-y-1.5">
                {snap!.obligations.map((o, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-sm rounded-field bg-black/[0.03] px-3.5 py-2"
                  >
                    <span className="font-mono text-ink/80">
                      {shortAddr(o.debtor)} → {shortAddr(o.creditor)}
                    </span>
                    <span className="font-semibold text-ink numerals">
                      {fmt(o.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {snap && snap.obligations.length > 0 && (
              <Button
                block
                variant="secondary"
                className="mt-4"
                disabled={busy === "settle"}
                onClick={runSettlement}
              >
                {busy === "settle" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Shuffle className="w-4 h-4" />
                )}
                Run settlement cycle
              </Button>
            )}
          </Card>
        </div>
      </div>
    </Shell>
  );
}

/* ---------------- presentational bits ---------------- */

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 md:py-12">
      <div className="mb-6">
        <div className="text-xs font-semibold text-slate uppercase tracking-widest mb-1">
          Corporate / SME
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-ink mb-1.5">
          Settle
        </h1>
        <p className="text-slate">
          Record invoices between members, then settle the whole web in one
          cycle — only net positions move on-chain.
        </p>
      </div>
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="text-[11px] font-semibold text-slate uppercase tracking-widest mb-1">
        {label}
      </div>
      <div
        className={`text-2xl font-semibold numerals ${
          accent ? "text-sky" : "text-ink"
        }`}
      >
        {value}
        {sub && <span className="text-xs font-medium text-slate ml-1">{sub}</span>}
      </div>
    </Card>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Landmark;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-sky" />
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-2 inline-block rounded-full bg-sky-tint text-sky text-[10px] font-semibold px-2 py-0.5 align-middle">
      {children}
    </span>
  );
}

function fmt(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
