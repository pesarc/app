"use client";

// Architecture tab — a readable, non-secret reference for how the app is wired,
// from /api/admin/architecture (ADMIN_SECRET-gated). The route returns only
// public config (addresses, fee %, routing order, market lists) — never keys.

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Wallet, Coins, Route, Globe2 } from "@/components/icons";
import type { AdminHdr } from "./useAdmin";
import { SectionTitle, CopyButton, Pill } from "./parts";

type Adapter = { name: string; countries: string[] | null; pollable: boolean; simulated: boolean };

type Architecture = {
  escrow: string;
  feePct: number;
  providerOrder: string[];
  countryOrder: Record<string, string[]>;
  adapters: Adapter[];
  bachs: { countries: string[]; currencies: string[] };
};

const FLOW: { title: string; body: string }[] = [
  { title: "Stablecoin leaves the smart wallet", body: "The user’s cNGN (or other local stablecoin) is sent from their smart wallet on-chain — gaslessly, so they never hold a gas token." },
  { title: "It settles into the escrow / treasury", body: "The on-chain leg lands the stablecoin in the ramp escrow address below, where off-ramp inflow collects before the fiat leg begins." },
  { title: "The partner pays local currency", body: "The selected off-ramp partner for that market pays the beneficiary in local currency, to their bank account or mobile-money wallet." },
  { title: "Status returns via webhook / poll", body: "The partner reports the result to our webhook (source of truth); pollable partners are also refreshed by polling until a terminal status." },
];

export function ArchitectureTab({ hdr, onForbidden }: { hdr: AdminHdr; onForbidden: () => void }) {
  const [data, setData] = useState<Architecture | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/admin/architecture", { headers: hdr(), cache: "no-store" });
      if (res.status === 403) {
        onForbidden();
        return;
      }
      const j = await res.json();
      if (j.ok) setData(j as Architecture);
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
    return <div className="py-16 text-center text-slate"><Loader2 className="w-5 h-5 animate-spin inline" /></div>;
  }
  if (error || !data) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-slate mb-3">Couldn’t load architecture config.</p>
        <button onClick={load} className="inline-flex items-center gap-1.5 rounded-pill bg-snow border border-fog text-harbor text-sm font-bold px-4 py-2">
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    );
  }

  const markets = Object.entries(data.countryOrder).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="space-y-7">
      {/* Your addresses */}
      <section>
        <SectionTitle>Your addresses</SectionTitle>
        <div className="rounded-card bg-snow border border-black/[0.04] shadow-card-flat p-4">
          <div className="flex items-center gap-1.5 text-[12px] font-bold text-harbor mb-2">
            <Wallet className="w-4 h-4" /> Ramp escrow / treasury
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 break-all rounded-field bg-cream px-3 py-2 text-[13px] font-mono text-ink">
              {data.escrow}
            </code>
            <CopyButton value={data.escrow} />
          </div>
          <p className="text-[12px] text-slate mt-2">
            Where off-ramp inflow collects: the on-chain leg of every cash-out delivers the
            swapped stablecoin here before the partner pays out local currency.
          </p>
        </div>
      </section>

      {/* Fees & spread */}
      <section>
        <SectionTitle>Fees &amp; spread</SectionTitle>
        <div className="rounded-card bg-snow border border-black/[0.04] shadow-card-flat p-4">
          <div className="flex items-center gap-1.5 text-[12px] font-bold text-harbor mb-1">
            <Coins className="w-4 h-4" /> All-in fee
          </div>
          <div className="text-[26px] font-extrabold tracking-tight text-harbor">
            {(data.feePct * 100).toFixed(2)}%
          </div>
          <p className="text-[12px] text-slate mt-1">
            The fee is folded into the FX spread (not charged separately), and must cover the
            partner’s payout fees plus on-chain gas.
          </p>
        </div>
      </section>

      {/* Off-ramp adapters */}
      <section>
        <SectionTitle>Off-ramp adapters</SectionTitle>
        <div className="overflow-x-auto rounded-card border border-black/[0.04] shadow-card-flat bg-snow mb-4">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[11px] font-bold uppercase tracking-widest text-slate">
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Countries</th>
                <th className="px-4 py-3">Refresh</th>
              </tr>
            </thead>
            <tbody>
              {data.adapters.map((a) => (
                <tr key={a.name} className="border-t border-black/[0.04] text-[13px] text-harbor">
                  <td className="px-4 py-3 font-bold">
                    {a.name}
                    {a.simulated ? <span className="ml-2 text-[11px] font-semibold text-slate">last resort</span> : null}
                  </td>
                  <td className="px-4 py-3 text-slate">{a.countries ? a.countries.join(", ") : "Universal"}</td>
                  <td className="px-4 py-3 text-slate">{a.pollable ? "webhook + poll" : "webhook"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-card bg-snow border border-black/[0.04] shadow-card-flat p-4">
          <div className="flex items-center gap-1.5 text-[12px] font-bold text-harbor mb-2">
            <Route className="w-4 h-4" /> Routing order (primary first)
          </div>
          <div className="text-[12px] text-slate mb-2">
            Global order:{" "}
            <span className="inline-flex flex-wrap gap-1.5 align-middle">
              {data.providerOrder.map((p) => <Pill key={p}>{p}</Pill>)}
            </span>
          </div>
          <div className="space-y-2">
            {markets.map(([cc, order]) => (
              <div key={cc} className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 text-[12px] font-bold text-harbor">
                  <Globe2 className="w-3.5 h-3.5" /> {cc}
                </span>
                {order.map((p) => <Pill key={p}>{p}</Pill>)}
              </div>
            ))}
          </div>
          <p className="text-[12px] text-slate mt-3">
            The router picks the first partner in a market’s order that is both online and able
            to handle the payout; if the primary is down, it fails over to the next automatically
            (the simulator is the universal last resort).
          </p>
        </div>
      </section>

      {/* Bachs markets */}
      <section>
        <SectionTitle>Bachs markets</SectionTitle>
        <div className="rounded-card bg-snow border border-black/[0.04] shadow-card-flat p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[12px] font-bold text-harbor">Countries</span>
            {data.bachs.countries.map((c) => <Pill key={c}>{c}</Pill>)}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[12px] font-bold text-harbor">Currencies</span>
            {data.bachs.currencies.map((c) => <Pill key={c}>{c}</Pill>)}
          </div>
        </div>
      </section>

      {/* How a cash-out flows */}
      <section>
        <SectionTitle>How a cash-out flows</SectionTitle>
        <ol className="space-y-2.5">
          {FLOW.map((step, i) => (
            <li key={i} className="flex gap-3 rounded-card bg-snow border border-black/[0.04] shadow-card-flat p-4">
              <span className="flex items-center justify-center w-7 h-7 shrink-0 rounded-full bg-sky text-white text-[13px] font-bold">
                {i + 1}
              </span>
              <div>
                <div className="text-[14px] font-bold text-harbor">{step.title}</div>
                <p className="text-[13px] text-slate mt-0.5">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
