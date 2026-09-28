# Pesarc — Arc submission demo video (shot list)

Target: ~2.5–3 min, screen recording with voiceover. Everything works in demo
mode today; for the mainnet-live cut, run `DEPLOY_TOMORROW.md` first. The story:
**money the way you already think about it, settled on Arc, no dollar in the path.**

## Before you hit record
- [ ] Deploy infra live (paymaster + 3 corridors): `BROADCAST=1 bash contracts/evm/deploy-arc-submission.sh`, then set `NEXT_PUBLIC_INHOUSE_PAYMASTER_ADDRESS` to the printed address.
- [ ] `LLM_API_KEY` (your OpenRouter `sk-or-…`) set so the agent **executes**, not just replies.
- [ ] Fund the agent signer `0x6eC22b2906Eb9164626A5Df9F46Ad86756025cb3` with ~0.3 USDC, and your smart wallet with ~1 USDC (tiny sends).
- [ ] Sign in once beforehand so the wallet exists; clear the agent chat for a clean start.
- [ ] Use **small amounts** on-screen (₦500–₦1,000) — genuinely live, costs cents.

## Scenes

**0. Hook (0:00–0:15).** Landing page, scroll the "Why it holds up" story once.
> "Pesarc is a money app for the Global South. Send, hold, earn and invest in
> your own currency, in seconds. Underneath, it settles on Arc, where USDC is the
> gas token, so there's no dollar in the path the user ever sees."

**1. Sign in (0:15–0:30).** Click Open App → sign in with Google (Privy).
> "One tap with Google. No seed phrase, no 'connect wallet'. A smart wallet is
> created for you on Arc." — show the wallet address / balance header.

**2. The agent sends money (0:30–1:05).** Open Agent. Type *"Send ₦1,000 to Ama in
Accra."* The agent confirms the corridor and asks bank vs contact; pick contact.
> "I just ask, in plain language. It nets the transfer peer-to-peer through our
> IntentMatcher and settles in cedis. Watch — gasless, and here's the Arc tx."
Show "Matched peer-to-peer" + the on-chain link. **Bonus:** attach a small CSV and
show it draft a bulk payout ("read + draft only, I confirm each").

**3. A normal transfer (1:05–1:25).** Open Send. Pick a contact, enter ₦1,000,
show the one-number quote ("you send, they get"), confirm.
> "The same thing by hand: one clear fee, the recipient amount fixed before I
> press send, settled in seconds."

**4. Create a market + hedge (1:25–1:55).** Markets → Propose. Create *"Will
USD/NGN cross ₦2,000 by December?"* Then back Yes with ₦1,000.
> "Anyone can spin up a market. I'll hedge the naira here — this pays out in my
> own currency if the rate moves, gaslessly, on Arc." Show the tx.

**5. Earn + buy a stock (1:55–2:20).** Earn: add to a corridor position (show the
yield). Invest: buy a few shares of a Global-South stock.
> "Put idle balance to work on a corridor, and buy real companies — quoted and
> settled in cNGN, not dollars."

**6. Cash out (2:20–2:40).** Send/Withdraw → bank. Pick the bank (name resolves),
confirm a small payout, show it move to "paid".
> "And out to any Nigerian bank. On-chain in, fiat out, one flow."

**7. Close (2:40–2:55).** Back to the wallet / a settled-activity list.
> "Send, hold, earn, invest, hedge and cash out — in your own money, on Arc, with
> nothing to learn. That's Pesarc."

## What to emphasise for judges (Arc-native)
- USDC is the **native gas token** on Arc; users never buy or hold a gas coin.
- **Gasless** ERC-4337 with our own verifying paymaster on Arc (no third party).
- **On-chain settlement**: IntentMatcher P2P netting + a realized-rate oracle,
  live at the addresses in `CORRIDORS_ROADMAP.md` (chain `5042`).
- **No dollar in the path**: the user sends/receives naira, cedis, shillings; the
  USDC leg is plumbing.

## If a step misbehaves on the day
- Agent only replies (doesn't execute): `LLM_API_KEY` unset, or agent signer
  unfunded.
- "Indicative" quote instead of live: that corridor's oracle rate isn't seeded —
  rerun its `DeployCorridor` (Step 2).
- Send fails on gas: paymaster not deployed/funded, or
  `NEXT_PUBLIC_INHOUSE_PAYMASTER_ADDRESS` doesn't match the deployed address.
- Cash-out stays "initiated": expected in sandbox; it advances to "paid" on the
  simulated timeline (or set `PAYSTACK_SECRET_KEY`/`CNGN_*` for a real test payout).
