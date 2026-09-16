// Live independence metrics on the landing page (docs/LOCAL_CURRENCY_SETTLEMENT.md §6).
// Server component: reads the chain at request time. The whole point is that
// the claim is checkable, so the numbers are real or they don't render.

import { ShieldCheck, Zap } from "lucide-react";
import { computeIndependence } from "@pesarc/sdk/metrics/independence";

export const revalidate = 60;

function pct(x: number): string {
  const p = x * 100;
  if (p === 0) return "0";
  if (p < 0.1) return "<0.1";
  return p.toFixed(1);
}

export async function Independence() {
  let m: Awaited<ReturnType<typeof computeIndependence>> | null = null;
  try {
    m = await computeIndependence();
  } catch {
    return null; // never break the page over a metric
  }
  if (!m || m.totalValueUsd <= 0) return null;

  const independentShare = 1 - m.dollarTouched;

  return (
    <section id="independence" className="bg-cream py-24 px-6 md:px-12">
      <div className="max-w-7xl mx-auto">
      <div className="mb-12">
        <div className="inline-flex items-center gap-2 rounded-pill bg-sky-tint/60 text-sky-deep px-3 py-1.5 mb-4">
          <ShieldCheck className="w-4 h-4" />
          <span className="text-[11px] font-extrabold uppercase tracking-widest">
            Independence · live
          </span>
        </div>
        <h2 className="text-3xl md:text-5xl tracking-tight font-extrabold text-harbor leading-tight mb-4">
          Money that doesn&apos;t need permission.
        </h2>
        <p className="text-base md:text-lg text-slate font-medium max-w-2xl leading-relaxed">
          African trade has always cleared through someone else&apos;s currency.
          We measure how little of ours does — and publish it, live from the
          chain, whether it flatters us or not.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Metric
          value={`${pct(independentShare)}%`}
          label="Settled without a dollar"
          sub={`${m.localSettlements} payments cleared peer-to-peer`}
          accent
        />
        <Metric
          value={`${pct(m.dollarTouched)}%`}
          label="Dollar-touched"
          sub="Value that actually crossed USD"
        />
        <Metric
          value={`${pct(m.dollarPriced)}%`}
          label="Dollar-priced"
          sub="Value priced off a USD-referenced feed"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="p-6 rounded-card bg-snow border border-fog shadow-card-flat">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-sky-deep" />
            <span className="text-[15px] font-extrabold text-harbor">
              Priced by our own flow
            </span>
          </div>
          <p className="text-[15px] text-slate font-medium leading-relaxed">
            {m.selfPricedPairs.length > 0 ? (
              <>
                <span className="text-harbor font-bold">
                  {m.selfPricedPairs.join(" · ")}
                </span>{" "}
                {m.selfPricedPairs.length === 1 ? "sets its" : "set their"} rate
                from trades that actually settled here — not from a price feed
                anyone can switch off.
              </>
            ) : (
              "No corridor has enough realized flow to price itself yet."
            )}
          </p>
        </div>
        <div className="p-6 rounded-card bg-snow border border-fog shadow-card-flat">
          <div className="text-[15px] font-extrabold text-harbor mb-2">
            Why two numbers
          </div>
          <p className="text-[15px] text-slate font-medium leading-relaxed">
            Not moving dollars isn&apos;t the same as not needing them. A
            transfer can settle in naira and cedis yet still be{" "}
            <em>priced</em> off a dollar feed. The second number is the harder
            one, and it&apos;s the one that outlives the first.
          </p>
        </div>
      </div>

      <p className="mt-6 text-[11px] font-bold text-slate/70 uppercase tracking-widest">
        Computed from on-chain events ·{" "}
        {new Date(m.asOf).toUTCString().replace("GMT", "UTC")} ·{" "}
        <a href="/api/metrics/independence" className="text-sky-deep hover:underline">
          check it yourself
        </a>
      </p>
      </div>
    </section>
  );
}

function Metric({
  value,
  label,
  sub,
  accent,
}: {
  value: string;
  label: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div className="p-6 rounded-card bg-snow border border-fog shadow-card-flat">
      <div
        className={`text-5xl tracking-tight font-extrabold numerals mb-2 ${
          accent ? "text-sky" : "text-harbor"
        }`}
      >
        {value}
      </div>
      <div className="text-[15px] font-extrabold text-harbor mb-1">{label}</div>
      <div className="text-[13px] text-slate font-medium">{sub}</div>
    </div>
  );
}
