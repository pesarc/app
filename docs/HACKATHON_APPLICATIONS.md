# Pesarc — hackathon / grant application answers

Ready-to-paste answers for the two programs.

**Hosted demo (Vercel preview, READY):**
https://pesarc-7iqxnr0ly-jorshimayors-projects.vercel.app
⚠️ It's currently behind **Vercel Authentication** (Deployment Protection) —
judges can't open it until that's turned off: Vercel → project `pesarc-web` →
Settings → Deployment Protection → set Vercel Authentication to *Disabled*. The
stable domain `pesarc-web.vercel.app` will serve it once you promote this build
to production (`vercel promote …` or the dashboard). I couldn't do either
automatically — both are gated as security/production actions.

Remaining **⟨FILL⟩**: your city (Arbitrum form) and, for Arc, the mainnet
deployment link (needs the Arc-mainnet deploy below).

---

## 1) Arbitrum Open House Singapore — Online Buildathon

| Field | Answer |
|---|---|
| **First name** | Joshua |
| **Last name** | Obafemi |
| **Location** | ⟨your city / country⟩ |
| **Do you already have an idea you want to build?** | Yes — **Pesarc**, a stablecoin-native cross-border settlement network + AI agent for the Global South. Send, hold, earn, invest and hedge money across borders in **local-currency stablecoins** (cNGN, cKES, cGHS…), gasless, with a real fiat off-ramp to banks and mobile money. |
| **Do you already have a project you're working on? (URL)** | Yes. Live app: **https://pesarc-7iqxnr0ly-jorshimayors-projects.vercel.app** · App repo: https://github.com/pesarc/app · Contracts (public): https://github.com/pesarc/contracts |
| **Arbitrum One wallet address** | `0xd4418f403F86De7DB7D1885d83A6d9A5bBf701F1` *(operator wallet — swap for a personal address if you'd rather receive prizes there)* |
| **Agree to T&C** | Yes |
| **Subscribe to newsletter** | Your call — Yes is fine |
| **Referral code** | ⟨leave blank unless you have one⟩ |

### Why it fits Arbitrum
Pesarc's prediction/hedge market and P2P settlement contracts are **already
deployed and live on Arbitrum Sepolia**, and the app defaults to Arbitrum:

- PredictionMarket (Arbitrum Sepolia): `0x088c60c5C1AC2f519497B36CFA72326e2c4b9904`
- Gasless UX via Alchemy Gas Manager (smart wallets), Privy embedded wallets
- Chain-switchable in-session (Arbitrum ⇄ Base), Solana devnet also live

Buildathon plan: promote the Arbitrum Sepolia deployment to **Arbitrum One**,
wire CCTP V2 USDC deposit corridors into Arbitrum, and ship the local-currency
off-ramp on an Arbitrum-first path.

---

## 2) Circle / Arc Microgrant

> ⚠️ **Eligibility gate:** the Arc Microgrant requires a **live Arc MAINNET**
> deployment. Our Arc integration today targets **Arc testnet** (chain
> `5042002`) — that does **not** qualify on its own. To submit we must deploy
> the contracts to Arc mainnet, which needs **real USDC in the operator wallet
> `0xd4418f403F86De7DB7D1885d83A6d9A5bBf701F1` on Arc mainnet** (USDC is the gas
> token there). Everything else below is ready. See "Path to eligibility".

| Field | Answer |
|---|---|
| **Project name** | Pesarc |
| **Short description of what you're building** | A stablecoin-native cross-border settlement network + AI agent for the Global South. Users send, hold, earn, invest and hedge in local-currency stablecoins — no dollar in the path, gasless — with a real fiat off-ramp to banks and mobile money. |
| **How you're using Arc** | Arc is a stablecoin-native L1 where **USDC is the gas token** — that is Pesarc's thesis made native. Users never touch a volatile gas token; value moves and settles in stablecoins end to end. We deploy the settlement + prediction/hedge market contracts to Arc, deposit native USDC over **Circle CCTP V2**, and settle P2P in local-currency stables on Arc. |
| **Live deployment link (Arc mainnet)** | **⟨FILL after Arc mainnet deploy⟩** — app: ⟨Vercel URL⟩, contract address on Arc mainnet: ⟨FILL⟩ |
| **Public repo** | https://github.com/pesarc/contracts (contracts) · https://github.com/pesarc/app (app) |
| **Builder profile (GitHub / X / Farcaster)** | GitHub: https://github.com/jorshimayor · X: ⟨your handle⟩ |
| **Wallet for USDC (Arc)** | `0xd4418f403F86De7DB7D1885d83A6d9A5bBf701F1` |

### What's already built (Circle-relevant)
- **USDC-native settlement + gas** — the "no gas token, settle in stablecoins"
  experience is Arc's default; we lean into it rather than bolt it on.
- **CCTP V2 corridors** — the Add-money flow deposits native USDC from a spoke
  chain and credits it on the hub (as tUSD, or auto-converted to a local stable).
- **Parimutuel prediction/hedge market**, local-currency P2P settlement
  (IntentMatcher), a self-referential RealizedRateOracle, an insured earn vault,
  and tokenized Global-South equities — all stablecoin-settled.
- Contracts are chain-agnostic Solidity (41 tests passing); the app already
  switches chains in-session — deploying to Arc is a config + deploy step.

### Path to eligibility (Arc mainnet)
1. ✅ Arc **mainnet** is in the chain registry (chain id `5042`, RPC
   `rpc.mainnet.arc.io`, native USDC predeploy `0x3600…0000`).
2. ✅ Deploy script `contracts/evm/script/DeployArc.s.sol` is written and
   **validated on Arc testnet** (chain `5042002`) — PredictionMarket
   `0xe9f109…558B`, 2 markets seeded, ~0.35 USDC gas.
3. Fund deployer `0xd4418f403F86De7DB7D1885d83A6d9A5bBf701F1` with **USDC on Arc
   mainnet** (gas). ← needs you.
4. Run the same script against mainnet:
   `PRIVATE_KEY=… forge script script/DeployArc.s.sol --rpc-url arc --broadcast --slow`
   (ENV_PREFIX defaults to `ARC`), then paste the printed `NEXT_PUBLIC_ARC_*`
   lines into `.env` and `docs/ARC_SUBMISSION.md`.
5. Redeploy the Vercel preview; capture the live URL + the Arc mainnet
   PredictionMarket tx as the submission's "live deployment link".

Deadline: **Oct 14 2026** (decisions ~Oct 21). Plenty of runway once the wallet
is funded.

---

## Deployed contracts (reference)

| Chain | PredictionMarket | Status |
|---|---|---|
| Arbitrum Sepolia | `0x088c60c5C1AC2f519497B36CFA72326e2c4b9904` | Live |
| Base Sepolia | `0xD6f0f1C8DC2AeD9Fc2886fed19eAfC34f699062E` | Live |
| Solana devnet | `2aMC2CKjqwxmLrS6dv98c6pVYEKogRXxEuz3NZpzv8CZ` | Live |
| Arc **mainnet** (`5042`) | ⟨pending — required for the microgrant⟩ | `DeployArc.s.sol` ready; needs USDC-funded deployer on Arc mainnet |
| Arc testnet (`5042002`) | `0xe9f109b826de37A6481eAfC60985B5b36763558B` | Live (validates the deploy); testnet doesn't qualify |
