import { NextResponse } from "next/server";
import { z } from "zod";
import { getAccount } from "@pesarc/sdk/api/auth";
import { rateLimit } from "@pesarc/sdk/api/guard";
import {
  operatorsFor,
  dataPlansFor,
  findOperator,
  getBillsAdapter,
  purchaseAmount,
  type BillCategory,
} from "@pesarc/sdk/bills";
import { recordTransfer } from "@pesarc/sdk/transfers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CATEGORIES = ["airtime", "data", "electricity"] as const;

/** Operators for a category, and data plans when an operator is given. */
export async function GET(request: Request) {
  const limited = rateLimit(request, "bills-read", 120, 60_000);
  if (limited) return limited;

  const url = new URL(request.url);
  const category = url.searchParams.get("category") as BillCategory | null;
  const operatorId = url.searchParams.get("operatorId");
  if (!category || !CATEGORIES.includes(category)) {
    return NextResponse.json({ ok: false, error: "Unknown category." }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    operators: operatorsFor(category),
    plans: category === "data" && operatorId ? dataPlansFor(operatorId) : [],
  });
}

const purchaseSchema = z.object({
  category: z.enum(CATEGORIES),
  operatorId: z.string().trim().min(1).max(40),
  customer: z.string().trim().min(3).max(40),
  amount: z.number().positive().max(10_000_000).optional(),
  planId: z.string().trim().max(60).optional(),
  meterType: z.enum(["prepaid", "postpaid"]).optional(),
});

/** Buy a bill through the active provider (simulated sandbox by default). */
export async function POST(request: Request) {
  const limited = rateLimit(request, "bills-write", 30, 60_000);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body." }, { status: 400 });
  }
  const parsed = purchaseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data." },
      { status: 400 },
    );
  }
  const input = parsed.data;
  const operator = findOperator(input.operatorId);
  if (!operator) {
    return NextResponse.json({ ok: false, error: "Unknown operator." }, { status: 400 });
  }
  if (purchaseAmount(input) <= 0) {
    return NextResponse.json({ ok: false, error: "Amount or plan is required." }, { status: 400 });
  }

  const result = await getBillsAdapter().purchase(input);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error ?? "Purchase failed." }, { status: 502 });
  }

  // Record it in the user's activity, best-effort.
  const account = await getAccount(request);
  const label =
    input.category === "airtime"
      ? `${operator.name} airtime`
      : input.category === "data"
        ? `${operator.name} data`
        : `${operator.name} electricity`;
  recordTransfer(
    {
      direction: "sent",
      counterparty: label,
      counterpartyHandle: input.customer,
      sendAmount: result.amount,
      sendCurrency: "NGN",
      receiveAmount: result.amount,
      receiveCurrency: "NGN",
      payout: input.category,
      reference: result.reference,
    },
    account,
  ).catch(() => {});

  return NextResponse.json({ ok: true, result });
}
