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
      id="waitlist"
      className="relative py-24 md:py-32 px-6 md:px-12 overflow-hidden bg-animated-gradient z-20 flex flex-col items-center justify-center text-center"
    >
      <div className="absolute inset-0 grid-overlay opacity-20 mix-blend-overlay pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-amber-500/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative z-10 max-w-3xl mx-auto flex flex-col items-center">
        <div className="flex items-center gap-2 mb-6">
          <Sparkles className="w-5 h-5 text-amber-400" />
          <span className="font-mono text-xs text-amber-400 uppercase tracking-widest">
            Early Access
          </span>
        </div>

        <h2 className="text-4xl md:text-5xl lg:text-6xl tracking-tight font-medium text-white mb-6 text-balance">
          Ready to send your{" "}
          <span className="bg-gradient-to-r from-amber-200 to-amber-500 bg-clip-text text-transparent">
            first transfer?
          </span>
        </h2>

        <p className="text-base md:text-lg text-blue-100/70 font-light max-w-xl mb-10 text-balance leading-relaxed">
          Join the waitlist for the Pesarc beta. Be first to send money home,
          gasless, in under a minute, in your own currency.
        </p>

        {done ? (
          <div className="flex items-center gap-3 bg-[#020617]/40 border border-amber-500/40 rounded-full px-6 py-3.5 backdrop-blur-md">
            <Check className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-white">
              {state === "duplicate"
                ? "You're already on the list — we'll be in touch."
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
                className="w-full bg-[#020617]/40 border border-[#1e3a8a]/60 rounded-full px-6 py-3.5 text-sm text-white placeholder:text-blue-300/40 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all backdrop-blur-md"
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
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-[#020617] px-8 py-3.5 rounded-full transition-all duration-300 font-medium text-sm whitespace-nowrap gold-glow hover:scale-[1.02] disabled:opacity-70 disabled:hover:scale-100"
              >
                {state === "loading" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Joining…
                  </>
                ) : (
                  <>
                    Join waitlist
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
            {state === "error" && (
              <p className="text-xs text-red-300" role="alert">
                {error}
              </p>
            )}
          </form>
        )}
      </div>
    </section>
  );
}
