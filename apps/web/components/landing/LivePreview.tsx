"use client";

// The hero's floating live card. Rotates through what Pesarc does, so the
// product reads as a money app first (payments), with the agent, investing and
// markets as features, not the headline. Crossfades in place (fixed height, no
// resize). Reskinned to Pesarc navy / #3AA0FF.

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, TrendingUp, LineChart, type LucideIcon } from "@/components/icons";

const ACCENT = "#3AA0FF";

type Scene = {
  label: string;
  icon: LucideIcon;
  flag: string;
  category: string;
  title: string;
  ccy: string;
  result?: string; // single outcome line (payments / agent / stocks)
  yes?: number; // when set, render a Yes/No market split
};

const SCENES: Scene[] = [
  {
    label: "Payment",
    icon: Send,
    flag: "🇳🇬",
    category: "Send",
    title: "₦50,000 to Ama in Accra",
    result: "She gets ₵470, in seconds",
    ccy: "cedis",
  },
  {
    label: "Agent",
    icon: Bot,
    flag: "💬",
    category: "Ask",
    title: "“Pay my Ikeja electricity bill”",
    result: "Done, ₦5,000, token sent",
    ccy: "naira",
  },
  {
    label: "Stocks",
    icon: TrendingUp,
    flag: "🇳🇬",
    category: "Invest",
    title: "Buy ₦50,000 of MTN Nigeria",
    result: "≈ 218 shares, held in naira",
    ccy: "naira",
  },
  {
    label: "Market",
    icon: LineChart,
    flag: "⚽",
    category: "Predict",
    title: "Super Eagles reach the 2026 World Cup?",
    yes: 64,
    ccy: "naira",
  },
];

export default function LivePreview() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % SCENES.length), 4200);
    return () => clearInterval(t);
  }, []);
  return (
    <div
      className="w-full max-w-[340px] lg:w-[300px] lg:max-w-none rounded-2xl p-4 overflow-hidden backdrop-blur-md"
      style={{ background: "rgba(255,255,255,0.09)", border: "1px solid rgba(255,255,255,0.14)" }}
    >
      {/* Whole card crossfades as one so the header, body and footer never
          show two different scenes mid-transition. */}
      <div className="relative h-[184px]">
        <AnimatePresence>
          {SCENES.map((s, idx) =>
            idx === i ? (
              <motion.div
                key={idx}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="absolute inset-0 flex flex-col"
              >
                <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-widest text-white/60">
                  <s.icon className="w-3.5 h-3.5" style={{ color: ACCENT }} /> {s.label} · live
                </div>

                <div className="mt-4 flex-1 flex flex-col">
                  <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-widest text-white/50">
                    <span className="text-base leading-none">{s.flag}</span>
                    {s.category}
                  </div>
                  <div className="mt-1.5 text-[14px] font-semibold text-white leading-snug text-balance">
                    {s.title}
                  </div>

                  <div className="mt-auto">
                    {typeof s.yes === "number" ? (
                      <div className="flex items-center gap-2">
                        <Split label="Yes" pct={s.yes} accent />
                        <Split label="No" pct={100 - s.yes} />
                      </div>
                    ) : (
                      <div
                        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-semibold text-white"
                        style={{ background: "rgba(58,160,255,0.14)", border: "1px solid rgba(58,160,255,0.32)" }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: ACCENT }} />
                        {s.result}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 text-[11px] font-medium" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                  <span className="text-white/60">
                    In <span className="text-white">{s.ccy}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5" style={{ color: ACCENT }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: ACCENT }} /> No fee to worry about
                  </span>
                </div>
              </motion.div>
            ) : null,
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Split({ label, pct, accent = false }: { label: string; pct: number; accent?: boolean }) {
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
