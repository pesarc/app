// Celo hackathon attribution tags (ERC-8021).
//
// Every leaderboard-counted transaction must carry your assigned tag in its
// calldata — appended as a "data suffix". The tag CANNOT be backfilled: it has
// to be in the calldata when the transaction is sent, or the transaction is
// permanently uncounted. So every write the agent makes goes through
// withTag() before it's broadcast.
//
// The Celo Builders skill hands you a tag (celo_…) at registration; put it in
// NEXT_PUBLIC_CELO_ATTRIBUTION_TAG. If you already tag with your own code, set
// NEXT_PUBLIC_CELO_OWN_TAG too — both get appended (only the assigned tag is
// credited, but keeping yours is allowed).
//
// The data suffix is the tag(s) hex-encoded and appended to the call's data.
// This mirrors Celo's toDataSuffix(['own', 'assigned']).

const HEX = /^0x[0-9a-fA-F]*$/;

/** Hex-encodes one tag. A `0x…` tag is used verbatim; text is UTF-8 encoded. */
function encodeTag(tag: string): string {
  const t = tag.trim();
  if (!t) return "";
  if (HEX.test(t)) return t.slice(2);
  return Buffer.from(t, "utf8").toString("hex");
}

/** The configured suffix (own tag first, then the assigned tag), or "". */
export function dataSuffix(): `0x${string}` | "" {
  const own = process.env.NEXT_PUBLIC_CELO_OWN_TAG ?? "";
  const assigned = process.env.NEXT_PUBLIC_CELO_ATTRIBUTION_TAG ?? "";
  const parts = [own, assigned].map(encodeTag).filter(Boolean);
  if (parts.length === 0) return "";
  return `0x${parts.join("")}` as `0x${string}`;
}

export function hasAttributionTag(): boolean {
  return dataSuffix() !== "";
}

/**
 * Appends the attribution suffix to an ABI-encoded calldata string. viem's
 * writeContract has no data-suffix option, so we encode the call ourselves and
 * append the tag before sending as a raw transaction.
 */
export function withTag(data: `0x${string}`): `0x${string}` {
  const suffix = dataSuffix();
  return suffix ? ((data + suffix.slice(2)) as `0x${string}`) : data;
}
