"use client";

// Auto-playing preview of the Pesarc agent, cycling through what it can do:
// settle to a contact (asking which chain or bank), hedge on a prediction
// market, earn on a corridor, and invest (stocks / DeFi lending).
//
// The chat area is a FIXED height with its own scroll, so the streaming replies
// never change the card's height. Agent replies stream in character by
// character rather than popping in.

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, ArrowUp, Check } from "lucide-react";

type Kind = "settle" | "market" | "earn" | "invest";

type Line = {
  from: "user" | "agent";
  text: string;
  visual?: Kind;
  chips?: string[];
};

type Scene = { kind: Kind; label: string; lines: Line[] };

const SCENES: Scene[] = [
  {
    kind: "settle",
    label: "Send",
    lines: [
      { from: "user", text: "Send ₦50,000 to Ama" },
      { from: "agent", text: "Sure, where should Ama get it?", chips: ["cNGN · Base", "GTBank ••4821"] },
      { from: "user", text: "GTBank ••4821" },
      {
        from: "agent",
        visual: "settle",
        text: "Sent ₦50,000 to Ama, GTBank ••4821, settled in local currency.",
      },
    ],
  },
  {
    kind: "market",
    label: "Hedge",
    lines: [
      { from: "user", text: "Hedge 50,000 naira against the dollar" },
      {
        from: "agent",
        visual: "market",
        text: "Backed “USD/NGN ≥ ₦1,700 by Dec”, you’re covered if the naira slides.",
      },
    ],
  },
  {
    kind: "earn",
    label: "Earn",
    lines: [
      { from: "user", text: "Put 200,000 naira to work" },
      {
        from: "agent",
        visual: "earn",
        text: "Deposited to the NGN↔GHS corridor, 9.2% APY, insured, withdraw anytime.",
      },
    ],
  },
  {
    kind: "invest",
    label: "Invest",
    lines: [
      { from: "user", text: "Buy ₦100k of Dangote Cement" },
      {
        from: "agent",
        visual: "invest",
        text: "Bought 183 DANGCEM, priced & settled in cNGN. Or lend it at 6.4%.",
      },
    ],
  },
];

const STREAM_MS = 22; // per 2 chars

export default function AgentPreview() {
  const [scene, setScene] = useState(0);
  const [visible, setVisible] = useState(0); // fully-revealed line count
  const [typing, setTyping] = useState(false);
  const [streamed, setStreamed] = useState(""); // partial text of the streaming agent line
  const streamRef = useRef<ReturnType<typeof setInterval>>();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const lines = SCENES[scene].lines;

    if (visible >= lines.length) {
      const t = setTimeout(() => {
        setScene((s) => (s + 1) % SCENES.length);
        setVisible(0);
        setStreamed("");
        setTyping(false);
      }, 1900);
      return () => clearTimeout(t);
    }

    const line = lines[visible];
    if (line.from === "user") {
      const t = setTimeout(() => setVisible((v) => v + 1), 700);
      return () => clearTimeout(t);
    }

    // Agent: brief typing indicator, then stream the reply in.
    setTyping(true);
    const t1 = setTimeout(() => {
      setTyping(false);
      let i = 0;
      streamRef.current = setInterval(() => {
        i += 2;
        setStreamed(line.text.slice(0, i));
        if (i >= line.text.length) {
          clearInterval(streamRef.current);
          setStreamed("");
          setVisible((v) => v + 1);
        }
      }, STREAM_MS);
    }, 450);

    return () => {
      clearTimeout(t1);
      if (streamRef.current) clearInterval(streamRef.current);
    };
  }, [scene, visible]);

  // Keep the newest content in view within the fixed-height scroll area.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [visible, streamed, typing]);

  const lines = SCENES[scene].lines;
  const shown = lines.slice(0, visible);
  const streamingLine = streamed ? lines[visible] : null;

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
          {SCENES[scene].label}
        </span>
      </div>

      {/* Chat — FIXED height, own scroll (streaming never resizes the card) */}
      <div ref={scrollRef} className="h-[210px] overflow-y-auto px-3.5 py-4 no-scrollbar">
        <div className="flex flex-col justify-end gap-2 min-h-full">
          <AnimatePresence initial={false}>
            {shown.map((line, i) =>
              line.from === "user" ? (
                <motion.div
                  key={`${scene}-u-${i}`}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="self-end max-w-[82%] bg-sky text-white rounded-2xl rounded-br-sm px-3.5 py-2 text-[13px] font-medium"
                >
                  {line.text}
                </motion.div>
              ) : (
                <motion.div
                  key={`${scene}-a-${i}`}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="self-start max-w-[90%] bg-cream text-ink rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-[13px]"
                >
                  <span className="flex items-start gap-1.5">
                    {line.visual && <Check className="w-3.5 h-3.5 text-sky shrink-0 mt-0.5" />}
                    <span>{line.text}</span>
                  </span>
                  {line.chips && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {line.chips.map((c) => (
                        <span
                          key={c}
                          className="rounded-full bg-snow border border-fog text-harbor text-[11px] font-bold px-2.5 py-1"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                  {line.visual && <SceneVisual kind={line.visual} />}
                </motion.div>
              ),
            )}

            {typing && (
              <motion.div
                key={`${scene}-typing`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
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

            {streamingLine && (
              <div
                key={`${scene}-stream`}
                className="self-start max-w-[90%] bg-cream text-ink rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-[13px]"
              >
                {streamed}
                <span className="inline-block w-[2px] h-[13px] align-middle ml-0.5 bg-sky animate-pulse" />
              </div>
            )}
          </AnimatePresence>
        </div>
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
  return (
    <div className="mt-2 h-1.5 rounded-full bg-fog overflow-hidden">
      <motion.div
        className="h-full rounded-full bg-sky"
        initial={{ width: "12%" }}
        animate={{ width: "100%" }}
        transition={{ duration: 1.2, ease: "easeInOut" }}
      />
    </div>
  );
}
