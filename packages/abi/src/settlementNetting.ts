// SettlementNetting (contracts/src/SettlementNetting.sol) — the multilateral
// net-settlement engine behind the Business/Settle mode.
export const settlementNettingAbi = [
  {
    type: "function",
    name: "setInfo",
    stateMutability: "view",
    inputs: [{ name: "setId", type: "uint256" }],
    outputs: [
      { name: "token", type: "address" },
      { name: "operator", type: "address" },
      { name: "active", type: "bool" },
      { name: "cycle", type: "uint64" },
      { name: "memberCount", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "membersOf",
    stateMutability: "view",
    inputs: [{ name: "setId", type: "uint256" }],
    outputs: [{ name: "", type: "address[]" }],
  },
  {
    type: "function",
    name: "isMember",
    stateMutability: "view",
    inputs: [
      { name: "", type: "uint256" },
      { name: "", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "owed",
    stateMutability: "view",
    inputs: [
      { name: "", type: "uint256" },
      { name: "", type: "address" },
      { name: "", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "grossThisCycle",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "netToMove",
    stateMutability: "view",
    inputs: [{ name: "setId", type: "uint256" }],
    outputs: [{ name: "total", type: "uint256" }],
  },
  {
    type: "function",
    name: "netPositionOf",
    stateMutability: "view",
    inputs: [
      { name: "setId", type: "uint256" },
      { name: "member", type: "address" },
    ],
    outputs: [{ name: "net", type: "int256" }],
  },
  {
    type: "function",
    name: "recordObligation",
    stateMutability: "nonpayable",
    inputs: [
      { name: "setId", type: "uint256" },
      { name: "creditor", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "invoiceRef", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "settle",
    stateMutability: "nonpayable",
    inputs: [{ name: "setId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "addMember",
    stateMutability: "nonpayable",
    inputs: [
      { name: "setId", type: "uint256" },
      { name: "member", type: "address" },
    ],
    outputs: [],
  },
] as const;
