"use client";

// Path A phone sign-in (own-auth mode). Two steps: enter phone -> enter the OTP
// we send via Termii. On success the server sets a signed session cookie and we
// reload; Privy custom auth then picks up the session and provisions the wallet.
import { useState } from "react";
import { ArrowRight, Loader2, Phone, ShieldCheck } from "lucide-react";
import { Button } from "@/components/app/ui";
import { LogoMark } from "@/components/app/Logo";
import { site } from "@pesarc/sdk/site";

type Step = "phone" | "code";

export default function PhoneSignIn() {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [pinId, setPinId] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Could not send the code.");
      } else {
        setPinId(data.pinId);
        setStep("code");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinId, code }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "That code isn't right.");
        if (data.expired) setStep("phone");
      } else {
        // Session cookie is set; reload so Privy custom auth picks it up.
        window.location.reload();
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream px-6 [color-scheme:light]">
      <div className="w-full max-w-sm text-center">
        <div className="flex justify-center mb-6">
          <LogoMark size={48} className="rounded-2xl shadow-pop-sm" />
        </div>

        {step === "phone" ? (
          <>
            <h1 className="text-2xl font-extrabold tracking-tight text-harbor">
              Sign in to {site.name}
            </h1>
            <p className="mt-2 text-sm text-slate font-medium">
              Enter your phone number and we&apos;ll text you a code.
            </p>
            <form onSubmit={send} className="mt-7 flex flex-col gap-3">
              <div className="flex items-center gap-2 rounded-field border border-fog bg-snow px-4 py-3.5">
                <Phone className="w-4 h-4 text-slate shrink-0" />
                <input
                  type="tel"
                  autoFocus
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +234 801 234 5678"
                  aria-label="Phone number"
                  className="flex-1 bg-transparent text-sm font-semibold text-ink placeholder:text-slate/60 outline-none"
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : (<>Send code <ArrowRight className="w-4 h-4" /></>)}
              </Button>
            </form>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-extrabold tracking-tight text-harbor">Enter your code</h1>
            <p className="mt-2 text-sm text-slate font-medium">
              We sent a 6-digit code to <span className="text-harbor font-bold">{phone}</span>.
            </p>
            <form onSubmit={verify} className="mt-7 flex flex-col gap-3">
              <div className="flex items-center gap-2 rounded-field border border-fog bg-snow px-4 py-3.5">
                <ShieldCheck className="w-4 h-4 text-slate shrink-0" />
                <input
                  type="text"
                  autoFocus
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, ""))}
                  placeholder="123456"
                  aria-label="Verification code"
                  className="flex-1 bg-transparent text-lg tracking-[0.3em] font-bold text-ink placeholder:text-slate/40 outline-none"
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : (<>Verify <ArrowRight className="w-4 h-4" /></>)}
              </Button>
              <button
                type="button"
                onClick={() => { setStep("phone"); setCode(""); setError(""); }}
                className="text-xs font-bold text-slate hover:text-harbor transition-colors"
              >
                Use a different number
              </button>
            </form>
          </>
        )}

        {error && <p className="mt-3 text-[13px] font-semibold text-red-500">{error}</p>}

        <a
          href={site.url}
          className="mt-6 inline-block text-xs font-bold text-slate hover:text-harbor transition-colors"
        >
          Back to {site.name}
        </a>
      </div>
    </div>
  );
}
