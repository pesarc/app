# @pesarc/worker

The keepers/relayers: settlement solver, CCTP relay, oracle recorder, market
resolver (`proposeFromOracle` / attested finalize), x402 settlement. Anything
that spends the operator key or runs on a schedule lives here, off the request
path. Migrated from luberty `lib/solver`, `lib/celo`, `app/api/cron`.
