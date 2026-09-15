// AgentSessionKeys — bounded agent authority (spend cap + expiry + allowlist).
// Synced from StableArc/contracts evm/src/AgentSessionKeys.sol.
export const agentSessionKeysAbi = [
  {
    type: "function",
    stateMutability: "view",
    name: "remaining",
    inputs: [{ name: "key", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "sessions",
    inputs: [{ name: "key", type: "address" }],
    outputs: [
      { name: "token", type: "address" },
      { name: "cap", type: "uint128" },
      { name: "spent", type: "uint128" },
      { name: "expiry", type: "uint64" },
      { name: "active", type: "bool" },
    ],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "pay",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "execute",
    inputs: [
      { name: "target", type: "address" },
      { name: "data", type: "bytes" },
    ],
    outputs: [{ type: "bytes" }],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "grantSession",
    inputs: [
      { name: "key", type: "address" },
      { name: "token", type: "address" },
      { name: "cap", type: "uint128" },
      { name: "expiry", type: "uint64" },
    ],
    outputs: [],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "revokeSession",
    inputs: [{ name: "key", type: "address" }],
    outputs: [],
  },
] as const;
