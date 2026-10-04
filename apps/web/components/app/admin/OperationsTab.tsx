"use client";

// Operations tab — live data from /api/admin/ops (ADMIN_SECRET-gated). KPI
// tiles, a recent-payouts table across all accounts, and a provider-health row.
// Provider names (bachs / paystack / …) are intentionally shown here: this is
// an internal, gated operator surface, NOT user-facing product copy.

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Receipt, Banknote, Clock, AlertCircle, Radio } from "@/components/icons";
import type { AdminHdr } from "./useAdmin";
import { Kpi, SectionTitle, StatusBadge, ngn, money, maskBeneficiary, fmtTime } from "./parts";

type Payout = {
  id: string;
  reference: string;
  beneficiary: string;
  method: "bank" | "mobile_money";
  amountNgn: number;
  status: "initiated" | "processing" | "paid" | "failed";
  createdAt: string;
  provider?: string;
};

type Provider = { name: string; live: boolean; countries: string[] | null; pollable: boolean };

type Ops = {
  metrics: {
    totalPayouts: number;
    paidNgn: number;
    pending: number;
    failed: number;
    totalTransfers: number;
    feePct: number;
    fees: { currency: string; amount: number }[];
  };
  payouts: Payout[];
  providers: Provider[];
  rampLive: boolean;
  treasury?: {
    escrowUsdcTotal: number;
    escrowByChain: { chainKey: string; label: string; testnet: boolean; usdc: number }[];
    floatProvider: string | null;
    floatNgn: number | null;
    float: { currency: string; available: number }[] | null;
  };
};

export function OperationsTab({ hdr, onForbidden }: { hdr: AdminHdr; onForbidden: () => void }) {
  const [data, setData] = useState<Ops | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/admin/ops", { headers: hdr(), cache: "no-store" });
      if (res.status === 403) {
        onForbidden();
        return;
      }
      const j = await res.json();
      if (j.ok) setData(j as Ops);
      else setError(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [hdr, onForbidden]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !data) {
    return (
      <div className="py-16 text-center text-slate">
        <Loader2 className="w-5 h-5 animate-spin inline" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-slate mb-3">Couldn’t load operations data.</p>
        <button onClick={load} className="inline-flex items-center gap-1.5 rounded-pill bg-snow border border-fog text-harbor text-sm font-bold px-4 py-2">
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    );
  }

  const m = data.metrics;
  const feeLabel = m.fees.length
    ? m.fees.slice(0, 2).map((f) => money(f.amount, f.currency)).join(" · ")
    : "—";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionTitle>Live operations</SectionTitle>
        <button
          onClick={load}
          aria-label="Refresh"
          className="inline-flex items-center gap-1.5 rounded-pill bg-snow border border-fog text-harbor text-[13px] font-bold px-3 py-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi label="Payouts" value={String(m.totalPayouts)} icon={Receipt} />
        <Kpi label="Paid out" value={ngn(m.paidNgn)} icon={Banknote} tone="good" />
        <Kpi label="Pending" value={String(m.pending)} icon={Clock} tone="warn" />
        <Kpi label="Failed" value={String(m.failed)} icon={AlertCircle} tone={m.failed ? "bad" : "default"} />
        <Kpi label="Est. fee revenue" value={feeLabel} icon={Radio} />
      </div>
      <p className="text-[12px] text-slate -mt-3">
        Est. fee revenue = sum of each transfer’s amount × {(m.feePct * 100).toFixed(2)}% fee
        (grouped by currency), across {m.totalTransfers} recent transfers.
      </p>

      {data.treasury && (
        <div>
          <SectionTitle>Float &amp; escrow</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-card border border-black/[0.04] shadow-card-flat bg-snow p-4">
              <div className="text-[11px] font-bold uppercase tracking-widest text-slate mb-1">
                Escrowed USDC (backs payouts)
              </div>
              <div className="text-[22px] font-extrabold text-harbor numerals">
                ${data.treasury.escrowUsdcTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
              <div className="mt-2 space-y-1">
                {data.treasury.escrowByChain.filter((e) => e.usdc > 0).length === 0 ? (
                  <div className="text-[12px] text-slate">No USDC in escrow yet.</div>
                ) : (
                  data.treasury.escrowByChain
                    .filter((e) => e.usdc > 0)
                    .sort((a, b) => b.usdc - a.usdc)
                    .map((e) => (
                      <div key={e.chainKey} className="flex items-center justify-between text-[12.5px]">
                        <span className="text-slate">
                          {e.label}
                          {e.testnet && <span className="ml-1 text-amber-500 font-bold">test</span>}
                        </span>
                        <span className="font-bold text-harbor numerals">
                          ${e.usdc.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))
                )}
              </div>
            </div>

            <div className="rounded-card border border-black/[0.04] shadow-card-flat bg-snow p-4">
              <div className="text-[11px] font-bold uppercase tracking-widest text-slate mb-1">
                Partner float{data.treasury.floatProvider ? ` · ${data.treasury.floatProvider}` : ""}
              </div>
              {data.treasury.floatProvider == null ? (
                <div className="text-[13px] text-slate">
                  No fiat partner configured — set a live payout key to fund and track the float.
                </div>
              ) : data.treasury.floatNgn == null ? (
                <div className="text-[13px] text-slate">
                  Couldn’t read the float balance (partner unreachable or key invalid).
                </div>
              ) : (
                <>
                  <div className="text-[22px] font-extrabold text-harbor numerals">{ngn(data.treasury.floatNgn)}</div>
                  {data.treasury.float && data.treasury.float.length > 1 && (
                    <div className="mt-2 space-y-1">
                      {data.treasury.float
                        .filter((b) => b.currency !== "NGN")
                        .map((b) => (
                          <div key={b.currency} className="flex items-center justify-between text-[12.5px]">
                            <span className="text-slate">{b.currency}</span>
                            <span className="font-bold text-harbor numerals">
                              {b.available.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          <p className="text-[12px] text-slate mt-2">
            Escrowed USDC is what you’ve collected on-chain; the partner float is the fiat you can pay out right now.
            Keep the float above your pending-payout volume and replenish it by converting escrowed USDC to fiat.
          </p>
        </div>
      )}

      <div>
        <SectionTitle>Recent payouts</SectionTitle>
        <div className="overflow-x-auto rounded-card border border-black/[0.04] shadow-card-flat bg-snow">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[11px] font-bold uppercase tracking-widest text-slate">
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Beneficiary</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">When</th>
              </tr>
            </thead>
            <tbody>
              {data.payouts.map((p) => (
                <tr key={p.id} className="border-t border-black/[0.04] text-[13px] text-harbor">
                  <td className="px-4 py-3 font-mono text-[12px]">{p.reference}</td>
                  <td className="px-4 py-3">{maskBeneficiary(p.beneficiary)}</td>
                  <td className="px-4 py-3 text-slate">{p.method === "mobile_money" ? "Mobile money" : "Bank"}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{ngn(p.amountNgn)}</td>
                  <td className="px-4 py-3 text-slate">{p.provider ?? "—"}</td>
                  <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                  <td className="px-4 py-3 text-slate whitespace-nowrap">{fmtTime(p.createdAt)}</td>
                </tr>
              ))}
              {data.payouts.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate">No payouts yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <SectionTitle>Provider health</SectionTitle>
        <div className="flex flex-wrap gap-2.5">
          {data.providers.map((p) => (
            <div
              key={p.name}
              className="inline-flex items-center gap-2 rounded-full bg-snow border border-fog px-3.5 py-2 shadow-card-flat"
            >
              <span className={`w-2 h-2 rounded-full ${p.live ? "bg-success" : "bg-slate/50"}`} />
              <span className="text-[13px] font-bold text-harbor">{p.name}</span>
              <span className="text-[11px] font-semibold text-slate">
                {p.live ? "configured" : "fallback"}
                {p.countries ? ` · ${p.countries.join(", ")}` : " · universal"}
              </span>
            </div>
          ))}
        </div>
        <p className="text-[12px] text-slate mt-2">
          “Configured” = a real partner adapter is wired (keys present); the
          simulator is the universal last-resort fallback. Overall:{" "}
          <span className="font-bold text-harbor">{data.rampLive ? "live partners active" : "simulator only"}</span>.
        </p>
      </div>
    </div>
  );
}
