"use client";

// Non-USDC coins move over Hyperbridge. The rail is wired but each coin needs its
// cross-chain contracts deployed before a route goes live; until then we say so
// plainly rather than offer a move that can't settle.
import { useState } from "react";
import { Button, Card } from "@/components/app/ui";
import { Dropdown } from "@/components/app/Dropdown";
import { chainLogoUrlForLabel } from "@/lib/chainLogos";
import {
  hasHyperRoute,
  hyperEndpoints,
  hyperTokenFor,
} from "@pesarc/sdk/chain/hyperbridge/registry";
import { chainByKey } from "@pesarc/sdk/chain/registry";
import { hyperSend } from "@pesarc/sdk/chain/hyperbridge/send";
import { useSmartWallet } from "@pesarc/sdk/wallet/smartWallet";
import { useActiveEvmChain } from "@pesarc/sdk/chain/activeChain";
import { type CctpNetwork } from "@pesarc/sdk/chain/cctp/network";
import { HYPER_CHAIN_KEY, useTokenBalanceOn } from "@/components/app/bridge/shared";

export default function HyperPanel({ symbol, network }: { symbol: string; network: CctpNetwork }) {
  const hyperNet = network === "testnet" ? "testnet" : "mainnet";
  const live = hasHyperRoute(hyperNet, symbol);
  const endpoints = hyperEndpoints(hyperNet, symbol);
  const [fromId, setFromId] = useState(endpoints[0]?.chainId ?? 0);
  const [toId, setToId] = useState(endpoints[1]?.chainId ?? 0);
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [errored, setErrored] = useState(false);
  const smart = useSmartWallet();
  const { chain: activeEvm, setChainKey } = useActiveEvmChain();

  // Picking a source chain makes it the active network, so the embedded smart
  // wallet signs the move there — in-app and gasless, no MetaMask.
  const pickFrom = (v: string) => {
    const id = Number(v);
    setFromId(id);
    const key = HYPER_CHAIN_KEY[id];
    if (key) setChainKey(key);
  };
  // In-app (AA) is possible when the smart wallet is ready on the source chain.
  const canAA = smart.ready && Boolean(smart.address) && activeEvm.chain.id === fromId;

  // Your real balance of this coin on the FROM chain (underlying on the home
  // chain, the HFT on a remote chain).
  const fromCfg = chainByKey(HYPER_CHAIN_KEY[fromId] ?? "");
  const holdToken = hyperTokenFor(hyperNet, symbol, fromId);
  const fromBal = useTokenBalanceOn(holdToken, fromCfg?.chain, fromCfg?.rpcUrl, smart.address);

  if (!live) {
    return (
      <Card className="mt-4 p-4">
        <div className="text-[15px] font-bold text-harbor">Moving {symbol} across chains</div>
        <p className="mt-1.5 text-sm text-slate">
          {symbol} cross-chain is coming soon. It rides a different rail from USDC and we are
          finishing its setup. USDC can move across chains today.
        </p>
        <p className="mt-3 text-xs text-slate/70">
          Want to change currency instead? Use the Currencies tab to swap {symbol} into USDC, then
          move the USDC.
        </p>
      </Card>
    );
  }

  const chainOpts = endpoints.map((e) => ({
    value: String(e.chainId),
    label: e.label,
    icon: chainLogoUrlForLabel(e.label),
  }));
  const same = fromId === toId;
  const amt = Number(amount) || 0;
  // Optional external recipient. Empty = send to your own address on the
  // destination; a valid 0x address sends there instead.
  const toAddr = recipient.trim();
  const recipientValid = toAddr === "" || /^0x[a-fA-F0-9]{40}$/.test(toAddr);
  // AA always needs an explicit recipient (defaults to self); the injected path
  // lets hyperSend default to the connected account when left blank.
  const effRecipient = toAddr
    ? (toAddr as `0x${string}`)
    : canAA
      ? (smart.address as `0x${string}`)
      : undefined;

  const move = async () => {
    if (amt <= 0 || same || busy || !recipientValid) return;
    setBusy(true);
    setErrored(false);
    setNote(canAA ? `Signing in-app and sending ${amount} ${symbol}…` : `Sending ${amount} ${symbol}…`);
    try {
      const tx = await hyperSend(
        {
          network: hyperNet,
          symbol,
          fromChainId: fromId,
          toChainId: toId,
          amount,
          recipient: effRecipient,
        },
        canAA ? smart : undefined,
      );
      setNote(`Sent from the source chain. It will arrive once Hyperbridge relays it. Tx ${tx.slice(0, 10)}…`);
    } catch (e: any) {
      setErrored(true);
      setNote(e?.shortMessage || e?.message?.split("\n")[0] || "That didn't go through. Try again.");
    }
    setBusy(false);
  };

  return (
    <Card className="mt-4 p-4 flex flex-col gap-3">
      <div className="text-[15px] font-bold text-harbor">Move {symbol} across chains</div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs font-bold text-slate mb-1">From</div>
          <Dropdown ariaLabel="Source chain" value={String(fromId)} onChange={pickFrom} options={chainOpts} />
        </div>
        <div>
          <div className="text-xs font-bold text-slate mb-1">To</div>
          <Dropdown ariaLabel="Destination chain" value={String(toId)} onChange={(v) => setToId(Number(v))} options={chainOpts} />
        </div>
      </div>
      <label className="text-xs font-bold text-slate">
        Amount ({symbol})
        <input
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          className="mt-1 w-full rounded-xl border border-fog bg-snow p-2 text-lg font-bold text-ink"
          disabled={busy}
        />
        <div className="mt-1 flex items-center justify-between text-[11px] font-normal">
          <span className="text-slate">
            {!smart.address
              ? "Sign in to see your balance"
              : fromBal.loading
                ? "Checking balance…"
                : fromBal.amount !== undefined
                  ? `Balance ${fromBal.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${symbol}`
                  : ""}
          </span>
          {fromBal.amount ? (
            <button type="button" className="font-bold text-sky" onClick={() => setAmount(String(fromBal.amount))} disabled={busy}>
              Max
            </button>
          ) : null}
        </div>
      </label>
      <label className="text-xs font-bold text-slate">
        Recipient (optional)
        <input
          inputMode="text"
          placeholder="0x… — defaults to your wallet"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value.trim())}
          spellCheck={false}
          className="mt-1 w-full rounded-xl border border-fog bg-snow p-2 font-mono text-[13px] text-ink"
          disabled={busy}
        />
        {!recipientValid && (
          <span className="mt-1 block text-[11px] font-normal text-alert">
            Enter a valid 0x wallet address, or leave blank to send to yourself.
          </span>
        )}
      </label>
      {same && <p className="text-[13px] text-slate">Pick two different chains.</p>}
      <Button onClick={move} disabled={busy || same || amt <= 0 || !recipientValid}>
        {busy ? "Moving…" : `Move ${symbol}`}
      </Button>
      {note && <p className={`text-sm ${errored ? "text-alert" : "text-slate"}`}>{note}</p>}
      <p className="text-[11px] text-slate/70">
        {canAA
          ? "Signed in your Pesarc wallet, gasless — no pop-ups. "
          : "You'll approve this in your connected wallet. "}
        Sends to {toAddr ? "the recipient address" : "your own address"} on the destination;
        delivery is handled by Hyperbridge relayers after the source transaction confirms.
      </p>
    </Card>
  );
}
