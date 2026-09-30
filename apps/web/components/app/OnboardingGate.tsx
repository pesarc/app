"use client";

// Shown once, after login, before the app: pick your audience. The choice routes
// you to the right surface, decides whether the business experience is ever
// shown, and turns on the Advanced tier for power users. Personal is the default
// path (the Mum Test audience).
import { useRouter } from "next/navigation";
import { User, Building2, PiggyBank, Gauge, ArrowRight } from "@/components/icons";
import { usePersona, homeFor, type Persona } from "@pesarc/sdk/persona";
import { useUIMode } from "@pesarc/sdk/ui-mode";
import { usePrefs } from "@pesarc/sdk/prefs";
import { SUPPORTED_COUNTRIES } from "@pesarc/sdk/countries";
import { LogoMark } from "@/components/app/Logo";
import { site } from "@pesarc/sdk/site";

export default function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { persona, ready, setPersona } = usePersona();
  const { country, setCountry, ready: prefsReady } = usePrefs();
  const { setMode } = useUIMode();
  const router = useRouter();

  // Wait for saved choices to load so nothing flashes for returning users.
  if (!ready || !prefsReady) return null;
  // First: where are you? (sets the default currency.) Then: how will you use it?
  if (!country) return <CountryStep onPick={setCountry} />;
  if (persona) return <>{children}</>;

  const choose = (p: Persona) => {
    setPersona(p);
    // Power users start in the Advanced UI tier; everyone else stays basic.
    if (p === "advanced") setMode("advanced");
    router.replace(homeFor(p));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream px-6 py-12 [color-scheme:light]">
      <div className="w-full max-w-2xl">
        <div className="flex flex-col items-center text-center mb-9">
          <LogoMark size={44} className="rounded-2xl shadow-pop-sm mb-5" />
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-harbor">
            Welcome to {site.name}
          </h1>
          <p className="mt-2 text-sm text-slate font-medium max-w-md">
            How will you use Pesarc? You can change this later in settings.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Option
            icon={User}
            title="For myself"
            body="Send money home, pay bills and trade the markets. The simple, everyday experience."
            cta="Continue as personal"
            onClick={() => choose("retail")}
          />
          <Option
            icon={Building2}
            title="For my business"
            body="Collect payments, settle with suppliers, plus an API and tools built for SMEs and teams."
            cta="Continue as business"
            onClick={() => choose("business")}
          />
          <Option
            icon={PiggyBank}
            title="To earn on my money"
            body="Put your money to work and earn in your own currency. Lands you straight in Earn."
            cta="Continue as saver"
            onClick={() => choose("provider")}
          />
          <Option
            icon={Gauge}
            title="I'm an advanced user"
            body="Every control on: live quotes, on-chain proofs, corridors and the full toolset."
            cta="Continue as advanced"
            onClick={() => choose("advanced")}
          />
        </div>
      </div>
    </div>
  );
}

function Option({
  icon: Icon,
  title,
  body,
  cta,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  cta: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group text-left bg-snow border border-fog rounded-card p-6 shadow-card-flat hover:border-sky/60 hover:-translate-y-0.5 transition-all"
    >
      <span className="flex items-center justify-center w-11 h-11 rounded-2xl bg-sky-tint/60 text-sky mb-5">
        <Icon className="w-5 h-5" />
      </span>
      <h2 className="text-base font-extrabold text-harbor">{title}</h2>
      <p className="mt-1.5 text-sm text-slate font-medium leading-relaxed">{body}</p>
      <span className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-extrabold text-sky group-hover:gap-2.5 transition-all">
        {cta} <ArrowRight className="w-4 h-4" />
      </span>
    </button>
  );
}

function CountryStep({ onPick }: { onPick: (code: string) => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-cream px-6 py-12 [color-scheme:light]">
      <div className="w-full max-w-lg">
        <div className="flex flex-col items-center text-center mb-8">
          <LogoMark size={44} className="rounded-2xl shadow-pop-sm mb-5" />
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-harbor">
            Where are you?
          </h1>
          <p className="mt-2 text-sm text-slate font-medium max-w-sm">
            We&apos;ll set your default currency from this. You can change it any time in settings.
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {SUPPORTED_COUNTRIES.map((c) => (
            <button
              key={c.code}
              onClick={() => onPick(c.code)}
              className="flex items-center gap-2.5 bg-snow border border-fog rounded-2xl px-3.5 py-3 text-left shadow-card-flat hover:border-sky/60 hover:-translate-y-0.5 transition-all"
            >
              <span className="text-2xl">{c.flag}</span>
              <span className="min-w-0">
                <span className="block text-[13.5px] font-bold text-harbor truncate">{c.name}</span>
                <span className="block text-[11px] font-semibold text-slate">{c.currency}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
