# Agents at Work — submission readiness

Facts below are read from the organiser's API, not from the landing page:
`GET https://celobuilders.xyz/hackathons` and
`GET https://celobuilders.xyz/hackathons/agents-at-work/submission-fields`.

| | |
| --- | --- |
| Slug | `agents-at-work` |
| Window | 2026-08-28T00:00Z to 2026-09-21T09:00Z |
| Submission deadline | **2026-09-21T09:00Z** |
| Prize pool | $5,000, paid in CELO |

## Registration fields (all `requiredAt: registration`)

| Field | Required | Note |
| --- | --- | --- |
| `telegram` | yes | personal `@handle`, not a group |
| `primaryTrack` | yes | one of `value-moved`, `real-world-adoption`, `askbots-growth`, `judges-favorite`, `cpay-feedback` |
| `erc8004Url` | yes | 8004scan.io or celoscan.io link to the agent's ERC-8004 identity |
| `agentWalletAddress` | yes | the **Celo mainnet** address the agent transacts from |
| `country` | no | reporting only |
| `cpayBetaOptIn` | no | required to enter the buy feedback track |
| `askbotsProjectUrl` | conditional | required when `primaryTrack` is `askbots-growth` |
| `reviewerAgentWallets` | no | only if running a reviewer agent |

Registration returns an `attributionTag` of the form `celo_` + 12 hex chars.

## The two rules that decide whether anything counts

**Celo mainnet only.** Testnet activity is worth nothing in every track. This
repo previously pinned the Celo stack to Celo Sepolia. It is now selectable via
`NEXT_PUBLIC_CELO_NETWORK`, which must be set to `mainnet` to score.

**The attribution tag cannot be backfilled.** It lives in the transaction's
calldata, so it has to be present when the transaction is sent. Every Celo write
path in this repo appends it:

| Path | Tagged |
| --- | --- |
| `packages/sdk/src/celo/solver.ts` (`sendTagged`) | yes, already |
| `packages/sdk/src/agent-pay.ts` (`agentSessionPay`) | yes, as of this branch |

Set `NEXT_PUBLIC_CELO_ATTRIBUTION_TAG` to the assigned tag before the agent
sends anything. `celoScoringStatus()` reports whether the current build can
score, and why not when it cannot.

## Environment for a scoring build

```bash
NEXT_PUBLIC_CELO_NETWORK=mainnet
NEXT_PUBLIC_CELO_MAINNET_RPC_URL=https://forno.celo.org
NEXT_PUBLIC_CELO_ATTRIBUTION_TAG=celo_xxxxxxxxxxxx
NEXT_PUBLIC_CELO_MAINNET_INTENT_MATCHER=0x...
NEXT_PUBLIC_CELO_MAINNET_REALIZED_ORACLE=0x...
NEXT_PUBLIC_CELO_MAINNET_AGENT_SESSION_KEYS=0x...
NEXT_PUBLIC_CELO_MAINNET_TOKEN_NGN=0x...
NEXT_PUBLIC_CELO_MAINNET_TOKEN_GHS=0x...
NEXT_PUBLIC_CELO_MAINNET_TOKEN_KES=0x...
```

`celoAgentReady()` needs `intentMatcher` plus at least two token addresses.

## Still blocked on a human

These need key custody or account creation and cannot be automated here:

1. Mint the ERC-8004 agent identity on Celo mainnet and keep the agent id.
2. Fund a Celo mainnet agent wallet.
3. Register through the Celo Builders skill and capture the attribution tag.
4. Deploy the contract suite to Celo mainnet and record the addresses.
5. Publish the X post tagging @CeloDevs and @Celo.

## Track feasibility, honestly

`value-moved` and `real-world-adoption` score volume and users from wallets that
are independent of yours and were already active on Celo before 28 August. With
no mainnet deployment yet, neither is reachable.

`askbots-growth` scores the gap between a round-one baseline taken early and a
round two run on 19-20 September, both at 10+ reviews, with round two at 5.0 or
better. No round-one baseline exists, so there is nothing to measure a gap from.

`judges-favorite` is the reachable one: most innovative use of Celo primitives
with a real distribution channel, picked by the panel. Fee abstraction and Self
proof-of-personhood are called out as what draws a judge's attention.
