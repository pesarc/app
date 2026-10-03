// Bank directory + account-name resolution for the withdraw/payout step.
//
// Follows the SAME partner that will move the money: the off-ramp partner picked
// for this market (see ramp.ts) is asked for its own bank list / resolver first,
// so the picker only ever shows banks that partner can actually pay into. Falls
// back to Paystack (GET /bank, GET /bank/resolve) when configured, then to a
// curated Nigerian list + demo resolver so the flow works with no partner at all.

import { offRampAdapter } from "./ramp";

export type Bank = { name: string; code: string };

// Curated top Nigerian banks + fintechs with their CBN/Paystack codes. Used as
// the demo list and as a fallback if the Paystack call fails.
const NG_BANKS: Bank[] = [
  { name: "Access Bank", code: "044" },
  { name: "Guaranty Trust Bank (GTBank)", code: "058" },
  { name: "Zenith Bank", code: "057" },
  { name: "First Bank of Nigeria", code: "011" },
  { name: "United Bank for Africa (UBA)", code: "033" },
  { name: "Kuda Bank", code: "50211" },
  { name: "OPay", code: "999992" },
  { name: "PalmPay", code: "999991" },
  { name: "Moniepoint MFB", code: "50515" },
  { name: "Wema Bank (ALAT)", code: "035" },
  { name: "Stanbic IBTC Bank", code: "221" },
  { name: "Fidelity Bank", code: "070" },
  { name: "First City Monument Bank (FCMB)", code: "214" },
  { name: "Sterling Bank", code: "232" },
  { name: "Union Bank of Nigeria", code: "032" },
  { name: "Ecobank Nigeria", code: "050" },
  { name: "Polaris Bank", code: "076" },
  { name: "Keystone Bank", code: "082" },
];

function paystackKey(): string | undefined {
  const key = process.env.PAYSTACK_SECRET_KEY;
  return key && process.env.RAMP_PROVIDER !== "http" ? key : undefined;
}

/** Dedupe by name + sort A–Z (partners return several entries per bank). */
function tidy(rows: { name: string; code: string }[]): Bank[] {
  const seen = new Set<string>();
  return rows
    .filter((b) => b.name && b.code)
    .map((b) => ({ name: String(b.name).trim(), code: String(b.code) }))
    .filter((b) => {
      const k = b.name.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function listBanks(currency = "NGN", country?: string): Promise<Bank[]> {
  // Ask the market's off-ramp partner for its own directory first.
  try {
    const partner = await offRampAdapter(currency, country);
    if (partner.listBanks) {
      const list = await partner.listBanks(currency);
      if (list && list.length) return tidy(list);
    }
  } catch {
    /* fall through to Paystack / curated */
  }

  const key = paystackKey();
  if (!key || currency.toUpperCase() !== "NGN") return NG_BANKS;
  try {
    // Paginate — Nigeria has 200+ banks and the provider caps a page at 100, so a
    // single page silently truncates the list (your bank wouldn't be searchable).
    const raw: { name: string; code: string }[] = [];
    for (let page = 1; page <= 6; page++) {
      const res = await fetch(
        `https://api.paystack.co/bank?currency=${encodeURIComponent(currency)}&perPage=100&page=${page}`,
        { headers: { authorization: `Bearer ${key}` }, cache: "no-store" },
      );
      if (!res.ok) break;
      const data = (await res.json()) as {
        data?: { name: string; code: string }[];
        meta?: { next?: number | null };
      };
      const batch = data.data ?? [];
      raw.push(...batch);
      if (!data.meta?.next || batch.length < 100) break;
    }
    const banks = tidy(raw);
    return banks.length ? banks : NG_BANKS;
  } catch {
    return NG_BANKS;
  }
}

export type ResolveResult = {
  resolved: boolean;
  accountName?: string;
  error?: string;
};

export async function resolveAccount(
  accountNumber: string,
  bankCode: string,
  currency = "NGN",
  country?: string,
): Promise<ResolveResult> {
  // Resolve against the market's partner first, so the verified name comes from
  // the same place that will receive the payout.
  try {
    const partner = await offRampAdapter(currency, country);
    if (partner.resolveAccount) {
      const r = await partner.resolveAccount(accountNumber, bankCode);
      // A clean verified/declined answer is authoritative; a transient reach
      // error falls through to Paystack/demo rather than blocking the user.
      if (r.resolved || (r.error && !/reach the bank/i.test(r.error))) return r;
    }
  } catch {
    /* fall through to Paystack / demo */
  }

  const key = paystackKey();
  // Demo mode: we can't verify the name, but the flow should still proceed.
  if (!key) return { resolved: false };
  try {
    const res = await fetch(
      `https://api.paystack.co/bank/resolve?account_number=${encodeURIComponent(
        accountNumber,
      )}&bank_code=${encodeURIComponent(bankCode)}`,
      { headers: { authorization: `Bearer ${key}` }, cache: "no-store" },
    );
    const data = (await res.json()) as {
      status?: boolean;
      message?: string;
      data?: { account_name?: string };
    };
    if (!res.ok || !data.status || !data.data?.account_name) {
      return { resolved: false, error: data.message || "Couldn't verify this account." };
    }
    return { resolved: true, accountName: data.data.account_name };
  } catch {
    return { resolved: false, error: "Couldn't reach the bank right now." };
  }
}
