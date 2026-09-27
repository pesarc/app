# Arc submission — tomorrow's deploy runbook

Everything below is **simulated and verified** against Arc mainnet (chain `5042`)
today. You run the `--broadcast` commands (they spend the real deployer key,
`0xd4418f403F86De7DB7D1885d83A6d9A5bBf701F1`). I cannot broadcast for you.

## What's already true (checked on-chain)
- Corridors' stablecoins (cNGN/cGHS/cKES), IntentMatcher, RealizedRateOracle,
  PredictionMarket: **live** on Arc `5042` (addresses in `CORRIDORS_ROADMAP.md`).
- Paymaster: **not deployed** (address `0xAe5493…b22` is the deterministic slot,
  still free — a fresh deploy lands exactly there, so no env change after).
- Oracle rates: **not seeded** — `hasData` is false for every corridor, so live
  quotes/settlement don't work yet. Seeding is part of this runbook.
- Deployer balance: **2.79 USDC** on Arc (USDC is the gas token).

## Plan: Option A — small-amount live (no top-up)

Deploy the infrastructure inside today's 2.79 USDC and demo with **tiny real
sends** (₦500–₦1,000). Genuinely on-chain and gasless; the stake + deposit are
recoverable, so the demo's true cost is a few cents of gas plus the tiny amounts
you send. A light paymaster keeps most of the balance free for those sends.

| Action | Cost (USDC) | Recoverable? |
|---|---|---|
| DeployPaymaster (gas 0.047 + stake 0.3 + deposit 1.0) | ~1.35 | stake + deposit yes |
| DeployCorridor × 3 (NGN, GHS, KES) @ 0.016 gas | ~0.05 | — |
| **Infra subtotal** | **~1.40** | leaves ~1.39 USDC |
| Fund demo wallet for tiny sends (Step 3) | ~1.0 | it's yours |
| Agent key gas (only if the agent settles on-chain) | ~0.3 | it's yours |

Everything fits in 2.79 with a small buffer. (Full-scale variant later: top the
deployer to ~60 USDC and set `PM_DEPOSIT=25000000000000000000` for a real
₦50k-scale send.)

## Step 0 — key hygiene (once)
`vm.envUint` needs the `0x` prefix. Normalise at export time (no file edit,
nothing printed):
```bash
cd contracts/evm
export PRIVATE_KEY=$(grep '^PRIVATE_KEY=' .env | cut -d= -f2- | tr -d '"' | sed 's/^0x//;s/^/0x/')
```

## Step 1 — deploy the paymaster (gasless)
```bash
PAYMASTER_SIGNER=0xb440319eE67d10Ffce6F413e4B889D06F20BE675 \
PM_STAKE=300000000000000000 \
PM_DEPOSIT=1000000000000000000 \
forge script script/DeployPaymaster.s.sol --rpc-url arc --broadcast --slow
```
- 0.3 USDC stake + 1.0 USDC deposit. The deposit sponsors gas for the demo's
  gasless sends (Arc gas is ~0.016–0.05 USDC per op, so 1.0 covers dozens).
- Confirm the printed `VerifyingPaymaster:` equals `0xAe5493E713991691075E2daBBFFD61aB66dBFb22`
  (it will, at the current nonce) — so `NEXT_PUBLIC_INHOUSE_PAYMASTER_ADDRESS`
  already matches, no change needed.

## Step 2 — seed the corridor rates (live quotes + netting)
Run once per corridor. Rates are `local-per-USD × 1000`.
```bash
export ORACLE_ADDRESS=0x48484e904EA964a649D0c73666bA1E91d3Ca2349
export USDC_ADDRESS=0x3600000000000000000000000000000000000000

# Nigeria — NGN 1600/USD
CORRIDOR_TOKEN=0xE76E4f347667d973a1B968733bE41738f2AE202C RATE_PER_USD_MILLI=1600000 \
  forge script script/DeployCorridor.s.sol --rpc-url arc --broadcast --slow

# Ghana — GHS 15.5/USD
CORRIDOR_TOKEN=0xb3387B3cCAd4ef68e0c348735daA1C306D17C004 RATE_PER_USD_MILLI=15500 \
  forge script script/DeployCorridor.s.sol --rpc-url arc --broadcast --slow

# Kenya — KES 155/USD
CORRIDOR_TOKEN=0x6616D69AcbB9fe9Ef630171C069CC069a0d8464f RATE_PER_USD_MILLI=155000 \
  forge script script/DeployCorridor.s.sol --rpc-url arc --broadcast --slow
```
Adjust the rates to the live mid-market on the day. Verify after:
```bash
cast call 0x48484e904EA964a649D0c73666bA1E91d3Ca2349 \
  'hasData(address,address)(bool)' 0x3600000000000000000000000000000000000000 \
  0xE76E4f347667d973a1B968733bE41738f2AE202C --rpc-url arc   # -> true
```

## Step 3 — fund the demo wallet (small amounts)
On Arc, USDC **is** the native token, so funding is a plain value transfer. After
you sign in with Privy and copy your smart-wallet address, send it ~1 USDC (gas
is covered by the paymaster, so this is just value to send in the demo):
```bash
# ~1 USDC to the signed-in smart wallet (enough for several ₦500–₦1,000 sends)
cast send <YOUR_SMART_WALLET> --value 1000000000000000000 \
  --rpc-url arc --private-key "$PRIVATE_KEY"
```
Only if the **agent** settles from its own key (not the user's gasless wallet),
also fund that key with ~0.3 USDC the same way:
```bash
cast send <SETTLE_OPERATOR_ADDRESS> --value 300000000000000000 \
  --rpc-url arc --private-key "$PRIVATE_KEY"
```

## Step 4 — env (make the app use all of it)
Build-time (`BUILD_DOTENV` secret) — already set locally, mirror to prod:
`NEXT_PUBLIC_GAS_SPONSOR_ARC=inhouse`, `NEXT_PUBLIC_INHOUSE_PAYMASTER_ADDRESS`,
`NEXT_PUBLIC_PIMLICO_API_KEY`, the `NEXT_PUBLIC_ARC_*` corridor token addresses,
`NEXT_PUBLIC_PRIVY_APP_ID`.
Server (`/etc/pesarc/pesarc.env`): `INHOUSE_PAYMASTER_PK`, `LLM_API_KEY`
(OpenRouter), `SETTLE_OPERATOR_PK`, and (for real cash-out) `PAYSTACK_SECRET_KEY`
or the `CNGN_*` keys. See `GO_LIVE.md` §2, §4b, §4c, §7.
Then push `main` (CI builds + redeploys the droplet).

## Step 5 — verify (2 min)
- `hasData` true for each seeded corridor (Step 2 check).
- `cast code 0xAe5493…b22 --rpc-url arc` is non-empty (paymaster deployed).
- On `app.pesarc.xyz`: sign in, Send shows a **live rate** (not "indicative"),
  a small send completes **gaslessly** with a real Arc tx hash.

That's the whole submission stack live. The only thing gating a full ₦50k-scale
live demo (vs a cents-scale one) is topping the deployer + demo wallet up with USDC.
