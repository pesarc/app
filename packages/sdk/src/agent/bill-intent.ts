// Rule-based "pay a bill" intent parser for the agent. Understands plain
// language like "buy 1GB of MTN data for 08031234567", "top up 500 airtime on
// Airtel 08031234567", or "pay 5k Ikeja electricity meter 04123456789" without
// needing the LLM. Returns null when the message isn't a bill request.

import { dataPlansFor, findOperator, type BillCategory, type MeterType } from "../bills";

export type BillIntent = {
  category: BillCategory;
  operatorId?: string;
  amount?: number; // NGN (airtime / electricity)
  planId?: string; // data
  customer?: string; // phone / meter number
  meterType?: MeterType;
  /** Required fields still missing before it can be executed. */
  missing: Array<"operator" | "amount" | "customer">;
};

const RE = {
  electricity: /\b(electric\w*|power|light|nepa|phcn|disco|meter|prepaid|postpaid|units?|kwh)\b/i,
  data: /\b(data|bundle|\d+\s?(?:mb|gb))\b/i,
  airtime: /\b(airtime|recharge|top\s?-?up|topup|call\s?card|credit)\b/i,
};

function detectCategory(t: string): BillCategory | null {
  if (RE.electricity.test(t)) return "electricity";
  if (RE.data.test(t)) return "data";
  if (RE.airtime.test(t)) return "airtime";
  return null;
}

// phcn/nepa are generic words for electricity, not a specific DisCo — kept out.
const OPERATOR_ALIASES: Array<[RegExp, string]> = [
  [/\bmtn\b/i, "mtn-ng"],
  [/\bairtel\b/i, "airtel-ng"],
  [/\bglo\b/i, "glo-ng"],
  [/\b(9\s?mobile|etisalat)\b/i, "9mobile-ng"],
  [/\b(ikeja|ikedc)\b/i, "ikedc"],
  [/\b(eko|ekedc)\b/i, "ekedc"],
  [/\b(abuja|aedc)\b/i, "aedc"],
  [/\b(port\s?harcourt|phed)\b/i, "phed"],
  [/\b(ibadan|ibedc)\b/i, "ibedc"],
  [/\b(kano|kedco)\b/i, "kedco"],
];

function detectOperator(t: string): string | undefined {
  for (const [re, id] of OPERATOR_ALIASES) if (re.test(t)) return id;
  return undefined;
}

/** A phone (0.. / +234..) or meter number: the first run of >= 10 digits. */
function extractCustomer(t: string): { customer?: string; rest: string } {
  const m = t.match(/(\+?234\d{7,}|0\d{9,}|\d{10,})/);
  if (!m) return { rest: t };
  return { customer: m[1], rest: t.slice(0, m.index) + " " + t.slice(m.index! + m[0].length) };
}

/** Amount in NGN, honoring a "k" suffix (5k -> 5000) and commas/₦. */
function extractAmount(t: string): number | undefined {
  const m = t.match(/(?:₦|ngn\s*)?(\d[\d,]*(?:\.\d+)?)\s*(k)?\b/i);
  if (!m) return undefined;
  let n = parseFloat(m[1].replace(/,/g, ""));
  if (m[2]) n *= 1000;
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** Map a "1GB"/"500MB" mention to one of the operator's plan ids. */
function extractDataPlan(t: string, operatorId?: string): string | undefined {
  if (!operatorId) return undefined;
  const m = t.match(/(\d+(?:\.\d+)?)\s?(gb|mb)/i);
  if (!m) return undefined;
  const gb = m[2].toLowerCase() === "gb" ? parseFloat(m[1]) : parseFloat(m[1]) / 1000;
  const plans = dataPlansFor(operatorId);
  // Match the labelled size (500MB, 1GB, 2GB, 5GB, 10GB) closest to the ask.
  const sizes: Array<[number, string]> = plans.map((p) => {
    const s = p.label.match(/(\d+(?:\.\d+)?)\s?(gb|mb)/i);
    const val = s ? (s[2].toLowerCase() === "gb" ? parseFloat(s[1]) : parseFloat(s[1]) / 1000) : 0;
    return [val, p.id];
  });
  let best: [number, string] | undefined;
  for (const s of sizes) {
    if (!best || Math.abs(s[0] - gb) < Math.abs(best[0] - gb)) best = s;
  }
  return best?.[1];
}

export function parseBillIntent(message: string): BillIntent | null {
  const category = detectCategory(message);
  if (!category) return null;

  const operatorId = detectOperator(message);
  const { customer, rest } = extractCustomer(message);
  const meterType: MeterType | undefined =
    category === "electricity" ? (/\bpostpaid\b/i.test(message) ? "postpaid" : "prepaid") : undefined;

  let planId: string | undefined;
  let amount: number | undefined;
  if (category === "data") {
    planId = extractDataPlan(message, operatorId);
  } else {
    // Parse the amount from the text with the phone/meter number removed, so a
    // long phone number is never mistaken for the amount.
    amount = extractAmount(rest);
  }

  // Validate the operator actually belongs to this category's set.
  const op = operatorId ? findOperator(operatorId) : undefined;
  const opValid =
    op &&
    (category === "electricity" ? op.category === "electricity" : op.category === "telco");

  const missing: BillIntent["missing"] = [];
  if (!opValid) missing.push("operator");
  if (!customer) missing.push("customer");
  if (category === "data" ? !planId : !amount) missing.push("amount");

  return {
    category,
    operatorId: opValid ? operatorId : undefined,
    amount,
    planId,
    customer,
    meterType,
    missing,
  };
}
