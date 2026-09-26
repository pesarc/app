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

export function Features() {
  return (
    <section
      id="features"
      className="relative px-5 sm:px-8 lg:px-12 py-20 lg:py-28"
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

      <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {FEATURES.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, ease, delay: (i % 3) * 0.06 }}
            className="group rounded-2xl p-6 backdrop-blur-md transition-transform hover:-translate-y-1.5"
            style={cardStyle}
          >
            <span
              className="flex items-center justify-center rounded-xl transition-transform group-hover:scale-110"
              style={{ width: 40, height: 40, background: "rgba(58,160,255,0.15)" }}
            >
              <f.icon className="w-5 h-5" style={{ color: LIME }} strokeWidth={1.6} />
            </span>
            <h3 className="mt-5 text-base font-medium text-white tracking-tight">{f.title}</h3>
            <p className="mt-2 text-sm text-white/55 leading-relaxed">{f.body}</p>
          </motion.div>
        ))}
      </div>

      {/* Reach strip: voice + USSD */}
      <div className="mt-4 grid sm:grid-cols-2 gap-4">
        <div className="rounded-2xl p-6 backdrop-blur-md flex items-center gap-4" style={cardStyle}>
          <span className="flex items-center justify-center rounded-xl shrink-0" style={{ width: 40, height: 40, background: "rgba(58,160,255,0.15)" }}>
            <Mic className="w-5 h-5" style={{ color: LIME }} strokeWidth={1.6} />
          </span>
          <p className="text-sm text-white/70 leading-relaxed">
            <span className="text-white font-medium">Voice first.</span> Speak to
            the agent in the app or on WhatsApp and it does the rest.
          </p>
        </div>
        <div className="rounded-2xl p-6 backdrop-blur-md flex items-center gap-4" style={cardStyle}>
          <span className="flex items-center justify-center rounded-xl shrink-0" style={{ width: 40, height: 40, background: "rgba(58,160,255,0.15)" }}>
            <Hash className="w-5 h-5" style={{ color: LIME }} strokeWidth={1.6} />
          </span>
          <p className="text-sm text-white/70 leading-relaxed">
            <span className="text-white font-medium">Works on any phone.</span>{" "}
            USSD support means no smartphone or data needed to move money.
          </p>
        </div>
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
      className="relative px-5 sm:px-8 lg:px-12 py-20 lg:py-28"
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

      <div className="mt-12 grid lg:grid-cols-2 gap-4">
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
