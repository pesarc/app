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
      className="relative py-24 md:py-32 px-6 md:px-12 overflow-hidden bg-cream flex flex-col items-center justify-center text-center"
    >
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[620px] h-[320px] bg-sky/10 blur-[120px] rounded-full" />

      <div className="relative z-10 max-w-3xl mx-auto flex flex-col items-center">
        <div className="inline-flex items-center gap-2 rounded-pill bg-sky-tint/60 text-sky-deep px-3.5 py-1.5 mb-6">
          <Sparkles className="w-4 h-4" />
          <span className="text-[11px] font-extrabold uppercase tracking-widest">
            Early access
          </span>
        </div>

        <h2 className="text-4xl md:text-5xl lg:text-6xl tracking-tight font-extrabold text-harbor mb-6 text-balance">
          Ready to send your <span className="text-sky">first transfer?</span>
        </h2>

        <p className="text-base md:text-lg text-slate font-medium max-w-xl mb-10 text-balance leading-relaxed">
          Become an early beta-tester of Pesarc. Be first to send money home,
          gasless, in under a minute, in your own currency.
        </p>

        {done ? (
          <div className="inline-flex items-center gap-2.5 bg-sky-tint/60 text-sky-deep rounded-pill px-6 py-3.5">
            <Check className="w-4 h-4" />
            <span className="text-sm font-bold">
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
                className="w-full bg-snow border border-fog rounded-pill px-6 py-3.5 text-sm text-ink placeholder:text-slate/60 focus:outline-none focus:border-sky focus:ring-1 focus:ring-sky/40 transition-all shadow-card-flat"
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
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-sky hover:bg-sky-deep text-white px-8 py-3.5 rounded-pill transition-all duration-300 font-extrabold text-sm whitespace-nowrap shadow-pop hover:-translate-y-0.5 disabled:opacity-70 disabled:translate-y-0"
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
