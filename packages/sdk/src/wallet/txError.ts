// Turn a raw wallet / RPC / revert error into one short, calm sentence a normal
// person can act on — never the developer string (fee caps in wei, nonces, RPC
// codes, opcodes, 0x hashes). Our own thrown messages are already friendly, so
// they pass through unchanged; only technical noise is replaced.

/** Pull every human-readable layer out of an error (viem nests the real reason
 *  in `cause`, often several deep). */
function rawText(e: unknown): string {
  if (!e) return "";
  if (typeof e === "string") return e;
  const o = e as {
    shortMessage?: string;
    details?: string;
    message?: string;
    reason?: string;
    cause?: unknown;
  };
  const parts = [o.shortMessage, o.reason, o.details, o.message];
  if (o.cause) parts.push(rawText(o.cause));
  return parts.filter(Boolean).join(" • ");
}

/** Does the text still read like a developer error we should hide? */
function looksTechnical(s: string): boolean {
  return /0x[0-9a-f]{6,}|\brpc\b|eth_[a-z]|gwei|basefee|base fee|maxfeepergas|nonce|opcode|revert reason|execution reverted|out of gas|intrinsic gas|stack|calldata|abi|0x[0-9a-f]{2,}\b|\bwei\b/i.test(
    s,
  );
}

/**
 * A short, user-facing sentence for a failed on-chain action.
 * `fallback` is used when nothing specific matches and the raw text is technical.
 */
export function humanizeTxError(
  e: unknown,
  fallback = "That didn't go through. Please try again.",
): string {
  const raw = rawText(e);
  const low = raw.toLowerCase();
  if (!low) return fallback;

  // User cancelled / denied in the wallet.
  if (/user rejected|user denied|rejected the request|request was rejected|denied transaction|action_rejected/.test(low))
    return "You cancelled the request in your wallet.";

  // Fee / base-fee / underpriced — transient, worth a retry.
  if (/max fee per gas less than block base fee|fee cap|underpriced|fee too low|max priority fee|replacement transaction/.test(low))
    return "Network fees just changed. Please try again in a moment.";

  // Not enough funds for the amount or the fee.
  if (/insufficient funds|insufficient balance|exceeds balance|transfer amount exceeds|not enough|balance too low/.test(low))
    return "You don't have enough to cover this amount and the network fee.";

  // Allowance / approval step.
  if (/allowance|not approved|approve/.test(low))
    return "The approval step didn't complete. Please try again.";

  // On-chain revert.
  if (/revert|reverted|call exception|failed on-chain|contract call failed/.test(low))
    return "The transaction didn't go through on-chain. Nothing was sent.";

  // Wrong / unsupported network.
  if (/switch your wallet|wrong network|chain mismatch|unsupported chain|unrecognized chain|does not match the target chain/.test(low))
    return "Your wallet is on a different network. Switch it to the one shown and try again.";

  // Timing / nonce.
  if (/nonce too low|nonce has already been used|already known/.test(low))
    return "A previous transaction is still settling. Please try again shortly.";

  // Connectivity.
  if (/network error|failed to fetch|fetch failed|timeout|timed out|econnrefused|could not reach/.test(low))
    return "We couldn't reach the network. Check your connection and try again.";

  // Nothing matched. Keep our own clear messages; hide anything still technical.
  const first = raw.split(/[•\n.]/)[0].trim();
  if (!first || looksTechnical(first) || first.length > 120) return fallback;
  return first.endsWith(".") ? first : `${first}.`;
}
