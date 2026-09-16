"use client";

// Live-corridor card that cycles through real remittance routes — primarily
// Global-South (African) corridors, plus a couple of Western origins — settled
// in local currency. Crossfades in place (no width change).

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap } from "lucide-react";

type Corridor = {
  fromFlag: string;
  fromPlace: string;
  fromAmount: string;
  toFlag: string;
  toPlace: string;
  toAmount: string;
};

const CORRIDORS: Corridor[] = [
  { fromFlag: "🇬🇭", fromPlace: "Accra", fromAmount: "₵1,000", toFlag: "🇳🇬", toPlace: "Lagos", toAmount: "₦105k" },
  { fromFlag: "🇰🇪", fromPlace: "Nairobi", fromAmount: "KSh 5,000", toFlag: "🇬🇭", toPlace: "Accra", toAmount: "₵470" },
  { fromFlag: "🇳🇬", fromPlace: "Lagos", fromAmount: "₦150k", toFlag: "🇿🇦", toPlace: "Johannesburg", toAmount: "R 1,700" },
  { fromFlag: "🇬🇧", fromPlace: "London", fromAmount: "£200", toFlag: "🇳🇬", toPlace: "Lagos", toAmount: "₦408k" },
  { fromFlag: "🇪🇬", fromPlace: "Cairo", fromAmount: "ج.م 2,000", toFlag: "🇰🇪", toPlace: "Nairobi", toAmount: "KSh 5,300" },
  { fromFlag: "🇺🇸", fromPlace: "New York", fromAmount: "$300", toFlag: "🇬🇭", toPlace: "Accra", toAmount: "₵4,600" },
];

export default function CorridorPreview() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % CORRIDORS.length), 3200);
    return () => clearInterval(t);
  }, []);
  const c = CORRIDORS[i];

  return (
    <div className="w-[300px] rounded-card bg-snow border border-fog shadow-pop p-4 overflow-hidden">
      <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-widest text-slate mb-3">
        <Zap className="w-3.5 h-3.5 text-sky" /> Corridor · live
      </div>

      <div className="relative h-[62px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 flex items-center justify-between"
          >
            <Endpoint flag={c.fromFlag} place={c.fromPlace} sub="You send" amount={c.fromAmount} />
            <div className="flex-1 px-2">
              <svg viewBox="0 0 120 8" className="w-full h-2 overflow-visible">
                <path
                  d="M0,4 H120"
                  stroke="#2e96ff"
                  strokeWidth="2"
                  fill="none"
                  strokeDasharray="4 4"
                  className="animate-flow"
                />
              </svg>
            </div>
            <Endpoint flag={c.toFlag} place={c.toPlace} sub="They get" amount={c.toAmount} align="right" />
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-cream text-[11px] font-bold">
        <span className="text-slate">
          Settles <span className="text-harbor">&lt;30s</span>
        </span>
        <span className="inline-flex items-center gap-1.5 text-sky-deep">
          <span className="w-1.5 h-1.5 rounded-full bg-sky" /> Gasless · 0.5%
        </span>
      </div>
    </div>
  );
}

function Endpoint({
  flag,
  place,
  sub,
  amount,
  align = "left",
}: {
  flag: string;
  place: string;
  sub: string;
  amount: string;
  align?: "left" | "right";
}) {
  return (
    <div className={`min-w-0 ${align === "right" ? "text-right" : "text-left"}`}>
      <div className="text-xl leading-none mb-1">{flag}</div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate">{sub}</div>
      <div className="text-[15px] font-extrabold text-harbor numerals truncate">{amount}</div>
      <div className="text-[11px] font-medium text-slate truncate">{place}</div>
    </div>
  );
}
