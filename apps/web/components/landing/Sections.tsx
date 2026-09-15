import {
  Send,
  PiggyBank,
  Building2,
  ArrowRight,
  Globe,
  Network,
} from "lucide-react";

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
    <section
      id="modes"
      className="py-24 px-6 md:px-12 max-w-7xl mx-auto relative z-20"
    >
      <div className="mb-16">
        <h2 className="text-3xl md:text-4xl tracking-tight font-medium text-white mb-4">
          One app, three modes
        </h2>
        <p className="text-zinc-400 text-base md:text-lg max-w-xl font-light">
          Same engine, one account, one balance, revealed progressively so the
          simplest user only ever sees what they need.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {MODES.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="p-6 rounded-xl bg-zinc-900/40 border border-zinc-800/50 hover:bg-zinc-900/80 hover:border-zinc-700 transition-all duration-300 group"
          >
            <div className="w-10 h-10 rounded bg-zinc-800 flex items-center justify-center mb-6 text-[#35E39C] group-hover:scale-110 transition-transform">
              <Icon className="w-5 h-5" strokeWidth={1.5} />
            </div>
            <h3 className="text-xl font-medium text-white tracking-tight mb-2">
              {title}
            </h3>
            <p className="text-base text-zinc-400 font-light leading-relaxed">
              {body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------- Corridor (case study) ---------------- */

export function Corridor() {
  return (
    <section
      id="corridor"
      className="py-24 border-y border-zinc-900 bg-zinc-950/50 relative z-20"
    >
      <div className="px-6 md:px-12 max-w-7xl mx-auto flex flex-col lg:flex-row gap-16 items-center">
        {/* Visual */}
        <div className="w-full lg:w-1/2 relative">
          <div className="relative w-full aspect-square md:aspect-[4/3] rounded-2xl overflow-hidden border border-zinc-700 bg-[#141417] grid-overlay shadow-[0_0_60px_-20px_rgba(53,227,156,0.25)]">
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/40 via-transparent to-transparent" />

            {/* Corridor flow */}
            <div className="absolute inset-0 flex items-center justify-center px-10">
              <div className="flex items-center w-full max-w-md">
                <Endpoint flag="🇬🇧" label="London" sub="You send" amount="£200" />
                <div className="flex-1 px-3">
                  <svg
                    viewBox="0 0 120 8"
                    className="w-full h-2 overflow-visible"
                  >
                    <path
                      d="M0,4 H120"
                      stroke="#35E39C"
                      strokeWidth="2"
                      fill="none"
                      strokeDasharray="3 3"
                      className="animate-flow"
                      style={{ filter: "drop-shadow(0 0 6px rgba(53,227,156,0.8))" }}
                    />
                  </svg>
                </div>
                <Endpoint
                  flag="🇳🇬"
                  label="Lagos"
                  sub="They receive"
                  amount="₦408k"
                  align="right"
                />
              </div>
            </div>

            <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between">
              <div className="bg-zinc-800 border border-zinc-600 px-4 py-2 rounded">
                <span className="block text-[10px] font-mono text-zinc-300 uppercase tracking-widest">
                  Settlement
                </span>
                <span className="text-lg font-medium text-white">&lt;30 sec</span>
              </div>
              <div className="bg-zinc-800 border border-zinc-600 px-4 py-2 rounded flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#35E39C] shadow-[0_0_8px_rgba(53,227,156,0.9)]" />
                <span className="text-[10px] font-mono text-white uppercase tracking-widest">
                  Gasless
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Copy */}
        <div className="w-full lg:w-1/2 space-y-8">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-[#35E39C]" />
            <span className="font-mono text-xs text-[#35E39C] uppercase tracking-widest">
              Corridor
            </span>
          </div>

          <h2 className="text-3xl md:text-5xl tracking-tight font-medium text-white leading-tight">
            How £200 reaches Lagos in under 30 seconds.
          </h2>

          <p className="text-base md:text-lg text-zinc-400 font-light leading-relaxed">
            Sending money into Sub-Saharan Africa averages ~8.78% in fees, the
            highest of any region, settled in days, not seconds. Luberty routes
            the same transfer over stablecoin rails for a fraction of a percent,
            credits the recipient instantly from local liquidity, and settles
            behind the scenes.
          </p>

          <div className="grid grid-cols-2 gap-8 pt-6 border-t border-zinc-900">
            <div>
              <div className="text-4xl tracking-tighter font-medium text-white mb-1">
                0.5%
              </div>
              <div className="text-xs font-mono text-zinc-500 uppercase tracking-widest">
                All-in fee vs 8.78%
              </div>
            </div>
            <div>
              <div className="text-4xl tracking-tighter font-medium text-white mb-1">
                &lt;30 sec
              </div>
              <div className="text-xs font-mono text-zinc-500 uppercase tracking-widest">
                Settlement time
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Endpoint({
  flag,
  label,
  sub,
  amount,
  align = "left",
}: {
  flag: string;
  label: string;
  sub: string;
  amount: string;
  align?: "left" | "right";
}) {
  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      <div className="text-2xl mb-2">{flag}</div>
      <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
        {sub}
      </div>
      <div className="text-lg font-medium text-white">{amount}</div>
      <div className="text-xs text-zinc-400">{label}</div>
    </div>
  );
}

/* ---------------- Rails (integrations) ---------------- */

// Protocols and networks per Engineering Spec v0.3 §2/§3.4 — real logos,
// self-hosted from /public/logos.
const PROTOCOLS = [
  { logo: "/logos/uniswap.png", name: "Uniswap v4" },
  { logo: "/logos/usdc.png", name: "Circle CCTP V2" },
  { logo: "/logos/hyperlane.png", name: "Hyperlane" },
  { logo: "/logos/layerzero.png", name: "LayerZero" },
  { logo: "/logos/reactive.png", name: "Reactive Network" },
];

const NETWORKS = [
  { logo: "/logos/arbitrum.png", name: "Arbitrum" },
  { logo: "/logos/ethereum.png", name: "Ethereum" },
  { logo: "/logos/base.png", name: "Base" },
  { logo: "/logos/optimism.png", name: "Optimism" },
  { logo: "/logos/polygon.png", name: "Polygon" },
  { logo: "/logos/bnb.png", name: "BNB Chain" },
  { logo: "/logos/avalanche.png", name: "Avalanche" },
  { logo: "/logos/celo.png", name: "Celo" },
  { logo: "/logos/solana.png", name: "Solana" },
  { logo: "/logos/sui.png", name: "Sui" },
  { logo: "/logos/aptos.png", name: "Aptos" },
  { logo: "/logos/tron.png", name: "Tron" },
  { logo: "/logos/stellar.png", name: "Stellar" },
];

function RailCard({
  logo,
  name,
  note,
  compact = false,
}: {
  logo: string;
  name: string;
  note?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`group rounded-xl bg-[#0c0c0e] border border-zinc-800/60 hover:bg-[#121214] hover:border-zinc-700 transition-all flex flex-col items-center justify-center cursor-default relative overflow-hidden ${
        compact ? "p-5" : "p-8"
      }`}
    >
      <div
        className={`rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center overflow-hidden group-hover:shadow-[0_0_20px_rgba(255,255,255,0.08)] transition-shadow duration-300 ${
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
      <span
        className={`font-medium text-white text-center ${
          compact ? "text-sm" : "text-base mb-1"
        }`}
      >
        {name}
      </span>
      {note && (
        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mt-1 text-center">
          {note}
        </span>
      )}
    </div>
  );
}

export function Rails() {
  return (
    <section
      id="rails"
      className="py-32 px-6 md:px-12 max-w-7xl mx-auto relative z-20 border-b border-zinc-900"
    >
      <div className="text-center mb-16 max-w-2xl mx-auto flex flex-col items-center">
        <h2 className="text-4xl md:text-5xl tracking-tight font-medium text-white mb-6">
          Built on proven rails.
        </h2>
        <p className="text-base md:text-lg text-zinc-400 font-light text-balance leading-relaxed">
          Your money moves on the most battle-tested networks in the industry,
           the same infrastructure already settling trillions a year. We
          integrate them; you never have to think about them.
        </p>
      </div>

      <div className="max-w-5xl mx-auto space-y-10">
        <div>
          <div className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mb-4 text-center">
            Protocols &amp; rails
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {PROTOCOLS.map((p) => (
              <RailCard key={p.name} {...p} />
            ))}
          </div>
        </div>

        <div>
          <div className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mb-4 text-center">
            Networks
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-3">
            {NETWORKS.map((n) => (
              <RailCard key={n.name} {...n} compact />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Engine CTA ---------------- */

export function EngineCTA() {
  return (
    <section className="relative w-full overflow-hidden bg-[#050505] min-h-[700px] flex items-center border-b border-zinc-900">
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 grid-overlay opacity-30" />
        <div className="absolute -top-10 -right-20 w-[120%] h-[120%] flex flex-col gap-16 transform -rotate-[8deg] select-none opacity-10 blur-[1px]">
          <div className="text-[140px] font-medium tracking-tighter text-zinc-500 whitespace-nowrap leading-none">
            One pool per pair One pool per pair
          </div>
          <div className="text-[90px] font-medium tracking-tighter text-zinc-500 whitespace-nowrap leading-none ml-32">
            Never one per chain, the structural fix for fragmentation
          </div>
          <div className="text-[120px] font-medium tracking-tighter text-zinc-500 whitespace-nowrap leading-none ml-64">
            Unified liquidity Unified liquidity
          </div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-[#050505]/80 to-transparent" />
        <div className="hidden md:block absolute top-[14%] left-1/2 -translate-x-1/2 bg-[#35E39C]/25 border border-[#35E39C]/60 rounded-full px-6 py-3 shadow-[0_0_50px_rgba(53,227,156,0.5)]">
          <span className="text-[#CFF7E7] font-medium text-lg tracking-tight flex items-center gap-2 drop-shadow-[0_0_8px_rgba(53,227,156,0.7)]">
            <Network className="w-5 h-5 text-[#7FEFC4]" strokeWidth={1.5} /> Unified Hub
          </span>
        </div>
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 md:px-12 py-24 flex flex-col lg:flex-row items-center justify-between gap-16">
        <div className="w-full lg:w-1/2 flex flex-col items-start">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded mb-8">
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
              Settlement Core
            </span>
          </div>

          <h2 className="text-4xl md:text-5xl lg:text-6xl tracking-tight font-medium text-white mb-6 leading-[1.05] text-balance">
            One hub, many gateways. Liquidity that stops fragmenting.
          </h2>

          <p className="text-base md:text-lg text-zinc-400 font-light leading-relaxed mb-10 max-w-md">
            Liquidity lives in one pool per currency pair on a single hub, not
            one pool per chain. Every other chain is a thin gateway that routes
            value to the hub. Deposit from any chain, exit on another.
          </p>

          <a
            href="#waitlist"
            className="group flex items-center gap-2 bg-[#35E39C] hover:bg-[#2BC889] text-white px-7 py-3.5 rounded-md transition-all duration-300 font-medium text-sm shadow-[0_0_20px_rgba(53,227,156,0.2)] hover:shadow-[0_0_30px_rgba(53,227,156,0.4)]"
          >
            Get early access
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </a>
        </div>

        <div className="w-full lg:w-5/12 flex justify-start lg:justify-end">
          <div className="tech-glass p-10 rounded-2xl w-full max-w-md border border-zinc-800/80 relative overflow-hidden group bg-[#0a0a0c]/80">
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            <h3 className="text-2xl tracking-tight font-medium text-white mb-8 pr-8 leading-tight">
              The rail has already won. The opening is the experience layer.
            </h3>
            <div className="bg-zinc-950 border border-zinc-800/60 rounded-xl p-6 relative">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block mb-3">
                Stablecoin settlement volume · 2025
              </span>
              <div className="text-6xl tracking-tighter font-medium text-white mb-4">
                $33T
              </div>
              <p className="text-sm text-zinc-400 font-light leading-relaxed">
                More than Visa and Mastercard combined. Luberty is the
                money-first app on top of a rail that has already won.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
