"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  PiggyBank,
  Building2,
  ArrowRight,
  Globe,
  Network,
} from "lucide-react";

const ease = [0.22, 1, 0.36, 1] as const;

/** Fade-and-rise on scroll into view. */
function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease, delay }}
    >
      {children}
    </motion.div>
  );
}

/* ---------------- One app, three modes ---------------- */

const MODES = [
  {
    icon: Send,
    title: "Send / Receive / Hold",
    body: "Send to a contact, phone number, or alias. See one all-in quote; you send X, they receive Y. Settles gaslessly in seconds to bank, mobile money, or an in-app balance.",
  },
  {
    icon: PiggyBank,
    title: "Earn",
    body: "Put an idle balance to work earning fees on a corridor. One unified position across chains, bounded and insured risk, withdraw anytime, never frozen.",
  },
  {
    icon: Building2,
    title: "Business",
    body: "Invoice, run payroll, and net-settle trade across borders. Multi-sig treasury with role-based approvals, structured references, and exportable settlement reports.",
  },
];

export function Modes() {
  return (
    <section id="modes" className="bg-cream py-16 md:py-24 px-6 md:px-12">
      <div className="max-w-7xl mx-auto">
        <Reveal className="mb-14">
          <span className="inline-block rounded-pill bg-sky-tint/60 text-sky-deep text-[11px] font-extrabold uppercase tracking-widest px-3 py-1.5 mb-4">
            One account
          </span>
          <h2 className="text-3xl md:text-5xl tracking-tight font-extrabold text-harbor mb-4">
            One app, three modes
          </h2>
          <p className="text-slate text-base md:text-lg max-w-xl font-medium leading-relaxed">
            Same engine, one account, one balance — revealed progressively so the
            simplest user only ever sees what they need.
          </p>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {MODES.map(({ icon: Icon, title, body }, i) => (
            <Reveal key={title} delay={i * 0.1}>
              <div className="group h-full p-6 rounded-card bg-snow border border-fog shadow-card-flat hover:shadow-pop hover:-translate-y-1 transition-all duration-300">
                <div className="w-12 h-12 rounded-2xl bg-sky-tint/60 flex items-center justify-center mb-6 text-sky-deep group-hover:scale-110 transition-transform">
                  <Icon className="w-5 h-5" strokeWidth={2} />
                </div>
                <h3 className="text-xl font-extrabold text-harbor tracking-tight mb-2">
                  {title}
                </h3>
                <p className="text-[15px] text-slate font-medium leading-relaxed">{body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Corridor (case study) ---------------- */

// Live remittance routes the visual cycles through — primarily Global-South
// corridors, plus a couple of Western origins. Mirrors the hero card.
const CORRIDORS = [
  { fromFlag: "🇬🇭", fromPlace: "Accra", fromAmount: "₵1,000", toFlag: "🇳🇬", toPlace: "Lagos", toAmount: "₦105k" },
  { fromFlag: "🇰🇪", fromPlace: "Nairobi", fromAmount: "KSh 5,000", toFlag: "🇬🇭", toPlace: "Accra", toAmount: "₵470" },
  { fromFlag: "🇳🇬", fromPlace: "Lagos", fromAmount: "₦150k", toFlag: "🇿🇦", toPlace: "Johannesburg", toAmount: "R 1,700" },
  { fromFlag: "🇬🇧", fromPlace: "London", fromAmount: "£200", toFlag: "🇳🇬", toPlace: "Lagos", toAmount: "₦408k" },
  { fromFlag: "🇪🇬", fromPlace: "Cairo", fromAmount: "ج.م 2,000", toFlag: "🇰🇪", toPlace: "Nairobi", toAmount: "KSh 5,300" },
  { fromFlag: "🇺🇸", fromPlace: "New York", fromAmount: "$300", toFlag: "🇬🇭", toPlace: "Accra", toAmount: "₵4,600" },
];

export function Corridor() {
  const [ci, setCi] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setCi((v) => (v + 1) % CORRIDORS.length), 3200);
    return () => clearInterval(t);
  }, []);
  const c = CORRIDORS[ci];

  return (
    <section id="corridor" className="bg-snow border-y border-fog py-16 md:py-24">
      <div className="px-6 md:px-12 max-w-7xl mx-auto flex flex-col lg:flex-row gap-10 lg:gap-16 items-center">
        {/* Visual */}
        <Reveal className="w-full lg:w-1/2">
          <div className="relative w-full aspect-[5/3] sm:aspect-[16/9] lg:aspect-[4/3] rounded-card-lg overflow-hidden bg-harbor shadow-[rgba(19,66,111,0.28)_0px_10px_0px_0px]">
            {/* subtle grid + glow */}
            <div
              className="absolute inset-0 opacity-40"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
                backgroundSize: "30px 30px",
              }}
            />
            <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full bg-sky/25 blur-[90px]" />

            <div className="absolute inset-0 flex items-center justify-center px-6 sm:px-10 pb-12 sm:pb-14">
              <div className="relative flex items-center w-full max-w-md">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={ci}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.45 }}
                    className="flex items-center w-full"
                  >
                    <CorridorEnd
                      flag={c.fromFlag}
                      place={c.fromPlace}
                      sub="You send"
                      amount={c.fromAmount}
                    />
                    <div className="flex-1 px-3">
                      <svg viewBox="0 0 120 8" className="w-full h-2 overflow-visible">
                        <path
                          d="M0,4 H120"
                          stroke="#7dc0ff"
                          strokeWidth="2.5"
                          fill="none"
                          strokeDasharray="4 4"
                          className="animate-flow"
                          style={{ filter: "drop-shadow(0 0 6px rgba(125,192,255,0.8))" }}
                        />
                      </svg>
                    </div>
                    <CorridorEnd
                      flag={c.toFlag}
                      place={c.toPlace}
                      sub="They receive"
                      amount={c.toAmount}
                      align="right"
                    />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 flex items-center justify-between">
              <div className="rounded-2xl bg-white/10 backdrop-blur px-3 py-1.5 sm:px-4 sm:py-2">
                <span className="block text-[10px] font-bold text-white/60 uppercase tracking-widest">
                  Settlement
                </span>
                <span className="text-base sm:text-lg font-extrabold text-white">&lt;30 sec</span>
              </div>
              <div className="rounded-2xl bg-white/10 backdrop-blur px-3 py-1.5 sm:px-4 sm:py-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-sky" />
                <span className="text-[11px] font-bold text-white uppercase tracking-widest">
                  Gasless
                </span>
              </div>
            </div>
          </div>
        </Reveal>

        {/* Copy */}
        <div className="w-full lg:w-1/2 space-y-6 lg:space-y-7">
          <Reveal>
            <div className="inline-flex items-center gap-2 rounded-pill bg-sky-tint/60 text-sky-deep px-3 py-1.5">
              <Globe className="w-4 h-4" />
              <span className="text-[11px] font-extrabold uppercase tracking-widest">Corridor</span>
            </div>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="text-3xl md:text-5xl tracking-tight font-extrabold text-harbor leading-tight">
              How money reaches home in under 30 seconds.
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="text-base md:text-lg text-slate font-medium leading-relaxed">
              Sending money within Sub-Saharan Africa averages ~8.78% in fees — the
              highest of any region — and settles in days, not seconds. Pesarc routes
              the same transfer over stablecoin rails for a fraction of a percent,
              credits the recipient instantly from local liquidity, and settles behind
              the scenes.
            </p>
          </Reveal>
          <Reveal delay={0.15}>
            <div className="grid grid-cols-2 gap-6 pt-6 border-t border-fog">
              <Stat value="0.5%" label="All-in fee vs 8.78%" />
              <Stat value="<30 sec" label="Settlement time" />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function CorridorEnd({
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
    <div className={`min-w-0 ${align === "right" ? "text-right" : "text-left"}`}>
      <div className="text-xl sm:text-2xl mb-1.5 sm:mb-2">{flag}</div>
      <div className="text-[10px] font-bold text-white/60 uppercase tracking-widest">{sub}</div>
      <div className="text-base sm:text-lg font-extrabold text-white numerals truncate">{amount}</div>
      <div className="text-xs font-medium text-white/70 truncate">{place}</div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-4xl tracking-tight font-extrabold text-harbor numerals mb-1">{value}</div>
      <div className="text-[11px] font-bold text-slate uppercase tracking-widest">{label}</div>
    </div>
  );
}

/* ---------------- Rails (integrations) ---------------- */

const PROTOCOLS = [
  { logo: "/logos/uniswap.png", name: "Uniswap v4" },
  { logo: "/logos/usdc.png", name: "Circle CCTP V2" },
  { logo: "/logos/hyperlane.png", name: "Hyperlane" },
  { logo: "/logos/layerzero.png", name: "LayerZero" },
  { logo: "/logos/reactive.png", name: "Reactive Network" },
];

// Networks we support (deployed / agent settling) or are actively bringing up.
const NETWORKS = [
  { logo: "/logos/arc.png", name: "Arc" },
  { logo: "/logos/arbitrum.png", name: "Arbitrum" },
  { logo: "/logos/base.png", name: "Base" },
  { logo: "/logos/celo.png", name: "Celo" },
  { logo: "/logos/solana.png", name: "Solana" },
  { logo: "/logos/ethereum.png", name: "Ethereum" },
  { logo: "/logos/optimism.png", name: "Optimism" },
  { logo: "/logos/algorand.png", name: "Algorand" },
  // Not live yet — uncomment as each network ships:
  // { logo: "/logos/polygon.png", name: "Polygon" },
  // { logo: "/logos/bnb.png", name: "BNB Chain" },
  // { logo: "/logos/avalanche.png", name: "Avalanche" },
  // { logo: "/logos/sui.png", name: "Sui" },
  // { logo: "/logos/aptos.png", name: "Aptos" },
  // { logo: "/logos/tron.png", name: "Tron" },
  // { logo: "/logos/stellar.png", name: "Stellar" },
];

function RailCard({
  logo,
  name,
  compact = false,
}: {
  logo: string;
  name: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`group rounded-card bg-snow border border-fog shadow-card-flat hover:shadow-pop hover:-translate-y-1 transition-all duration-300 flex flex-col items-center justify-center cursor-default ${
        compact ? "p-5" : "p-8"
      }`}
    >
      <div
        className={`rounded-full bg-cream flex items-center justify-center overflow-hidden ${
          compact ? "w-10 h-10 mb-3" : "w-12 h-12 mb-5"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logo}
          alt={`${name} logo`}
          loading="lazy"
          className={compact ? "w-7 h-7 object-contain" : "w-9 h-9 object-contain"}
        />
      </div>
      <span className={`font-bold text-harbor text-center ${compact ? "text-sm" : "text-base"}`}>
        {name}
      </span>
    </div>
  );
}

export function Rails() {
  return (
    <section id="rails" className="bg-cream py-16 md:py-28 px-6 md:px-12">
      <div className="max-w-7xl mx-auto">
        <Reveal className="text-center mb-14 max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-5xl tracking-tight font-extrabold text-harbor mb-5">
            Built on proven rails.
          </h2>
          <p className="text-base md:text-lg text-slate font-medium text-balance leading-relaxed">
            Your money moves on the most battle-tested networks in the industry — the
            same infrastructure already settling trillions a year. We integrate them;
            you never have to think about them.
          </p>
        </Reveal>

        <div className="max-w-5xl mx-auto space-y-10">
          <div>
            <Reveal className="text-[11px] font-bold text-slate uppercase tracking-widest mb-4 text-center">
              Protocols &amp; rails
            </Reveal>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {PROTOCOLS.map((p, i) => (
                <Reveal key={p.name} delay={i * 0.05}>
                  <RailCard {...p} />
                </Reveal>
              ))}
            </div>
          </div>

          <div>
            <Reveal className="text-[11px] font-bold text-slate uppercase tracking-widest mb-4 text-center">
              Networks
            </Reveal>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-3">
              {NETWORKS.map((n, i) => (
                <Reveal key={n.name} delay={i * 0.03}>
                  <RailCard {...n} compact />
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Engine CTA ---------------- */

export function EngineCTA() {
  return (
    <section className="relative w-full overflow-hidden bg-harbor">
      {/* moving glow accents */}
      <motion.div
        className="pointer-events-none absolute -top-24 -left-24 w-[420px] h-[420px] rounded-full bg-sky/20 blur-[120px]"
        animate={{ x: [0, 60, 0], y: [0, 30, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute bottom-0 right-0 w-[380px] h-[380px] rounded-full bg-sky/15 blur-[110px]"
        animate={{ x: [0, -50, 0], y: [0, -20, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "34px 34px",
          maskImage: "radial-gradient(circle at 50% 50%, black 40%, transparent 85%)",
          WebkitMaskImage: "radial-gradient(circle at 50% 50%, black 40%, transparent 85%)",
        }}
      />

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 md:px-12 py-24 flex flex-col lg:flex-row items-center justify-between gap-16">
        <Reveal className="w-full lg:w-1/2">
          <span className="inline-block rounded-pill bg-white/10 text-sky-tint text-[11px] font-extrabold uppercase tracking-widest px-3 py-1.5 mb-7">
            Settlement core
          </span>
          <h2 className="text-4xl md:text-5xl lg:text-6xl tracking-tight font-extrabold text-white mb-6 leading-[1.05] text-balance">
            One hub, many gateways. Liquidity that stops fragmenting.
          </h2>
          <p className="text-base md:text-lg text-white/70 font-medium leading-relaxed mb-9 max-w-md">
            Liquidity lives in one pool per currency pair on a single hub — not one
            pool per chain. Every other chain is a thin gateway that routes value to
            the hub. Deposit from any chain, exit on another.
          </p>
          <a
            href="#waitlist"
            className="group inline-flex items-center gap-2 bg-sky hover:bg-sky-deep text-white px-7 py-3.5 rounded-pill transition-all duration-300 font-extrabold text-sm shadow-pop hover:-translate-y-0.5"
          >
            Get early access
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </a>
        </Reveal>

        <Reveal delay={0.1} className="w-full lg:w-5/12">
          <div className="rounded-card-lg bg-white/[0.06] border border-white/10 backdrop-blur p-8">
            <div className="inline-flex items-center gap-2 rounded-pill bg-white/10 text-sky-tint px-3 py-1.5 mb-6">
              <Network className="w-4 h-4" />
              <span className="text-[11px] font-extrabold uppercase tracking-widest">Unified hub</span>
            </div>
            <h3 className="text-2xl tracking-tight font-extrabold text-white mb-7 leading-tight">
              The rail has already won. The opening is the experience layer.
            </h3>
            <div className="rounded-card bg-harbor/60 border border-white/10 p-6">
              <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest block mb-3">
                Stablecoin settlement volume · 2025
              </span>
              <div className="text-6xl tracking-tight font-extrabold text-white numerals mb-4">
                $33T
              </div>
              <p className="text-sm text-white/70 font-medium leading-relaxed">
                More than Visa and Mastercard combined. Pesarc is the money-first app
                on top of a rail that has already won.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
