// Agent smoke test: run 20 prompts (4 per scenario) through the agent in PREVIEW
// mode against Arc testnet. Preview parses + prices + drafts but never executes,
// so this is safe. Bills and market creation don't need the LLM; transfers use
// it (LLM_API_KEY comes from --env-file). Run:
//   npx --yes tsx --env-file=apps/web/.env.local scripts/test-agent.ts

// Force Arc TESTNET (no real funds) and give the registry the testnet stack
// BEFORE importing the agent (the registry reads these at module load).
process.env.NEXT_PUBLIC_ACTIVE_CHAIN = "arc-testnet";
process.env.NEXT_PUBLIC_PREFER_MAINNET = "";
Object.assign(process.env, {
  NEXT_PUBLIC_ARC_TESTNET_PREDICTION_MARKET: "0x12183902bE7447a8eBFF137E05eF3C9f88D5046C",
  NEXT_PUBLIC_ARC_TESTNET_REALIZED_ORACLE: "0xbE83f14e435b7D7f8a6F9F572d60E3B84E3bF397",
  NEXT_PUBLIC_ARC_TESTNET_INTENT_MATCHER: "0x9552206455D5E1c1F86A0c8cEB72AbA4A6D73e7c",
  NEXT_PUBLIC_ARC_TESTNET_TOKEN_NGN: "0x6BC90a559C427a7f5CB2ef1935d3d413a7E20775",
  NEXT_PUBLIC_ARC_TESTNET_TOKEN_GHS: "0x8Ee08E02dEE1DA7a0ebFebB2A14F3158A742aA2f",
  NEXT_PUBLIC_ARC_TESTNET_TOKEN_KES: "0xAe5493E713991691075E2daBBFFD61aB66dBFb22",
  NEXT_PUBLIC_ARC_TESTNET_TOKEN_USD: "0x3600000000000000000000000000000000000000",
});

type Case = { scenario: string; prompt: string; expect: string };

const CASES: Case[] = [
  // 1) Cross-border transfer / settlement
  { scenario: "transfer", prompt: "Send 50,000 naira to Ghana", expect: "draft:transfer" },
  { scenario: "transfer", prompt: "Move 20000 cedis to Kenya", expect: "draft:transfer" },
  { scenario: "transfer", prompt: "Send 100000 naira, they get cedis", expect: "draft:transfer" },
  { scenario: "transfer", prompt: "Settle 30000 shillings into naira", expect: "draft:transfer" },
  // 2) Airtime
  { scenario: "airtime", prompt: "Buy 1000 naira MTN airtime for 08031234567", expect: "draft:bill" },
  { scenario: "airtime", prompt: "Top up 500 Airtel airtime 07012345678", expect: "draft:bill" },
  { scenario: "airtime", prompt: "Recharge 2000 Glo for 08151234567", expect: "draft:bill" },
  { scenario: "airtime", prompt: "1500 9mobile airtime to 09011112222", expect: "draft:bill" },
  // 3) Data
  { scenario: "data", prompt: "Buy 1GB MTN data for 08031234567", expect: "draft:bill" },
  { scenario: "data", prompt: "Get 2GB Airtel data for 07012345678", expect: "draft:bill" },
  { scenario: "data", prompt: "500MB Glo data for 08151234567", expect: "draft:bill" },
  { scenario: "data", prompt: "Buy 5GB MTN data 08099998888", expect: "draft:bill" },
  // 4) Electricity
  { scenario: "electricity", prompt: "Pay 5000 Ikeja electricity meter 04123456789", expect: "draft:bill" },
  { scenario: "electricity", prompt: "Buy 3000 Eko electric token meter 12345678901", expect: "draft:bill" },
  { scenario: "electricity", prompt: "Pay 10000 Abuja electricity meter 55501234567", expect: "draft:bill" },
  { scenario: "electricity", prompt: "2000 Port Harcourt electricity meter 99988877766", expect: "draft:bill" },
  // 5) Prediction market (executes immediately, no money moves)
  { scenario: "market", prompt: "Create a market: will USD/NGN cross 2000 by June?", expect: "createdMarket" },
  { scenario: "market", prompt: "Make a market: will Nigeria inflation exceed 30% in December?", expect: "createdMarket" },
  { scenario: "market", prompt: "New market: will Bitcoin hit 150k by year end?", expect: "createdMarket" },
  { scenario: "market", prompt: "Create a yes/no market on whether petrol exceeds 1000 naira per litre", expect: "createdMarket" },
];

function outcome(r: any): string {
  if (r.draft) return `draft:${r.draft.type}`;
  if (r.createdMarket) return "createdMarket";
  if (r.billPaid) return "billPaid";
  if (r.needsInput) return "needsInput";
  if (r.ok) return "ok";
  return "error";
}

async function main() {
  const { runAgentTurn } = await import("../packages/sdk/src/agent/run.ts");
  const { activeChain } = await import("../packages/sdk/src/chain/registry.ts");
  console.log(`Active chain: ${activeChain().label} (${activeChain().key})`);
  console.log(`LLM configured: ${Boolean(process.env.LLM_API_KEY)}\n`);

  const byScenario: Record<string, { pass: number; total: number }> = {};
  let n = 0;
  for (const c of CASES) {
    n++;
    let got = "error";
    let reply = "";
    try {
      const r: any = await runAgentTurn(c.prompt, "test:+2348000000000", { preview: true });
      got = outcome(r);
      reply = (r.reply || "").replace(/\s+/g, " ").slice(0, 96);
    } catch (e) {
      reply = e instanceof Error ? e.message.slice(0, 96) : "threw";
    }
    const ok = got === c.expect;
    const s = (byScenario[c.scenario] ??= { pass: 0, total: 0 });
    s.total++;
    if (ok) s.pass++;
    console.log(`${String(n).padStart(2)}. [${ok ? "PASS" : "FAIL"}] ${c.scenario.padEnd(11)} "${c.prompt}"`);
    console.log(`     -> ${got}${ok ? "" : ` (expected ${c.expect})`} | ${reply}`);
  }

  console.log("\n=== per scenario ===");
  for (const [k, v] of Object.entries(byScenario)) console.log(`  ${k.padEnd(12)} ${v.pass}/${v.total}`);
  const pass = Object.values(byScenario).reduce((a, v) => a + v.pass, 0);
  console.log(`  TOTAL        ${pass}/${CASES.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
