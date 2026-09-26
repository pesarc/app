"use client";

// Shown once, after login, before the app: pick retail or business. The choice
// routes you to the right surface and decides whether the business experience is
// ever shown. Retail is the default path (the Mum Test audience).
import { useRouter } from "next/navigation";
import { User, Building2, ArrowRight } from "lucide-react";
import { usePersona, type Persona } from "@pesarc/sdk/persona";
import { LogoMark } from "@/components/app/Logo";
import { site } from "@pesarc/sdk/site";

export default function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { persona, ready, setPersona } = usePersona();
  const router = useRouter();

  // Wait for the saved choice to load so the picker never flashes for returning
  // users.
  if (!ready) return null;
  if (persona) return <>{children}</>;

  const choose = (p: Persona) => {
    setPersona(p);
    router.replace(p === "business" ? "/business" : "/home");
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
            body="Send money home, pay bills, earn and hold. The simple, everyday experience."
            cta="Continue as personal"
            onClick={() => choose("retail")}
          />
          <Option
            icon={Building2}
            title="For my business"
            body="Collect payments, settle with suppliers, an API and tools built for SMEs and teams."
            cta="Continue as business"
            onClick={() => choose("business")}
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
