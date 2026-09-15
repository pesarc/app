// Uniswap v4 swap router (no-checks variant used by the existing deployment).
// Ported from goldgard-hookathon/frontend/lib/abi/swapRouterNoChecks.ts.
export const swapRouterAbi = [
  {
    type: "function",
    name: "swap",
    stateMutability: "nonpayable",
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
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "zeroForOne", type: "bool" },
          { name: "amountSpecified", type: "int256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "amount0", type: "int128" },
          { name: "amount1", type: "int128" },
        ],
      },
    ],
  },
] as const;

// NOTE: SwapRouterNoChecks.swap actually returns nothing (the tuple above is
// only ever used to *encode* calldata). Quotes come from the V4Quoter lens
// (abi/quoter.ts), not from simulating this router.

// v4 price-limit bounds for an exact-input swap.
export const MIN_SQRT_PRICE_LIMIT = 4295128740n; // zeroForOne (token0 -> token1)
export const MAX_SQRT_PRICE_LIMIT =
  1461446703485210103287273052203988822378723970341n; // !zeroForOne
