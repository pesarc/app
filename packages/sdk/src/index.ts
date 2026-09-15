// Pesarc SDK — the VM-neutral, reusable core. This is where the crown-jewel
// TS lands (migrated from stablearc-agent + luberty/lib):
//   - matching / ring-netting solver
//   - RealizedRateOracle client + FX quoting
//   - ChainAdapter (EVM via viem, SVM via @solana/kit)
//   - intent construction (tap-flow = zero-token; agent = one NL adapter)
//   - PredictionMarket + (future) BrokerAdapter / TokenizedEquity clients
// Web, mobile, api and worker all import from here — one implementation.
export const SDK_VERSION = "0.0.0";
