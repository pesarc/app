"use client";

// "Networks and banks" — the money you already use. Written for the Mum Test:
// no "agent", no "web3", no chain jargon. Just "we work with your bank and your
// mobile money". World-class brand icons (real logos where they exist, clean
// brand-coloured badges otherwise). Reskinned to Pesarc navy / #3AA0FF.

import { motion } from "framer-motion";
import { Landmark } from "lucide-react";
import type { IconType } from "react-icons";
import {
  SiEthereum,
  SiSolana,
  SiPolygon,
  SiCoinbase,
  SiOptimism,
  SiAirtel,
  SiVisa,
  SiMastercard,
} from "react-icons/si";

const ACCENT = "#3AA0FF";
const ease = [0.22, 1, 0.36, 1] as const;

type Brand = { color: string; Icon?: IconType; mono?: string };

const BRANDS: Record<string, Brand> = {
  Ethereum: { color: "#627EEA", Icon: SiEthereum },
  Base: { color: "#0052FF", Icon: SiCoinbase },
  Arc: { color: "#3AA0FF", mono: "◆" },
  Solana: { color: "#14F195", Icon: SiSolana },
  Celo: { color: "#FBCC5C", mono: "C" },
  Arbitrum: { color: "#28A0F0", mono: "A" },
  Polygon: { color: "#8247E5", Icon: SiPolygon },
  Optimism: { color: "#FF0420", Icon: SiOptimism },
  Avalanche: { color: "#E84142", mono: "A" },
  Paystack: { color: "#00C3F7", mono: "P" },
  Flutterwave: { color: "#F5A623", mono: "F" },
  "M-Pesa": { color: "#4BB543", mono: "M" },
  "MTN MoMo": { color: "#FFCC00", mono: "M" },
  Airtel: { color: "#E40000", Icon: SiAirtel },
  "Bank transfer": { color: "#6BB7FF", Icon: undefined, mono: undefined },
  GTBank: { color: "#E5322D", mono: "GT" },
  Visa: { color: "#1A56DB", Icon: SiVisa },
  Mastercard: { color: "#F79E1B", Icon: SiMastercard },
};

const NETWORKS = ["Ethereum", "Base", "Arc", "Solana", "Celo", "Arbitrum", "Polygon", "Optimism", "Avalanche"];
const RAILS = ["Paystack", "Flutterwave", "M-Pesa", "MTN MoMo", "Airtel", "Bank transfer", "GTBank", "Visa", "Mastercard"];

function BrandChip({ name, index }: { name: string; index: number }) {
  const b = BRANDS[name] ?? { color: ACCENT };
  const Icon = b.Icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4, ease, delay: Math.min(index * 0.03, 0.3) }}
      className="flex items-center gap-2.5 rounded-full pl-1.5 pr-4 py-1.5 transition-transform hover:-translate-y-0.5"
      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)" }}
    >
      <span
        className="grid place-items-center w-8 h-8 rounded-full shrink-0"
        style={{ background: `${b.color}22`, border: `1px solid ${b.color}55` }}
      >
        {Icon ? (
          <Icon size={16} color={b.color} />
        ) : name === "Bank transfer" ? (
          <Landmark className="w-4 h-4" style={{ color: b.color }} strokeWidth={1.8} />
        ) : (
          <span className="text-[11px] font-extrabold" style={{ color: b.color }}>{b.mono ?? name[0]}</span>
        )}
      </span>
      <span className="text-[13px] font-semibold text-white/85 whitespace-nowrap">{name}</span>
    </motion.div>
  );
}

function Group({ eyebrow, title, items }: { eyebrow: string; title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-white/12 bg-white/[0.03] p-6 sm:p-7">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/40" style={{ fontFamily: "var(--font-mono, ui-monospace), monospace" }}>
        {eyebrow}
      </p>
      <h3 className="mt-1.5 text-lg font-semibold text-white">{title}</h3>
      <div className="mt-5 flex flex-wrap gap-2.5">
        {items.map((name, i) => (
          <BrandChip key={name} name={name} index={i} />
        ))}
      </div>
    </div>
  );
}

export default function NetworkHub() {
  return (
    <section
      id="networks"
      className="relative px-6 sm:px-8 lg:px-12 py-24 lg:py-28"
      style={{ borderTop: "1px solid rgba(255,255,255,0.08)", background: "rgba(7,42,77,0.72)" }}
    >
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <span
            className="inline-flex items-center rounded-full border border-white/15 bg-white/[0.04] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60"
            style={{ fontFamily: "var(--font-mono, ui-monospace), monospace" }}
          >
            Networks and banks
          </span>
          <h2 className="mt-6 text-white text-3xl sm:text-4xl lg:text-5xl tracking-tighter" style={{ lineHeight: 1.14 }}>
            Works with the money{" "}
            <span style={{ color: ACCENT }}>you already use</span>
          </h2>
          <p className="mt-5 max-w-md text-sm text-white/60 leading-relaxed">
            Money reaches Pesarc over the world's most trusted networks, then lands
            in your bank or your mobile money, the ones you already have. Nothing
            new to open, nothing new to learn.
          </p>
        </div>

        <div className="mt-12 grid lg:grid-cols-2 gap-5">
          <Group eyebrow="Networks" title="The rails your money travels on" items={NETWORKS} />
          <Group eyebrow="Cash in and out" title="Your bank and your mobile money" items={RAILS} />
        </div>
      </div>
    </section>
  );
}
