"use client";

// Gates the app: app.pesarc.xyz is reachable only after login. Unauthenticated
// visitors get a sign-in screen instead of the dashboard. When Privy isn't
// configured (local dev), useWallet() reports authenticated=true, so dev is
// unaffected.
import { useWallet } from "@pesarc/sdk/wallet/WalletProvider";
import { Button } from "@/components/app/ui";
import { LogoMark } from "@/components/app/Logo";
import { site } from "@pesarc/sdk/site";
import { Loader2, ArrowRight } from "lucide-react";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, login } = useWallet();

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <Loader2 className="w-6 h-6 animate-spin text-sky" />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream px-6 [color-scheme:light]">
        <div className="w-full max-w-sm text-center">
          <div className="flex justify-center mb-6">
            <LogoMark size={48} className="rounded-2xl shadow-pop-sm" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-harbor">
            Sign in to {site.name}
          </h1>
          <p className="mt-2 text-sm text-slate font-medium">
            Log in to send, hold, earn and settle money across borders.
          </p>
          <Button className="mt-7 w-full" onClick={() => login()}>
            Sign in <ArrowRight className="w-4 h-4" />
          </Button>
          <a
            href={site.url}
            className="mt-4 inline-block text-xs font-bold text-slate hover:text-harbor transition-colors"
          >
            Back to pesarc.xyz
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
