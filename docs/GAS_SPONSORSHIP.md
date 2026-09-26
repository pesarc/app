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

## The erc7677 wallet client (wired)

`sdk/wallet/erc7677Client.ts` builds a viem ERC-4337 bundler client
(`createBundlerClient`) with an ERC-7677 paymaster (`createPaymasterClient` →
`sponsor.paymasterUrl`) and a Coinbase smart account owned by the Privy signer,
adapted to the app's `{ sendCalls, waitForCallsStatus }` shape. `smart-wallet.tsx`
builds it asynchronously in an effect, and it activates only when a bundler URL is
configured. Circle and in-house resolve to the same client — wired once.

Verified: viem's real `createPaymasterClient` round-trips against `/api/paymaster`
(getPaymasterStubData + getPaymasterData both return the paymaster + a 77-byte
paymasterData). The bundler leg is the remaining integration step — it needs an
Arc bundler URL + a funded paymaster, and the smart-account factory (Coinbase
Smart Wallet by default) must be deployed on Arc. Swap the account implementation
in `erc7677Client.ts` if Circle recommends a different one.

## Circle Gas Station URLs (what to obtain)

From Circle's Gas Station / Arc developer console:

- `NEXT_PUBLIC_CIRCLE_PAYMASTER_URL` — Circle's ERC-7677 paymaster service URL for
  Arc (the endpoint exposing `pm_getPaymasterStubData` / `pm_getPaymasterData`).
- `NEXT_PUBLIC_ARC_BUNDLER_URL` — an ERC-4337 bundler RPC for Arc (Circle's, or a
  public Arc bundler). EntryPoint on Arc is the canonical v0.7
  `0x0000000071727De22E5E9d8BAf0edAc6f37da032`.
- Set `NEXT_PUBLIC_GAS_SPONSOR_ARC=circle`.

Confirm which smart-account factory Circle expects; if it is not the Coinbase
Smart Wallet, point `erc7677Client.ts` at that account implementation.

## Gasless across VMs — only EVM needs a paymaster

Account abstraction is an EVM thing. Solana and Algorand sponsor fees natively,
so their gasless is **inherently in-house — no Circle or third party**:

- **EVM / Arc** — ERC-4337 paymaster (this doc). Circle first, in-house after audit.
- **Solana** — a **fee-payer relayer**, already in-house: `/api/svm/sponsor`
  co-signs a user-signed tx as the fee payer (user pays 0 SOL) and only sponsors
  txs where every instruction targets an allow-listed program, so the relayer's
  SOL can't be drained. Enable with `SVM_FEE_PAYER_SECRET`.
- **Algorand** — **fee pooling**: a sponsor account pays the fee inside an atomic
  group (user txn fee = 0). Native to Algorand, fully in-house, no AA. Build it
  when native Algorand tx flows land (today Algorand is bridge-only via Wormhole).

So the "third-party vs in-house" question is only about EVM/Arc — and even there
the seam lets us own it after audit. SVM is already ours; Algorand will be too.
