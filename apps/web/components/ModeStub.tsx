import { type LucideIcon } from "lucide-react";
import { Card } from "@/components/app/ui";

type Props = {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  /** Functional requirements from the PRD, shown as the build checklist. */
  requirements: { id: string; text: string }[];
};

export default function ModeStub({
  icon: Icon,
  eyebrow,
  title,
  description,
  requirements,
}: Props) {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 md:py-16">
      <div className="flex items-center gap-3 mb-5">
        <span className="w-11 h-11 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald">
          <Icon className="w-5 h-5" strokeWidth={1.75} />
        </span>
        <span className="text-xs font-semibold text-emerald uppercase tracking-[0.18em]">
          {eyebrow}
        </span>
      </div>

      <h1 className="text-4xl md:text-5xl tracking-tight font-semibold text-deepink mb-4 text-balance">
        {title}
      </h1>
      <p className="text-base md:text-lg text-muted leading-relaxed max-w-2xl mb-10">
        {description}
      </p>

      <div className="inline-flex items-center gap-2 px-3 py-1 bg-gold/15 rounded-full mb-5">
        <span className="w-1.5 h-1.5 rounded-full bg-gold animate-progress-pulse" />
        <span className="text-[11px] font-semibold text-deepink/70 uppercase tracking-widest">
          Coming soon · build queue
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {requirements.map((req) => (
          <Card key={req.id} className="flex items-start gap-3 p-4">
            <span className="font-mono text-[11px] text-emerald font-semibold mt-0.5 shrink-0">
              {req.id}
            </span>
            <span className="text-sm text-deepink/80 leading-relaxed">
              {req.text}
            </span>
          </Card>
        ))}
      </div>
    </div>
  );
}
