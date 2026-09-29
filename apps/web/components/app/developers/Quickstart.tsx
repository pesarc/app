"use client";

import { useMemo } from "react";
import { Copy, Check } from "@/components/icons";

export function Quickstart({
  origin,
  copy,
  copied,
}: {
  origin: string;
  copy: (t: string, id: string) => void;
  copied: string | null;
}) {
  const curl = useMemo(
    () =>
      `curl ${origin}/api/v1/payments \\
  -H "Authorization: Bearer sk_live_…" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 5000,
    "currency": "NGN",
    "redirect_url": "https://your-site.com/return",
    "reference": "order_1234"
  }'`,
    [origin],
  );

  const verify = `import { createHmac } from "node:crypto";

// On your /return handler, verify the redirect signature:
function verify({ paymentId, reference, status, signature }, signingSecret) {
  const expected = createHmac("sha256", signingSecret)
    .update(\`\${paymentId}.\${reference}.\${status}\`)
    .digest("hex");
  return expected === signature; // status === "paid" => fulfil the order
}`;

  const webhook = `// Pass "webhook_url" when creating a payment to also get a server
// callback. We POST { type: "payment.succeeded", data } with a header
//   X-Pesarc-Signature: t=<unix>,v1=<hex>
function verifyWebhook(rawBody, header, signingSecret) {
  const [t, v1] = header.split(",").map((p) => p.split("=")[1]);
  const expected = createHmac("sha256", signingSecret)
    .update(\`\${t}.\${rawBody}\`)
    .digest("hex");
  return expected === v1;
}`;

  return (
    <section>
      <h2 className="text-lg font-semibold text-ink mb-3">Quickstart</h2>
      <ol className="space-y-2 mb-4 text-sm text-slate list-decimal list-inside">
        <li>Create a key above and store the secret on your server.</li>
        <li>
          Call <code className="text-ink font-mono text-xs">POST /api/v1/payments</code> to
          start a payment. You get a <code className="text-ink font-mono text-xs">checkout_url</code>.
        </li>
        <li>Redirect your customer to that URL. They pay inside Pesarc.</li>
        <li>
          We send them back to your <code className="text-ink font-mono text-xs">redirect_url</code>{" "}
          with <code className="text-ink font-mono text-xs">?paymentId&amp;reference&amp;status&amp;signature</code>.
        </li>
        <li>Verify the signature with your signing secret, then fulfil the order.</li>
      </ol>

      <CodeBlock title="Create a payment" code={curl} id="curl" copy={copy} copied={copied} />
      <CodeBlock title="Verify the redirect (Node)" code={verify} id="verify" copy={copy} copied={copied} />
      <CodeBlock title="Verify a webhook (Node)" code={webhook} id="webhook" copy={copy} copied={copied} />
    </section>
  );
}

function CodeBlock({
  title,
  code,
  id,
  copy,
  copied,
}: {
  title: string;
  code: string;
  id: string;
  copy: (t: string, id: string) => void;
  copied: string | null;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold text-slate uppercase tracking-widest">{title}</span>
        <button
          onClick={() => copy(code, id)}
          className="inline-flex items-center gap-1 text-xs font-medium text-slate hover:text-ink transition"
        >
          {copied === id ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
          Copy
        </button>
      </div>
      <pre className="rounded-card bg-harbor text-white/90 text-xs font-mono p-4 overflow-x-auto leading-relaxed">
        {code}
      </pre>
    </div>
  );
}
