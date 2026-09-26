// Server-to-server webhook delivery for the developer API.
//
// When a payment succeeds we POST the event to the merchant's webhook_url,
// signed with their whsec so they can trust it. Signature scheme (Stripe-style):
//   header  X-Pesarc-Signature: t=<unix>,v1=<hex>
//   v1 = HMAC_SHA256(whsec, `${t}.${rawBody}`)
// The customer redirect stays the primary signal; the webhook is the push
// convenience, and GET /api/v1/payments/:id is always the reliable source.

import { createHmac } from "node:crypto";

export type WebhookEvent = {
  type: string;
  created: number;
  data: unknown;
};

export type WebhookResult = {
  delivered: boolean;
  status?: number;
  attempts: number;
  error?: string;
};

/** Sign the raw body with the merchant's signing secret. */
export function signWebhook(signingSecret: string, rawBody: string, ts: number): string {
  return createHmac("sha256", signingSecret).update(`${ts}.${rawBody}`).digest("hex");
}

/**
 * Best-effort delivery with a few retries and short timeouts. Never throws — a
 * failed webhook must not fail the customer's payment. Any 2xx counts as
 * delivered; 4xx (except 429) is treated as terminal (no point retrying a bad
 * endpoint), 5xx/timeout retries with backoff.
 */
export async function deliverWebhook(
  url: string,
  signingSecret: string,
  event: WebhookEvent,
  opts: { attempts?: number; timeoutMs?: number } = {},
): Promise<WebhookResult> {
  const maxAttempts = opts.attempts ?? 3;
  const timeoutMs = opts.timeoutMs ?? 4000;
  const rawBody = JSON.stringify(event);
  let lastError: string | undefined;
  let lastStatus: number | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const ts = Math.floor(Date.now() / 1000);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Pesarc-Signature": `t=${ts},v1=${signWebhook(signingSecret, rawBody, ts)}`,
          "X-Pesarc-Event": event.type,
        },
        body: rawBody,
        signal: controller.signal,
      });
      lastStatus = res.status;
      if (res.ok) return { delivered: true, status: res.status, attempts: attempt };
      // 4xx other than 429 is a bad endpoint — do not keep hammering it.
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        return { delivered: false, status: res.status, attempts: attempt, error: `HTTP ${res.status}` };
      }
      lastError = `HTTP ${res.status}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : "request failed";
    } finally {
      clearTimeout(timer);
    }
    if (attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, 300 * attempt)); // linear backoff
    }
  }
  return { delivered: false, status: lastStatus, attempts: maxAttempts, error: lastError };
}
