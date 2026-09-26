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

Per Circle's Arc guide (`circlefin/arc-node`, `docs/erc-4337.md`) the account is
**SimpleAccount** via `permissionless.js` `toSimpleSmartAccount` (deterministic
address across chains — matches the CCTP address), on the canonical EntryPoint
v0.7 `0x0000000071727De22E5E9d8BAf0edAc6f37da032`. `erc7677Client.ts` is wired to
exactly that.

Verified END TO END on Arc testnet (5042002): a SimpleAccount UserOp was
submitted through the Pimlico bundler, **sponsored by Pimlico's paymaster (no
policy needed on testnet)**, deployed the account, and confirmed on-chain
(`success: true`). So gasless on Arc works with just a Pimlico key.

Setup is one key: `NEXT_PUBLIC_PIMLICO_API_KEY` builds both the bundler URL and
the paymaster (same v2 endpoint), and `NEXT_PUBLIC_GAS_SPONSOR_ARC=pimlico`. On
mainnet, add a funded `NEXT_PUBLIC_PIMLICO_SPONSORSHIP_POLICY_ID` (passed as
paymaster context) or use Circle Paymaster / the in-house paymaster. The
`/api/paymaster` in-house path is also verified against viem's real paymaster
client (77-byte paymasterData) for the survivable, audit-then-flip option.

## Arc bundler + paymaster URLs (exact, from Circle's guide)

Source: Circle's `circlefin/arc-node` `docs/erc-4337.md`. Arc facts:

- EntryPoint v0.7: `0x0000000071727De22E5E9d8BAf0edAc6f37da032` (canonical).
- USDC (native gas token): `0x3600000000000000000000000000000000000000`
  (18-decimal for native gas accounting, 6-decimal ERC-20 interface).
- Arc RPC: `https://rpc.testnet.arc.io` (5042002) / `https://rpc.mainnet.arc.io` (5042).

**Bundler** (`NEXT_PUBLIC_ARC_BUNDLER_URL`) — Pimlico is recommended:
`https://api.pimlico.io/v2/<chainId>/rpc?apikey=<PIMLICO_API_KEY>`
(chainId 5042 mainnet / 5042002 testnet). Get the key at dashboard.pimlico.io.

**Paymaster** (`NEXT_PUBLIC_CIRCLE_PAYMASTER_URL`) — any ERC-7677 service:
- **Circle Paymaster** (users pay gas in USDC; permissionless) — natural on Arc
  since USDC is the gas token. See developers.circle.com/paymaster.
- **Pimlico's paymaster** (sponsorship) — one provider for bundler + paymaster.
- **In-house** — `NEXT_PUBLIC_GAS_SPONSOR_ARC=inhouse` + `/api/paymaster`.

Then set `NEXT_PUBLIC_GAS_SPONSOR_ARC=circle` (or `inhouse`).

### USDC decimal split (for a USDC-charging paymaster)

A paymaster that converts `maxCost` (18-decimal native) to a USDC (6-decimal)
charge divides by `1e12`. Relevant only for a USDC-charging paymaster, not our
sponsored VerifyingPaymaster.

### ERC-7562 rule that bit others (our contract already complies)

`validatePaymasterUserOp` must NOT write global storage or use `nonReentrant`
for an unstaked paymaster — Pimlico silently drops such UserOps. Our
`VerifyingPaymaster.sol` validation is a `view` function with no storage writes,
so it complies; put any reentrancy guard on `postOp`, never on validation.

## Gasless across VMs — only EVM needs a paymaster

Account abstraction is an EVM thing. Solana and Algorand sponsor fees natively,
so their gasless is **inherently in-house — no Circle or third party**:

- **EVM / Arc** — ERC-4337 paymaster (this doc). Circle first, in-house after audit.
- **Solana** — a **fee-payer relayer**, already in-house: `/api/svm/sponsor`
  co-signs a user-signed tx as the fee payer (user pays 0 SOL) and only sponsors
  txs where every instruction targets an allow-listed program, so the relayer's
  SOL can't be drained. Enable with `SVM_FEE_PAYER_SECRET`.
- **Algorand** — **fee pooling**, in-house and BUILT: `/api/algorand/sponsor` +
  `sdk/algorand/sponsor.ts`. The client builds an atomic group of its txns (fee 0)
  plus one sponsor fee-cover self-payment; the relayer co-signs ONLY that self-pay
  (amount 0, from==to==sponsor, fee ≤ `ALGO_SPONSOR_MAX_FEE`, optional app
  allow-list) and submits. The sponsor never signs anything that moves its funds,
  so its exposure is just the pooled fee. Enable with `ALGO_SPONSOR_MNEMONIC`.
  Verified: valid group validates + co-signs; a sponsor txn that pays out or
  exceeds the fee cap is rejected.

So the "third-party vs in-house" question is only about EVM/Arc — and even there
the seam lets us own it after audit. SVM is already ours; Algorand will be too.
