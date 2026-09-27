"use client";

// Live-market card that cycles through sample Pesarc markets — African
// elections, football, prices and world events — each with Yes/No odds and the
// local currency it settles in. Crossfades in place (no width change), matching
// the hero widget style.

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LineChart } from "lucide-react";

type PreviewMarket = {
  flag: string;
  category: string;
  question: string;
  yes: number; // implied Yes probability, 0-100
  ccy: string; // settlement currency label
};

const MARKETS: PreviewMarket[] = [
  { flag: "🇳🇬", category: "Football", question: "Super Eagles qualify for the 2026 World Cup?", yes: 64, ccy: "cNGN" },
  { flag: "🇳🇬", category: "Politics", question: "CBN cuts the benchmark rate before year-end?", yes: 41, ccy: "cNGN" },
  { flag: "🌍", category: "Crypto", question: "Bitcoin above $150,000 before 2027?", yes: 38, ccy: "cGHS" },
  { flag: "🇰🇪", category: "Prices", question: "Shilling stronger than 120 to the dollar by June?", yes: 29, ccy: "cKES" },
  { flag: "🇬🇭", category: "Football", question: "African player tops the Premier League scorers?", yes: 55, ccy: "cGHS" },
];

export default function MarketPreview() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % MARKETS.length), 4200);
    return () => clearInterval(t);
  }, []);
  const m = MARKETS[i];

  return (
    <div
      className="w-full max-w-[340px] lg:w-[300px] lg:max-w-none rounded-2xl p-4 overflow-hidden backdrop-blur-md"
      style={{ background: "rgba(255,255,255,0.09)", border: "1px solid rgba(255,255,255,0.14)" }}
    >
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-widest text-white/60 mb-3">
        <LineChart className="w-3.5 h-3.5" style={{ color: "#3AA0FF" }} /> Market · live
      </div>

      <div className="relative h-[104px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 flex flex-col"
          >
            <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-widest text-white/50">
              <span className="text-base leading-none">{m.flag}</span>
              {m.category}
            </div>
            <div className="mt-1.5 text-[14px] font-semibold text-white leading-snug text-balance">
              {m.question}
            </div>

            <div className="mt-auto flex items-center gap-2">
              <Odds label="Yes" pct={m.yes} accent />
              <Odds label="No" pct={100 - m.yes} />
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 text-[11px] font-medium" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
        <span className="text-white/60">
          Settles in <span className="text-white">{m.ccy}</span>
        </span>
        <span className="inline-flex items-center gap-1.5" style={{ color: "#3AA0FF" }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#3AA0FF" }} /> Gasless
        </span>
      </div>
    </div>
  );
}

function Odds({ label, pct, accent = false }: { label: string; pct: number; accent?: boolean }) {
  return (
    <div
      className="flex-1 rounded-xl px-3 py-2"
      style={{
        background: accent ? "rgba(58,160,255,0.16)" : "rgba(255,255,255,0.06)",
        border: `1px solid ${accent ? "rgba(58,160,255,0.4)" : "rgba(255,255,255,0.12)"}`,
      }}
    >
      <div className="text-[10px] font-medium uppercase tracking-widest text-white/50">{label}</div>
      <div className="text-[17px] font-bold text-white numerals leading-tight">{pct}%</div>
    </div>
  );
}
