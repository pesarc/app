"use client";

// "The Platform" (five pillars around a core node) + the closing CTA — ported
// like-for-like from the agentic-AI reference and reskinned to Pesarc navy /
// #3AA0FF, with scroll-reveal transitions and the serif-italic accent headings.

import { motion } from "framer-motion";
import { LineChart, Send, Sprout, Bot, ArrowLeftRight, ArrowRight } from "lucide-react";
import { site } from "@pesarc/sdk/site";

const ACCENT = "#3AA0FF";
const ease = [0.22, 1, 0.36, 1] as const;
const mono = { fontFamily: "var(--font-mono, ui-monospace), monospace" } as const;
const serif = { fontFamily: "var(--font-serif, Georgia), serif" } as const;

const PILLARS = [
  { n: "01", tag: "Predict", body: "Yes or No markets on Africa's elections, football, prices and the world. Take a side in a tap." },
  { n: "02", tag: "Settle", body: "Send and settle across borders in local currency, gasless, in under a minute." },
  { n: "03", tag: "Earn", body: "Grow idle balances in insured vaults and put your winnings back to work." },
  { n: "04", tag: "Agent", body: "An AI agent reads the odds, trades and settles for you, in the app or on WhatsApp." },
  { n: "05", tag: "Cash in and out", body: "Top up and withdraw through the banks and mobile money people actually use." },
] as const;

// grid placement mirrors the reference: cards on the flanks, core node centre.
const POS = [
  "md:col-start-1 md:row-start-1",
  "md:col-start-3 md:row-start-1",
  "md:col-start-1 md:row-start-2 md:mt-12",
  "md:col-start-3 md:row-start-2 md:mt-12",
  "md:col-start-2 md:row-start-3 md:mt-8",
] as const;

function PillarCard({ n, tag, body, className, index }: { n: string; tag: string; body: string; className: string; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, ease, delay: index * 0.06 }}
      className={`relative z-10 rounded-xl border border-white/12 bg-white/[0.03] p-7 backdrop-blur-md transition-transform hover:-translate-y-1 ${className}`}
    >
      <span className="grid place-items-center w-8 h-8 rounded-full border border-white/15 bg-white/[0.04] mb-5 text-[11px] font-bold text-white" style={mono}>{n}</span>
      <h4 className="text-[11px] font-bold uppercase tracking-[0.18em] text-white mb-4 pb-4 border-b border-white/10" style={mono}>{tag}</h4>
      <p className="text-sm font-light leading-relaxed text-white/60">{body}</p>
    </motion.div>
  );
}

export function Platform() {
  return (
    <section id="platform" className="relative px-6 sm:px-8 lg:px-12 py-24 lg:py-28 overflow-hidden" style={{ borderTop: "1px solid rgba(255,255,255,0.08)", background: "rgba(4,26,51,0.55)" }}>
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45 mb-5" style={mono}>The platform</span>
          <h2 className="text-4xl sm:text-5xl md:text-6xl leading-[1.02] tracking-tight text-white" style={serif}>
            Five pillars.
            <br />
            <span className="italic text-white/55">One balance.</span>
          </h2>
        </div>

        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* centre core node */}
          <div className="hidden md:flex absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-60 h-60 rounded-full items-center justify-center z-0" style={{ background: "rgba(4,26,51,0.85)", border: "1px solid rgba(255,255,255,0.12)", backdropFilter: "blur(8px)" }}>
            <div className="relative w-44 h-44 rounded-full flex flex-col items-center justify-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.12)" }}>
              <span className="absolute inset-0 rounded-full animate-ping" style={{ border: `1px solid ${ACCENT}55`, animationDuration: "4s" }} />
              <span className="relative z-10 text-2xl tracking-tight text-white" style={serif}>Pesarc</span>
              <span className="relative z-10 mt-1.5 text-[11px] tracking-[0.2em] text-white/45" style={mono}>GOLDGARD CORE</span>
            </div>
          </div>

          {PILLARS.map((p, i) => (
            <PillarCard key={p.n} {...p} className={POS[i]} index={i} />
          ))}
          {/* spacer to hold the centre column on desktop */}
          <div className="hidden md:block md:col-start-2 md:row-start-2" aria-hidden />
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  const appHref = `${site.appUrl}/home`;
  return (
    <section className="relative min-h-[60vh] flex flex-col items-center justify-center text-center px-6 py-28" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-40"
        style={{ backgroundImage: "linear-gradient(rgba(58,160,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(58,160,255,0.06) 1px, transparent 1px)", backgroundSize: "48px 48px" }}
        aria-hidden
      />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.8, ease }}
        className="relative z-10 max-w-2xl mx-auto flex flex-col items-center"
      >
        <span className="grid place-items-center w-12 h-12 rounded-lg border border-white/20 mb-9 overflow-hidden relative" style={{ background: "rgba(255,255,255,0.03)" }}>
          <span className="absolute w-full h-px rotate-45" style={{ background: ACCENT }} />
          <span className="absolute w-full h-px -rotate-45" style={{ background: ACCENT }} />
        </span>

        <h2 className="text-4xl sm:text-5xl md:text-7xl leading-[1.02] tracking-tight text-white mb-7" style={serif}>
          Ready to predict
          <br />
          <span className="italic text-white/55">Africa?</span>
        </h2>
        <p className="text-base sm:text-lg font-light text-white/60 mb-11 max-w-lg">
          Join the early beta and trade the elections, football and prices you
          already argue about, gasless, in your own currency.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-5">
          <a
            href="#beta"
            className="group inline-flex items-center justify-center gap-2.5 rounded-lg px-8 py-4 w-full sm:w-auto text-sm font-medium text-[#04294d] transition-all duration-300 hover:-translate-y-0.5"
            style={{ background: ACCENT }}
          >
            <span className="uppercase tracking-[0.14em] text-[13px] font-bold" style={mono}>Become a beta-tester</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </a>
          <a href={appHref} className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/60 hover:text-white transition-colors border-b border-transparent hover:border-white/40 pb-1" style={mono}>
            Open the app
          </a>
        </div>
      </motion.div>

      <div className="absolute bottom-7 w-full text-center opacity-60">
        <span className="text-[11px] uppercase tracking-[0.2em] text-white/45" style={mono}>Pesarc — prediction markets for Africa</span>
      </div>
    </section>
  );
}
