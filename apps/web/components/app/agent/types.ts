// Shared types for the Pesarc agent chat surface.

import type { ParsedUpload } from "@pesarc/sdk/agent/files";
import type { AgentDraft, AgentReceipt, RoutePlan, StakePlan } from "@pesarc/sdk/agent/run";

export type Msg =
  | { role: "user"; text: string; attachment?: string }
  | {
      role: "agent";
      text: string;
      matched?: boolean;
      submitUrl?: string;
      settlements?: { kind: string; url: string }[];
      pending?: boolean;
      marketsUrl?: string;
      billsUrl?: string;
      /** Deep link to the Cross-chain screen for a recognized cross-chain move. */
      crossChainUrl?: string;
      /** A drafted bulk action parsed from an uploaded file (read + draft only). */
      upload?: ParsedUpload;
      /** A money-moving action the agent drafted, awaiting the user's consent. */
      draft?: AgentDraft;
      draftState?: "pending" | "confirmed" | "cancelled";
      /** The receipt for a completed action. */
      receipt?: AgentReceipt;
      /** A multi-hop cross-chain route the browser runs leg by leg. */
      route?: RoutePlan;
      /** An on-chain market stake the user confirms + signs in chat. */
      stake?: StakePlan;
    };

// ---- Chat history (per-device, localStorage) ----------------------------
export type Thread = { id: string; title: string; msgs: Msg[]; updatedAt: number };
