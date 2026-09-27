"use client";

// "Networks and banks" as a live hub (ref: the connected-tools animation): the
// networks your money travels on flow through YOU and your agent in the middle,
// out to the banks and mobile money you already use. Real brand logos on every
// node (embedded in the SVG via foreignObject), animated connectors + travelling
// packets. No code/trace card. Reskinned to Pesarc navy / #3AA0FF.

import { motion } from "framer-motion";
import { User, Bot, Landmark } from "lucide-react";
import type { IconType } from "react-icons";
import {
  SiEthereum,
  SiSolana,
  SiPolygon,
  SiCoinbase,
  SiOptimism,
} from "react-icons/si";

const ACCENT = "#3AA0FF";
const ease = [0.22, 1, 0.36, 1] as const;

type Brand = { color: string; Icon?: IconType; mono?: string; bank?: boolean };
const BRANDS: Record<string, Brand> = {
  Ethereum: { color: "#8AA0FF", Icon: SiEthereum },
  Base: { color: "#4F86FF", Icon: SiCoinbase },
  Arc: { color: "#3AA0FF", mono: "◆" },
  Solana: { color: "#14F195", Icon: SiSolana },
  Celo: { color: "#FBCC5C", mono: "C" },
  Polygon: { color: "#A98BFF", Icon: SiPolygon },
  Optimism: { color: "#FF6B6B", Icon: SiOptimism },
  Paystack: { color: "#3AC8F7", mono: "P" },
  Flutterwave: { color: "#F5A623", mono: "F" },
  "M-Pesa": { color: "#5BD06A", mono: "M" },
  "MTN MoMo": { color: "#FFCC00", mono: "M" },
  GTBank: { color: "#FF7A6B", mono: "GT" },
  "Bank": { color: "#8FC7FF", bank: true },
};

const LEFT = ["Ethereum", "Base", "Arc", "Solana", "Celo"];
const RIGHT = ["Paystack", "M-Pesa", "MTN MoMo", "Flutterwave", "GTBank"];

// viewBox space
const W = 1000;
const HUB = { x: 500, y: 285 };
const YS = [70, 178, 285, 392, 500];
const LEFT_X = 118;
const RIGHT_X = 882;

function bez(x1: number, y1: number, x2: number, y2: number) {
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
}

// A logo tile as an SVG foreignObject so brand icons scale with the drawing.
function Node({ name, x, y, align }: { name: string; x: number; y: number; align: "start" | "end" }) {
  const b = BRANDS[name] ?? { color: ACCENT };
  const Icon = b.Icon;
  const labelX = align === "start" ? x + 40 : x - 40;
  return (
    <g>
      <foreignObject x={x - 26} y={y - 26} width="52" height="52">
        <div
          className="w-full h-full rounded-xl grid place-items-center"
          style={{ background: `${b.color}1f`, border: `1px solid ${b.color}66` }}
        >
          {Icon ? (
            <Icon size={22} color={b.color} />
          ) : b.bank ? (
            <Landmark size={20} color={b.color} />
          ) : (
            <span style={{ color: b.color, fontWeight: 800, fontSize: 14 }}>{b.mono}</span>
          )}
        </div>
      </foreignObject>
      <text
        className="nlabel"
        x={labelX}
        y={y + 5}
        textAnchor={align}
        fill="rgba(255,255,255,0.7)"
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
    ...LEFT.map((_, i) => ({ key: `l${i}`, d: bez(LEFT_X + 26, YS[i], HUB.x - 62, HUB.y) })),
    ...RIGHT.map((_, i) => ({ key: `r${i}`, d: bez(HUB.x + 62, HUB.y, RIGHT_X - 26, YS[i]) })),
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
          <h2 className="mt-6 text-white text-3xl sm:text-4xl lg:text-5xl tracking-tighter" style={{ lineHeight: 1.14 }}>
            Works with the money{" "}
            <span style={{ color: ACCENT }}>you already use</span>
          </h2>
          <p className="mt-5 max-w-md text-sm text-white/60 leading-relaxed">
            Money reaches Pesarc over the world's most trusted networks, and lands
            in your bank or your mobile money, the ones you already have. Nothing
            new to open, nothing new to learn.
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

            {LEFT.map((name, i) => (
              <Node key={name} name={name} x={LEFT_X} y={YS[i]} align="start" />
            ))}
            {RIGHT.map((name, i) => (
              <Node key={name} name={name} x={RIGHT_X} y={YS[i]} align="end" />
            ))}

            {/* centre: you + agent */}
            <circle cx={HUB.x} cy={HUB.y} r="130" fill="url(#hubGlow)" />
            <circle cx={HUB.x} cy={HUB.y} r="70" className="hubring" fill="none" stroke={ACCENT} strokeOpacity="0.4" strokeWidth="1.5" />
            <circle cx={HUB.x} cy={HUB.y} r="54" fill="#06294d" stroke={ACCENT} strokeWidth="2" />
            <foreignObject x={HUB.x - 54} y={HUB.y - 54} width="108" height="108">
              <div className="w-full h-full flex flex-col items-center justify-center">
                <span className="flex items-center gap-1.5">
                  <User size={20} color="#fff" strokeWidth={2} />
                  <span style={{ color: "#fff", fontWeight: 800, fontSize: 17 }}>You</span>
                </span>
                <span className="mt-1 inline-flex items-center gap-1" style={{ color: ACCENT }}>
                  <Bot size={13} />
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", fontFamily: "var(--font-mono, ui-monospace), monospace" }}>+ AGENT</span>
                </span>
              </div>
            </foreignObject>
          </svg>
        </motion.div>
      </div>
    </section>
  );
}
