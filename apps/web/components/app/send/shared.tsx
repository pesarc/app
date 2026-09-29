import type { ReactNode } from "react";
import { ArrowLeft } from "@/components/icons";
import type { Step } from "./types";

/* ---------------- Progress dots ---------------- */

export function Progress({ step }: { step: Step }) {
  const order: Step[] = ["recipient", "amount", "confirm"];
  const idx =
    step === "settling" || step === "success" ? 3 : order.indexOf(step);
  return (
    <div className="flex items-center gap-2 mb-8" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i <= idx ? "bg-sky w-8" : "bg-black/10 w-4"
          }`}
        />
      ))}
    </div>
  );
}

export function StepNav({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <button
        onClick={onBack}
        aria-label="Back"
        className="w-9 h-9 rounded-full bg-snow border border-fog flex items-center justify-center text-ink hover:border-black/20 transition shadow-card-flat"
      >
        <ArrowLeft className="w-4 h-4" />
      </button>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">
        {title}
      </h1>
    </div>
  );
}

export function Row({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-3 text-[15px]">
      <span className="text-slate">{label}</span>
      <span className="font-medium text-ink">{children}</span>
    </div>
  );
}
