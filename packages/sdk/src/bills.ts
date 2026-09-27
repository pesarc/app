// Bills: airtime, data, and electricity. Same shape as ramp.ts — a provider
// ADAPTER SEAM so the UI and agent stay identical whether we run the simulated
// sandbox or a real provider (Reloadly / VTpass / Flutterwave Bills) wired
// through env. Nigeria first (per the Global-South mandate); more countries add
// by extending the catalog.
//
// v1 ships the simulated adapter (no provider account needed). Set
// BILLS_PROVIDER_URL (+ its key) to route through a real provider later; the
// seam is already here.

import { randomBytes } from "node:crypto";

export type BillCategory = "airtime" | "data" | "electricity";
export type MeterType = "prepaid" | "postpaid";

export type Operator = {
  id: string;
  name: string;
  category: BillCategory | "telco"; // "telco" serves both airtime + data
  country: string; // ISO-ish label, e.g. "NG"
  color: string; // brand tint for the UI chip
};

export type DataPlan = {
  id: string;
  operatorId: string;
  label: string; // "1GB · 30 days"
  amount: number; // in local currency (NGN)
  validityDays: number;
};

export type BillPurchaseInput = {
  category: BillCategory;
  operatorId: string;
  /** Phone number (airtime/data) or meter number (electricity). */
  customer: string;
  /** Local-currency amount (airtime, electricity). Ignored for data (plan sets it). */
  amount?: number;
  /** Data plan id (data only). */
  planId?: string;
  /** Prepaid vs postpaid (electricity only). */
  meterType?: MeterType;
};

export type BillResult = {
  ok: boolean;
  reference: string;
  status: "success" | "pending" | "failed";
  amount: number;
  currency: string;
  /** Prepaid electricity token, when applicable. */
  token?: string;
  /** Units credited, e.g. "12.4 kWh" or "1GB". */
  units?: string;
  error?: string;
};

/* ----------------------------- Catalog ----------------------------- */
// Operators are real; simulated pricing is standard face value.

export const OPERATORS: Operator[] = [
  { id: "mtn-ng", name: "MTN", category: "telco", country: "NG", color: "#ffcc00" },
  { id: "airtel-ng", name: "Airtel", category: "telco", country: "NG", color: "#e40000" },
  { id: "glo-ng", name: "Glo", category: "telco", country: "NG", color: "#00a651" },
  { id: "9mobile-ng", name: "9mobile", category: "telco", country: "NG", color: "#006e4e" },
  { id: "ikedc", name: "Ikeja Electric", category: "electricity", country: "NG", color: "#e30613" },
  { id: "ekedc", name: "Eko Electric", category: "electricity", country: "NG", color: "#005baa" },
  { id: "aedc", name: "Abuja Electric", category: "electricity", country: "NG", color: "#0072bc" },
  { id: "phed", name: "Port Harcourt Electric", category: "electricity", country: "NG", color: "#f7941e" },
  { id: "ibedc", name: "Ibadan Electric", category: "electricity", country: "NG", color: "#00843d" },
  { id: "kedco", name: "Kano Electric", category: "electricity", country: "NG", color: "#2e3192" },
];

const DATA_PLANS: DataPlan[] = [
  ...["mtn-ng", "airtel-ng", "glo-ng", "9mobile-ng"].flatMap((op) => [
    { id: `${op}-500mb`, operatorId: op, label: "500MB · 30 days", amount: 500, validityDays: 30 },
    { id: `${op}-1gb`, operatorId: op, label: "1GB · 30 days", amount: 1000, validityDays: 30 },
    { id: `${op}-2gb`, operatorId: op, label: "2GB · 30 days", amount: 2000, validityDays: 30 },
    { id: `${op}-5gb`, operatorId: op, label: "5GB · 30 days", amount: 3500, validityDays: 30 },
    { id: `${op}-10gb`, operatorId: op, label: "10GB · 30 days", amount: 6000, validityDays: 30 },
  ]),
];

/** Operators offering a given category ("telco" ops cover airtime + data). */
export function operatorsFor(category: BillCategory): Operator[] {
  if (category === "electricity") {
    return OPERATORS.filter((o) => o.category === "electricity");
  }
  return OPERATORS.filter((o) => o.category === "telco");
}

export function dataPlansFor(operatorId: string): DataPlan[] {
  return DATA_PLANS.filter((p) => p.operatorId === operatorId);
}

export function findOperator(id: string): Operator | undefined {
  return OPERATORS.find((o) => o.id === id);
}

export function findDataPlan(id: string): DataPlan | undefined {
  return DATA_PLANS.find((p) => p.id === id);
}

/* ----------------------------- Adapters ----------------------------- */

export interface BillsAdapter {
  purchase(input: BillPurchaseInput): Promise<BillResult>;
}

function reference(): string {
  return `BILL-${randomBytes(6).toString("hex").toUpperCase()}`;
}

/** Resolve the effective amount for a purchase (data plans set their own). */
export function purchaseAmount(input: BillPurchaseInput): number {
  if (input.category === "data" && input.planId) {
    return findDataPlan(input.planId)?.amount ?? 0;
  }
  return input.amount ?? 0;
}

/** Simulated sandbox adapter: always succeeds, mints a fake token for prepaid. */
export const simulatedBillsAdapter: BillsAdapter = {
  async purchase(input) {
    const amount = purchaseAmount(input);
    const plan = input.planId ? findDataPlan(input.planId) : undefined;
    const units =
      input.category === "electricity"
        ? `${(amount / 65).toFixed(1)} kWh` // ~NGN 65/kWh, illustrative
        : input.category === "data"
          ? (plan?.label.split(" · ")[0] ?? undefined)
          : undefined;
    return {
      ok: true,
      reference: reference(),
      status: "success",
      amount,
      currency: "NGN",
      token:
        input.category === "electricity" && input.meterType !== "postpaid"
          ? randomBytes(10).toString("hex").replace(/(.{4})/g, "$1 ").trim().toUpperCase()
          : undefined,
      units,
    };
  },
};

/** True when a real bills provider is wired (env). */
export function billsProviderConfigured(): boolean {
  return Boolean(process.env.BILLS_PROVIDER_URL);
}

/**
 * Real provider adapter. POSTs the normalised purchase to BILLS_PROVIDER_URL
 * (your provider endpoint, or a thin proxy in front of Reloadly / VTpass /
 * Flutterwave Bills) and maps the response back to a BillResult. Server-only.
 *
 * Env: BILLS_PROVIDER_URL (base), BILLS_PROVIDER_KEY (bearer, optional).
 * Expected response JSON: { ok, status, reference?, amount?, currency?, token?, units?, error? }.
 */
export function httpBillsAdapter(): BillsAdapter {
  const baseUrl = (process.env.BILLS_PROVIDER_URL || "").replace(/\/$/, "");
  const apiKey = process.env.BILLS_PROVIDER_KEY || "";
  return {
    async purchase(input) {
      const amount = purchaseAmount(input);
      const ref = reference();
      try {
        const res = await fetch(`${baseUrl}/purchase`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify({
            category: input.category,
            operatorId: input.operatorId,
            customer: input.customer,
            amount,
            planId: input.planId,
            meterType: input.meterType,
            reference: ref,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as Partial<BillResult>;
        if (!res.ok || data.ok === false) {
          return {
            ok: false,
            reference: data.reference ?? ref,
            status: "failed",
            amount: data.amount ?? amount,
            currency: data.currency ?? "NGN",
            error: data.error ?? "Bill payment failed.",
          };
        }
        return {
          ok: true,
          reference: data.reference ?? ref,
          status: data.status ?? "success",
          amount: data.amount ?? amount,
          currency: data.currency ?? "NGN",
          token: data.token,
          units: data.units,
        };
      } catch {
        return {
          ok: false,
          reference: ref,
          status: "failed",
          amount,
          currency: "NGN",
          error: "Couldn't reach the bills provider.",
        };
      }
    },
  };
}

/** The active adapter: real provider when configured, else the sandbox. */
export function getBillsAdapter(): BillsAdapter {
  return billsProviderConfigured() ? httpBillsAdapter() : simulatedBillsAdapter;
}
