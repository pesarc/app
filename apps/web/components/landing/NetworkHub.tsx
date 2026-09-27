"use client";

// "Networks and banks" as a live hub (ref: the connected-tools animation): the
// networks your money travels on flow through YOU and your agent in the middle,
// out to your bank and mobile money. Web3 side reads word -> icon (toward the
// centre); web2 side reads icon -> word (away from the centre). Centre is icons
// only. The marquee below scrolls through every network (from the chain
// registry) and the cash-in/out rails. Logos: Cloudinary first (LOGO map), then
// a react-icons brand logo, then a brand-coloured badge. Navy / #3AA0FF.

import { motion } from "framer-motion";
import { User, Bot, Landmark, Smartphone } from "lucide-react";
import type { IconType } from "react-icons";
import { SiEthereum, SiSolana, SiPolygon, SiCoinbase, SiOptimism } from "react-icons/si";

const ACCENT = "#3AA0FF";
const ease = [0.22, 1, 0.36, 1] as const;

// Cloudinary: real brand logos. Fill LOGO with public IDs and they win over the
// react-icons / badge fallback below. Delivery needs only the (public) cloud name.
const CLOUD = "noivtpg4";
const cld = (id?: string) => (id ? `https://res.cloudinary.com/${CLOUD}/image/upload/${id}` : "");
const LOGO: Record<string, string> = {
  Ethereum: "eth-diamond-_color-filled_cbdlt6",
  Base: "Base_square_blue_dd1ktd",
  Arc: "Arc_Icon_YellowGradient_avsvys",
  Solana: "solanaLogoMark_jvqcyo",
  Celo: "Celo_Symbol_RGB_ProsperityYellow_vvwx61",
  Arbitrum: "1225_Arbitrum_Logomark_FullColor_ClearSpace_xlpcpl",
  Optimism: "05dee11fbd0f605cc307d301daf68e2192297e50_k3gqrv",
  Algorand: "algorand-logomark-blue-RGB_ckba3s",
  Polygon: "polygon-icon-primary-purple_w6psna",
};

// Per-logo size tuning so wildly different source art reads at one optical
// weight: the ETH diamond runs tall, Base is a heavy solid square, while the
// Arbitrum and Algorand marks read small. 1 = no change.
const LOGO_SCALE: Record<string, number> = {
  Ethereum: 0.76,
  Base: 0.9,
  Optimism: 1.12,
  Arbitrum: 1.6,
  Algorand: 1.62,
};

type Brand = { color: string; Icon?: IconType; mono?: string; lucide?: "bank" | "phone" };
const BRANDS: Record<string, Brand> = {
  Ethereum: { color: "#8AA0FF", Icon: SiEthereum },
  Base: { color: "#4F86FF", Icon: SiCoinbase },
  Arc: { color: "#3AA0FF", mono: "◆" },
  Solana: { color: "#14F195", Icon: SiSolana },
  Celo: { color: "#FBCC5C", mono: "C" },
  Arbitrum: { color: "#5AB6F5", mono: "A" },
  Optimism: { color: "#FF6B6B", Icon: SiOptimism },
  Polygon: { color: "#A98BFF", Icon: SiPolygon },
  Algorand: { color: "#6E8BFF" },
  "Bank transfer": { color: "#8FC7FF", lucide: "bank" },
  "Mobile Money": { color: "#5FD0C0", lucide: "phone" },
};

// Networks = the chains in the registry we settle on. Rails = cash in / out.
const NETWORKS = ["Ethereum", "Base", "Arc", "Solana", "Celo", "Arbitrum", "Optimism", "Algorand", "Polygon"];
const RAILS = ["Bank transfer", "Mobile Money"];
const ALL = [...NETWORKS, ...RAILS];

const HUB_LEFT = ["Ethereum", "Base", "Arc", "Solana", "Celo"];
const HUB_RIGHT = ["Bank transfer", "Mobile Money"];

function Mark({ name, size = 20 }: { name: string; size?: number }) {
  const url = cld(LOGO[name]);
  const s = Math.round(size * (LOGO_SCALE[name] ?? 1));
  // eslint-disable-next-line @next/next/no-img-element -- small brand logo; next/image can't render inside SVG
  if (url) return <img src={url} alt={name} width={s} height={s} style={{ objectFit: "contain" }} />;
  const b = BRANDS[name] ?? { color: ACCENT };
  if (b.Icon) return <b.Icon size={size} color={b.color} />;
  if (b.lucide === "bank") return <Landmark size={size - 2} color={b.color} />;
  if (b.lucide === "phone") return <Smartphone size={size - 2} color={b.color} />;
  return <span style={{ color: b.color, fontWeight: 800, fontSize: size * 0.62 }}>{b.mono}</span>;
}

// ---- the hub (SVG) ----
const W = 1000;
const H = 560;
const HUB = { x: 500, y: 285 };
const YS_LEFT = [60, 172, 285, 398, 510];
const YS_RIGHT = [205, 365];
const LEFT_X = 205;
const RIGHT_X = 795;

function bez(x1: number, y1: number, x2: number, y2: number) {
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
}

// side: "left" = word before icon (web3, reads toward centre);
//       "right" = word after icon (web2, reads away from centre).
function HubNode({ name, x, y, side }: { name: string; x: number; y: number; side: "left" | "right" }) {
  const b = BRANDS[name] ?? { color: ACCENT };
  const hasLogo = Boolean(LOGO[name]);
  const labelX = side === "left" ? x - 52 : x + 52;
  const anchor = side === "left" ? "end" : "start";
  return (
    <g>
      <foreignObject x={x - 34} y={y - 34} width="68" height="68">
        <div
          className="w-full h-full rounded-2xl grid place-items-center overflow-hidden"
          style={{ background: `${b.color}1f`, border: `1px solid ${b.color}66`, padding: hasLogo ? 8 : 0 }}
        >
          <Mark name={name} size={hasLogo ? 40 : 30} />
        </div>
      </foreignObject>
      <text
        className="nlabel"
        x={labelX}
        y={y + 6}
        textAnchor={anchor}
        fill="rgba(255,255,255,0.78)"
        fontSize="17"
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
    ...HUB_LEFT.map((_, i) => ({ key: `l${i}`, d: bez(LEFT_X + 34, YS_LEFT[i], HUB.x - 86, HUB.y) })),
    ...HUB_RIGHT.map((_, i) => ({ key: `r${i}`, d: bez(HUB.x + 86, HUB.y, RIGHT_X - 34, YS_RIGHT[i]) })),
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
          <h2 className="mt-6 text-white text-4xl sm:text-5xl lg:text-6xl tracking-tight" style={{ fontFamily: "var(--font-serif, Georgia), serif", lineHeight: 1.05 }}>
            Works with the money{" "}
            <span className="italic text-white/55">you already use</span>
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
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="The networks your money travels on flow through you and your agent, out to your bank and mobile money.">
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
              <HubNode key={name} name={name} x={LEFT_X} y={YS_LEFT[i]} side="left" />
            ))}
            {HUB_RIGHT.map((name, i) => (
              <HubNode key={name} name={name} x={RIGHT_X} y={YS_RIGHT[i]} side="right" />
            ))}

            {/* centre: you + agent, icons only */}
            <circle cx={HUB.x} cy={HUB.y} r="230" fill="url(#hubGlow)" />
            <circle cx={HUB.x} cy={HUB.y} r="118" className="hubring" fill="none" stroke={ACCENT} strokeOpacity="0.28" strokeWidth="1.5" />
            <circle cx={HUB.x} cy={HUB.y} r="92" className="hubring" fill="none" stroke={ACCENT} strokeOpacity="0.4" strokeWidth="1.5" />
            <circle cx={HUB.x} cy={HUB.y} r="68" fill="#06294d" stroke={ACCENT} strokeWidth="2.5" />
            <foreignObject x={HUB.x - 52} y={HUB.y - 44} width="104" height="88">
              <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                <User size={34} color="#fff" strokeWidth={2} />
                <Bot size={26} color={ACCENT} strokeWidth={2} />
              </div>
            </foreignObject>
          </svg>
        </motion.div>

        {/* Marquee: every network + rail we support, name beside each logo. */}
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
        .railtrack{animation:railmarquee 26s linear infinite}
        .railtrack:hover{animation-play-state:paused}
        @media(prefers-reduced-motion:reduce){.railtrack{animation:none}}
      `}</style>
      <div className="railtrack flex w-max gap-2.5">
        {row.map((name, i) => {
          const hasLogo = Boolean(LOGO[name]);
          return (
            <div
              key={`${name}-${i}`}
              className="flex items-center gap-2 rounded-full border border-white/12 pl-2 pr-4 py-1 shrink-0"
            >
              <span className="grid place-items-center h-12 shrink-0">
                <Mark name={name} size={hasLogo ? 30 : 20} />
              </span>
              <span className="text-[13px] font-semibold text-white/80 whitespace-nowrap">{name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
