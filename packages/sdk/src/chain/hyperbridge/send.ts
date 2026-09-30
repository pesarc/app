// In-app Hyperbridge send. Mirrors the flow proven on testnet with forge:
//   wrapped (home): approve the underlying, then wrapped.send(params, value 0)
//   remote (HFT):   HFT.send(params, value 0)  (burns the holder's balance)
// value is 0 because this testnet host prices the relayer fee in its fee token,
// and the per-byte protocol fee is 0, so relayerFee 0 needs no fee token. Delivery
// to the destination is handled by Hyperbridge's relayers after the source tx.
import {
  createWalletClient,
  createPublicClient,
  custom,
  http,
  parseUnits,
  stringToHex,
  type Chain,
} from "viem";
import { baseSepolia, arbitrumSepolia } from "viem/chains";
import { HYPER_TOKENS, type HyperNetwork } from "./registry";

const CHAINS: Record<number, Chain> = {
  [baseSepolia.id]: baseSepolia,
  [arbitrumSepolia.id]: arbitrumSepolia,
};

const erc20Abi = [
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [{ type: "address" }, { type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [{ type: "address" }, { type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
] as const;

const SEND_PARAMS = {
  name: "params",
  type: "tuple",
  components: [
    { name: "dest", type: "bytes" },
    { name: "to", type: "bytes" },
    { name: "amount", type: "uint256" },
    { name: "timeout", type: "uint64" },
    { name: "relayerFee", type: "uint256" },
    { name: "data", type: "bytes" },
  ],
} as const;

const sendAbi = [
  { type: "function", name: "send", stateMutability: "payable", inputs: [SEND_PARAMS], outputs: [] },
] as const;

function eth(): any {
  return typeof window !== "undefined" ? (window as any).ethereum : undefined;
}

export type HyperSendInput = {
  network: HyperNetwork;
  symbol: string;
  fromChainId: number;
  toChainId: number;
  /** Destination recipient. Defaults to the sender (send to yourself cross-chain). */
  recipient?: `0x${string}`;
  amount: string; // human amount in the token's own units
};

/** Send a Hyperbridge cross-chain token. Returns the source-chain tx hash; the
 *  destination mint follows via Hyperbridge's relayers. */
export async function hyperSend(input: HyperSendInput): Promise<`0x${string}`> {
  const token = HYPER_TOKENS[input.network][input.symbol];
  const src = token?.deployments[input.fromChainId];
  const chain = CHAINS[input.fromChainId];
  if (!src || !chain) throw new Error("This route isn't available yet.");

  const provider = eth();
  if (!provider) throw new Error("Connect a wallet that holds this token (e.g. MetaMask).");
  const [account] = (await provider.request({ method: "eth_requestAccounts" })) as `0x${string}`[];

  const wallet = createWalletClient({ account, chain, transport: custom(provider) });
  const pub = createPublicClient({ chain, transport: http(chain.rpcUrls.default.http[0]) });
  try {
    await wallet.switchChain({ id: chain.id });
  } catch (e: any) {
    if (e?.code === 4902) {
      await wallet.addChain({ chain });
      await wallet.switchChain({ id: chain.id });
    } else throw e;
  }

  // The token that leaves the wallet: the underlying for a wrapped (home) send,
  // the HFT itself for a remote send.
  const debitToken = src.kind === "wrapped" ? (src.underlying as `0x${string}`) : src.address;
  const decimals = (await pub.readContract({
    address: debitToken,
    abi: erc20Abi,
    functionName: "decimals",
  })) as number;
  const amount = parseUnits(input.amount, decimals);

  // Wrapped send pulls the underlying via transferFrom, so approve it first.
  if (src.kind === "wrapped") {
    const allowance = (await pub.readContract({
      address: debitToken,
      abi: erc20Abi,
      functionName: "allowance",
      args: [account, src.address],
    })) as bigint;
    if (allowance < amount) {
      const aTx = await wallet.writeContract({
        address: debitToken,
        abi: erc20Abi,
        functionName: "approve",
        args: [src.address, amount],
      });
      await pub.waitForTransactionReceipt({ hash: aTx, timeout: 60_000 });
    }
  }

  const params = {
    dest: stringToHex(`EVM-${input.toChainId}`),
    to: (input.recipient ?? account) as `0x${string}`, // 20-byte address is valid `bytes`
    amount,
    timeout: 3600n,
    relayerFee: 0n,
    data: "0x" as `0x${string}`,
  };
  const tx = await wallet.writeContract({
    address: src.address,
    abi: sendAbi,
    functionName: "send",
    args: [params],
    value: 0n,
  });
  await pub.waitForTransactionReceipt({ hash: tx, timeout: 60_000 });
  return tx;
}
