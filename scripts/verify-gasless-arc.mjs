// Prove OUR gasless infra works on Arc MAINNET: a real ERC-4337 UserOperation
// sponsored by our own VerifyingPaymaster (funded by us), bundled via Pimlico
// (free relay, no sponsorship policy). We sign the sponsorship in-process with
// the paymaster's verifyingSigner key — exactly what /api/paymaster does — so
// this exercises the same trust path end to end.
//
// PASS criteria:
//   - the UserOp lands on-chain (receipt.success === true), AND
//   - the throwaway smart-account owner EOA was NEVER funded (0 balance), AND
//   - the paymaster's EntryPoint deposit DECREASED (our paymaster paid the gas).
//
// Run (after DeployPaymaster.s.sol is broadcast):
//   NEXT_PUBLIC_INHOUSE_PAYMASTER_ADDRESS=0x... \
//   INHOUSE_PAYMASTER_PK=0x... \
//   NEXT_PUBLIC_PIMLICO_API_KEY=pim_... \
//   node scripts/verify-gasless-arc.mjs
//
// Env falls back to apps/web/.env.local when the vars are not already exported.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPublicClient,
  createWalletClient,
  http,
  encodeAbiParameters,
  keccak256,
  hashMessage,
  defineChain,
} from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { createBundlerClient, toPackedUserOperation } from "viem/account-abstraction";
import { toSimpleSmartAccount } from "permissionless/accounts";

// --- env (prefer process.env, else apps/web/.env.local) ------------------------
const __dir = path.dirname(fileURLToPath(import.meta.url));
function loadEnvLocal() {
  const p = path.join(__dir, "..", "apps", "web", ".env.local");
  const out = {};
  try {
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
      if (m) out[m[1]] = m[2];
    }
  } catch {}
  return out;
}
const FILE_ENV = loadEnvLocal();
const env = (k) => process.env[k] || FILE_ENV[k] || "";

const PAYMASTER = env("NEXT_PUBLIC_INHOUSE_PAYMASTER_ADDRESS");
const SIGNER_PK = env("INHOUSE_PAYMASTER_PK");
const PIMLICO_KEY = env("NEXT_PUBLIC_PIMLICO_API_KEY");
const RPC = env("NEXT_PUBLIC_ARC_RPC_URL") || "https://rpc.mainnet.arc.io";
const CHAIN_ID = 5042;
const ENTRY_POINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

if (!PAYMASTER || !SIGNER_PK || !PIMLICO_KEY) {
  console.error("Missing env: need NEXT_PUBLIC_INHOUSE_PAYMASTER_ADDRESS, INHOUSE_PAYMASTER_PK, NEXT_PUBLIC_PIMLICO_API_KEY");
  process.exit(1);
}

const arc = defineChain({
  id: CHAIN_ID,
  name: "Arc",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});
const bundlerUrl = `https://api.pimlico.io/v2/${CHAIN_ID}/rpc?apikey=${PIMLICO_KEY}`;

// --- sponsorship signing (mirrors sdk/paymaster/verifying.ts + contract getHash) -
const signerAccount = privateKeyToAccount(SIGNER_PK.startsWith("0x") ? SIGNER_PK : `0x${SIGNER_PK}`);

function getSponsorHash(op, validUntil, validAfter) {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "address" }, // sender
        { type: "uint256" }, // nonce
        { type: "bytes32" }, // keccak(callData)
        { type: "uint256" }, // maxFeePerGas
        { type: "uint256" }, // maxPriorityFeePerGas
        { type: "uint48" },  // validUntil
        { type: "uint48" },  // validAfter
        { type: "uint256" }, // chainid
        { type: "address" }, // paymaster
      ],
      [
        op.sender,
        op.nonce,
        keccak256(op.callData),
        op.maxFeePerGas,
        op.maxPriorityFeePerGas,
        validUntil,
        validAfter,
        BigInt(CHAIN_ID),
        PAYMASTER,
      ],
    ),
  );
}

function encodePaymasterData(sig, validUntil, validAfter) {
  const u48 = (n) => n.toString(16).padStart(12, "0");
  return `0x${u48(validUntil)}${u48(validAfter)}${sig.slice(2)}`;
}

async function signSponsorship(op) {
  const now = Math.floor(Date.now() / 1000);
  const validAfter = 0;
  const validUntil = now + 3600;
  const hash = getSponsorHash(op, validUntil, validAfter);
  const signature = await signerAccount.sign({ hash: hashMessage({ raw: hash }) });
  return { paymasterData: encodePaymasterData(signature, validUntil, validAfter), validUntil, validAfter };
}

// A viem paymaster that speaks the in-house signing (no /api server needed).
const STUB_SIG = `0x${"fc".repeat(65)}`;
const inhousePaymaster = {
  async getPaymasterStubData() {
    return {
      paymaster: PAYMASTER,
      paymasterData: encodePaymasterData(STUB_SIG, 0xffffffffffff, 0),
      paymasterVerificationGasLimit: 80000n,
      paymasterPostOpGasLimit: 20000n,
    };
  },
  async getPaymasterData(params) {
    const { paymasterData } = await signSponsorship({
      sender: params.sender,
      nonce: params.nonce,
      callData: params.callData,
      maxFeePerGas: params.maxFeePerGas,
      maxPriorityFeePerGas: params.maxPriorityFeePerGas,
    });
    return {
      paymaster: PAYMASTER,
      paymasterData,
      paymasterVerificationGasLimit: 80000n,
      paymasterPostOpGasLimit: 20000n,
    };
  },
};

// EntryPoint deposit read (balanceOf) — proves OUR paymaster paid.
const EP_ABI = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
];

async function main() {
  const publicClient = createPublicClient({ chain: arc, transport: http(RPC) });

  // Throwaway owner — never funded. If the send works, gas came from the paymaster.
  const owner = privateKeyToAccount(generatePrivateKey());
  const account = await toSimpleSmartAccount({
    client: publicClient,
    owner,
    entryPoint: { address: ENTRY_POINT, version: "0.7" },
  });

  const ownerBal = await publicClient.getBalance({ address: owner.address });
  const depositBefore = await publicClient.readContract({ address: ENTRY_POINT, abi: EP_ABI, functionName: "balanceOf", args: [PAYMASTER] });

  console.log("paymaster:", PAYMASTER, "signer:", signerAccount.address);
  console.log("smart account:", account.address, "(counterfactual, will deploy on this op)");
  console.log("owner EOA balance:", ownerBal.toString(), "(must be 0)");
  console.log("paymaster deposit before:", depositBefore.toString());

  const bundler = createBundlerClient({
    account,
    client: publicClient,
    transport: http(bundlerUrl),
    paymaster: inhousePaymaster,
  });

  // A harmless no-op call: send 0 value to self, empty calldata.
  const hash = await bundler.sendUserOperation({
    calls: [{ to: account.address, value: 0n, data: "0x" }],
  });
  console.log("userOpHash:", hash);
  const receipt = await bundler.waitForUserOperationReceipt({ hash });

  const depositAfter = await publicClient.readContract({ address: ENTRY_POINT, abi: EP_ABI, functionName: "balanceOf", args: [PAYMASTER] });
  const ownerBalAfter = await publicClient.getBalance({ address: owner.address });

  console.log("tx:", receipt.receipt.transactionHash);
  console.log("success:", receipt.success);
  console.log("owner EOA balance after:", ownerBalAfter.toString(), "(still 0 = never paid)");
  console.log(`paymaster deposit: ${depositBefore} -> ${depositAfter} (Δ -${depositBefore - depositAfter})`);

  const pass = receipt.success === true && ownerBalAfter === 0n && depositAfter < depositBefore;
  console.log("GASLESS_INHOUSE_OK:", pass);
  if (!pass) process.exit(1);
}

main().catch((e) => { console.error("FAILED:", e.shortMessage || e.message || e); process.exit(1); });

// Keep the packed-userop import referenced (some viem versions tree-shake types).
void toPackedUserOperation;
void createWalletClient;
