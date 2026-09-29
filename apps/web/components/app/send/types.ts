export type Step = "recipient" | "amount" | "confirm" | "settling" | "success";

export type SendResult = { tx?: string; received?: number; payoutTx?: string };
