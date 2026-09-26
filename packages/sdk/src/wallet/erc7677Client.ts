// The ERC-7677 smart-wallet client for Arc: a viem ERC-4337 bundler client with
// an ERC-7677 paymaster (Circle Gas Station OR our in-house /api/paymaster —
// same interface). Adapts to the app's { sendCalls, waitForCallsStatus } shape
// so the rest of the wallet layer is provider-agnostic.
//
// INTEGRATION NOTE: needs an Arc bundler URL + a funded paymaster to run, and the
// chosen smart-account factory must be deployed on Arc. Defaults to Coinbase
// Smart Wallet (in viem); if Circle recommends a different account, swap the
// implementation here. Verify against Arc before mainnet — money path.

import { createPublicClient, http, type Chain, type Hex, type LocalAccount } from "viem";
import {
  createBundlerClient,
  createPaymasterClient,
  toCoinbaseSmartAccount,
} from "viem/account-abstraction";

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
}): Promise<Erc7677SmartClient> {
  const { signer, chain, bundlerUrl, paymasterUrl } = opts;

  const publicClient = createPublicClient({ chain, transport: http() });

  // Counterfactual smart account owned by the Privy embedded signer.
  const account = await toCoinbaseSmartAccount({
    client: publicClient,
    owners: [signer],
    version: "1.1",
  });

  // ERC-7677 paymaster service (getPaymasterStubData / getPaymasterData).
  const paymaster = createPaymasterClient({ transport: http(paymasterUrl) });

  const bundler = createBundlerClient({
    account,
    client: publicClient,
    transport: http(bundlerUrl),
    paymaster,
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
