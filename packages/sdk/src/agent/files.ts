// Agent file ingestion. The agent can READ an uploaded file (CSV of recipients,
// a ZIP of them, or plain text) and DRAFT a bulk action from it. Parsing is
// DETERMINISTIC here on purpose: money rows must not depend on an LLM guessing.
// The draft is only ever a proposal — nothing is sent until the user confirms
// each row in the Send flow (read + draft only).
//
// Server-only (Node): ZIP is unzipped with fflate.

import { unzipSync, strFromU8 } from "fflate";

export type DraftMethod = "bank" | "mobile_money" | "unknown";

/** One normalised recipient row drafted from an uploaded file. */
export type DraftRow = {
  name?: string;
  /** Human handle for display (phone or masked account). */
  handle: string;
  method: DraftMethod;
  /** Phone number (mobile money) — digits only. */
  phone?: string;
  /** Bank account / NUBAN. */
  account?: string;
  /** Bank name or code, when given. */
  bank?: string;
  amount: number;
  currency: string;
  note?: string;
  /** Per-row problems (missing amount, unrecognised destination, etc.). */
  issues?: string[];
};

export type ParsedUpload = {
  ok: boolean;
  kind: "payouts" | "text" | "unsupported";
  filename: string;
  rows: DraftRow[];
  rowCount: number;
  /** Totals per currency, e.g. { NGN: 125000, GHS: 400 }. */
  totals: Record<string, number>;
  summary: string;
  warnings: string[];
  /** Raw text (kind: "text"), truncated. */
  text?: string;
};

const MAX_ROWS = 500;
const CCY_BY_SYMBOL: Record<string, string> = { "₦": "NGN", "₵": "GHS", KSh: "KES", $: "USD", "£": "GBP", "€": "EUR" };
const KNOWN_CCY = new Set(["NGN", "GHS", "KES", "USD", "GBP", "EUR", "UGX", "TZS", "ZAR"]);

/* ------------------------------- CSV parsing ------------------------------- */

/** Minimal RFC-4180-ish CSV splitter (handles quoted fields + commas). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); if (row.some((f) => f.trim() !== "")) rows.push(row); }
  return rows;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Map fuzzy header names to our fields. */
function indexHeaders(header: string[]) {
  const idx: Record<string, number> = {};
  header.forEach((h, i) => {
    const k = norm(h);
    if (idx.name === undefined && /(name|beneficiary|recipient|payee|fullname)/.test(k)) idx.name = i;
    if (idx.phone === undefined && /(phone|msisdn|mobile|number|tel|momo)/.test(k) && !/account/.test(k)) idx.phone = i;
    if (idx.account === undefined && /(account|nuban|acct|iban)/.test(k)) idx.account = i;
    if (idx.bank === undefined && /(bank|institution|provider|network|bankcode)/.test(k)) idx.bank = i;
    if (idx.amount === undefined && /(amount|value|total|sum|pay|naira|cedis|shillings)/.test(k)) idx.amount = i;
    if (idx.currency === undefined && /(currency|ccy|curr)/.test(k)) idx.currency = i;
    if (idx.note === undefined && /(note|memo|reason|desc|narration)/.test(k)) idx.note = i;
  });
  return idx;
}

function parseAmount(raw: string): { amount: number; currency?: string } {
  if (!raw) return { amount: 0 };
  let currency: string | undefined;
  for (const [sym, code] of Object.entries(CCY_BY_SYMBOL)) if (raw.includes(sym)) currency = code;
  const codeMatch = raw.toUpperCase().match(/\b(NGN|GHS|KES|USD|GBP|EUR|UGX|TZS|ZAR)\b/);
  if (codeMatch) currency = codeMatch[1];
  const n = Number(raw.replace(/[^0-9.]/g, ""));
  return { amount: Number.isFinite(n) ? n : 0, currency };
}

const digits = (s: string) => (s || "").replace(/[^\d]/g, "");

function rowsFromCsv(text: string, warnings: string[]): DraftRow[] {
  const grid = parseCsv(text);
  if (grid.length < 2) {
    warnings.push("The file didn't have a header row and at least one data row.");
    return [];
  }
  const idx = indexHeaders(grid[0]);
  if (idx.amount === undefined) warnings.push("No amount column was found; amounts default to 0 for you to fill in.");
  if (idx.phone === undefined && idx.account === undefined)
    warnings.push("No phone or account column was found; destinations may be incomplete.");

  const body = grid.slice(1, 1 + MAX_ROWS);
  if (grid.length - 1 > MAX_ROWS) warnings.push(`Only the first ${MAX_ROWS} rows were read.`);

  return body.map((cells) => {
    const get = (i?: number) => (i === undefined ? "" : (cells[i] ?? "").trim());
    const phone = digits(get(idx.phone));
    const account = digits(get(idx.account));
    const bank = get(idx.bank);
    const { amount, currency: amtCcy } = parseAmount(get(idx.amount));
    const rowCcyRaw = get(idx.currency).toUpperCase();
    const currency = (KNOWN_CCY.has(rowCcyRaw) && rowCcyRaw) || amtCcy || "NGN";
    const name = get(idx.name) || undefined;

    const issues: string[] = [];
    let method: DraftMethod = "unknown";
    let handle = "";
    if (phone && phone.length >= 7 && !account) { method = "mobile_money"; handle = phone; }
    else if (account) { method = "bank"; handle = `${bank ? bank + " " : ""}••••${account.slice(-4)}`; }
    else { handle = name || "Unknown recipient"; issues.push("No phone or account for this recipient."); }
    if (!amount) issues.push("Amount is missing or zero.");

    return { name, handle, method, phone: phone || undefined, account: account || undefined, bank: bank || undefined, amount, currency, note: get(idx.note) || undefined, issues: issues.length ? issues : undefined };
  });
}

/* ------------------------------- entrypoint ------------------------------- */

function totalsOf(rows: DraftRow[]): Record<string, number> {
  const t: Record<string, number> = {};
  for (const r of rows) t[r.currency] = (t[r.currency] ?? 0) + r.amount;
  return t;
}

function summarise(rows: DraftRow[], totals: Record<string, number>): string {
  if (!rows.length) return "I couldn't find any recipients to pay in that file.";
  const totalStr = Object.entries(totals).map(([c, v]) => `${c} ${Math.round(v).toLocaleString()}`).join(" + ");
  const flagged = rows.filter((r) => r.issues?.length).length;
  const tail = flagged ? ` ${flagged} need a closer look before you confirm.` : "";
  return `I read ${rows.length} recipient${rows.length === 1 ? "" : "s"} totalling ${totalStr}. Nothing is sent yet, review each row and confirm the ones you want to pay.${tail}`;
}

const ext = (name: string) => (name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "");

/** Parse an uploaded file into a draft. Deterministic; never executes anything. */
export function parseUploadFile(filename: string, bytes: Uint8Array): ParsedUpload {
  const warnings: string[] = [];
  const e = ext(filename);
  const base: Omit<ParsedUpload, "rows" | "rowCount" | "totals" | "summary" | "kind" | "ok"> = { filename, warnings };

  try {
    if (e === "zip") {
      const files = unzipSync(bytes);
      const csvNames = Object.keys(files).filter((n) => n.toLowerCase().endsWith(".csv") && !n.startsWith("__MACOSX"));
      if (!csvNames.length) {
        return { ...base, ok: false, kind: "unsupported", rows: [], rowCount: 0, totals: {}, summary: "That ZIP didn't contain a CSV of recipients. Zip up a .csv and try again." };
      }
      let rows: DraftRow[] = [];
      for (const n of csvNames) {
        rows = rows.concat(rowsFromCsv(strFromU8(files[n]), warnings));
        if (rows.length >= MAX_ROWS) break;
      }
      if (csvNames.length > 1) warnings.push(`Merged ${csvNames.length} CSV files from the ZIP.`);
      const totals = totalsOf(rows);
      return { ...base, ok: rows.length > 0, kind: "payouts", rows, rowCount: rows.length, totals, summary: summarise(rows, totals) };
    }

    if (e === "csv" || e === "tsv") {
      const rows = rowsFromCsv(strFromU8(bytes), warnings);
      const totals = totalsOf(rows);
      return { ...base, ok: rows.length > 0, kind: "payouts", rows, rowCount: rows.length, totals, summary: summarise(rows, totals) };
    }

    if (e === "txt" || e === "md") {
      const text = strFromU8(bytes).slice(0, 4000);
      return { ...base, ok: true, kind: "text", rows: [], rowCount: 0, totals: {}, summary: "I read the text. Tell me what you'd like me to do with it.", text };
    }

    return { ...base, ok: false, kind: "unsupported", rows: [], rowCount: 0, totals: {}, summary: `I can read CSV and ZIP files (and plain text) for now. I can't read “.${e}” yet, export it as CSV and I'll draft the payouts.` };
  } catch {
    return { ...base, ok: false, kind: "unsupported", rows: [], rowCount: 0, totals: {}, summary: "I couldn't read that file, it may be corrupt or an unexpected format. A CSV works best." };
  }
}
