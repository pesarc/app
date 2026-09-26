# Gas sponsorship (gasless) — provider seam

Gasless is ERC-4337: a smart wallet sends UserOperations and a **paymaster** pays
the gas. The provider is a swappable seam so we are not locked to one vendor.

## The seam

`sdk/wallet/gasSponsor.ts` resolves, per hub chain, one of three shapes:

- **alchemy** — Alchemy Gas Manager (bundler + paymaster in one). Used on the
  testnets today; unchanged.
- **erc7677** — a standards-based paymaster service (a bundler URL + a paymaster
  service URL). **Circle Gas Station** and our **in-house paymaster** both speak
  ERC-7677, so they are the same shape here — only the URLs/provider differ.
- **none** — no sponsorship (user pays / mock).

`smart-wallet.tsx` reads the seam. The Alchemy branch is wired. The erc7677
branch is the remaining integration point (below).

## Enabling on Arc

Pick the provider with `NEXT_PUBLIC_GAS_SPONSOR_ARC` (`circle` | `inhouse`), or
leave it unset to auto-detect from whichever URL is present.

```ini
NEXT_PUBLIC_ARC_BUNDLER_URL=            # ERC-4337 bundler RPC for Arc

# Circle Gas Station (fast path, recommended for the grant):
NEXT_PUBLIC_CIRCLE_PAYMASTER_URL=      # Circle's ERC-7677 paymaster service URL

# In-house paymaster (survivable path):
NEXT_PUBLIC_INHOUSE_PAYMASTER_ADDRESS= # deployed VerifyingPaymaster address
NEXT_PUBLIC_INHOUSE_PAYMASTER_URL=     # defaults to same-origin /api/paymaster
INHOUSE_PAYMASTER_PK=                  # server-only signer key (never NEXT_PUBLIC)
INHOUSE_PAYMASTER_MAX_FEE_WEI=50000000000
```

## In-house paymaster (built, audit-pending)

Two halves, kept byte-consistent so signatures recover:

1. **Contract** — `docs/contracts/VerifyingPaymaster.sol` (a reference to drop
   into the `pesarc/contracts` repo; needs the account-abstraction lib). It only
   sponsors an op that `verifyingSigner` signed, within a `validUntil/validAfter`
   window.
2. **Signer service** — `/api/paymaster` (ERC-7677: `pm_getPaymasterStubData` /
   `pm_getPaymasterData`), signing with `sdk/paymaster/verifying.ts`. Enabled
   only when `INHOUSE_PAYMASTER_PK` + `NEXT_PUBLIC_INHOUSE_PAYMASTER_ADDRESS` are
   set; only sponsors Arc; enforces a per-op fee ceiling + a per-sender rate
   limit.

`getSponsorHash` (TS) and `getHash` (Solidity) hash the **same** fields in the
same order — change one, change both.

### Deploy the in-house paymaster

1. Copy `VerifyingPaymaster.sol` into `pesarc/contracts`, deploy to Arc with the
   EntryPoint address + `verifyingSigner` = the address of `INHOUSE_PAYMASTER_PK`.
2. Fund its EntryPoint deposit with USDC (Arc gas).
3. Set the env above (`NEXT_PUBLIC_GAS_SPONSOR_ARC=inhouse`).

> **AUDIT REQUIRED before Arc mainnet.** The paymaster holds and spends funds —
> a bug drains it. Ship Circle Gas Station in production until this is audited
> and integration-tested against a live EntryPoint + bundler on Arc. The seam
> makes that flip one env var.

## Remaining integration step (erc7677 wallet client)

`smart-wallet.tsx` currently constructs the Alchemy client only. For the
erc7677 branch, build a viem/permissionless ERC-4337 client pointed at
`sponsor.bundlerUrl` with a paymaster that calls `sponsor.paymasterUrl`
(getPaymasterStubData/getPaymasterData). This is deliberately not shipped
untested — it is a money path, and both Circle and in-house resolve to the same
client, so it is wired once. Do it against Arc with a funded paymaster and a
real bundler, then it serves every erc7677 provider.
