import { rateLimit } from "@pesarc/sdk/api/guard";
import { handleUssd } from "@pesarc/sdk/ussd";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * USSD gateway webhook (Africa's Talking shape). The gateway POSTs
 * x-www-form-urlencoded fields: sessionId, serviceCode, phoneNumber, text.
 * We reply with plain text: "CON …" to prompt for more, "END …" to finish.
 * Point the AT (or telco) shortcode's callback at <origin>/api/ussd.
 */
export async function POST(request: Request) {
  const limited = rateLimit(request, "ussd", 120, 60_000);
  if (limited) {
    return new Response("END Too many requests. Please try again shortly.", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(await request.text());
  } catch {
    return ussd("END Bad request.");
  }

  const phoneNumber = params.get("phoneNumber") ?? "";
  const text = (params.get("text") ?? "").trim();
  if (!phoneNumber) return ussd("END Missing caller.");

  try {
    const res = await handleUssd({ text, phoneNumber, account: `ussd:${phoneNumber}` });
    return ussd(`${res.type} ${res.message}`);
  } catch {
    return ussd("END Sorry, something went wrong. Please dial again.");
  }
}

function ussd(body: string): Response {
  return new Response(body, { status: 200, headers: { "Content-Type": "text/plain" } });
}
