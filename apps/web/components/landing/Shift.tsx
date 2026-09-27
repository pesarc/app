"use client";

// "The Shift" + "One Layer" — ported like-for-like from the agentic-AI reference
// and reskinned to Pesarc (navy / #3AA0FF), with scroll-reveal transitions.
//   - The Shift: a two-column "Today's Reality" (dimmed) vs "The Pesarc Layer"
//     (lit) contrast with a centre VS divider.
//   - One Layer: the orchestration-layer statement + a rails -> layer -> app
//     flow diagram + three differentiator cards.

import { motion } from "framer-motion";
import {
  Clock,
  Lock,
  Banknote,
  TrendingDown,
  Send,
  Coins,
  Receipt,
  ShieldCheck,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";

const ACCENT = "#3AA0FF";
const ease = [0.22, 1, 0.36, 1] as const;

type Row = { icon: LucideIcon; label: string };

const TODAY: Row[] = [
  { icon: Clock, label: "Days of waiting" },
  { icon: Banknote, label: "Big hidden fees" },
  { icon: Lock, label: "Dollar accounts" },
  { icon: TrendingDown, label: "Savings that melt" },
];

const PESARC: Row[] = [
  { icon: Send, label: "Money in seconds" },
  { icon: Receipt, label: "One clear fee" },
  { icon: Coins, label: "Your own currency" },
  { icon: ShieldCheck, label: "A balance that holds" },
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center rounded-full border border-white/15 bg-white/[0.04] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60"
      style={{ fontFamily: "var(--font-mono, ui-monospace), monospace" }}
    >
      {children}
    </span>
  );
}

function RowItem({ icon: Icon, label, lit }: Row & { lit?: boolean }) {
  return (
    <div className="flex items-center gap-3.5">
      <Icon
        className="w-[22px] h-[22px] shrink-0"
        style={{ color: lit ? ACCENT : undefined }}
        strokeWidth={1.6}
      />
      <span
        className={`text-[11px] font-bold uppercase tracking-[0.18em] ${lit ? "text-white" : "text-white/60"}`}
        style={{ fontFamily: "var(--font-mono, ui-monospace), monospace" }}
      >
        {label}
      </span>
    </div>
  );
}

function TheShift() {
  return (
    <section className="relative px-6 sm:px-8 lg:px-12 py-24 lg:py-28" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 text-center">
          <Eyebrow>The shift</Eyebrow>
        </div>

        <div className="relative flex flex-col md:flex-row">
          {/* Centre VS divider (desktop) */}
          <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-px flex-col items-center justify-center" style={{ background: "rgba(255,255,255,0.12)" }}>
            <span
              className="grid place-items-center w-9 h-9 rounded-full border border-white/15 text-[11px] font-bold text-white/50"
              style={{ background: "#041a33", fontFamily: "var(--font-mono, ui-monospace), monospace" }}
            >
              VS
            </span>
          </div>

          {/* Today's Reality — dimmed */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 0.55, y: 0 }}
            whileHover={{ opacity: 0.85 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease }}
            className="w-full md:w-1/2 md:pr-20 pb-14 md:pb-0"
            style={{ filter: "grayscale(1)" }}
          >
            <h3 className="italic text-3xl sm:text-4xl tracking-tight mb-10 text-white/60" style={{ fontFamily: "var(--font-serif, Georgia), serif" }}>
              &ldquo;Today&apos;s reality&rdquo;
            </h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-7 mb-9">
              {TODAY.map((r) => (
                <RowItem key={r.label} {...r} />
              ))}
            </div>
            <p className="max-w-sm text-[15px] font-light leading-relaxed text-white/50">
              Long queues and forms. Fees you only find at the end. A dollar
              account you cannot get. Savings that quietly lose value.
            </p>
          </motion.div>

          {/* The Pesarc Layer — lit */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease, delay: 0.1 }}
            className="w-full md:w-1/2 md:pl-20 pt-14 md:pt-0 border-t md:border-t-0 border-white/10"
          >
            <h3 className="italic text-3xl sm:text-4xl tracking-tight mb-10 text-white" style={{ fontFamily: "var(--font-serif, Georgia), serif" }}>
              &ldquo;The Pesarc layer&rdquo;
            </h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-7 mb-9">
              {PESARC.map((r) => (
                <RowItem key={r.label} {...r} lit />
              ))}
            </div>
            <p className="max-w-sm text-[15px] font-light leading-relaxed text-white/80">
              One app. Send, hold, earn and cash out in your own money, in
              seconds, for a fee you can actually read. No jargon, no waiting.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function FlowNode({ eyebrow, title, primary = false }: { eyebrow: string; title: string; primary?: boolean }) {
  return (
    <div
      className={`w-full md:w-1/3 rounded-xl p-6 text-center ${primary ? "shadow-[0_20px_40px_-12px_rgba(58,160,255,0.4)] scale-[1.04]" : ""}`}
      style={
        primary
          ? { background: "linear-gradient(135deg,#3AA0FF,#1f7fe0)", color: "#04294d" }
          : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.14)" }
      }
    >
      <span
        className={`block text-[10px] font-bold uppercase tracking-[0.2em] mb-2 ${primary ? "text-[#04294d]/70" : "text-white/45"}`}
        style={{ fontFamily: "var(--font-mono, ui-monospace), monospace" }}
      >
        {eyebrow}
      </span>
      <span className={`italic text-xl sm:text-2xl tracking-tight ${primary ? "text-[#04294d]" : "text-white"}`} style={{ fontFamily: "var(--font-serif, Georgia), serif" }}>
        {title}
      </span>
    </div>
  );
}

function Connector({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center shrink-0" style={{ color: ACCENT }}>
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] mb-1.5 opacity-70" style={{ fontFamily: "var(--font-mono, ui-monospace), monospace" }}>
        {label}
      </span>
      <ArrowRight className="w-7 h-7 rotate-90 md:rotate-0" />
    </div>
  );
}

const DIFFERENTIATORS = [
  { n: "01", tag: "Your money, yours", body: "Only you can touch your money. Pesarc never holds it for you, and there is nothing new to sign up for or hand over." },
  { n: "02", tag: "Just ask", body: "Say what you need, in the app or on WhatsApp, and it happens. Send money, pay a bill, top up airtime, in your own words." },
  { n: "03", tag: "One balance", body: "Send, hold, earn and cash out from a single balance in your own currency, wherever the money needs to go." },
];

function OneLayer() {
  return (
    <section className="relative px-6 sm:px-8 lg:px-12 py-24 lg:py-28" style={{ borderTop: "1px solid rgba(255,255,255,0.08)", background: "rgba(4,26,51,0.55)" }}>
      <div className="mx-auto max-w-6xl">
        <span className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45 mb-8" style={{ fontFamily: "var(--font-mono, ui-monospace), monospace" }}>
          Why Pesarc
        </span>

        <div className="grid gap-10 lg:grid-cols-2 mb-20">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.8, ease }}
            className="text-4xl sm:text-5xl md:text-6xl leading-[1.02] tracking-tight text-white"
            style={{ fontFamily: "var(--font-serif, Georgia), serif" }}
          >
            One layer.
            <br />
            <span className="italic text-white/55">Everything connected.</span>
          </motion.h2>
          <div className="flex items-center">
            <p className="max-w-lg text-base sm:text-lg font-light leading-relaxed text-white/60">
              Pesarc does not ask you to leave your money behind. It works with the
              banks and mobile money you already use, and quietly does the hard
              part in the middle, so money sent from Lagos lands in Accra in
              seconds, in the currency each person actually holds.
            </p>
          </div>
        </div>

        {/* rails -> layer -> app flow */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease }}
          className="w-full rounded-2xl border border-white/12 bg-white/[0.03] p-6 sm:p-8 mb-16 flex flex-col md:flex-row items-center justify-between gap-6"
        >
          <FlowNode eyebrow="What you use" title="Bank & mobile money" />
          <Connector label="in" />
          <FlowNode eyebrow="In the middle" title="Pesarc" primary />
          <Connector label="out" />
          <FlowNode eyebrow="What you get" title="Send, hold, earn" />
        </motion.div>

        {/* differentiators */}
        <div className="grid gap-4 md:grid-cols-3">
          {DIFFERENTIATORS.map((d, i) => (
            <motion.div
              key={d.n}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, ease, delay: i * 0.08 }}
              className="rounded-xl p-7 backdrop-blur-md"
              style={{ background: "rgba(255,255,255,0.04)", borderTop: `2px solid ${ACCENT}` }}
            >
              <div className="flex items-center gap-3 mb-5 pb-5 border-b border-white/10">
                <span className="text-[11px] font-bold text-white/40" style={{ fontFamily: "var(--font-mono, ui-monospace), monospace" }}>{d.n}</span>
                <span className="text-[11px] font-bold text-white uppercase tracking-[0.18em]" style={{ fontFamily: "var(--font-mono, ui-monospace), monospace" }}>{d.tag}</span>
              </div>
              <p className="text-sm font-light leading-relaxed text-white/60">{d.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Shift() {
  return (
    <>
      <TheShift />
      <OneLayer />
    </>
  );
}
