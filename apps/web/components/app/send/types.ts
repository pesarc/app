export type Step = "recipient" | "amount" | "confirm" | "settling" | "success";

export type SendResult = {
  tx?: string;
  received?: number;
  payoutTx?: string;
  /** App chain key the tx settled on (for the explorer link + chain badge);
   *  "solana" for the SVM leg. Omitted for the hub corridor (uses the hub). */
  chainKey?: string;
  /** Token symbol that moved (e.g. "USDC"), for the activity row. */
  token?: string;
};
