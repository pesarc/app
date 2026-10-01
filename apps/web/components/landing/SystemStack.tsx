"use client";

// "The system, top to bottom" — the masterplan's structural spine, rendered in
// Pesarc's navy brand (content/structure from the StableArc→Pesarc masterplan;
// no gold/mint reskin). A four-stat proof strip + the Face → Core → Edge →
// Ground band stack that frames the whole product: a money app on top, a
// local-currency settlement network underneath, markets at the edge, two VMs on
// the ground.

import { motion } from "framer-motion";

const ACCENT = "#3AA0FF";
const ease = [0.22, 1, 0.36, 1] as const;
const mono = { fontFamily: "var(--font-mono, ui-monospace), monospace" } as const;

const STATS = [
  { big: "8.78%", cap: "the average cross-border remittance fee, what we replace with 0.5 to 1%" },
  { big: "$33T", cap: "stablecoin settlement in 2025, more than Visa and Mastercard combined" },
  { big: "3 to 1", cap: "consumers, LPs, businesses, three experiences on one engine" },
  { big: "2 VMs", cap: "EVM and SVM native, one build across every chain" },
];

const BANDS = [
  {
    lbl: "Face · normal fintech",
    title: "A money app that passes the Mum Test",
    body: "Send, hold, earn and settle in your own currency, to a person, in three taps. Gasless, non-custodial, cash out to a bank or mobile money. The crypto stays invisible.",
    tint: "rgba(107,183,255,0.9)",
  },
  {
    lbl: "Core · settlement",
    title: "Local-currency settlement, priced by your own flow",
    body: "A transfer is a swap whose recipient isn't you. Intents settle your currency straight into theirs as pairs or rings, and the RealizedRateOracle prices from the network's own volume.",
    tint: "rgba(53,227,156,0.9)",
  },
  {
    lbl: "Edge · markets",
    title: "Predict the events you care about, and hedge the corridor you send on",
    body: "A prediction market on elections, sport and prices, worldwide, plus FX hedging on the corridors you already use. The same oracle resolves them and the same engine clears them.",
    tint: "rgba(245,196,81,0.9)",
  },
  {
    lbl: "Ground · runtimes",
    title: "One core, two virtual machines",
    body: "The same settlement core runs natively on EVM (Solidity) and SVM (Anchor). The cross-chain layer moves only residual value between them, so liquidity is never stranded on one chain.",
    tint: "rgba(157,140,255,0.9)",
  },
];

export default function SystemStack() {
  return (
    <section className="relative px-6 sm:px-8 lg:px-12 py-24 lg:py-28" style={{ borderTop: "1px solid rgba(255,255,255,0.08)", background: "rgba(4,26,51,0.55)" }}>
      <div className="mx-auto max-w-6xl">
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45" style={mono}>
          One product, every layer
        </span>

        {/* four-stat proof strip */}
        <div className="mt-8 grid gap-4 grid-cols-2 lg:grid-cols-4">
          {STATS.map((s, i) => (
            <motion.div
              key={s.big}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, ease, delay: i * 0.06 }}
              className="rounded-xl border border-white/12 bg-white/[0.03] p-5"
            >
              <div className="text-3xl sm:text-4xl font-medium tracking-tight" style={{ color: ACCENT }}>{s.big}</div>
              <div className="mt-2 text-[12.5px] leading-snug text-white/55">{s.cap}</div>
            </motion.div>
          ))}
        </div>

        <h2 className="mt-16 text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tighter text-white" style={{ lineHeight: 1.1 }}>
          The system, <span style={{ color: ACCENT }}>top to bottom</span>
        </h2>
        <p className="mt-4 max-w-xl text-sm text-white/55 leading-relaxed">
          A money app on top, a local-currency settlement network underneath,
          markets at the edge, two runtimes on the ground. One account. One engine.
        </p>

        <div className="mt-10 flex flex-col gap-3.5">
          {BANDS.map((b, i) => (
            <motion.div
              key={b.lbl}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, ease, delay: i * 0.07 }}
              className="relative overflow-hidden rounded-xl border border-white/14 bg-white/[0.03] p-5 sm:p-6"
            >
              <span className="absolute top-0 right-0 bottom-0 w-[5px]" style={{ background: b.tint }} />
              <div className="text-[10.5px] font-bold uppercase tracking-[0.16em]" style={{ ...mono, color: b.tint }}>{b.lbl}</div>
              <h4 className="mt-1.5 text-lg sm:text-xl font-medium tracking-tight text-white">{b.title}</h4>
              <p className="mt-1.5 max-w-3xl text-[13.5px] leading-relaxed text-white/55">{b.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
