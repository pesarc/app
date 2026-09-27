# What sets Pesarc apart

A single source of truth for pitches (VCs, hackathon judges) and landing-page
copy. Two lenses: the marketing angle (why people and investors care) and the
technical / infra angle (why it is defensible). Everything here is true of what
we have built, not roadmap.

Positioning line: **Pesarc is the settlement layer for the Global South. Send,
hold, earn and invest in your own currency, in seconds, for a fee you can
actually read.**

---

## Marketing angle (people + investors)

1. **Local currency first, not dollars.** Everyone else makes Africans think in
   USD. Pesarc lets people send, hold and spend in naira, cedis and shillings.
   The dollar rail is plumbing the user never sees.

2. **The Mum Test.** No seed phrases, no gas, no jargon, no "connect wallet"
   unless you want it. If your mum can send money on WhatsApp, she can use
   Pesarc. That is the product bar, and it is rare in this space.

3. **One product, three front doors.** The same money network reaches a
   smartphone app, a WhatsApp agent, and USSD on a feature phone. Competitors
   pick one. We meet people where they already are, including the billions
   without a modern smartphone.

4. **Just ask.** An AI agent moves money in plain language ("send 50k to Ama in
   Accra", "pay my electricity bill") in the app or on WhatsApp. It is the same
   brain everywhere, so the simplest interface is also the most powerful.

5. **Your money stays yours.** Non-custodial by default. Pesarc never holds the
   balance, so there is nothing to freeze, lose or run off with. Trust without
   asking for trust.

6. **Seconds, and a fee you can read.** Money sent from Lagos lands in Accra in
   seconds, with one clear fee shown before you confirm, and the recipient
   amount quoted up front. No surprise deductions at the other end.

7. **A full money life, not one feature.** Send, hold, earn, invest in real
   companies, and take a view on local events, from one balance. Remittance is
   the wedge, not the ceiling.

### One-liners for the deck
- "Stripe-simple money for the Global South, settled on-chain, spoken in local
  currency."
- "We hid the blockchain so well your grandmother can use it."
- "The first money app that works on a feature phone and a smart contract."

---

## Technical / infra angle (judges + technical investors)

1. **Native EVM + SVM settlement, one network.** We settle across Ethereum,
   Base, Arc, Celo, Arbitrum, Optimism, Polygon, Solana and Algorand from one
   registry-driven core, not a single-chain toy. Cross-chain value moves over
   CCTP and Hyperbridge.

2. **Intent netting, not just swaps.** Transfers become stablecoin intents that
   our solver nets against each other (ring and pair netting), so most value
   never touches an external rail. That is what makes settlement both fast and
   cheap, and it compounds as volume grows (a real liquidity moat).

3. **Realized-rate oracle.** The recipient amount is quoted from an on-chain
   realized-rate oracle before the user confirms, so quotes are honest and
   verifiable, not a black-box spread.

4. **Gasless, account-abstracted wallets.** ERC-4337 smart accounts with
   paymaster sponsorship (a one-key gasless path plus our own verifying
   paymaster) mean users never hold or spend a network token. Onboarding has no
   "go buy gas" cliff.

5. **We own the local-currency leg.** Local stablecoin corridors (cNGN, cGHS,
   cKES) and the liquidity pools behind them are ours to deepen, so we capture
   the FX spread instead of renting it. Vertical integration where it matters.

6. **Channel-agnostic agent core.** The settlement + agent logic
   (`runSettlementTurn`) is a reusable core with thin adapters for web, WhatsApp
   (Meta Cloud API), USSD and MiniPay. New channels are adapters, not rewrites.

7. **A real developer platform.** A small REST API and hosted checkout let any
   SaaS or store take stablecoin-settled payments in local currency, with
   webhooks and API keys. We are infrastructure others can build on, not a
   closed app.

8. **Portable, self-hostable stack.** The whole app is a standard OCI image plus
   Postgres, deployed on our own droplet with one `git push` (CI builds and
   restarts). No lock-in to a single cloud, and unit economics we control.

9. **Own auth for the Global South.** Login is being built to own the phone
   channel (global OTP via an Africa-native provider, bridged to embedded
   wallets), instead of inheriting a US-centric auth vendor's coverage gaps.

### Defensibility summary
- **Liquidity moat:** netting + owned local pools get cheaper as we scale.
- **Distribution moat:** app + WhatsApp + USSD reaches users no single-channel
  rival can.
- **UX moat:** the Mum Test is a discipline, not a feature, and it is hard to
  retrofit.
- **Platform moat:** a developer API turns integrators into a distribution
  flywheel.

---

## Quick contrasts (use sparingly, know your audience)
- **vs. bank / traditional remittance (Wise, WorldRemit):** seconds not days,
  local currency not a dollar account, one readable fee not a hidden spread.
- **vs. African fintech apps (custodial wallets):** non-custodial, on-chain and
  transparent, plus USSD + agent reach and a developer platform.
- **vs. crypto exchanges:** no jargon, no gas, no seed phrase, framed in the
  money people actually think in.
- **vs. Polymarket:** local events, local currency, inside a money app people
  already use.
