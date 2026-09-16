"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Zap } from "lucide-react";
import Globe from "./Globe";
import AgentPreview from "./AgentPreview";
import { site } from "@pesarc/sdk/site";
import { LogoMark } from "@/components/app/Logo";

const ease = [0.22, 1, 0.36, 1] as const;

export default function Hero() {
  return (
    <section className="relative w-full min-h-screen overflow-hidden bg-cream [color-scheme:light]">
      {/* Soft sky glow, top-right */}
      <div className="pointer-events-none absolute -top-40 right-[-10%] w-[680px] h-[680px] rounded-full bg-sky/10 blur-[130px]" />
      {/* Faint dotted grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage:
            "radial-gradient(rgba(19,66,111,0.06) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
          maskImage: "radial-gradient(circle at 70% 40%, black 30%, transparent 78%)",
          WebkitMaskImage: "radial-gradient(circle at 70% 40%, black 30%, transparent 78%)",
        }}
      />

      {/* Globe — navy sphere, right of centre, on the back layer */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.4, ease }}
        className="absolute inset-y-0 left-1/2 lg:left-[54%] -translate-x-1/2 w-full lg:w-[78%] z-0"
      >
        <Globe />
      </motion.div>

      {/* Cream fade keeps the headline legible over the globe */}
      <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-r from-cream via-cream/85 to-transparent lg:via-cream/55" />

      <div className="relative z-10 flex flex-col min-h-screen px-6 md:px-12 py-6 md:py-8">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease }}
          className="flex items-center justify-between"
        >
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark size={34} className="rounded-xl shadow-pop-sm" />
            <span className="text-xl font-extrabold tracking-tight text-harbor">{site.name}</span>
          </Link>

          <nav className="flex items-center gap-2 sm:gap-6">
            {site.nav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="hidden sm:inline text-[13px] font-bold text-slate hover:text-harbor transition-colors"
              >
                {item.label}
              </a>
            ))}
            <Link
              href="/home"
              className="inline-flex items-center gap-1.5 rounded-pill bg-harbor text-white text-[13px] font-bold px-4 py-2 shadow-pop-sm hover:-translate-y-0.5 transition-transform"
            >
              Open app <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </nav>
        </motion.header>

        {/* Headline */}
        <div className="flex-1 flex items-center">
          <div className="w-full max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease, delay: 0.1 }}
              className="inline-flex items-center gap-2 rounded-pill bg-sky-tint/60 text-sky-deep text-[12px] font-extrabold uppercase tracking-widest px-3.5 py-1.5 mb-6"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-sky animate-pulse" />
              Stablecoin settlement network
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease, delay: 0.18 }}
              className="text-[15vw] sm:text-7xl lg:text-8xl font-extrabold tracking-tight text-harbor leading-[0.95] text-balance"
            >
              Send money
              <br />
              <span className="text-sky">anywhere.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease, delay: 0.28 }}
              className="mt-6 max-w-md text-base md:text-lg text-slate font-medium leading-relaxed"
            >
              One gasless app to send, hold, earn, and settle money across borders.
              No seed phrase, no gas, no jargon — just money, the way you already
              think about it.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease, delay: 0.36 }}
              className="mt-9 flex flex-wrap items-center gap-4"
            >
              <a
                href="#waitlist"
                className="group inline-flex items-center gap-2 rounded-pill bg-sky text-white px-6 py-3.5 text-sm font-extrabold shadow-pop hover:-translate-y-0.5 transition-transform"
              >
                Get early access
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </a>
              <div className="inline-flex items-center gap-2 text-[13px] font-bold text-slate">
                <span className="relative flex w-2 h-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-[#4ade80] opacity-70 animate-ping" />
                  <span className="relative inline-flex rounded-full w-2 h-2 bg-[#22c55e]" />
                </span>
                Network live
              </div>
            </motion.div>
          </div>
        </div>

        {/* Floating widgets — corridor + live agent preview */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease, delay: 0.5 }}
          className="lg:absolute lg:bottom-10 lg:right-12 z-20 flex flex-col items-stretch lg:items-end gap-3 mt-10 lg:mt-0"
        >
          <motion.div
            animate={{ y: [0, -7, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="w-[300px] rounded-card bg-snow border border-fog shadow-pop p-4"
          >
            <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-widest text-slate mb-3">
              <Zap className="w-3.5 h-3.5 text-sky" /> Corridor · live
            </div>
            <div className="flex items-center justify-between">
              <Endpoint flag="🇬🇭" place="Accra" sub="You send" amount="₵1,000" />
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
              <Endpoint flag="🇳🇬" place="Lagos" sub="They get" amount="₦105k" align="right" />
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-cream text-[11px] font-bold">
              <span className="text-slate">Settles <span className="text-harbor">&lt;30s</span></span>
              <span className="inline-flex items-center gap-1.5 text-sky-deep">
                <span className="w-1.5 h-1.5 rounded-full bg-sky" /> Gasless · 0.5%
              </span>
            </div>
          </motion.div>

          <motion.div
            animate={{ y: [0, -7, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
          >
            <AgentPreview />
          </motion.div>
        </motion.div>

        {/* Meta */}
        <div className="hidden lg:flex absolute bottom-8 left-12 flex-col gap-0.5 text-[11px] font-bold uppercase tracking-widest text-slate/70">
          <span>{site.protocolVersion}</span>
          <span>Gasless · Non-custodial</span>
        </div>
      </div>
    </section>
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
    <div className={align === "right" ? "text-right" : "text-left"}>
      <div className="text-xl leading-none mb-1">{flag}</div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate">{sub}</div>
      <div className="text-[15px] font-extrabold text-harbor numerals">{amount}</div>
      <div className="text-[11px] font-medium text-slate">{place}</div>
    </div>
  );
}
