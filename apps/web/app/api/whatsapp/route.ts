import { NextResponse } from "next/server";
import {
  whatsappVerifyToken,
  verifyWhatsAppSignature,
  parseIncoming,
  sendWhatsAppText,
} from "@pesarc/sdk/whatsapp";
import { runAgentTurn } from "@pesarc/sdk/agent/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Meta webhook verification handshake. Configure this URL in the WhatsApp app
 * with the same verify token; Meta calls GET with hub.challenge to confirm.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge") ?? "";
  const expected = whatsappVerifyToken();

  if (mode === "subscribe" && expected && token === expected) {
    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new Response("Forbidden", { status: 403 });
}

// Dedupe message ids across Meta's retries (best-effort, per instance).
const seen = new Set<string>();
function firstTime(id: string): boolean {
  if (seen.has(id)) return false;
  seen.add(id);
  if (seen.size > 2000) seen.clear();
  return true;
}

/**
 * Incoming WhatsApp messages. Verify the signature, bridge the text to the same
 * agent brain as the in-app chat, and reply over the Cloud API. Always 200s so
 * Meta doesn't retry (a bad signature is the one exception).
 */
export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifyWhatsAppSignature(raw, request.headers.get("x-hub-signature-256"))) {
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true }); // ack malformed; nothing to do
  }

  const msg = parseIncoming(payload);
  // Status callbacks / non-messages: acknowledge and stop.
  if (!msg || !firstTime(msg.id)) return NextResponse.json({ ok: true });

  // Only text is bridged for now; voice notes need transcription (next).
  if (msg.type !== "text" || !msg.text) {
    await sendWhatsAppText(
      msg.from,
      "I can read text messages for now — type what you'd like to do, like “buy 1GB of MTN data for 08031234567”. Voice notes are coming soon.",
    );
    return NextResponse.json({ ok: true });
  }

  try {
    const result = await runAgentTurn(msg.text, `whatsapp:${msg.from}`);
    await sendWhatsAppText(msg.from, result.reply);
  } catch {
    await sendWhatsAppText(
      msg.from,
      "Sorry, something went wrong on my end. Please try again in a moment.",
    );
  }
  return NextResponse.json({ ok: true });
}
