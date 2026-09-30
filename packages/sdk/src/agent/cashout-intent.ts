// "Cash out ₦5,000 to my bank" / "withdraw 10000 to my bank account" — a
// money-moving action, so it drafts and waits for consent, then settles on Arc
// and pays out to the user's linked bank via the ramp partner (Paystack in prod).

export type CashoutIntent = { amountNgn: number };

export function parseCashoutIntent(message: string): CashoutIntent | null {
  const m = message.toLowerCase();
  const wantsCashout =
    /\b(cash\s?out|withdraw|pay\s?out)\b/.test(m) ||
    /\bto my bank( account)?\b/.test(m) ||
    /\bsend\b[^.]*\bto\b[^.]*\bbank\b/.test(m);
  if (!wantsCashout) return null;
  // Amount: ₦1,000 / "1000 naira" / a bare number.
  const cleaned = m.replace(/,/g, "");
  const num = cleaned.match(/(?:₦|ngn\s*)?(\d+(?:\.\d+)?)/);
  const amountNgn = num ? Number(num[1]) : 0;
  if (!amountNgn || amountNgn <= 0) return null;
  return { amountNgn };
}
