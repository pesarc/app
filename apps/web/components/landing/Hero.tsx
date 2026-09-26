"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import AgentPreview from "./AgentPreview";
import CorridorPreview from "./CorridorPreview";
import { site } from "@pesarc/sdk/site";
import { LogoMark } from "@/components/app/Logo";

const ease = [0.22, 1, 0.36, 1] as const;
const LIME = "#c8f542";

export default function Hero() {
  return (
    <section className="relative w-full min-h-screen overflow-hidden">
      <div className="relative z-10 flex flex-col min-h-screen px-6 md:px-12 py-6 md:py-8 pointer-events-none">
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

          <nav className="flex items-center gap-2 sm:gap-5">
            {site.nav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="hidden sm:inline text-[13px] font-medium text-white/70 hover:text-white transition-colors"
              >
                {item.label}
              </a>
            ))}
            <a
              href={`${site.appUrl}/home`}
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-medium text-[#12300f] transition-transform hover:scale-[1.04]"
              style={{ backgroundColor: LIME }}
            >
              Open app <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </nav>
        </motion.header>

        {/* Headline */}
        <div className="flex-1 flex items-center">
          <div className="w-full max-w-2xl pointer-events-auto">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease, delay: 0.1 }}
              className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 mb-7 text-[12px] font-medium text-white/90"
              style={{ border: "1px solid rgba(200,245,66,0.35)", background: "rgba(200,245,66,0.06)" }}
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: LIME }} />
              Stablecoin settlement network
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease, delay: 0.18 }}
              className="text-[15vw] sm:text-7xl lg:text-[5.4rem] font-medium tracking-tighter text-white text-balance"
              style={{ lineHeight: 1.04 }}
            >
              Send money
              <br />
              <span style={{ color: LIME }}>anywhere.</span>
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
              className="mt-9 flex flex-wrap items-center gap-4"
            >
              <a
                href="#beta"
                className="group inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-medium text-[#12300f] transition-all hover:scale-[1.03] active:scale-[0.98]"
                style={{ backgroundColor: LIME, boxShadow: "0 8px 24px -6px rgba(200,245,66,0.4)" }}
              >
                Become a beta-tester
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </a>
              <div className="inline-flex items-center gap-2 text-[13px] font-medium text-white/70">
                <span className="relative flex w-2 h-2">
                  <span className="absolute inline-flex h-full w-full rounded-full opacity-70 animate-ping" style={{ background: LIME }} />
                  <span className="relative inline-flex rounded-full w-2 h-2" style={{ background: LIME }} />
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
          className="lg:absolute lg:bottom-10 lg:right-12 z-20 flex flex-col items-stretch lg:items-end gap-3 mt-10 lg:mt-0 pointer-events-auto"
        >
          <motion.div animate={{ y: [0, -7, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}>
            <CorridorPreview />
          </motion.div>
          <motion.div animate={{ y: [0, -7, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}>
            <AgentPreview />
          </motion.div>
        </motion.div>

        {/* Meta */}
        <div className="hidden lg:flex absolute bottom-8 left-12 flex-col gap-0.5 text-[11px] font-medium uppercase tracking-widest text-white/40">
          <span>{site.protocolVersion}</span>
          <span>Gasless · Non-custodial</span>
        </div>
      </div>
    </section>
  );
}
