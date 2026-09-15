// Minimal ABI for the Pesarc PredictionMarket (read path). The app reads
// live implied odds + pools from Celo and overlays them on the market catalog;
// staking on Celo needs a Celo-funded signer and is a separate flow.

export const predictionMarketAbi = [
  {
    type: "function",
    stateMutability: "view",
    name: "marketCount",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "impliedYes1e18",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "getMarket",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "question", type: "string" },
          { name: "collateral", type: "address" },
          { name: "closeTime", type: "uint64" },
          { name: "resolveTime", type: "uint64" },
          { name: "disputeWindow", type: "uint64" },
          { name: "disputeUntil", type: "uint64" },
          { name: "attestor", type: "address" },
          { name: "poolYes", type: "uint128" },
          { name: "poolNo", type: "uint128" },
          { name: "winnerPool", type: "uint256" },
          { name: "payoutPool", type: "uint256" },
          { name: "bond", type: "uint256" },
          { name: "proposer", type: "address" },
          { name: "disputer", type: "address" },
          { name: "proposed", type: "uint8" },
          { name: "outcome", type: "uint8" },
          { name: "status", type: "uint8" },
          {
            name: "source",
            type: "tuple",
            components: [
              { name: "kind", type: "uint8" },
              { name: "tokenIn", type: "address" },
              { name: "tokenOut", type: "address" },
              { name: "twapWindow", type: "uint32" },
              { name: "comparator", type: "uint8" },
              { name: "threshold", type: "uint256" },
              { name: "feedRef", type: "bytes32" },
            ],
          },
        ],
      },
    ],
  },
] as const;
