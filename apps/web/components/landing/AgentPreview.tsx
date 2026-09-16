"use client";

// Auto-playing preview of the Pesarc agent, cycling through what it can do:
// settle money, hedge on a prediction market, earn on a corridor, and invest
// (stocks / DeFi lending). Each scene: user asks → agent works → result, on loop.

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, ArrowUp, Check, Shield, Sprout, LineChart, Send } from "lucide-react";

type Kind = "settle" | "market" | "earn" | "invest";

type Scene = {
  kind: Kind;
  icon: typeof Send;
  prompt: string;
  reply: React.ReactNode;
};

const SCENES: Scene[] = [
  {
    kind: "settle",
    icon: Send,
    prompt: "Send 1,000 cedis to Lagos",
    reply: (
      <>
        Settled <b className="text-harbor">₵1,000 → ₦105,000</b> peer-to-peer — no dollar in the
        path.
      </>
    ),
  },
  {
    kind: "market",
    icon: Shield,
    prompt: "Hedge 50,000 naira against the dollar",
    reply: (
      <>
        Backed <b className="text-harbor">“USD/NGN ≥ ₦1,700 by Dec”</b> — you’re covered if the
        naira slides.
      </>
    ),
  },
  {
    kind: "earn",
    icon: Sprout,
    prompt: "Put 200,000 naira to work",
    reply: (
      <>
        Deposited to the <b className="text-harbor">NGN↔GHS corridor</b> — 9.2% APY, insured,
        withdraw anytime.
      </>
    ),
  },
  {
    kind: "invest",
    icon: LineChart,
    prompt: "Buy ₦100k of Dangote Cement",
    reply: (
      <>
        Bought <b className="text-harbor">183 DANGCEM</b> — priced &amp; settled in cNGN. Or lend it
        at 6.4%.
      </>
    ),
  },
];

// phase: 0 user · 1 typing · 2 reply+visual · 3 hold → next scene
const PHASE_MS = [900, 700, 2600, 900];

export default function AgentPreview() {
  const [scene, setScene] = useState(0);
  const [phase, setPhase] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    timer.current = setTimeout(() => {
      if (phase < PHASE_MS.length - 1) {
        setPhase((p) => p + 1);
      } else {
        setPhase(0);
        setScene((s) => (s + 1) % SCENES.length);
      }
    }, PHASE_MS[phase]);
    return () => clearTimeout(timer.current);
  }, [phase]);

  const s = SCENES[scene];
  const showUser = phase >= 0;
  const showTyping = phase === 1;
  const showReply = phase >= 2;

  return (
    <div className="w-[300px] rounded-card bg-snow border border-fog shadow-pop overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-cream">
        <span className="w-8 h-8 rounded-full bg-sky/15 flex items-center justify-center text-sky">
          <Bot className="w-4 h-4" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-extrabold text-harbor leading-tight">Pesarc agent</div>
          <div className="flex items-center gap-1.5 text-[10.5px] font-bold text-slate">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" /> online
          </div>
        </div>
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate">
          {s.kind === "settle"
            ? "Send"
            : s.kind === "market"
            ? "Hedge"
            : s.kind === "earn"
            ? "Earn"
            : "Invest"}
        </span>
      </div>

      {/* Chat */}
      <div className="px-3.5 py-4 space-y-2.5 min-h-[184px] flex flex-col justify-end">
        <AnimatePresence mode="popLayout">
          {showUser && (
            <motion.div
              key={`u-${scene}`}
              layout
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              className="self-end max-w-[82%] bg-sky text-white rounded-2xl rounded-br-sm px-3.5 py-2 text-[13px] font-medium"
            >
              {s.prompt}
            </motion.div>
          )}

          {showTyping && (
            <motion.div
              key={`t-${scene}`}
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

          {showReply && (
            <motion.div
              key={`r-${scene}`}
              layout
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              className="self-start max-w-[90%] bg-cream text-ink rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-[13px]"
            >
              <span className="flex items-start gap-1.5">
                <Check className="w-3.5 h-3.5 text-sky shrink-0 mt-0.5" />
                <span>{s.reply}</span>
              </span>
              <SceneVisual kind={s.kind} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Composer (decorative) */}
      <div className="flex items-center gap-2 px-3.5 pb-3.5">
        <div className="flex-1 rounded-pill bg-cream border border-fog px-3.5 py-2 text-[12.5px] text-slate/70">
          Ask the agent anything…
        </div>
        <span className="w-8 h-8 rounded-full bg-sky text-white flex items-center justify-center shrink-0">
          <ArrowUp className="w-4 h-4" />
        </span>
      </div>
    </div>
  );
}

/** A tiny result visual tuned to each capability. */
function SceneVisual({ kind }: { kind: Kind }) {
  if (kind === "market") {
    return (
      <div className="mt-2">
        <div className="flex h-1.5 rounded-full overflow-hidden">
          <div className="bg-sky" style={{ width: "62%" }} />
          <div className="bg-fog" style={{ width: "38%" }} />
        </div>
        <div className="flex justify-between mt-1 text-[10.5px] font-bold">
          <span className="text-sky-deep">Yes 62%</span>
          <span className="text-slate">No 38%</span>
        </div>
      </div>
    );
  }
  if (kind === "earn" || kind === "invest") {
    return (
      <div className="mt-2 flex items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-sky-tint/50 text-sky-deep text-[10.5px] font-extrabold px-2 py-0.5">
          {kind === "earn" ? "9.2% APY" : "DANGCEM · 183 sh"}
        </span>
        <span className="text-[10.5px] font-bold text-slate">settled in cNGN</span>
      </div>
    );
  }
  // settle → a quick fill bar
  return (
    <div className="mt-2 h-1.5 rounded-full bg-fog overflow-hidden">
      <motion.div
        className="h-full rounded-full bg-sky"
        initial={{ width: "10%" }}
        animate={{ width: "100%" }}
        transition={{ duration: 1.4, ease: "easeInOut" }}
      />
    </div>
  );
}
