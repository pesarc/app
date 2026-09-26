"use client";

import { motion } from "framer-motion";
import {
  Send,
  Bot,
  Zap,
  PiggyBank,
  LineChart,
  Code2,
  Hash,
  Mic,
  type LucideIcon,
} from "lucide-react";

const LIME = "#3AA0FF";
const ease = [0.22, 1, 0.36, 1] as const;

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium text-white/90"
      style={{ border: "1px solid rgba(58,160,255,0.35)", background: "rgba(58,160,255,0.06)" }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: LIME }} />
      {children}
    </span>
  );
}

const cardStyle = {
  background: "rgba(255,255,255,0.09)",
  border: "1px solid rgba(255,255,255,0.14)",
  boxShadow: "0 20px 40px -12px rgba(0,0,0,0.3)",
} as const;

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Send,
    title: "Send money home in seconds",
    body: "Send, receive and settle across borders in your own currency. Gasless, under a minute, with a fee you can actually read.",
  },
  {
    icon: Bot,
    title: "Pay by chatting with an agent",
    body: "An AI agent in the app and on WhatsApp handles transfers, bills and questions. Talk or type, in your own words.",
  },
  {
    icon: Zap,
    title: "Airtime, data and electricity",
    body: "Top up airtime and data or pay a power bill in a couple of taps, or just ask the agent to do it for you.",
  },
  {
    icon: PiggyBank,
    title: "Earn, invest and hedge",
    body: "Grow idle balances in insured vaults, buy on-chain African stocks, and hedge your currency against the market.",
  },
  {
    icon: LineChart,
    title: "Markets you can create",
    body: "Trade and create prediction and FX markets, so a shift in the naira can work for you instead of against you.",
  },
  {
    icon: Code2,
    title: "Built for businesses and devs",
    body: "A clean API for SMEs and SaaS, plus an in-app pay flow so partners can send customers to Pesarc and back.",
  },
];

// Bento placement (lg+): a tall flagship on the left, a 2x2 core grid, and a
// full-width accent stat strip underneath. Below lg it collapses to a single
// readable column. Kept in one place so the grid stays easy to reason about.
const BENTO_POS = [
  "sm:col-span-2 lg:col-span-1 lg:col-start-1 lg:row-start-1 lg:row-span-2", // flagship (Send)
  "lg:col-start-2 lg:row-start-1",               // agent
  "lg:col-start-3 lg:row-start-1",               // bills
  "lg:col-start-2 lg:row-start-2",               // earn
  "lg:col-start-3 lg:row-start-2",               // markets
] as const;

function BentoCard({
  feature,
  className = "",
  large = false,
  index,
}: {
  feature: { icon: LucideIcon; title: string; body: string };
  className?: string;
  large?: boolean;
  index: number;
}) {
  const Icon = feature.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, ease, delay: Math.min(index, 4) * 0.05 }}
      className={`group relative flex flex-col rounded-card p-6 backdrop-blur-md transition-transform hover:-translate-y-1 ${
        large ? "lg:p-8" : ""
      } ${className}`}
      style={cardStyle}
    >
      <span
        className="flex items-center justify-center rounded-xl transition-transform group-hover:scale-110"
        style={{
          width: large ? 52 : 40,
          height: large ? 52 : 40,
          background: "rgba(58,160,255,0.15)",
        }}
      >
        <Icon className={large ? "w-6 h-6" : "w-5 h-5"} style={{ color: LIME }} strokeWidth={1.6} />
      </span>
      <h3
        className={`mt-5 font-medium text-white tracking-tight ${
          large ? "text-xl lg:text-2xl" : "text-base"
        }`}
      >
        {feature.title}
      </h3>
      <p
        className={`mt-2 text-white/55 leading-relaxed ${
          large ? "text-sm lg:text-base max-w-sm" : "text-sm"
        }`}
      >
        {feature.body}
      </p>

      {large && (
        <div className="mt-auto pt-6 flex flex-wrap gap-2">
          {[
            { icon: Mic, label: "Voice first" },
            { icon: Hash, label: "Works on any phone" },
            { icon: Bot, label: "WhatsApp agent" },
          ].map((chip) => (
            <span
              key={chip.label}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-white/80"
              style={{ border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.05)" }}
            >
              <chip.icon className="w-3.5 h-3.5" style={{ color: LIME }} strokeWidth={1.7} />
              {chip.label}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}

export function Features() {
  const [flagship, ...rest] = FEATURES;
  return (
    <section
      id="features"
      className="relative px-6 sm:px-8 lg:px-12 py-24 lg:py-28"
      style={{ borderTop: "1px solid rgba(255,255,255,0.08)", background: "rgba(4,26,51,0.72)" }}
    >
      <div className="max-w-2xl">
        <Eyebrow>What you can do</Eyebrow>
        <h2 className="mt-6 text-white text-3xl sm:text-4xl lg:text-5xl tracking-tighter" style={{ lineHeight: 1.14 }}>
          One app for money that{" "}
          <span style={{ color: LIME }}>moves the way you do</span>
        </h2>
        <p className="mt-5 max-w-md text-sm text-white/60 leading-relaxed">
          Built for retailers, import and export traders, businesses and everyday
          people. Money that is quick to send, easy to grow, and simple enough for
          the first phone you owned.
        </p>
      </div>

      <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:auto-rows-fr">
        <BentoCard feature={flagship} large className={BENTO_POS[0]} index={0} />
        {rest.slice(0, 4).map((f, i) => (
          <BentoCard key={f.title} feature={f} className={BENTO_POS[i + 1]} index={i + 1} />
        ))}

        {/* Accent stat strip spanning the full width */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5, ease, delay: 0.25 }}
          className="rounded-card p-6 lg:p-8 backdrop-blur-md sm:col-span-2 lg:col-span-3 lg:row-start-3"
          style={{
            background: "linear-gradient(120deg, rgba(58,160,255,0.16), rgba(58,160,255,0.06))",
            border: "1px solid rgba(58,160,255,0.4)",
            boxShadow: "0 20px 40px -12px rgba(0,0,0,0.3)",
          }}
        >
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 items-center">
            {[
              { stat: "< 60s", label: "Average settlement, gasless" },
              { stat: "10+", label: "Chains and local rails, one balance" },
              { stat: rest[4].title, label: rest[4].body, feature: true },
            ].map((item, i) =>
              item.feature ? (
                <div key={i} className="lg:col-span-2 flex items-start gap-3">
                  <span
                    className="flex items-center justify-center rounded-xl shrink-0"
                    style={{ width: 40, height: 40, background: "rgba(255,255,255,0.12)" }}
                  >
                    <Code2 className="w-5 h-5" style={{ color: LIME }} strokeWidth={1.6} />
                  </span>
                  <div>
                    <h3 className="text-base font-medium text-white tracking-tight">{item.stat}</h3>
                    <p className="mt-1 text-sm text-white/60 leading-relaxed">{item.label}</p>
                  </div>
                </div>
              ) : (
                <div key={i}>
                  <div className="text-3xl lg:text-4xl font-semibold text-white tracking-tighter">
                    {item.stat}
                  </div>
                  <p className="mt-1.5 text-sm text-white/60 leading-relaxed">{item.label}</p>
                </div>
              )
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

const NETWORKS = [
  "Ethereum", "Base", "Optimism", "Arbitrum", "Solana", "Arc",
  "Algorand", "Polygon", "Avalanche", "Celo",
];
const RAILS = [
  "Paystack", "Flutterwave", "Bank transfer (NIP)", "Mobile money",
  "M-Pesa", "MTN MoMo", "GTBank", "Access Bank", "Zenith Bank",
];

export function NetworksBanks() {
  return (
    <section
      id="networks"
      className="relative px-6 sm:px-8 lg:px-12 py-24 lg:py-28"
      style={{ borderTop: "1px solid rgba(255,255,255,0.08)", background: "rgba(7,42,77,0.72)" }}
    >
      <div className="max-w-2xl">
        <Eyebrow>Networks and banks</Eyebrow>
        <h2 className="mt-6 text-white text-3xl sm:text-4xl lg:text-5xl tracking-tighter" style={{ lineHeight: 1.14 }}>
          Reaches the rails{" "}
          <span style={{ color: LIME }}>your money already lives on</span>
        </h2>
        <p className="mt-5 max-w-md text-sm text-white/60 leading-relaxed">
          Move value across the most battle-tested networks, then cash out to a
          bank account or mobile money wallet people actually use.
        </p>
      </div>

      <div className="mt-14 grid lg:grid-cols-2 gap-5">
        <div className="rounded-2xl p-6 backdrop-blur-md" style={cardStyle}>
          <p className="text-xs font-medium uppercase tracking-widest text-white/40">Networks</p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            {NETWORKS.map((n) => (
              <span
                key={n}
                className="rounded-full px-3.5 py-1.5 text-xs font-medium text-white/80"
                style={{ border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.05)" }}
              >
                {n}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-2xl p-6 backdrop-blur-md" style={cardStyle}>
          <p className="text-xs font-medium uppercase tracking-widest text-white/40">Banks and cash-out</p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            {RAILS.map((r) => (
              <span
                key={r}
                className="rounded-full px-3.5 py-1.5 text-xs font-medium"
                style={{ border: "1px solid rgba(58,160,255,0.25)", background: "rgba(58,160,255,0.05)", color: "rgba(255,255,255,0.85)" }}
              >
                {r}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
