# Colosseum (Solana) hackathon — submission answers

Paste-ready answers for the Colosseum submission form. `[YOUR INPUT]` marks fields
only you can fill (personal facts). Char limits noted where the form enforces them.

---

## Project details

**Project name** — `Pesarc`

**Brief description** (≤500)
> Pesarc is a stablecoin-native settlement network and AI agent. Send, hold, earn, invest, hedge, and settle money across borders in local-currency stablecoins, gasless, with a real fiat off-ramp to banks and mobile money.

**Project website** — `https://pesarc.xyz`

**What are you building, and who is it for?** (≤1000)
> Pesarc is a stablecoin-native settlement network and AI money agent for the Global South. People send, hold, earn, invest, hedge and cash out entirely in their own currency — naira, cedis, shillings — never in dollars, and never touching gas or seed phrases. It's for the billions priced out of crypto and remittance apps: the trader in Lagos, the family sending money Accra↔Nairobi, the SME paying suppliers across borders. Our bar is the Mum Test: if your mum can send money on WhatsApp, she can use Pesarc — on a smartphone, on WhatsApp, or on USSD from a basic phone. Under the hood it's a native EVM+SVM network: local-currency stablecoins settled peer-to-peer by an intent-netting engine, priced by an on-chain realized-rate oracle, moved gaslessly with account abstraction, and bridged over CCTP and Hyperbridge. On Solana we run a settlement spoke and a parimutuel prediction market so people can hedge real-world events — FX, fuel, elections — in their own money.

**Why did you decide to build this, and why now?** (≤1000)
> Everyone in our markets is forced to think in dollars they don't have. Remittances to Africa cost 8%+ and take days, local FX is opaque and quoted in WhatsApp groups, and every "crypto" fix so far demands a wallet, gas, a seed phrase and a dollar mindset. We're Nigerian — this is our own problem. Two things make now the moment: regulated local-currency stablecoins (cNGN and peers) finally exist, and account abstraction plus chains where the stablecoin is the native gas token let us hide the blockchain completely. Netting makes it compound — as more people send, more transfers cancel out before money leaves the network, so it gets cheaper the more it's used. The infrastructure to make money feel like money — local, instant, gasless, one readable fee — is finally here, and nobody is building it consumer-first for the Global South. That's the gap we're taking.

**Technologies you're using / integrating**
> - **Solana / Anchor** — settlement spoke over Circle CCTP V2, a parimutuel prediction-market program, and a native SVM realized-rate oracle (tested in LiteSVM)
> - **EVM (Solidity + Foundry)** — IntentMatcher (P2P netting), RealizedRateOracle, ERC-4337 VerifyingPaymaster, PredictionMarket — live on Arc, Arbitrum and Base
> - **Cross-chain** — Circle CCTP V2 and Hyperbridge
> - **Wallets / auth** — Privy embedded smart wallets, ERC-4337 gasless account abstraction
> - **App** — Next.js 15, TypeScript, viem
> - **AI** — an LLM money agent via OpenRouter (DeepSeek) that turns plain language into on-chain settlement; built with Claude Code
> - **Off-ramp** — cNGN plus Paystack / Flutterwave adapters
> - **Infra** — self-hosted on DigitalOcean, Dockerized CI to GHCR

**Which chains** — Solana, Arbitrum, Base, and Arc (via "Other"). Deselect Ethereum L1 unless you want to claim the CCTP Ethereum route.

**How does your product use these chains?** (≤500)
> Solana runs a settlement spoke (CCTP V2 burn/mint into the reserve) and a parimutuel prediction-market Anchor program, plus a native SVM realized-rate oracle. Arbitrum is the unified-liquidity hub. Arc (USDC as native gas) hosts the live corridors — IntentMatcher netting, the oracle and a gasless paymaster for cNGN/cGHS/cKES. Base is an additional EVM venue. Value moves between them over Circle CCTP V2 and Hyperbridge, so users always send and receive in local currency.

**Category** — FinTech · **Mobile-focused dApp** — Yes · **Team based** — Nigeria
**Team Telegram** — `[YOUR INPUT]` · **X profile** — `[YOUR INPUT: @jorshimayor]`

---

## Media & code
- **Live product link** — `https://app.pesarc.xyz`
- **Access instructions** — "Sign in with Google; runs in demo mode without funds and live on Arc mainnet."
- **GitHub** — link the repo containing your Solana program (the hackathon code). If private, email a judge invite to hackathon@colosseum.com.
- **Demo video** (≤3 min) + **Pitch video** (≤2 min) — use the shot list in `DEMO_VIDEO.md`.
- **Project logo** — `[YOUR INPUT: upload]`

---

## Accelerator (private)

**How do you know people actually need this?** (≤1000)
> 8%+ remittance fees and dollar-quoted FX are a daily tax on our markets; people already move money informally over WhatsApp and P2P because banks are slow and expensive. We're building the rails they're improvising around — local currency, seconds, one fee.

**How far along are you? Users?** (≤1000)
> Live app at app.pesarc.xyz; contracts deployed and verifiable on Arc mainnet (netting, oracle, gasless paymaster, three seeded corridors), plus Base/Arbitrum Sepolia and a Solana program. AI agent executes real sends. Pre-launch, onboarding beta users; Nigeria CAC registration in progress.

**Who else is building here, and what do they get wrong?** (≤1000)
> Banks/remittance apps: slow, dollar-first, opaque fees. Crypto wallets: seed phrases, gas, jargon. Other African fintechs: single-rail, custodial. They all make people think in dollars; we keep everything in local currency and hide the chain entirely.

**How do you make money?** (≤500)
> We own the local-currency FX leg (our own corridors/pools), capturing the spread instead of renting it, plus a small transparent per-transfer fee and a developer/checkout platform.

**Where have you worked or built before?** (≤1000)
> I'm a blockchain engineer, security researcher and technical writer. Most relevant to Pesarc: I build AI + Web3 systems and ship production dApps. At OnchainSuite (a Web3 retention & communication layer) I built the audience-intelligence side — per-chain enrichment, behavioral segments from chat, and the analytics UX that turns on-chain activity into usable signals. I built OpenClaw, a multi-agent AI system — 8 specialised agents in an 11-step deterministic pipeline with cross-provider LLM routing/fallback and MCP integrations — the exact orchestration skill behind Pesarc's money agent. I've shipped a POAP ticketing dApp, Mindnest / Mind Vault (a zero-knowledge privacy journaling app on Midnight), fieldtilt (a football-intelligence platform with LLM content), and Kaia NFT fractionalization. On security I've done exploit post-mortems (e.g. the UPS token burn-mechanism hack) and I run Solana/Ethereum validator and RPC infrastructure. Pesarc combines all of it — smart contracts, AI agents, and consumer Web3 — aimed at my own market.

**Most impressive thing built outside this project** (≤500)
> OpenClaw: a production multi-agent AI system — 8 specialised agents orchestrated through an 11-step deterministic pipeline, with LLM routing/fallback across providers and 5 MCP integrations — generating football content end to end. Getting many agents to cooperate reliably is exactly what makes an AI agent safe to trust with money, and it's why Pesarc's agent works.

**You could be working on anything — why choose this?** (≤1000)
> Because it's my own problem, and a real one. I'm Nigerian; everyone around me is taxed by dollar-quoted FX, 8%+ remittance fees, and "crypto" that demands gas and seed phrases. I've spent years building Web3 tools and AI agents, and for the first time the pieces exist — regulated local stablecoins, account abstraction, chains where the stablecoin is the gas token — to make money finally feel like money for the Global South. I don't want to build another marketing tool or NFT app; I want the thing my mum could actually use to send money home.

**Are you a technical founder?** — Yes

**Technical background** (≤600)
> I'm the technical founder and build the whole stack. Contracts: Solidity + Foundry (netting, realized-rate oracle, ERC-4337 paymaster, prediction market) and Anchor on Solana (CCTP spoke, SVM oracle, parimutuel market). App: Next.js / TypeScript / viem. AI: LLM agent orchestration (OpenRouter/DeepSeek), building on prior multi-agent systems. Also a blockchain security researcher (exploit post-mortems) and infra operator (Solana/Ethereum validators, RPC, self-hosted deploys). On Pesarc I wrote the contracts, the app, the agent and the deploy pipeline.

### Fields only you can fill
- **Educational background** (≤500) — `[YOUR INPUT: degree, university, year]`. Frame: "…; largely self-taught in blockchain, from technical writing and validator ops into smart-contract engineering and AI, shipping 30+ projects across EVM and Solana."
- **Time on this / full-time** — `[YOUR INPUT]`. e.g. "Building since [date]; going full-time after the hackathon / on first funding."
- **Extreme lengths story** (≤500) — `[YOUR INPUT]`. Fallback: "I took Pesarc's full EVM+SVM stack, AI agent and app live on Arc mainnet largely solo within the hackathon window — deploying the paymaster and seeding corridors on-chain, self-hosting the whole thing."
- **Equity %** — `[YOUR INPUT]` (you drafted 30%; if sole founder it's likely higher).
- **Legal entity** — No (Nigeria CAC registration in progress) · **Investment** — No · **Fundraising** — No · **Live token** — No
- **Looking for a cofounder?** — `[YOUR INPUT]` (as a solo technical founder, "open to a business/GTM cofounder" if true).
- **Where is each team member based / in-person?** — `[YOUR INPUT]` (Nigeria; solo or list team).
