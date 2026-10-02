// Bank directory + account-name resolution for the withdraw/payout step.
//
// Live via Paystack when PAYSTACK_SECRET_KEY is set (GET /bank, GET
// /bank/resolve); otherwise a curated Nigerian bank list and a demo resolver
// so the flow is fully usable without a provider account.

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

export async function listBanks(currency = "NGN"): Promise<Bank[]> {
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
    // Dedupe by name (the provider returns several entries per bank, which is what
    // made the picker show duplicates) and sort alphabetically.
    const seen = new Set<string>();
    const banks = raw
      .filter((b) => b.name && b.code)
      .map((b) => ({ name: String(b.name).trim(), code: String(b.code) }))
      .filter((b) => {
        const k = b.name.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
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
): Promise<ResolveResult> {
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
