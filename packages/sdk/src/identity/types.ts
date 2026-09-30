// The identity layer: one canonical identity that unifies a person's chain
// addresses, phone number, username, and (once licensed) a bank account number
// (NUBAN). This is the spine that lets Pesarc feel like one account across every
// chain and rail — a user is a phone number; chains and account numbers hang off
// it. Read the masterplan "Rails & Identity" section for the why.

/** A wallet address on a specific chain. `chain` is a registry key
 *  (e.g. "arbitrum", "base", "arc") or a non-EVM VM name ("solana", "algorand"). */
export type ChainAddress = { chain: string; address: string };

/** How verified a person is — gates what rails they can use. */
export type KycLevel = "none" | "phone" | "basic" | "full";

/** A NUBAN / virtual account number, issued once a licensed rail is live. */
export type BankAlias = { number: string; bankCode?: string; provider?: string };

/** The canonical record. Keyed by `id`; every other field is a lookup handle. */
export type Identity = {
  id: string;
  /** E.164 phone, the human-memorable root handle. */
  phone?: string;
  /** Unique @username. */
  username?: string;
  /** Smart-wallet + non-EVM addresses this person controls. */
  addresses: ChainAddress[];
  /** Issued bank account number(s). */
  bank?: BankAlias;
  kyc: KycLevel;
  createdAt: string;
  updatedAt: string;
};

/** The kind of handle a caller passed in. */
export type HandleKind = "phone" | "username" | "evm" | "solana" | "nuban" | "id";

/** How value should reach a resolved handle. */
export type Rail = "onchain" | "fiat" | "unknown";

/** The routing answer: who the handle is, and how to pay them. */
export type ResolvedDestination = {
  /** Matched identity id, when the handle mapped to one. */
  identityId?: string;
  kind: HandleKind;
  rail: Rail;
  /** On-chain target, when rail is "onchain". */
  chain?: string;
  address?: string;
  /** Fiat target, when rail is "fiat". */
  nuban?: string;
  /** A friendly label for the UI. */
  display: string;
};
