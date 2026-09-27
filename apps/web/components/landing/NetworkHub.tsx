"use client";

// Networks & banks, revamped as an AGENT HUB (ref: the connected-tools diagram).
// Web3 rails on the left flow through the user + their agent in the centre, out
// to web2 African fiat on the right. One scalable SVG keeps nodes and the
// animated connector lines in the same coordinate system; a live "trigger" trace
// card sits under it. Reskinned to Pesarc navy / #3AA0FF.

import { motion } from "framer-motion";

const ACCENT = "#3AA0FF";
const ease = [0.22, 1, 0.36, 1] as const;

// SVG canvas is 1000x520; nodes are laid out in this space and scale with it.
const HUB = { x: 500, y: 260 };
const LEFT = [
  { label: "Ethereum", y: 70 },
  { label: "Base", y: 150 },
  { label: "Arc", y: 260, hot: true },
  { label: "Solana", y: 370 },
  { label: "Celo", y: 450 },
];
const RIGHT = [
  { label: "Paystack", y: 70 },
  { label: "M-Pesa", y: 150 },
  { label: "MTN MoMo", y: 260, hot: true },
  { label: "GTBank", y: 370 },
  { label: "Airtel", y: 450 },
];

function bez(x1: number, y1: number, x2: number, y2: number) {
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
}

function SideNode({ x, y, label, hot, align }: { x: number; y: number; label: string; hot?: boolean; align: "start" | "end" }) {
  const tx = align === "start" ? x + 22 : x - 22;
  return (
    <g>
      <circle cx={x} cy={y} r="13" fill={hot ? ACCENT : "rgba(255,255,255,0.06)"} stroke={hot ? ACCENT : "rgba(255,255,255,0.2)"} strokeWidth="1.5" />
      <circle cx={x} cy={y} r="4.5" fill={hot ? "#04294d" : ACCENT} />
      <text x={tx} y={y + 4} textAnchor={align} fill="rgba(255,255,255,0.7)" fontSize="15" fontWeight="600" style={{ fontFamily: "var(--font-mono, ui-monospace), monospace" }}>
        {label}
      </text>
    </g>
  );
}

export default function NetworkHub() {
  const links = [
    ...LEFT.map((n) => ({ d: bez(140, n.y, HUB.x - 60, HUB.y), key: `l-${n.label}` })),
    ...RIGHT.map((n) => ({ d: bez(HUB.x + 60, HUB.y, 860, n.y), key: `r-${n.label}` })),
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
            Your agent wires{" "}
            <span style={{ color: ACCENT }}>web3 to your bank</span>
          </h2>
          <p className="mt-5 max-w-md text-sm text-white/60 leading-relaxed">
            Every chain and every local rail connects through you and your agent.
            A position on-chain, a payout to mobile money, one balance in your own
            currency, all wired for you.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease }}
          className="mt-12 rounded-2xl border border-white/12 bg-white/[0.02] p-4 sm:p-6 overflow-hidden"
        >
          {/* Column captions */}
          <div className="flex justify-between text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 px-2 mb-2" style={{ fontFamily: "var(--font-mono, ui-monospace), monospace" }}>
            <span>Web3 rails</span>
            <span className="hidden sm:inline">You + agent</span>
            <span>African fiat</span>
          </div>

          <svg viewBox="0 0 1000 520" className="w-full h-auto" role="img" aria-label="Web3 rails connect through the user and their agent to African fiat rails">
            <defs>
              <style>{`
                .flow { stroke-dasharray: 7 9; animation: hubflow 1.1s linear infinite; }
                @keyframes hubflow { to { stroke-dashoffset: -32; } }
                @keyframes hubpulse { 0%,100%{ opacity:.25; transform:scale(1);} 50%{ opacity:.6; transform:scale(1.35);} }
                .hubring { transform-box: fill-box; transform-origin: center; animation: hubpulse 3.2s ease-in-out infinite; }
                @media (prefers-reduced-motion: reduce){ .flow, .hubring, .pkt { animation: none !important; } }
              `}</style>
              <radialGradient id="hubGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={ACCENT} stopOpacity="0.45" />
                <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* connector lines */}
            {links.map((l) => (
              <g key={l.key}>
                <path d={l.d} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="2" />
                <path d={l.d} fill="none" stroke={ACCENT} strokeWidth="1.6" strokeOpacity="0.8" className="flow" />
                <circle r="3.2" fill="#dff0ff" className="pkt">
                  <animateMotion dur="2.4s" repeatCount="indefinite" path={l.d} keyPoints="0;1" keyTimes="0;1" calcMode="linear" />
                </circle>
              </g>
            ))}

            {/* side nodes */}
            {LEFT.map((n) => (
              <SideNode key={n.label} x={140} y={n.y} label={n.label} hot={n.hot} align="start" />
            ))}
            {RIGHT.map((n) => (
              <SideNode key={n.label} x={860} y={n.y} label={n.label} hot={n.hot} align="end" />
            ))}

            {/* centre hub: user + agent */}
            <circle cx={HUB.x} cy={HUB.y} r="120" fill="url(#hubGlow)" />
            <circle cx={HUB.x} cy={HUB.y} r="66" className="hubring" fill="none" stroke={ACCENT} strokeOpacity="0.4" strokeWidth="1.5" />
            <circle cx={HUB.x} cy={HUB.y} r="52" fill="#06294d" stroke={ACCENT} strokeWidth="2" />
            <text x={HUB.x} y={HUB.y - 6} textAnchor="middle" fill="#fff" fontSize="17" fontWeight="800">You</text>
            <text x={HUB.x} y={HUB.y + 15} textAnchor="middle" fill={ACCENT} fontSize="12.5" fontWeight="700" style={{ fontFamily: "var(--font-mono, ui-monospace), monospace" }}>+ AGENT</text>
          </svg>
        </motion.div>

        {/* live trigger trace (ref: the POST /v1/agent/trigger card) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, ease, delay: 0.1 }}
          className="mt-6 flex items-center gap-4 rounded-xl border border-white/12 p-4"
          style={{ background: "rgba(4,26,51,0.6)" }}
        >
          <span className="grid place-items-center w-11 h-11 shrink-0 rounded-lg" style={{ background: "rgba(58,160,255,0.15)" }}>
            <span className="w-2 h-2 rounded-full" style={{ background: ACCENT, boxShadow: `0 0 10px ${ACCENT}` }} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-bold text-white truncate" style={{ fontFamily: "var(--font-mono, ui-monospace), monospace" }}>
                POST /v1/agent/settle
              </span>
              <span className="text-[11px] font-medium text-white/40" style={{ fontFamily: "var(--font-mono, ui-monospace), monospace" }}>24ms</span>
            </div>
            <div className="text-[12.5px] text-white/55 truncate" style={{ fontFamily: "var(--font-mono, ui-monospace), monospace" }}>
              {`{ "from":"Arc", "market":"Super Eagles", "to":"MTN MoMo", "ccy":"NGN" }`}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
