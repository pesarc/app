"use client";

import { ShieldCheck, Bot, Sparkles } from "@/components/icons";
import { Card } from "@/components/app/ui";

/* What makes the agent safe to trust, in plain words. */
export function AgentCapabilities() {
  const items = [
    { icon: ShieldCheck, title: "A daily limit you set", body: "The agent can never spend more than the limit you give it each day." },
    { icon: Bot, title: "Every action is logged", body: "Nothing happens anonymously. You can see and check everything it does." },
    { icon: Sparkles, title: "You only pay per task", body: "No standing access and no surprises. It only acts when you ask." },
  ];
  return (
    <Card className="p-4">
      <div className="text-[11px] font-bold uppercase tracking-widest text-slate mb-3">
        Safe by design
      </div>
      <div className="space-y-3.5">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <div key={it.title} className="flex gap-3">
              <span className="w-8 h-8 shrink-0 rounded-full bg-sky-tint/60 flex items-center justify-center text-sky-deep">
                <Icon className="w-4 h-4" />
              </span>
              <div>
                <div className="text-[13.5px] font-bold text-harbor leading-tight">{it.title}</div>
                <div className="text-[12.5px] text-slate leading-snug mt-0.5">{it.body}</div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
