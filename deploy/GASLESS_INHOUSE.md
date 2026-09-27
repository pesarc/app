# Enabling in-house gasless on the droplet (Arc mainnet)

Turn on Pesarc's OWN paymaster in production, so sponsored sends on Arc run on
our funded VerifyingPaymaster (bundled by Pimlico's free relay) instead of a paid
third-party sponsorship policy.

Prereq: `DeployPaymaster.s.sol` has been broadcast on Arc mainnet (see
`pesarc/contracts` → `script/DeployPaymaster.s.sol`) and the paymaster is staked
+ funded. You have its address and the verifyingSigner private key.

## The build/runtime split (important)

`NEXT_PUBLIC_*` vars are **inlined at build time** (baked into the image via the
BuildKit `--secret id=dotenv` mount in CI). Changing them needs a **rebuild +
redeploy** (push to `main` → GitHub Actions). Server-only vars are read at
**runtime** from `/etc/pesarc/pesarc.env` and take effect on `systemctl restart
pesarc-web` — no rebuild.

### 1. Build dotenv (the CI `.env` / repo build secret) — needs a rebuild

Add / set these so they inline into the client bundle:

```dotenv
# Arc mainnet hub (already set if the pivot shipped)
NEXT_PUBLIC_HUB_CHAIN_ID=5042
NEXT_PUBLIC_ACTIVE_CHAIN=arc
NEXT_PUBLIC_ARC_RPC_URL=https://rpc.mainnet.arc.io
NEXT_PUBLIC_ARC_EXPLORER_URL=https://explorer.arc.io

# Prediction-market + settlement addresses (from DeployArc)
NEXT_PUBLIC_ARC_PREDICTION_MARKET=0xe9f109b826de37A6481eAfC60985B5b36763558B
NEXT_PUBLIC_ARC_REALIZED_ORACLE=0x48484e904EA964a649D0c73666bA1E91d3Ca2349
NEXT_PUBLIC_ARC_INTENT_MATCHER=0x5f7Cb34cA29d0554998882B716DC86e0B764f206
NEXT_PUBLIC_ARC_TOKEN_NGN=0xE76E4f347667d973a1B968733bE41738f2AE202C
NEXT_PUBLIC_ARC_TOKEN_GHS=0xb3387B3cCAd4ef68e0c348735daA1C306D17C004
NEXT_PUBLIC_ARC_TOKEN_KES=0x6616D69AcbB9fe9Ef630171C069CC069a0d8464f

# Gasless: route sponsorship to OUR paymaster; Pimlico only relays (free).
NEXT_PUBLIC_GAS_SPONSOR_ARC=inhouse
NEXT_PUBLIC_INHOUSE_PAYMASTER_ADDRESS=<paymaster address from DeployPaymaster>
NEXT_PUBLIC_PIMLICO_API_KEY=<pimlico key — bundler only, no policy needed>
# Leave the Pimlico sponsorship policy EMPTY in the in-house path:
NEXT_PUBLIC_PIMLICO_SPONSORSHIP_POLICY_ID=
```

The app resolves `inhouse` to the ERC-7677 service at `/api/paymaster` (same
origin) automatically — no `NEXT_PUBLIC_INHOUSE_PAYMASTER_URL` needed on the
droplet.

### 2. Runtime env `/etc/pesarc/pesarc.env` — no rebuild, restart only

```dotenv
# Off-chain signer for /api/paymaster. Fresh key, holds NO funds; only signs
# sponsorships. Its address is the paymaster's verifyingSigner.
INHOUSE_PAYMASTER_PK=<0x… signer private key>
# Reject any user-op whose maxFeePerGas exceeds this ceiling (anti-drain).
INHOUSE_PAYMASTER_MAX_FEE_WEI=50000000000
```

`chmod 600 /etc/pesarc/pesarc.env`. Never commit this file. The signer key is
low-value (rotate via `paymaster.setSigner(...)` from the owner, and the owner
can `withdrawTo` the deposit), but treat it as a secret.

### 3. Deploy

```bash
# build-time change -> rebuild + redeploy
git push origin main          # CI builds the image with the new NEXT_PUBLIC_* and redeploys
# runtime-only change -> restart is enough
ssh <droplet> 'sudo systemctl restart pesarc-web'
```

## Verify in prod

1. `scripts/verify-gasless-arc.mjs` against Arc mainnet proves the paymaster
   sponsors a real user-op (owner never funded, paymaster deposit drops).
2. In the app on `app.pesarc.xyz`: sign in, stake on a market — the tx should
   land with no gas token in the smart wallet.
3. Watch the deposit: `cast call 0x0000000071727De22E5E9d8BAf0edAc6f37da032
   "balanceOf(address)(uint256)" <paymaster> --rpc-url arc` should tick down as
   ops are sponsored. Top it up with `paymaster.deposit{value: …}()` (owner).

## Guardrails

- The paymaster is UNAUDITED. Keep the EntryPoint deposit small (a few USDC)
  until it is audited; the fee ceiling above bounds per-op exposure.
- If sponsorship misbehaves, flip `NEXT_PUBLIC_GAS_SPONSOR_ARC` back to `pimlico`
  (with a funded policy) or `circle`, rebuild, redeploy — the seam is one env var.
