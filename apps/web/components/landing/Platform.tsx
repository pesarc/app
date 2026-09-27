"use client";

// "Everything your money does" (five things around one account) + the closing
// beta CTA. Written for the Mum Test: money words, no crypto, no infra names.
// Navy brand, serif-italic accent headings.

import { useState } from "react";
import { motion } from "framer-motion";
import { Send, Wallet, Sprout, TrendingUp, Bot, ArrowRight, Check, Loader2 } from "lucide-react";
import { site } from "@pesarc/sdk/site";

const ACCENT = "#3AA0FF";
const ease = [0.22, 1, 0.36, 1] as const;
const mono = { fontFamily: "var(--font-mono, ui-monospace), monospace" } as const;
const serif = { fontFamily: "var(--font-serif, Georgia), serif" } as const;

const PILLARS = [
  { n: "01", icon: Send, tag: "Send", body: "Send money across borders in your own currency, in seconds, for a fee you can actually read." },
  { n: "02", icon: Wallet, tag: "Hold", body: "Keep a balance that holds its value, in naira, cedis or shillings, not something that melts away." },
  { n: "03", icon: Sprout, tag: "Earn", body: "Put money that's just sitting there to work and watch it grow. Take it out whenever you want." },
  { n: "04", icon: TrendingUp, tag: "Invest", body: "Buy shares in the companies you know, and if you like, take a view on the day's big events." },
  { n: "05", icon: Bot, tag: "Just ask", body: "Say what you need, in the app or on WhatsApp, and it's done. Pay a bill, send money, top up airtime." },
] as const;

const POS = [
  "md:col-start-1 md:row-start-1",
  "md:col-start-3 md:row-start-1",
  "md:col-start-1 md:row-start-2 md:mt-12",
  "md:col-start-3 md:row-start-2 md:mt-12",
  "md:col-start-2 md:row-start-3 md:mt-8",
] as const;

function PillarCard({
  n,
  tag,
  body,
  icon: Icon,
  className,
  index,
}: {
  n: string;
  tag: string;
  body: string;
  icon: typeof Send;
  className: string;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, ease, delay: index * 0.06 }}
      className={`relative z-10 rounded-xl border border-white/12 bg-white/[0.03] p-7 backdrop-blur-md transition-transform hover:-translate-y-1 ${className}`}
    >
      <div className="flex items-center gap-3 mb-4 pb-4 border-b border-white/10">
        <span className="grid place-items-center w-9 h-9 rounded-lg" style={{ background: "rgba(58,160,255,0.15)" }}>
          <Icon className="w-[18px] h-[18px]" style={{ color: ACCENT }} strokeWidth={1.7} />
        </span>
        <span className="text-[11px] font-bold text-white/40" style={mono}>{n}</span>
        <span className="text-[11px] font-bold text-white uppercase tracking-[0.16em]" style={mono}>{tag}</span>
      </div>
      <p className="text-sm font-light leading-relaxed text-white/60">{body}</p>
    </motion.div>
  );
}

export function Platform() {
  return (
    <section id="features" className="relative px-6 sm:px-8 lg:px-12 py-24 lg:py-28 overflow-hidden" style={{ borderTop: "1px solid rgba(255,255,255,0.08)", background: "rgba(4,26,51,0.55)" }}>
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45 mb-5" style={mono}>One app</span>
          <h2 className="text-4xl sm:text-5xl md:text-6xl leading-[1.02] tracking-tight text-white" style={serif}>
            Everything your money does,
            <br />
            <span className="italic text-white/55">in one place.</span>
          </h2>
        </div>

        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* centre node: one account */}
          <div className="hidden md:flex absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-60 h-60 rounded-full items-center justify-center z-0" style={{ background: "rgba(4,26,51,0.85)", border: "1px solid rgba(255,255,255,0.12)", backdropFilter: "blur(8px)" }}>
            <div className="relative w-44 h-44 rounded-full flex flex-col items-center justify-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.12)" }}>
              <span className="absolute inset-0 rounded-full animate-ping" style={{ border: `1px solid ${ACCENT}55`, animationDuration: "4s" }} />
              <span className="relative z-10 text-2xl tracking-tight text-white" style={serif}>Pesarc</span>
              <span className="relative z-10 mt-1.5 text-[11px] tracking-[0.2em] text-white/45" style={mono}>ONE ACCOUNT</span>
            </div>
          </div>

          {PILLARS.map((p, i) => (
            <PillarCard key={p.n} {...p} className={POS[i]} index={i} />
          ))}
          <div className="hidden md:block md:col-start-2 md:row-start-2" aria-hidden />
        </div>
      </div>
    </section>
  );
}

type State = "idle" | "loading" | "success" | "duplicate" | "error";

export function FinalCta() {
  const appHref = `${site.appUrl}/home`;
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState(""); // honeypot
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || state === "loading") return;
    setState("loading");
    setError("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, company, source: "landing-cta" }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        setState("error");
        return;
      }
      setState(data.status === "duplicate" ? "duplicate" : "success");
    } catch {
      setError("Network error. Please try again.");
      setState("error");
    }
  };

  const done = state === "success" || state === "duplicate";

  return (
    <section id="beta" className="relative min-h-[60vh] flex flex-col items-center justify-center text-center px-6 py-28" style={{ borderTop: "1px solid rgba(255,255,255,0.08)", background: "rgba(4,26,51,0.55)" }}>
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-40"
        style={{ backgroundImage: "linear-gradient(rgba(58,160,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(58,160,255,0.06) 1px, transparent 1px)", backgroundSize: "48px 48px" }}
        aria-hidden
      />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.8, ease }}
        className="relative z-10 max-w-2xl mx-auto flex flex-col items-center w-full"
      >
        <span className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 mb-8 text-white/90" style={{ border: "1px solid rgba(58,160,255,0.35)", background: "rgba(58,160,255,0.06)" }}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: ACCENT }} />
          <span className="text-[11px] font-medium uppercase tracking-widest">Early beta</span>
        </span>

        <h2 className="text-4xl sm:text-5xl md:text-7xl leading-[1.02] tracking-tight text-white mb-7" style={serif}>
          Ready to send your
          <br />
          <span className="italic text-white/55">first transfer?</span>
        </h2>
        <p className="text-base sm:text-lg font-light text-white/60 mb-9 max-w-lg">
          Join the early beta-testers. Be first to send money home, in your own
          currency, for a fraction of what it costs today.
        </p>

        {done ? (
          <div className="inline-flex items-center gap-2.5 rounded-full px-6 py-3.5 text-white" style={{ background: "rgba(58,160,255,0.12)", border: `1px solid ${ACCENT}` }}>
            <Check className="w-4 h-4" style={{ color: ACCENT }} />
            <span className="text-sm font-medium">
              {state === "duplicate" ? "You're already on the list." : "You're in. We'll be in touch soon."}
            </span>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="w-full max-w-md flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              aria-label="Email address"
              className="flex-1 rounded-full px-5 py-3.5 text-sm text-white placeholder:text-white/40 outline-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.16)" }}
            />
            <input type="text" tabIndex={-1} autoComplete="off" value={company} onChange={(e) => setCompany(e.target.value)} className="hidden" aria-hidden />
            <button
              type="submit"
              disabled={state === "loading"}
              className="group inline-flex items-center justify-center gap-2.5 rounded-full px-6 py-3.5 text-sm font-bold uppercase tracking-wide text-[#04294d] transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-70"
              style={{ background: ACCENT }}
            >
              {state === "loading" ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                <>
                  Become a beta-tester
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>
        )}
        {state === "error" && <p className="mt-3 text-[13px] text-red-300">{error}</p>}

        <a href={appHref} className="mt-7 text-[12px] font-bold uppercase tracking-[0.14em] text-white/60 hover:text-white transition-colors border-b border-transparent hover:border-white/40 pb-1" style={mono}>
          Or open the app
        </a>
      </motion.div>

      <div className="absolute bottom-7 w-full text-center opacity-60">
        <span className="text-[11px] uppercase tracking-[0.2em] text-white/45" style={mono}>Pesarc, money the way you think about it</span>
      </div>
    </section>
  );
}
