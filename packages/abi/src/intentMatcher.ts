// IntentMatcher (contracts/src/IntentMatcher.sol) — local-currency P2P settlement.
export const intentMatcherAbi = [
  {
    type: "function",
    name: "intentCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "intents",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "maker", type: "address" },
      { name: "recipient", type: "address" },
      { name: "tokenIn", type: "address" },
      { name: "tokenOut", type: "address" },
      { name: "amountIn", type: "uint128" },
      { name: "minAmountOut", type: "uint128" },
      { name: "remainingIn", type: "uint128" },
      { name: "expiry", type: "uint64" },
      { name: "active", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "submitIntent",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenIn", type: "address" },
      { name: "tokenOut", type: "address" },
      { name: "amountIn", type: "uint128" },
      { name: "minAmountOut", type: "uint128" },
      { name: "recipient", type: "address" },
      { name: "expiry", type: "uint64" },
      { name: "reference_", type: "bytes32" },
    ],
    outputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "function",
    name: "cancelIntent",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "matchIntents",
    stateMutability: "nonpayable",
    inputs: [
      { name: "idA", type: "uint256" },
      { name: "idB", type: "uint256" },
      { name: "fillA", type: "uint128" },
      { name: "fillB", type: "uint128" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "matchRing",
    stateMutability: "nonpayable",
    inputs: [
      { name: "ids", type: "uint256[]" },
      { name: "fills", type: "uint128[]" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "isMatchable",
    stateMutability: "view",
    inputs: [
      { name: "idA", type: "uint256" },
      { name: "idB", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "event",
    name: "IntentsMatched",
    inputs: [
      { name: "idA", type: "uint256", indexed: true },
      { name: "idB", type: "uint256", indexed: true },
      { name: "tokenA", type: "address", indexed: false },
      { name: "tokenB", type: "address", indexed: false },
      { name: "fillA", type: "uint128", indexed: false },
      { name: "fillB", type: "uint128", indexed: false },
      { name: "rate1e18", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "RingMatched",
    inputs: [
      { name: "ids", type: "uint256[]", indexed: false },
      { name: "fills", type: "uint128[]", indexed: false },
    ],
  },
] as const;

// RealizedRateOracle — self-referential price discovery from settled flow.
export const realizedRateOracleAbi = [
  {
    type: "function",
    name: "latestRate1e18",
    stateMutability: "view",
    inputs: [
      { name: "tokenIn", type: "address" },
      { name: "tokenOut", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "consult",
    stateMutability: "view",
    inputs: [
      { name: "tokenIn", type: "address" },
      { name: "tokenOut", type: "address" },
      { name: "window", type: "uint32" },
    ],
    outputs: [{ name: "twap1e18", type: "uint256" }],
  },
  {
    type: "function",
    name: "hasData",
    stateMutability: "view",
    inputs: [
      { name: "tokenIn", type: "address" },
      { name: "tokenOut", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;
