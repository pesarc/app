import { NextResponse } from "next/server";
import { hexToBigInt, type Address, type Hex } from "viem";
import { ARC_MAINNET_ID } from "@pesarc/sdk/chain/chains";
import { storeRateLimit } from "@pesarc/sdk/api/rate-limit-store";
import {
  signSponsorship,
  encodePaymasterData,
  STUB_SIGNATURE,
} from "@pesarc/sdk/paymaster/verifying";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The in-house ERC-7677 paymaster service (getPaymasterStubData / getPaymasterData).
// Enabled only when the signer key + deployed paymaster address are configured;
// otherwise it reports "not configured" so the seam can fall back (Circle). Only
// sponsors Arc, and only within a per-op fee ceiling + per-sender rate limit.
//
// AUDIT + on-chain integration test REQUIRED before Arc mainnet.
const PAYMASTER = (process.env.NEXT_PUBLIC_INHOUSE_PAYMASTER_ADDRESS || "") as Address | "";
const SIGNER_PK = (process.env.INHOUSE_PAYMASTER_PK || "") as Hex | "";
// Refuse to sponsor an op whose maxFeePerGas exceeds this ceiling (wei).
const MAX_FEE_WEI = BigInt(process.env.INHOUSE_PAYMASTER_MAX_FEE_WEI || "50000000000"); // 50 gwei
const VERIFICATION_GAS = "0x186a0"; // 100000
const POSTOP_GAS = "0xc350"; // 50000

function ok(id: unknown, result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id, result });
}
function err(id: unknown, code: number, message: string, status = 200) {
  return NextResponse.json({ jsonrpc: "2.0", id, error: { code, message } }, { status });
}

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return err(null, -32700, "Parse error");
  }
  const { id, method, params } = body ?? {};

  if (!PAYMASTER || !SIGNER_PK) {
    return err(id, -32000, "In-house paymaster is not configured on this deployment.");
  }
  if (method !== "pm_getPaymasterStubData" && method !== "pm_getPaymasterData") {
    return err(id, -32601, "Method not found");
  }

  // ERC-7677: params = [userOp, entryPoint, chainId, context?]
  const userOp = params?.[0];
  const chainId = Number(params?.[2] ?? 0) || parseIntHex(params?.[2]);
  if (!userOp || !userOp.sender) return err(id, -32602, "Invalid params: userOp");
  if (chainId !== ARC_MAINNET_ID) {
    return err(id, -32001, "This paymaster only sponsors Arc.");
  }

  const maxFeePerGas = safeBig(userOp.maxFeePerGas);
  if (maxFeePerGas > MAX_FEE_WEI) {
    return err(id, -32002, "Fee exceeds the sponsorship ceiling.");
  }

  // Stub: return a well-formed dummy so the bundler can estimate gas.
  if (method === "pm_getPaymasterStubData") {
    return ok(id, {
      paymaster: PAYMASTER,
      paymasterData: encodePaymasterData(0, 0, STUB_SIGNATURE),
      paymasterVerificationGasLimit: VERIFICATION_GAS,
      paymasterPostOpGasLimit: POSTOP_GAS,
      isFinal: false,
    });
  }

  // Final: policy (per-sender rate limit) + sign.
  const limited = await storeRateLimit(`pm:${String(userOp.sender).toLowerCase()}`, 60, 60_000);
  if (limited) return err(id, -32003, "Too many sponsorship requests for this account.");

  try {
    const signed = await signSponsorship({
      userOp: {
        sender: userOp.sender as Address,
        nonce: safeBig(userOp.nonce),
        callData: (userOp.callData ?? "0x") as Hex,
        maxFeePerGas,
        maxPriorityFeePerGas: safeBig(userOp.maxPriorityFeePerGas),
      },
      chainId,
      paymaster: PAYMASTER as Address,
      signerPk: SIGNER_PK as Hex,
    });
    return ok(id, {
      paymaster: PAYMASTER,
      paymasterData: signed.paymasterData,
      paymasterVerificationGasLimit: VERIFICATION_GAS,
      paymasterPostOpGasLimit: POSTOP_GAS,
    });
  } catch {
    return err(id, -32004, "Could not sign sponsorship.");
  }
}

function safeBig(v: unknown): bigint {
  if (typeof v === "bigint") return v;
  if (typeof v === "string") {
    try {
      return v.startsWith("0x") ? hexToBigInt(v as Hex) : BigInt(v);
    } catch {
      return 0n;
    }
  }
  if (typeof v === "number") return BigInt(v);
  return 0n;
}

function parseIntHex(v: unknown): number {
  if (typeof v === "string" && v.startsWith("0x")) return Number(hexToBigInt(v as Hex));
  return 0;
}
