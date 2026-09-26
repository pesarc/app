"use client";

import { useState } from "react";
import { ArrowRight, Check, Sparkles, Loader2 } from "lucide-react";

type State = "idle" | "loading" | "success" | "duplicate" | "error";

export default function Waitlist() {
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
        body: JSON.stringify({ email, company, source: "landing-hero" }),
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
    <section
      id="beta"
      className="relative py-24 md:py-32 px-6 md:px-12 overflow-hidden flex flex-col items-center justify-center text-center"
      style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
    >
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[620px] h-[320px] rounded-full"
        style={{ background: "rgba(58,160,255,0.10)", filter: "blur(120px)" }}
      />

      <div className="relative z-10 max-w-3xl mx-auto flex flex-col items-center">
        <div
          className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 mb-6 text-white/90"
          style={{ border: "1px solid rgba(58,160,255,0.35)", background: "rgba(58,160,255,0.06)" }}
        >
          <Sparkles className="w-4 h-4" style={{ color: "#3AA0FF" }} />
          <span className="text-[11px] font-medium uppercase tracking-widest">
            Early beta
          </span>
        </div>

        <h2 className="text-4xl md:text-5xl lg:text-6xl tracking-tighter font-medium text-white mb-6 text-balance" style={{ lineHeight: 1.12 }}>
          Ready to send your <span style={{ color: "#3AA0FF" }}>first transfer?</span>
        </h2>

        <p className="text-base md:text-lg text-white/60 max-w-xl mb-10 text-balance leading-relaxed">
          Become an early beta-tester of Pesarc. Be first to send money home,
          gasless, in under a minute, in your own currency.
        </p>

        {done ? (
          <div
            className="inline-flex items-center gap-2.5 rounded-full px-6 py-3.5 text-white"
            style={{ border: "1px solid rgba(58,160,255,0.3)", background: "rgba(58,160,255,0.08)" }}
          >
            <Check className="w-4 h-4" style={{ color: "#3AA0FF" }} />
            <span className="text-sm font-medium">
              {state === "duplicate"
                ? "You're already on the list, we'll be in touch."
                : "You're on the list. We'll be in touch."}
            </span>
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            className="flex flex-col items-center gap-3 w-full max-w-md relative z-20"
          >
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                aria-label="Email address"
                className="w-full rounded-full px-6 py-3.5 text-sm text-white placeholder:text-white/40 focus:outline-none transition-all"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.16)" }}
              />
              {/* Honeypot — visually hidden, not for humans */}
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="hidden"
                name="company"
              />
              <button
                type="submit"
                disabled={state === "loading"}
                className="w-full sm:w-auto flex items-center justify-center gap-2 text-[#04294d] px-8 py-3.5 rounded-full transition-all duration-300 font-medium text-sm whitespace-nowrap hover:scale-[1.03] disabled:opacity-70"
                style={{ backgroundColor: "#3AA0FF", boxShadow: "0 8px 24px -6px rgba(58,160,255,0.4)" }}
              >
                {state === "loading" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Joining…
                  </>
                ) : (
                  <>
                    Become a beta-tester
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
            {state === "error" && (
              <p className="text-xs font-semibold text-alert" role="alert">
                {error}
              </p>
            )}
          </form>
        )}
      </div>
    </section>
  );
}
