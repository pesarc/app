import { NextResponse } from "next/server";
import {
  whatsappVerifyToken,
  verifyWhatsAppSignature,
  parseIncoming,
  sendWhatsAppText,
  fetchWhatsAppMedia,
} from "@pesarc/sdk/whatsapp";
import { transcribeConfigured, transcribeAudio } from "@pesarc/sdk/transcribe";
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

  // Resolve the user's words: text directly, or a transcribed voice note.
  let words = msg.text?.trim() ?? "";
  if (!words && msg.type === "audio" && msg.audioId) {
    if (!transcribeConfigured()) {
      await sendWhatsAppText(
        msg.from,
        "I can't hear voice notes just yet — type what you'd like to do, like “buy 1GB of MTN data for 08031234567”.",
      );
      return NextResponse.json({ ok: true });
    }
    const media = await fetchWhatsAppMedia(msg.audioId);
    const transcript = media ? await transcribeAudio(media.bytes, media.mimeType) : null;
    if (!transcript) {
      await sendWhatsAppText(
        msg.from,
        "Sorry, I couldn't make out that voice note. Please try again or type your request.",
      );
      return NextResponse.json({ ok: true });
    }
    words = transcript;
  }

  if (!words) {
    await sendWhatsAppText(
      msg.from,
      "Send me a message like “send 50,000 naira to Ghana” or “pay 5k Ikeja electricity, meter 04123456789”.",
    );
    return NextResponse.json({ ok: true });
  }

  try {
    const result = await runAgentTurn(words, `whatsapp:${msg.from}`);
    // Echo what a voice note was heard as, so the sender can confirm.
    const prefix = msg.type === "audio" ? `“${words}”\n\n` : "";
    await sendWhatsAppText(msg.from, prefix + result.reply);
  } catch {
    await sendWhatsAppText(
      msg.from,
      "Sorry, something went wrong on my end. Please try again in a moment.",
    );
  }
  return NextResponse.json({ ok: true });
}
