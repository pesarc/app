"use client";

// "Why it holds up" — the technical / infra moats and defensibility, told in
// plain language (the Mum Test) with a small "how" tag for investors and judges.
// One read should land for a customer, an investor and a hackathon judge alike.

import { motion } from "framer-motion";
import {
  TrendingDown,
  ShieldCheck,
  Sparkles,
  Smartphone,
  Coins,
  Lock,
  type LucideIcon,
} from "lucide-react";

const ACCENT = "#3AA0FF";
const ease = [0.22, 1, 0.36, 1] as const;
const mono = { fontFamily: "var(--font-mono, ui-monospace), monospace" } as const;
const serif = { fontFamily: "var(--font-serif, Georgia), serif" } as const;

type Moat = { icon: LucideIcon; title: string; body: string; how: string };

const MOATS: Moat[] = [
  {
    icon: TrendingDown,
    title: "Cheaper as more people join",
    body: "Most transfers cancel each other out before money ever leaves the network, so the fee keeps dropping as we grow.",
    how: "Intent netting",
  },
  {
    icon: ShieldCheck,
    title: "Honest rates, checked openly",
    body: "The amount your person receives is fixed before you press send, and anyone can verify it. No hidden spread.",
    how: "On-chain rate oracle",
  },
  {
    icon: Sparkles,
    title: "No gas, no seed phrase",
    body: "You never buy a coin to pay a fee or write down twelve secret words. It just works, like a normal app.",
    how: "Gasless smart accounts",
  },
  {
    icon: Smartphone,
    title: "Works on any phone",
    body: "The same money on a smartphone, on WhatsApp, and on USSD for a basic phone. Nobody is left out.",
    how: "One core, many channels",
  },
  {
    icon: Coins,
    title: "We own the local-money rails",
    body: "We run the naira, cedis and shillings pools ourselves, so the savings reach you instead of a middleman.",
    how: "Owned FX corridors",
  },
  {
    icon: Lock,
    title: "Your money, only yours",
    body: "Pesarc never holds your balance. There is nothing to freeze, nothing to lose, nothing to run off with.",
    how: "Non-custodial",
  },
];

const VERSUS: { them: string; us: string }[] = [
  { them: "Banks & remittance apps", us: "Seconds not days, your currency not dollars, one clear fee" },
  { them: "Other money wallets", us: "Your money stays yours, and it works on a basic phone" },
  { them: "Crypto apps", us: "No jargon, no gas, no seed phrase, spoken in your own money" },
];

export default function Different() {
  return (
    <section
      id="different"
      className="relative px-6 sm:px-8 lg:px-12 py-24 lg:py-28"
      style={{ borderTop: "1px solid rgba(255,255,255,0.08)", background: "rgba(7,42,77,0.72)" }}
    >
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl mb-14">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45 mb-6" style={mono}>
            Why it holds up
          </span>
          <h2 className="text-white text-4xl sm:text-5xl lg:text-6xl tracking-tight" style={{ ...serif, lineHeight: 1.05 }}>
            Simple on top.{" "}
            <span className="italic text-white/55">Serious underneath.</span>
          </h2>
          <p className="mt-5 max-w-md text-sm text-white/60 leading-relaxed">
            Anyone can build a pretty money app. What makes Pesarc hard to copy is
            what happens under the hood, and why it gets better the more it is used.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MOATS.map((m, i) => {
            const Icon = m.icon;
            return (
              <motion.div
                key={m.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6, ease, delay: i * 0.05 }}
                className="rounded-xl p-6 backdrop-blur-md"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)" }}
              >
                <span className="grid place-items-center w-10 h-10 rounded-lg mb-4" style={{ background: "rgba(58,160,255,0.15)" }}>
                  <Icon className="w-[19px] h-[19px]" style={{ color: ACCENT }} strokeWidth={1.7} />
                </span>
                <h3 className="text-[16px] font-bold text-white mb-2">{m.title}</h3>
                <p className="text-sm font-light leading-relaxed text-white/60">{m.body}</p>
                <span
                  className="inline-block mt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-white/45"
                  style={mono}
                >
                  {m.how}
                </span>
              </motion.div>
            );
          })}
        </div>

        {/* Defensibility, one line for investors. */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, ease }}
          className="mt-12 text-center text-base sm:text-lg font-light text-white/70 max-w-2xl mx-auto"
        >
          The more people send, the cheaper and deeper it gets. Liquidity,
          distribution and a developer platform that compound together.
        </motion.p>

        {/* Compared to — a quick, plain-language contrast. */}
        <div className="mt-14 rounded-2xl border border-white/12 bg-white/[0.02] overflow-hidden">
          {VERSUS.map((v, i) => (
            <div
              key={v.them}
              className={`grid sm:grid-cols-[1fr_auto_2fr] items-center gap-2 sm:gap-6 px-5 sm:px-7 py-5 ${i > 0 ? "border-t border-white/10" : ""}`}
            >
              <span className="text-sm font-semibold text-white/50">{v.them}</span>
              <span className="hidden sm:block text-[11px] font-bold uppercase tracking-[0.2em] text-white/30" style={mono}>
                vs
              </span>
              <span className="text-sm font-medium text-white/85">
                <span style={{ color: ACCENT }}>Pesarc.</span> {v.us}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
