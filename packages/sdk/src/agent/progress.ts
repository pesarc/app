// The stages an agent action moves through, in plain, branded language, plus the
// progress event the execute stream emits as it enters each one. Shared by the
// server (which emits real progress) and the client (which renders the trace),
// so the two never drift.

export type AgentProgress = { index: number; label: string };

/** A step callback the execution helpers call as they enter each real stage. */
export type OnProgress = (p: AgentProgress) => void;

export const AGENT_STEPS: Record<string, string[]> = {
  // Money-moving actions (server-driven over SSE).
  transfer: ["Placing your transfer on-chain", "Matching and settling in local currency", "Finishing up"],
  payout: ["Settling your funds", "Sending to your bank", "Confirming the payout"],
  bill: ["Reaching your provider", "Sending it through", "Confirming"],
  // Client-side traces (fast, timer-driven).
  understand: ["Reading what you need", "Checking today's rate", "Getting your options ready"],
  upload: ["Reading your file", "Drafting each payout", "Getting them ready to review"],
};

export function stepsFor(type: string): string[] {
  return AGENT_STEPS[type] ?? AGENT_STEPS.understand;
}

/** Emit step `index` for `type` via `onProgress`, if a callback was given. */
export function emitStep(onProgress: OnProgress | undefined, type: string, index: number): void {
  if (!onProgress) return;
  const label = stepsFor(type)[index];
  if (label) onProgress({ index, label });
}
