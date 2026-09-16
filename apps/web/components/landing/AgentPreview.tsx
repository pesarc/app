"use client";

// A self-contained, auto-playing preview of the Pesarc settlement agent —
// a plain-language request turning into a peer-to-peer settlement, on loop.
// Replaces the old "Network Tuner" widget in the hero.

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, ArrowUp, Check } from "lucide-react";

// step: 0 empty · 1 user msg · 2 agent typing · 3 matching + progress ·
// 4 settled · (hold) → loop
const DURATIONS = [700, 900, 700, 2100, 3000];

export default function AgentPreview() {
  const [step, setStep] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    timer.current = setTimeout(
      () => setStep((s) => (s + 1) % DURATIONS.length),
      DURATIONS[step],
    );
    return () => clearTimeout(timer.current);
  }, [step]);

  const showUser = step >= 1;
  const showTyping = step === 2;
  const showMatching = step >= 3;
  const settling = step === 3;
  const settled = step >= 4;

  return (
    <div className="w-[300px] rounded-card bg-snow border border-fog shadow-pop overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-cream">
        <span className="w-8 h-8 rounded-full bg-sky/15 flex items-center justify-center text-sky">
          <Bot className="w-4 h-4" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-extrabold text-harbor leading-tight">
            Settlement agent
          </div>
          <div className="flex items-center gap-1.5 text-[10.5px] font-bold text-slate">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" /> online
          </div>
        </div>
      </div>

      {/* Chat */}
      <div className="px-3.5 py-4 space-y-2.5 min-h-[184px] flex flex-col justify-end">
        <AnimatePresence mode="popLayout">
          {showUser && (
            <motion.div
              key="user"
              layout
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="self-end max-w-[80%] bg-sky text-white rounded-2xl rounded-br-sm px-3.5 py-2 text-[13px] font-medium"
            >
              Send 1,000 cedis to Lagos
            </motion.div>
          )}

          {showTyping && (
            <motion.div
              key="typing"
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="self-start bg-cream rounded-2xl rounded-bl-sm px-3.5 py-2.5 flex gap-1"
            >
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-slate"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
                />
              ))}
            </motion.div>
          )}

          {showMatching && (
            <motion.div
              key="matching"
              layout
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="self-start max-w-[88%] bg-cream text-ink rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-[13px]"
            >
              {settled ? (
                <span className="flex items-start gap-1.5">
                  <Check className="w-3.5 h-3.5 text-sky shrink-0 mt-0.5" />
                  <span>
                    Settled <span className="font-bold text-harbor">₵1,000 → ₦105,000</span>{" "}
                    peer-to-peer — no dollar in the path.
                  </span>
                </span>
              ) : (
                <>Matching your ₵1,000 against opposing ₦ flow…</>
              )}

              {/* progress bar */}
              <div className="mt-2 h-1.5 rounded-full bg-fog overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-sky"
                  initial={{ width: "8%" }}
                  animate={{ width: settled ? "100%" : settling ? "72%" : "8%" }}
                  transition={{ duration: settling ? 1.9 : 0.5, ease: "easeInOut" }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Composer (decorative) */}
      <div className="flex items-center gap-2 px-3.5 pb-3.5">
        <div className="flex-1 rounded-pill bg-cream border border-fog px-3.5 py-2 text-[12.5px] text-slate/70">
          Just say what to send…
        </div>
        <span className="w-8 h-8 rounded-full bg-sky text-white flex items-center justify-center shrink-0">
          <ArrowUp className="w-4 h-4" />
        </span>
      </div>
    </div>
  );
}
