// Termii OTP adapter (Path A phone login). Termii generates, stores and
// verifies the one-time PIN for us (the Token API), so we hold no codes — we
// just relay a `pinId` between send and verify. Strong NG/GH/KE deliverability;
// `channel` picks SMS ("dnd"/"generic") or "whatsapp".
//
// Env:
//   TERMII_API_KEY     (required) — server-only secret.
//   TERMII_SENDER_ID   sender/from (default "Pesarc"; must be an approved
//                      sender for the generic route, or use "dnd").
//   TERMII_CHANNEL     "dnd" | "generic" | "whatsapp" (default "dnd").
//   TERMII_BASE_URL    default "https://api.ng.termii.com".

const BASE = process.env.TERMII_BASE_URL || "https://api.ng.termii.com";
const API_KEY = process.env.TERMII_API_KEY || "";
const SENDER = process.env.TERMII_SENDER_ID || "Pesarc";
const CHANNEL = (process.env.TERMII_CHANNEL || "dnd") as "dnd" | "generic" | "whatsapp";

export const isTermiiConfigured = Boolean(API_KEY);

export type SendResult = { ok: true; pinId: string } | { ok: false; error: string };
export type VerifyResult =
  | { ok: true; msisdn: string }
  | { ok: false; error: string; expired?: boolean };

/** E.164-ish: digits only, no leading +, no spaces. Termii wants "2348012345678". */
export function normalizeMsisdn(raw: string): string {
  return raw.replace(/[^\d]/g, "");
}

/** Send an OTP. Returns a `pinId` the client passes back to verify. */
export async function sendOtp(phone: string): Promise<SendResult> {
  if (!API_KEY) return { ok: false, error: "OTP not configured." };
  const to = normalizeMsisdn(phone);
  if (to.length < 7) return { ok: false, error: "Enter a valid phone number." };

  try {
    const res = await fetch(`${BASE}/api/sms/otp/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: API_KEY,
        message_type: "NUMERIC",
        to,
        from: SENDER,
        channel: CHANNEL,
        pin_attempts: 3,
        pin_time_to_live: 5, // minutes
        pin_length: 6,
        pin_placeholder: "< 123456 >",
        message_text: "Your Pesarc code is < 123456 >. It expires in 5 minutes.",
        pin_type: "NUMERIC",
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { pinId?: string; message?: string };
    if (!res.ok || !data.pinId) {
      return { ok: false, error: data.message || "Could not send the code. Try again." };
    }
    return { ok: true, pinId: data.pinId };
  } catch {
    return { ok: false, error: "Network error sending the code." };
  }
}

/** Verify the code the user entered against the `pinId` from send. */
export async function verifyOtp(pinId: string, pin: string): Promise<VerifyResult> {
  if (!API_KEY) return { ok: false, error: "OTP not configured." };
  const code = pin.replace(/[^\d]/g, "");
  if (!pinId || code.length < 4) return { ok: false, error: "Enter the code we sent." };

  try {
    const res = await fetch(`${BASE}/api/sms/otp/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: API_KEY, pin_id: pinId, pin: code }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      verified?: boolean | string;
      msisdn?: string;
      message?: string;
    };
    // Termii returns verified:true, or verified:"Expired"/false, or an error.
    if (data.verified === true && data.msisdn) {
      return { ok: true, msisdn: normalizeMsisdn(data.msisdn) };
    }
    if (data.verified === "Expired") {
      return { ok: false, error: "That code expired. Request a new one.", expired: true };
    }
    return { ok: false, error: data.message || "That code isn't right. Try again." };
  } catch {
    return { ok: false, error: "Network error verifying the code." };
  }
}
