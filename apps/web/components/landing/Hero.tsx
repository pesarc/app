"use client";

import { motion } from "framer-motion";
import { ArrowUpRight } from "@/components/icons";
import AgentPreview from "./AgentPreview";
import LivePreview from "./LivePreview";
import { AccentButton, ACCENT } from "./ui";

const ease = [0.22, 1, 0.36, 1] as const;

export default function Hero() {
  return (
    <section className="relative w-full min-h-screen overflow-hidden">
      <div className="relative z-10 flex flex-col min-h-screen px-6 md:px-12 pt-24 pb-8 md:pt-24 pointer-events-none">
        {/* Headline */}
        <div className="flex-1 flex items-center pt-10 sm:pt-8 lg:pt-0">
          <div className="w-full max-w-2xl pointer-events-none select-none">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease, delay: 0.18 }}
              className="text-[3rem] sm:text-7xl lg:text-[5.4rem] font-medium tracking-tighter text-white text-balance uppercase"
              style={{ lineHeight: 1.06 }}
            >
              Send money
              <br />
              <span style={{ color: ACCENT }}>in seconds.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease, delay: 0.28 }}
              className="mt-6 max-w-md text-base md:text-lg text-white/60 leading-relaxed"
            >
              One simple app to send, hold, earn and settle money across borders,
              in your own currency. No big fees, no waiting, no jargon, just money
              the way you already think about it.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease, delay: 0.36 }}
              className="mt-9 flex flex-wrap items-center gap-4 pointer-events-auto w-fit"
            >
              <AccentButton href="#beta" icon={ArrowUpRight} badge className="px-6 py-3.5 text-sm uppercase tracking-wide">
                Join beta
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

        {/*
          Floating widgets. On phones/tablets they are a horizontal, snapping
          card carousel that bleeds to the screen edge (a compact proof strip,
          not two giant stacked blocks). On desktop they return to a floating
          vertical stack pinned bottom-right.
        */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease, delay: 0.5 }}
          className="z-20 mt-12 sm:mt-14 flex gap-4 -mx-6 px-6 py-4 overflow-x-auto snap-x snap-mandatory no-scrollbar pointer-events-auto
                     lg:absolute lg:bottom-10 lg:right-12 lg:mt-0 lg:mx-0 lg:px-0 lg:py-0 lg:overflow-visible lg:flex-col lg:items-end"
        >
          <motion.div
            className="snap-center shrink-0 w-[86vw] max-w-[340px] lg:w-auto lg:max-w-none"
            animate={{ y: [0, -7, 0] }}
            transition={{ duration: 8.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <LivePreview />
          </motion.div>
          <motion.div
            className="snap-center shrink-0 w-[86vw] max-w-[340px] lg:w-auto lg:max-w-none"
            animate={{ y: [0, -7, 0] }}
            transition={{ duration: 8.5, repeat: Infinity, ease: "easeInOut", delay: 1.4 }}
          >
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
        </div>
      </div>
    </section>
  );
}

function Badge() {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/90"
      style={{ border: "1px solid rgba(58,160,255,0.35)", background: "rgba(58,160,255,0.06)" }}
    >
      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: ACCENT }} />
      Stablecoin settlement platform
    </span>
  );
}
