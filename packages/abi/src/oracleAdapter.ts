// OracleAdapter (contracts/src/OracleAdapter.sol) — read-only reference price.
export const oracleAdapterAbi = [
  {
    type: "function",
    name: "getPrice1e18Strict",
    stateMutability: "view",
    inputs: [
      {
        name: "key",
        type: "tuple",
        components: [
          { name: "currency0", type: "address" },
          { name: "currency1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "hooks", type: "address" },
        ],
      },
    ],
    outputs: [{ name: "price1e18", type: "uint256" }],
  },
] as const;
