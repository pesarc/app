// The ERC-7677 smart-wallet client for Arc: a viem ERC-4337 bundler client with
// an ERC-7677 paymaster (Circle Paymaster OR our in-house /api/paymaster — same
// interface). Adapts to the app's { sendCalls, waitForCallsStatus } shape so the
// rest of the wallet layer is provider-agnostic.
//
// Wired to Circle's Arc ERC-4337 guide (circlefin/arc-node, docs/erc-4337.md):
// SimpleAccount (permissionless.js) + canonical EntryPoint v0.7. The account
// address is deterministic across chains for the same owner (matches the CCTP
// address). Keeping viem's createBundlerClient + createPaymasterClient means any
// bundler (Pimlico) and any ERC-7677 paymaster (Circle / in-house) drop in.
//
// INTEGRATION NOTE: needs an Arc bundler URL + a paymaster with a funded gas
// vault. Verify against Arc before mainnet — money path.

import { createPublicClient, http, type Chain, type Hex, type LocalAccount } from "viem";
import { createBundlerClient, createPaymasterClient } from "viem/account-abstraction";
import { toSimpleSmartAccount } from "permissionless/accounts";

// Canonical ERC-4337 v0.7 EntryPoint (same CREATE2 address on Arc and every EVM).
const ENTRY_POINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032" as const;

type CallInput = { to: `0x${string}`; value?: bigint; data?: `0x${string}` };

export type Erc7677SmartClient = {
  address: `0x${string}`;
  sendCalls: (args: { calls: CallInput[] }) => Promise<{ id: string }>;
  waitForCallsStatus: (args: { id: string }) => Promise<{
    receipts: { transactionHash: string }[];
  }>;
};

/**
 * Build an ERC-4337 + ERC-7677 smart-wallet client. Async because the smart
 * account is derived from the owner + factory.
 */
export async function buildErc7677Client(opts: {
  signer: LocalAccount;
  chain: Chain;
  bundlerUrl: string;
  paymasterUrl: string;
  /** Paymaster context (e.g. { sponsorshipPolicyId } for Pimlico). */
  paymasterContext?: Record<string, unknown>;
}): Promise<Erc7677SmartClient> {
  const { signer, chain, bundlerUrl, paymasterUrl, paymasterContext } = opts;

  const publicClient = createPublicClient({ chain, transport: http() });

  // Counterfactual SimpleAccount owned by the Privy embedded signer (the account
  // Circle's Arc guide validates). Deterministic address across chains.
  const account = await toSimpleSmartAccount({
    client: publicClient,
    owner: signer,
    entryPoint: { address: ENTRY_POINT, version: "0.7" },
  });

  // ERC-7677 paymaster service (getPaymasterStubData / getPaymasterData).
  const paymaster = createPaymasterClient({ transport: http(paymasterUrl) });

  const bundler = createBundlerClient({
    account,
    client: publicClient,
    transport: http(bundlerUrl),
    paymaster,
    ...(paymasterContext ? { paymasterContext } : {}),
  });

  return {
    address: account.address,
    async sendCalls({ calls }) {
      const hash = await bundler.sendUserOperation({
        calls: calls.map((c) => ({
          to: c.to,
          value: c.value ?? 0n,
          data: (c.data ?? "0x") as Hex,
        })),
      });
      return { id: hash as string };
    },
    async waitForCallsStatus({ id }) {
      const receipt = await bundler.waitForUserOperationReceipt({ hash: id as Hex });
      return { receipts: [{ transactionHash: receipt.receipt.transactionHash }] };
    },
  };
}
