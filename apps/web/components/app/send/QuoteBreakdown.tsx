import { Route, Gauge, Clock, ShieldCheck } from "lucide-react";
import { type Quote } from "@pesarc/sdk/quote";
import { CURRENCIES, formatMoney, formatNumber } from "@pesarc/sdk/money";

/**
 * Advanced-tier breakdown (PRD §9.7). Reveals the FX math, route, and
 * slippage that the Basic tier deliberately hides behind one all-in number.
 */
export function QuoteBreakdown({ quote }: { quote: Quote }) {
  const sendC = CURRENCIES[quote.sendCurrency];
  const recvC = CURRENCIES[quote.receiveCurrency];

  const rows: { label: string; value: string }[] = [
    {
      label: quote.live ? "Mid-market rate · on-chain oracle" : "Mid-market rate",
      value: `1 ${sendC.code} = ${formatNumber(quote.midRate, quote.receiveCurrency)} ${recvC.code}`,
    },
    {
      label: "Effective rate (after spread)",
      value: `1 ${sendC.code} = ${formatNumber(quote.effectiveRate, quote.receiveCurrency)} ${recvC.code}`,
    },
    {
      label: "Pesarc fee",
      value: `${(quote.feePct * 100).toFixed(2)}% · ${formatMoney(quote.feeAmount, quote.sendCurrency)}`,
    },
    { label: "Max slippage", value: `${quote.slippagePct.toFixed(2)}%` },
  ];

  return (
    <div className="rounded-field bg-black/[0.03] border border-black/[0.05] p-4 space-y-3">
      <div className="grid gap-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between text-sm">
            <span className="text-slate">{r.label}</span>
            <span className="font-medium text-ink numerals">{r.value}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <Chip icon={Route} text={quote.route} />
        <Chip icon={Clock} text={`~${formatEta(quote.etaSeconds)}`} />
        <Chip icon={Gauge} text="Gasless · sponsored" />
        <Chip icon={ShieldCheck} text="Recipient screened" />
      </div>
    </div>
  );
}

function Chip({
  icon: Icon,
  text,
}: {
  icon: typeof Route;
  text: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-snow border border-black/[0.06] px-3 py-1 text-xs font-medium text-ink/80">
      <Icon className="w-3.5 h-3.5 text-sky" strokeWidth={2} />
      {text}
    </span>
  );
}

export function formatEta(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.round(seconds / 60);
  return `${m} min`;
}
