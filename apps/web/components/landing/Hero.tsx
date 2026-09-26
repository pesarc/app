"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, LayoutGrid, Globe2, Sparkles, type LucideIcon } from "lucide-react";
import AgentPreview from "./AgentPreview";
import CorridorPreview from "./CorridorPreview";
import { NavPill, AccentButton, ACCENT } from "./ui";
import { site } from "@pesarc/sdk/site";
import { LogoMark } from "@/components/app/Logo";

const ease = [0.22, 1, 0.36, 1] as const;
const NAV_ICON: Record<string, LucideIcon> = {
  Features: LayoutGrid,
  Networks: Globe2,
  Beta: Sparkles,
};

export default function Hero() {
  return (
    <section className="relative w-full min-h-screen overflow-hidden">
      <div className="relative z-10 flex flex-col min-h-screen px-6 md:px-12 py-8 md:py-8 pointer-events-none">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease }}
          className="flex items-center justify-between pointer-events-auto"
        >
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark size={34} className="rounded-xl" />
            <span className="text-xl font-medium tracking-tight text-white">{site.name}</span>
          </Link>

          <nav className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2">
              {site.nav.map((item) => (
                <NavPill
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={NAV_ICON[item.label] ?? LayoutGrid}
                />
              ))}
            </div>
            <AccentButton href={`${site.appUrl}/home`} size="sm" icon={ArrowUpRight}>
              Open app
            </AccentButton>
          </nav>
        </motion.header>

        {/* Headline */}
        <div className="flex-1 flex items-center">
          <div className="w-full max-w-2xl pointer-events-none select-none">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease, delay: 0.18 }}
              className="text-[3rem] sm:text-7xl lg:text-[5.4rem] font-medium tracking-tighter text-white text-balance"
              style={{ lineHeight: 1.06 }}
            >
              Send money
              <br />
              <span style={{ color: ACCENT }}>anywhere.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease, delay: 0.28 }}
              className="mt-6 max-w-md text-base md:text-lg text-white/60 leading-relaxed"
            >
              One gasless app to send, hold, earn, and settle money across borders.
              No seed phrase, no gas, no jargon, just money the way you already
              think about it.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease, delay: 0.36 }}
              className="mt-9 flex flex-wrap items-center gap-4 pointer-events-auto w-fit"
            >
              <AccentButton href="#beta" icon={ArrowUpRight} badge className="px-6 py-3.5 text-sm">
                Become a beta-tester
              </AccentButton>
              <div className="inline-flex items-center gap-2 text-[13px] font-medium text-white/70">
                <span className="relative flex w-2 h-2">
                  <span className="absolute inline-flex h-full w-full rounded-full opacity-70 animate-ping" style={{ background: ACCENT }} />
                  <span className="relative inline-flex rounded-full w-2 h-2" style={{ background: ACCENT }} />
                </span>
                Network live
              </div>
            </motion.div>
          </div>
        </div>

        {/* Floating widgets: corridor + live agent preview */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease, delay: 0.5 }}
          className="lg:absolute lg:bottom-10 lg:right-12 z-20 flex flex-col items-stretch lg:items-end gap-4 mt-14 lg:mt-0 pointer-events-auto"
        >
          <motion.div animate={{ y: [0, -7, 0] }} transition={{ duration: 8.5, repeat: Infinity, ease: "easeInOut" }}>
            <CorridorPreview />
          </motion.div>
          <motion.div animate={{ y: [0, -7, 0] }} transition={{ duration: 8.5, repeat: Infinity, ease: "easeInOut", delay: 1.4 }}>
            <AgentPreview />
          </motion.div>
        </motion.div>

        {/* Badge, moved to the foot of the hero so the headline leads on small
            screens. In-flow at the bottom on phones/tablets, tucked into the
            corner meta on desktop. */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease, delay: 0.6 }}
          className="lg:hidden mt-14 pointer-events-auto"
        >
          <Badge />
        </motion.div>

        {/* Meta (desktop only) */}
        <div className="hidden lg:flex absolute bottom-8 left-12 flex-col items-start gap-3 pointer-events-auto">
          <Badge />
          <div className="flex flex-col gap-0.5 text-[11px] font-medium uppercase tracking-widest text-white/40">
            <span>{site.protocolVersion}</span>
            <span>Gasless · Non-custodial</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function Badge() {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12px] font-medium text-white/90"
      style={{ border: "1px solid rgba(58,160,255,0.35)", background: "rgba(58,160,255,0.06)" }}
    >
      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: ACCENT }} />
      Stablecoin settlement network
    </span>
  );
}
