"use client";

import { Copy, Check, ShieldCheck } from "@/components/icons";
import { Button, Card } from "@/components/app/ui";
import type { CreatedKey } from "./types";

export function RevealCard({
  created,
  onClose,
  copy,
  copied,
}: {
  created: CreatedKey;
  onClose: () => void;
  copy: (t: string, id: string) => void;
  copied: string | null;
}) {
  return (
    <Card className="p-5 mb-6 border border-sky/30 bg-sky-tint/30">
      <div className="flex items-start gap-2 mb-3">
        <ShieldCheck className="w-5 h-5 text-sky shrink-0 mt-0.5" />
        <div>
          <div className="font-semibold text-ink">Save your secret key now</div>
          <div className="text-sm text-slate">
            This is the only time we show it. Store it somewhere safe on your server.
          </div>
        </div>
      </div>
      <RevealRow label="Secret key" value={created.secret} id="sk" copy={copy} copied={copied} />
      <RevealRow label="Publishable id" value={created.publishable} id="pk" copy={copy} copied={copied} />
      <RevealRow label="Signing secret" value={created.signingSecret} id="wh" copy={copy} copied={copied} />
      <p className="text-xs text-slate mt-3">
        Use the <span className="font-semibold">signing secret</span> to verify the
        signature on redirects and webhooks.
      </p>
      <Button variant="secondary" className="mt-4" onClick={onClose}>
        <Check className="w-4 h-4" /> I have saved it
      </Button>
    </Card>
  );
}

function RevealRow({
  label,
  value,
  id,
  copy,
  copied,
}: {
  label: string;
  value: string;
  id: string;
  copy: (t: string, id: string) => void;
  copied: string | null;
}) {
  return (
    <div className="mb-2">
      <div className="text-[11px] font-semibold text-slate uppercase tracking-widest mb-1">
        {label}
      </div>
      <div className="flex items-center gap-2">
        <code className="flex-1 min-w-0 truncate rounded-lg bg-white border border-fog px-3 py-2 text-xs font-mono text-ink">
          {value}
        </code>
        <button
          onClick={() => copy(value, id)}
          className="shrink-0 p-2 rounded-lg border border-fog bg-white text-slate hover:text-ink transition"
          aria-label={`Copy ${label}`}
        >
          {copied === id ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
