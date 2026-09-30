// "Cash out ₦5,000 to my bank" / "withdraw 10000 to my bank account" / "send
// 1,000 naira to my Paystack" — a money-moving action, so it drafts and waits
// for consent, then settles on Arc and pays out to the user's linked bank via
// the ramp partner (Paystack in prod).

export type CashoutIntent = { amountNgn: number };

export function parseCashoutIntent(message: string): CashoutIntent | null {
  const m = message.toLowerCase();
  const dest = /\b(bank|account|paystack|mobile\s?money|momo)\b/;
  const wantsCashout =
    /\b(cash\s?out|withdraw|pay\s?out|paystack)\b/.test(m) ||
    new RegExp(`\\bto my ${dest.source}`).test(m) ||
    (/\bsend\b[^.]*\bto\b[^.]*/.test(m) && dest.test(m));
  if (!wantsCashout) return null;
  // Amount: ₦1,000 / "1000 naira" / a bare number.
  const cleaned = m.replace(/,/g, "");
  const num = cleaned.match(/(?:₦|ngn\s*)?(\d+(?:\.\d+)?)/);
  const amountNgn = num ? Number(num[1]) : 0;
  if (!amountNgn || amountNgn <= 0) return null;
  return { amountNgn };
}
