// Rule-based "create a market" intent parser for the settlement agent. Lets a
// user create a prediction market in plain language — "create a market: will
// the naira cross ₦2,000 by June?" or "new market: 2027 winner? options: A, B,
// C" — without needing the LLM. Returns null when the message isn't a
// create-market request.

export type ParsedMarket = {
  question: string;
  type: "binary" | "multi";
  outcomes?: string[];
  kind: "fx" | "macro" | "sports" | "politics";
  collateral: "cNGN" | "cKES" | "cGHS";
  closes?: string;
  resolves?: string;
};

const INTENT =
  /\b(create|make|new|propose|open|start|add|list)\b[^.]*?\bmarket\b/i;

/** Split a loose "A, B or C" / "A / B / C" list into trimmed outcome labels. */
function splitOutcomes(raw: string): string[] {
  return raw
    .split(/\s*(?:,|\/|\bor\b|\bvs\.?\b|;)\s*/i)
    .map((s) => s.replace(/[.?!]+$/, "").trim())
    .filter((s) => s.length > 0 && s.length <= 40);
}

function inferKind(text: string): ParsedMarket["kind"] {
  if (/\b(election|president|vote|poll|governor|senate|party)\b/i.test(text)) return "politics";
  if (/\b(win|match|cup|final|afcon|league|score|game|championship)\b/i.test(text)) return "sports";
  if (/\b(usd|ngn|naira|cedi|shilling|fx|exchange rate|dollar|forex|rate)\b/i.test(text)) return "fx";
  return "macro";
}

function inferCollateral(text: string): ParsedMarket["collateral"] {
  if (/\b(cedi|ghs|ghana)\b/i.test(text)) return "cGHS";
  if (/\b(shilling|kes|kenya)\b/i.test(text)) return "cKES";
  return "cNGN";
}

/** Pull a "by/on <date>" phrase for the resolve date, if present. */
function extractDate(text: string): string | undefined {
  const m = text.match(
    /\b(?:by|on|before|in)\s+((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{0,4}|q[1-4]\s*\d{0,4}|\d{4})/i,
  );
  return m ? m[1].replace(/\s+/g, " ").trim() : undefined;
}

export function parseCreateMarket(message: string): ParsedMarket | null {
  if (!INTENT.test(message)) return null;

  // Everything after the first ":" is the market spec, else drop the intent
  // clause up to "market".
  let rest = message;
  const colon = message.indexOf(":");
  if (colon >= 0) {
    rest = message.slice(colon + 1);
  } else {
    rest = message.replace(/^.*?\bmarket\b\s*(?:on|for|about|:|-)?\s*/i, "");
  }
  rest = rest.trim();
  if (rest.length < 6) return null;

  // Outcomes: an explicit "options:/choices:/outcomes:" list, or an inline
  // "between A, B or C".
  let question = rest;
  let outcomes: string[] | undefined;
  const optMatch = rest.match(/\b(?:options?|choices?|outcomes?)\s*[:\-]\s*(.+)$/i);
  const betweenMatch = rest.match(/\bbetween\s+(.+)$/i);
  if (optMatch) {
    question = rest.slice(0, optMatch.index).replace(/[,;:\-\s]+$/, "").trim();
    outcomes = splitOutcomes(optMatch[1]);
  } else if (betweenMatch && splitOutcomes(betweenMatch[1]).length >= 2) {
    question = rest.slice(0, betweenMatch.index).replace(/[,;:\-\s]+$/, "").trim();
    outcomes = splitOutcomes(betweenMatch[1]);
  }

  if (!question) question = rest;
  const isMulti = Boolean(outcomes && outcomes.length >= 2);

  return {
    question: question.slice(0, 160),
    type: isMulti ? "multi" : "binary",
    outcomes: isMulti ? outcomes!.slice(0, 8) : undefined,
    kind: inferKind(message),
    collateral: inferCollateral(message),
    resolves: extractDate(message),
  };
}
