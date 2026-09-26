"use client";

// OPay-style hosted checkout. A merchant sends the customer here with
// ?session=pay_…; the customer sees what they are paying, signs into Pesarc at
// the Pay step, pays (real corridor send in live mode / simulated in mock), and
// is redirected back to the merchant's redirect_url with a signed status.

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Lock, Store, Loader2, AlertCircle } from "lucide-react";
import { executeCorridorSend } from "@pesarc/sdk/chain/sendCorridor";
import { CONTRACTS_READY } from "@pesarc/sdk/chain/contracts";
import { useWallet } from "@pesarc/sdk/wallet/WalletProvider";
import { useSmartWallet } from "@pesarc/sdk/wallet/smartWallet";
import { LogoMark } from "@/components/app/Logo";
import { Button, Card } from "@/components/app/ui";

type Session = {
  id: string;
  merchantName: string;
  description: string | null;
  amount: number;
  currency: string;
  reference: string;
  status: "pending" | "paid" | "expired" | "canceled";
  hasPayout: boolean;
  expiresAt: string;
};

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString()} ${currency}`;
  }
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<Centered>Loading checkout…</Centered>}>
      <Checkout />
    </Suspense>
  );
}

function Checkout() {
  const params = useSearchParams();
  const sessionId = params.get("session") ?? "";

  const { mode, authenticated, login } = useWallet();
  const smart = useSmartWallet();
  const live = mode === "live" && authenticated && smart.ready && CONTRACTS_READY;
  const needsLogin = mode === "live" && !authenticated;

  const [session, setSession] = useState<Session | null>(null);
  const [step, setStep] = useState<"loading" | "ready" | "paying" | "done" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!sessionId) {
      setError("This checkout link is missing its payment reference.");
      setStep("error");
      return;
    }
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/checkout/${sessionId}`);
        const data = await res.json();
        if (!active) return;
        if (!data.ok) {
          setError(data.error ?? "This payment could not be found.");
          setStep("error");
          return;
        }
        setSession(data.payment);
        setStep(data.payment.status === "paid" ? "done" : "ready");
      } catch {
        if (active) {
          setError("Could not load this payment.");
          setStep("error");
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [sessionId]);

  const finish = useCallback(
    async (txHash?: string) => {
      const res = await fetch(`/api/checkout/${sessionId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Could not complete the payment.");
        setStep("error");
        return;
      }
      setStep("done");
      if (data.redirectUrl) {
        setTimeout(() => {
          window.location.href = data.redirectUrl;
        }, 1200);
      }
    },
    [sessionId],
  );

  const pay = useCallback(async () => {
    if (!session) return;
    // Live mode: authenticate before we take any money.
    if (needsLogin) {
      login();
      return;
    }
    setStep("paying");
    try {
      let txHash: string | undefined;
      if (live && session.hasPayout && session.currency === "USD") {
        const r = await executeCorridorSend(smart, session.amount, "");
        txHash = r.tx;
      } else {
        await new Promise((res) => setTimeout(res, 1400));
      }
      await finish(txHash);
    } catch {
      setError("Payment failed. No funds were moved.");
      setStep("error");
    }
  }, [session, needsLogin, login, live, smart, finish]);

  const brand = (
    <div className="flex items-center justify-center gap-2 py-6">
      <LogoMark size={24} className="rounded-lg" />
      <span className="text-sm font-bold tracking-tight text-harbor">Pesarc</span>
      <span className="text-xs text-slate">· secure checkout</span>
    </div>
  );

  if (step === "loading") return <Centered>Loading checkout…</Centered>;

  if (step === "error") {
    return (
      <div className="min-h-screen flex flex-col">
        {brand}
        <div className="flex-1 flex items-center justify-center px-4 pb-16">
          <Card className="p-6 text-center max-w-sm">
            <div className="mx-auto w-12 h-12 rounded-full bg-alert/10 text-alert flex items-center justify-center mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="font-semibold text-ink mb-1">Payment unavailable</div>
            <p className="text-sm text-slate">{error}</p>
          </Card>
        </div>
      </div>
    );
  }

  if (!session) return null;
  const expired = session.status === "expired";

  return (
    <div className="min-h-screen flex flex-col">
      {brand}
      <div className="flex-1 flex items-start sm:items-center justify-center px-4 pb-16">
        <Card className="w-full max-w-md p-6 sm:p-8">
          <div className="flex items-center gap-2.5 mb-6">
            <span className="w-9 h-9 rounded-xl bg-sky-tint text-sky flex items-center justify-center shrink-0">
              <Store className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate uppercase tracking-widest">Pay</div>
              <div className="font-semibold text-ink truncate">{session.merchantName}</div>
            </div>
          </div>

          <div className="text-center py-4">
            <div className="text-4xl font-semibold text-ink numerals">
              {money(session.amount, session.currency)}
            </div>
            {session.description && (
              <div className="text-sm text-slate mt-1.5">{session.description}</div>
            )}
            <div className="text-xs text-slate/70 mt-1 font-mono">Ref {session.reference}</div>
          </div>

          {step === "done" ? (
            <div className="text-center mt-4">
              <div className="mx-auto w-14 h-14 rounded-full bg-sky text-white flex items-center justify-center mb-3 shadow-pop-sm">
                <Check className="w-7 h-7" strokeWidth={2.5} />
              </div>
              <div className="font-semibold text-ink mb-1">Payment complete</div>
              <p className="text-sm text-slate flex items-center justify-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Returning you to {session.merchantName}…
              </p>
            </div>
          ) : expired ? (
            <div className="text-center mt-2 text-sm text-slate">
              This payment link has expired. Ask {session.merchantName} for a new one.
            </div>
          ) : (
            <>
              <Button size="lg" block className="mt-2" onClick={pay} disabled={step === "paying"}>
                {step === "paying" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Paying…
                  </>
                ) : needsLogin ? (
                  <>Sign in to pay {money(session.amount, session.currency)}</>
                ) : (
                  <>Pay {money(session.amount, session.currency)}</>
                )}
              </Button>
              <p className="mt-4 text-center text-xs text-slate flex items-center justify-center gap-1.5">
                <Lock className="w-3.5 h-3.5" /> Gasless and secured by Pesarc
              </p>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 text-slate text-sm">
      {children}
    </div>
  );
}
