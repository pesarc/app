"use client";

// "Networks and banks" as a live hub (ref: the connected-tools animation): the
// networks your money travels on flow through YOU and your agent in the middle,
// out to the banks and mobile money you already use. Node names sit next to each
// logo (hidden under 640px, where the marquee below carries them). The centre is
// icons only. The marquee scrolls through every network (from the chain
// registry) and rail we support. Logos: Cloudinary URL first (LOGO map), then a
// react-icons brand logo, then a brand-coloured badge. Navy / #3AA0FF.

import { motion } from "framer-motion";
import { User, Bot, Landmark } from "lucide-react";
import type { IconType } from "react-icons";
import {
  SiEthereum,
  SiSolana,
  SiPolygon,
  SiCoinbase,
  SiOptimism,
  SiAirtel,
} from "react-icons/si";

const ACCENT = "#3AA0FF";
const ease = [0.22, 1, 0.36, 1] as const;

// Real brand logos hosted on Cloudinary. Fill with delivery URLs, e.g.
//   Arc: "https://res.cloudinary.com/<cloud>/image/upload/logos/arc.svg"
// Anything here overrides the react-icons / badge fallback below.
const LOGO: Record<string, string> = {};

type Brand = { color: string; Icon?: IconType; mono?: string; bank?: boolean };
const BRANDS: Record<string, Brand> = {
  Ethereum: { color: "#8AA0FF", Icon: SiEthereum },
  Base: { color: "#4F86FF", Icon: SiCoinbase },
  Arc: { color: "#3AA0FF", mono: "◆" },
  Solana: { color: "#14F195", Icon: SiSolana },
  Celo: { color: "#FBCC5C", mono: "C" },
  Arbitrum: { color: "#5AB6F5", mono: "A" },
  Optimism: { color: "#FF6B6B", Icon: SiOptimism },
  Polygon: { color: "#A98BFF", Icon: SiPolygon },
  Paystack: { color: "#3AC8F7", mono: "P" },
  Flutterwave: { color: "#F5A623", mono: "F" },
  "M-Pesa": { color: "#5BD06A", mono: "M" },
  "MTN MoMo": { color: "#FFCC00", mono: "M" },
  Airtel: { color: "#FF6B6B", Icon: SiAirtel },
  "Bank transfer": { color: "#8FC7FF", bank: true },
};

// Networks = the chains in the registry we settle on. Rails = cash in / out we
// actually support (banks via Paystack/Flutterwave, mobile money via Flutterwave).
const NETWORKS = ["Ethereum", "Base", "Arc", "Solana", "Celo", "Arbitrum", "Optimism", "Polygon"];
const RAILS = ["Bank transfer", "Paystack", "Flutterwave", "M-Pesa", "MTN MoMo", "Airtel"];
const ALL = [...NETWORKS, ...RAILS];

// Hub nodes (a representative set per side; the full list is in the marquee).
const HUB_LEFT = ["Ethereum", "Base", "Arc", "Solana", "Celo"];
const HUB_RIGHT = ["Bank transfer", "M-Pesa", "MTN MoMo", "Paystack", "Flutterwave"];

function Mark({ name, size = 20 }: { name: string; size?: number }) {
  const url = LOGO[name];
  // eslint-disable-next-line @next/next/no-img-element -- small brand logo inside an SVG; next/image can't render here
  if (url) return <img src={url} alt={name} width={size} height={size} style={{ objectFit: "contain" }} />;
  const b = BRANDS[name] ?? { color: ACCENT };
  if (b.Icon) return <b.Icon size={size} color={b.color} />;
  if (b.bank) return <Landmark size={size - 2} color={b.color} />;
  return <span style={{ color: b.color, fontWeight: 800, fontSize: size * 0.62 }}>{b.mono}</span>;
}

// ---- the hub (SVG) ----
const W = 1000;
const HUB = { x: 500, y: 285 };
const YS = [70, 178, 285, 392, 500];
const LEFT_X = 150;
const RIGHT_X = 850;

function bez(x1: number, y1: number, x2: number, y2: number) {
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
}

function HubNode({ name, x, y, align }: { name: string; x: number; y: number; align: "start" | "end" }) {
  const b = BRANDS[name] ?? { color: ACCENT };
  const labelX = align === "start" ? x + 40 : x - 40;
  return (
    <g>
      <foreignObject x={x - 28} y={y - 28} width="56" height="56">
        <div
          className="w-full h-full rounded-xl grid place-items-center overflow-hidden"
          style={{ background: `${b.color}1f`, border: `1px solid ${b.color}66` }}
        >
          <Mark name={name} size={24} />
        </div>
      </foreignObject>
      <text
        className="nlabel"
        x={labelX}
        y={y + 5}
        textAnchor={align}
        fill="rgba(255,255,255,0.72)"
        fontSize="15"
        fontWeight="600"
        style={{ fontFamily: "var(--font-mono, ui-monospace), monospace" }}
      >
        {name}
      </text>
    </g>
  );
}

export default function NetworkHub() {
  const links = [
    ...HUB_LEFT.map((_, i) => ({ key: `l${i}`, d: bez(LEFT_X + 28, YS[i], HUB.x - 62, HUB.y) })),
    ...HUB_RIGHT.map((_, i) => ({ key: `r${i}`, d: bez(HUB.x + 62, HUB.y, RIGHT_X - 28, YS[i]) })),
  ];

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
          <h2 className="mt-6 text-white text-3xl sm:text-4xl lg:text-5xl tracking-tighter uppercase" style={{ lineHeight: 1.14 }}>
            Works with the money{" "}
            <span style={{ color: ACCENT }}>you already use</span>
          </h2>
          <p className="mt-5 max-w-md text-sm text-white/60 leading-relaxed">
            Money reaches Pesarc over the most trusted networks in the world, and
            lands in your bank or your mobile money, the ones you already have.
            Nothing new to open, nothing new to learn.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease }}
          className="mt-12 rounded-2xl border border-white/12 bg-white/[0.02] p-4 sm:p-6 overflow-hidden"
        >
          <div className="flex justify-between text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 px-2 mb-1" style={{ fontFamily: "var(--font-mono, ui-monospace), monospace" }}>
            <span>Networks</span>
            <span className="hidden sm:inline">You + agent</span>
            <span>Bank &amp; mobile money</span>
          </div>

          <svg viewBox={`0 0 ${W} 560`} className="w-full h-auto" role="img" aria-label="The networks your money travels on flow through you and your agent, out to your bank and mobile money.">
            <defs>
              <style>{`
                .flow{stroke-dasharray:7 9;animation:hubflow 1.1s linear infinite}
                @keyframes hubflow{to{stroke-dashoffset:-32}}
                @keyframes hubpulse{0%,100%{opacity:.25;transform:scale(1)}50%{opacity:.6;transform:scale(1.3)}}
                .hubring{transform-box:fill-box;transform-origin:center;animation:hubpulse 3.4s ease-in-out infinite}
                @media(prefers-reduced-motion:reduce){.flow,.hubring,.pkt{animation:none!important}}
                @media(max-width:640px){.nlabel{display:none}}
              `}</style>
              <radialGradient id="hubGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={ACCENT} stopOpacity="0.5" />
                <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
              </radialGradient>
            </defs>

            {links.map((l) => (
              <g key={l.key}>
                <path d={l.d} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="2" />
                <path d={l.d} fill="none" stroke={ACCENT} strokeWidth="1.6" strokeOpacity="0.8" className="flow" />
                <circle r="3.2" fill="#dff0ff" className="pkt">
                  <animateMotion dur="2.4s" repeatCount="indefinite" path={l.d} keyPoints="0;1" keyTimes="0;1" calcMode="linear" />
                </circle>
              </g>
            ))}

            {HUB_LEFT.map((name, i) => (
              <HubNode key={name} name={name} x={LEFT_X} y={YS[i]} align="start" />
            ))}
            {HUB_RIGHT.map((name, i) => (
              <HubNode key={name} name={name} x={RIGHT_X} y={YS[i]} align="end" />
            ))}

            {/* centre: you + agent, icons only */}
            <circle cx={HUB.x} cy={HUB.y} r="130" fill="url(#hubGlow)" />
            <circle cx={HUB.x} cy={HUB.y} r="70" className="hubring" fill="none" stroke={ACCENT} strokeOpacity="0.4" strokeWidth="1.5" />
            <circle cx={HUB.x} cy={HUB.y} r="52" fill="#06294d" stroke={ACCENT} strokeWidth="2" />
            <foreignObject x={HUB.x - 40} y={HUB.y - 34} width="80" height="68">
              <div className="w-full h-full flex flex-col items-center justify-center gap-1.5">
                <User size={26} color="#fff" strokeWidth={2} />
                <Bot size={20} color={ACCENT} strokeWidth={2} />
              </div>
            </foreignObject>
          </svg>
        </motion.div>

        {/* Marquee: every network + rail we support, names beside each logo. */}
        <Marquee />
      </div>
    </section>
  );
}

function Marquee() {
  const row = [...ALL, ...ALL]; // duplicate for a seamless loop
  return (
    <div className="mt-6 relative overflow-hidden" style={{ maskImage: "linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)", WebkitMaskImage: "linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)" }}>
      <style>{`
        @keyframes railmarquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        .railtrack{animation:railmarquee 30s linear infinite}
        .railtrack:hover{animation-play-state:paused}
        @media(prefers-reduced-motion:reduce){.railtrack{animation:none}}
      `}</style>
      <div className="railtrack flex w-max gap-3">
        {row.map((name, i) => {
          const b = BRANDS[name] ?? { color: ACCENT };
          return (
            <div
              key={`${name}-${i}`}
              className="flex items-center gap-2.5 rounded-full pl-1.5 pr-4 py-1.5 shrink-0"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)" }}
            >
              <span className="grid place-items-center w-8 h-8 rounded-full shrink-0 overflow-hidden" style={{ background: `${b.color}22`, border: `1px solid ${b.color}55` }}>
                <Mark name={name} size={16} />
              </span>
              <span className="text-[13px] font-semibold text-white/80 whitespace-nowrap">{name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
