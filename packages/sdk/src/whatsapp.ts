// WhatsApp Cloud API adapter (Meta). Env-gated so the bridge runs in a "sandbox"
// (log instead of send) until a real WhatsApp Business number is connected.
//
// Env:
//   WHATSAPP_TOKEN            Cloud API access token (Bearer)
//   WHATSAPP_PHONE_NUMBER_ID  the sending phone-number id
//   WHATSAPP_VERIFY_TOKEN     the token you set in the Meta webhook config
//   WHATSAPP_APP_SECRET       app secret, to verify X-Hub-Signature-256
//   WHATSAPP_GRAPH_VERSION    graph version (default v21.0)

import { createHmac, timingSafeEqual } from "node:crypto";

const GRAPH = "https://graph.facebook.com";

export function whatsappConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

/** The token Meta echoes back during the GET webhook handshake. */
export function whatsappVerifyToken(): string | undefined {
  return process.env.WHATSAPP_VERIFY_TOKEN || undefined;
}

/**
 * Verify the X-Hub-Signature-256 header against the raw body with the app
 * secret. When no secret is configured (sandbox), returns true so local testing
 * works — production MUST set WHATSAPP_APP_SECRET.
 */
export function verifyWhatsAppSignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return true; // sandbox: no verification configured
  if (!header) return false;
  const expected = "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(header);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type IncomingMessage = {
  from: string; // sender wa id / phone (E.164 without +)
  id: string;
  type: string; // text | audio | image | ...
  text?: string;
  audioId?: string; // media id for audio/voice notes
  name?: string; // contact profile name, when present
};

/**
 * Pull the first user message out of a Cloud API webhook payload. Returns null
 * for delivery-status callbacks (no user message) or anything unparseable.
 */
export function parseIncoming(payload: any): IncomingMessage | null {
  try {
    const value = payload?.entry?.[0]?.changes?.[0]?.value;
    const msg = value?.messages?.[0];
    if (!msg) return null; // status update or empty
    const name = value?.contacts?.[0]?.profile?.name as string | undefined;
    return {
      from: String(msg.from),
      id: String(msg.id),
      type: String(msg.type),
      text: msg.type === "text" ? String(msg.text?.body ?? "") : undefined,
      audioId:
        msg.type === "audio" || msg.type === "voice"
          ? String(msg.audio?.id ?? msg.voice?.id ?? "")
          : undefined,
      name,
    };
  } catch {
    return null;
  }
}

/**
 * Download a media object (e.g. a voice note) by its id: resolve the temporary
 * URL from the Graph API, then fetch the bytes with the token. Null on failure
 * or when unconfigured.
 */
export async function fetchWhatsAppMedia(
  mediaId: string,
): Promise<{ bytes: Uint8Array; mimeType: string } | null> {
  const token = process.env.WHATSAPP_TOKEN;
  const version = process.env.WHATSAPP_GRAPH_VERSION || "v21.0";
  if (!token || !mediaId) return null;
  try {
    const metaRes = await fetch(`${GRAPH}/${version}/${mediaId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!metaRes.ok) return null;
    const meta = (await metaRes.json()) as { url?: string; mime_type?: string };
    if (!meta.url) return null;
    const binRes = await fetch(meta.url, { headers: { Authorization: `Bearer ${token}` } });
    if (!binRes.ok) return null;
    const buf = new Uint8Array(await binRes.arrayBuffer());
    return { bytes: buf, mimeType: meta.mime_type || "audio/ogg" };
  } catch {
    return null;
  }
}

export type SendResult = { sent: boolean; sandbox?: boolean; status?: number; error?: string };

/** Send a plain-text WhatsApp reply. In sandbox mode it logs and returns. */
export async function sendWhatsAppText(to: string, body: string): Promise<SendResult> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const version = process.env.WHATSAPP_GRAPH_VERSION || "v21.0";
  if (!token || !phoneId) {
    // Sandbox: no number connected yet — surface what we WOULD send.
    console.log(`[whatsapp sandbox] -> ${to}: ${body}`);
    return { sent: false, sandbox: true };
  }
  try {
    const res = await fetch(`${GRAPH}/${version}/${phoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { preview_url: false, body: body.slice(0, 4096) },
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { sent: false, status: res.status, error: text.slice(0, 200) };
    }
    return { sent: true, status: res.status };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : "send failed" };
  }
}
