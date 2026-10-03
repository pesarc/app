"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { type Recipient } from "@pesarc/sdk/account";
import { type CurrencyCode } from "@pesarc/sdk/money";
import {
  applyLivePool,
  getQuote,
  type PayoutMethod,
  type Quote,
} from "@pesarc/sdk/quote";
import { fetchCorridorQuote, type LivePoolQuote } from "@pesarc/sdk/chain/liveQuote";
import { useUIMode } from "@pesarc/sdk/ui-mode";
import { usePrefs } from "@pesarc/sdk/prefs";
import { useWallet } from "@pesarc/sdk/wallet/WalletProvider";
import { useSmartWallet } from "@pesarc/sdk/wallet/smartWallet";
import { RAMP_ESCROW } from "@pesarc/sdk/wallet/config";
import { CONTRACTS_READY } from "@pesarc/sdk/chain/contracts";
import { HUB_CHAIN_ID } from "@pesarc/sdk/chain/chains";
import { executeCorridorSend } from "@pesarc/sdk/chain/sendCorridor";
import { sendTokenDirect } from "@pesarc/sdk/chain/sendDirect";
import { useActiveNetwork } from "@pesarc/sdk/chain/activeNetwork";
import { useActiveEvmChain } from "@pesarc/sdk/chain/activeChain";
import { useSolanaSigner } from "@pesarc/sdk/wallet/solana";
import { svmTransfer } from "@pesarc/sdk/svm/write";
import { stablecoinAddress, registryChainKey } from "@pesarc/sdk/chain/stablecoin-registry";
import { evmBridgeChains } from "@pesarc/sdk/chain/cctp/bridge";
import { selectAdapter, type CrossSendRequest } from "@pesarc/sdk/chain/crosschain";
import { tokenByCode } from "@pesarc/sdk/chain/evm-settle";
import { STABLECOINS } from "@pesarc/sdk/stablecoins";
import { type BankDestination } from "./BankDetails";
import {
  detectPhone,
  isEvmAddress,
  isSolanaAddress,
  isWalletAddress,
  recipientFromAddress,
  recipientFromBank,
  recipientFromPhone,
} from "./helpers";
import type { Step, SendResult } from "./types";

export function useSendState() {
  const { isAdvanced } = useUIMode();
  const { sendCurrency } = usePrefs(); // default currency — no per-send picking
  const { mode, authenticated } = useWallet();
  const smart = useSmartWallet();
  const solana = useSolanaSigner();
  // Solana selected → the EVM smart-wallet execution must not run; the flow
  // falls to its demo/simulated path (real execution stays on the EVM/Arc leg).
  const { isSvm } = useActiveNetwork();
  // Active EVM chain: a wallet send delivers the token the user holds HERE.
  const { chain: activeChain } = useActiveEvmChain();
  const usdToken = activeChain.tokens?.USD as `0x${string}` | undefined;
  // The token a WALLET send moves. Same-chain can send any held stablecoin; the
  // cross-chain (CCTP) rail forces USDC. Default USDC.
  const [sendToken, setSendToken] = useState("USDC");
  const [step, setStep] = useState<Step>("recipient");
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [amountStr, setAmountStr] = useState("");
  const [payout, setPayout] = useState<PayoutMethod>("bank");
  const [bankDest, setBankDest] = useState<BankDestination | null>(null);
  // Destination wallet address for a "wallet" payout (send to any wallet).
  const [recipientAddress, setRecipientAddress] = useState<string>();
  // Destination chain for a cross-chain wallet send ("" / source chain = same-chain).
  const [destChainKey, setDestChainKey] = useState<string>("");
  const [txHash, setTxHash] = useState<string>();
  const [payoutTxHash, setPayoutTxHash] = useState<string>();
  const [actualReceive, setActualReceive] = useState<number>();

  // Deep-link prefill. The agent's bulk-file preview (and any share link) hands a
  // recipient here as ?to=&amount=&ccy=&method=&name=&bank=. We seed the fields
  // and land on the AMOUNT step so the user still reviews the quote and confirms
  // — a prefilled link never auto-sends (read + draft only carries through).
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const to = sp.get("to");
    if (!to) return;
    const method = sp.get("method");
    const ccy = (sp.get("ccy") || "").toUpperCase();
    const name = sp.get("name") || undefined;
    const amt = sp.get("amount");
    if (isWalletAddress(to)) {
      setRecipient(recipientFromAddress(to));
      setPayout("wallet");
      setRecipientAddress(to);
    } else if (method === "bank") {
      const dest: BankDestination = { bankCode: sp.get("bank") || "", accountNumber: to, accountName: name };
      setBankDest(dest);
      setPayout("bank");
      setRecipient(recipientFromBank(dest));
    } else {
      const guess = detectPhone(to) ?? { pretty: to, country: "", flag: "🌍", ccy: (ccy || "NGN") as CurrencyCode };
      if (ccy) guess.ccy = ccy as CurrencyCode;
      setRecipient(recipientFromPhone(guess));
    }
    if (amt && Number(amt) > 0) setAmountStr(String(Number(amt)));
    setStep("amount");
    // Read the link once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const amount = parseFloat(amountStr) || 0;

  // Classify a wallet (on-chain address) destination by its rail.
  const walletIsSolana = payout === "wallet" && !!recipientAddress && isSolanaAddress(recipientAddress);
  const walletIsEvm = payout === "wallet" && !!recipientAddress && isEvmAddress(recipientAddress);

  // Cross-chain: an EVM wallet send where the chosen destination chain differs
  // from the active (source) chain. USDC moves via the crosschain router (CCTP),
  // delivered straight to the recipient on the destination chain.
  const network = activeChain.testnet ? "testnet" : "mainnet";
  const srcCctpKey = registryChainKey(activeChain.key);
  const bridgeChains = useMemo(() => evmBridgeChains(network), [network]);
  const isCrossChain = walletIsEvm && destChainKey !== "" && destChainKey !== srcCctpKey;
  // Tokens the active chain has wired, for the wallet send-token picker.
  const sendTokenOptions = useMemo(
    () =>
      STABLECOINS.filter((s) => Boolean(tokenByCode(activeChain, s.symbol)?.address)).map((s) => ({
        value: s.symbol,
        label: `${s.flag} ${s.symbol}`,
      })),
    [activeChain],
  );
  // Cross-chain can only move USDC (CCTP); same-chain moves the picked token.
  const effectiveSendToken = isCrossChain ? "USDC" : sendToken;
  const sendTokenAddr = tokenByCode(activeChain, effectiveSendToken)?.address as `0x${string}` | undefined;
  const crossReq: CrossSendRequest | null = useMemo(() => {
    if (!isCrossChain || !recipientAddress) return null;
    const dest = bridgeChains.find((c) => c.key === destChainKey);
    if (!dest || dest.chainId == null) return null;
    return {
      token: "USDC",
      fromChainKey: activeChain.key,
      fromChainId: activeChain.chain.id,
      toChainKey: dest.key,
      toChainId: dest.chainId,
      amount: amountStr || "0",
      recipient: recipientAddress as `0x${string}`,
      network,
    };
  }, [isCrossChain, recipientAddress, bridgeChains, destChainKey, activeChain.key, activeChain.chain.id, amountStr, network]);
  const crossAdapter = crossReq ? selectAdapter(crossReq) : null;

  // Live = a real on-chain send is possible right now. Three real paths today:
  //  • Fiat corridor: USD→cNGN gasless swap on the hub pool (NGN recipients).
  //  • EVM wallet: a direct transfer of the token held on the ACTIVE chain.
  //  • Solana wallet: a direct SPL USDC transfer on devnet.
  // Everything else quotes live but settles via the simulated path for now.
  const fiatLive =
    mode === "live" &&
    authenticated &&
    smart.ready &&
    CONTRACTS_READY &&
    !isSvm &&
    payout !== "wallet" &&
    recipient?.receiveCurrency === "NGN";
  const walletEvmLive =
    mode === "live" &&
    authenticated &&
    smart.ready &&
    !isSvm &&
    walletIsEvm &&
    !isCrossChain &&
    Boolean(sendTokenAddr);
  const walletSolLive = mode === "live" && authenticated && walletIsSolana && Boolean(solana);
  const walletCrossLive =
    mode === "live" &&
    authenticated &&
    smart.ready &&
    !isSvm &&
    Boolean(crossAdapter && crossAdapter.kind === "programmatic");
  const live = fiatLive || walletEvmLive || walletSolLive || walletCrossLive;

  // Instant mock quote, then overlaid with live on-chain pool pricing
  // (oracle mid + exact swap simulation) when the corridor is on the hub.
  const [livePool, setLivePool] = useState<LivePoolQuote | null>(null);
  // Any USD corridor is quotable: NGN via the hub pool, the rest via the
  // realized-rate oracle (null result → the indicative mock quote stands).
  const liveQuotable = sendCurrency === "USD" && Boolean(recipient);
  const receiveCurrency = recipient?.receiveCurrency;

  useEffect(() => {
    setLivePool(null);
    if (!liveQuotable || amount <= 0 || !receiveCurrency) return;
    let stale = false;
    const t = setTimeout(() => {
      fetchCorridorQuote(amount, receiveCurrency).then((q) => {
        if (!stale) setLivePool(q);
      });
    }, 350);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [liveQuotable, amount, receiveCurrency]);

  const quote: Quote | null = useMemo(() => {
    if (!recipient || amount <= 0) return null;
    const mock = getQuote({
      sendAmount: amount,
      sendCurrency,
      receiveCurrency: recipient.receiveCurrency,
      payout,
    });
    return livePool ? applyLivePool(mock, livePool) : mock;
  }, [recipient, amount, payout, livePool, sendCurrency]);

  // Real gasless corridor send (USD -> NGN swap on the hub pool). The cNGN
  // then goes to the peer's wallet for in-app payouts, or to the ramp
  // partner's escrow when the recipient chose a fiat payout (bank / mobile
  // money) — the fiat leg is orchestrated off-chain from there.
  const executeReal = useCallback(async (): Promise<SendResult> => {
    // Send to a Solana wallet: a direct SPL USDC transfer on devnet.
    if (walletIsSolana && solana && recipientAddress) {
      const mint = stablecoinAddress("USDC", "solana", "testnet");
      if (!mint) throw new Error("USDC is not configured on Solana devnet.");
      const sig = await svmTransfer(solana, { mint, to: recipientAddress, amount, decimals: 6 });
      return { tx: sig, received: amount };
    }
    // Cross-chain wallet send: burn on the source chain with the recipient as the
    // mint target, then poll until the destination settles. Funds go straight to
    // the recipient on the destination chain — no intermediate.
    if (isCrossChain && crossReq && crossAdapter) {
      const { sourceTx } = await crossAdapter.execute(crossReq, smart);
      const deadline = Date.now() + 15 * 60_000;
      while (Date.now() < deadline) {
        const s = await crossAdapter.settle(crossReq, sourceTx);
        if (s.ok) return { tx: sourceTx, payoutTx: s.destTx, received: amount };
        if (!s.pending && s.error) throw new Error(s.error);
        await new Promise((r) => setTimeout(r, 15_000));
      }
      // Timed out polling — the burn landed and the funds are in transit (safe).
      return { tx: sourceTx, received: amount };
    }
    // Send to an EVM wallet on the SAME chain: a direct transfer of the PICKED
    // token, straight to the recipient (no swap, no ramp escrow).
    if (walletIsEvm && recipientAddress) {
      if (!sendTokenAddr) throw new Error(`${effectiveSendToken} isn't available on this chain to send.`);
      return sendTokenDirect(smart, sendTokenAddr, recipientAddress as `0x${string}`, amount);
    }
    // Otherwise the fiat cash-out on-chain leg. Two routes:
    //  • Corridor (on the hub chain, pool wired): swap USD→cNGN and deposit the
    //    cNGN into the ramp escrow, then the fiat partner pays out.
    //  • Direct (off the hub — e.g. Arc mainnet with no pool, or forced via
    //    NEXT_PUBLIC_CASHOUT_MODE=direct): send the USD stablecoin straight to the
    //    escrow; the fiat partner pays NGN from there. Same off-chain payout leg.
    const hubOnActiveChain = CONTRACTS_READY && activeChain.chain.id === HUB_CHAIN_ID;
    const forceDirect = process.env.NEXT_PUBLIC_CASHOUT_MODE === "direct";
    if (hubOnActiveChain && !forceDirect) {
      return executeCorridorSend(smart, amount, RAMP_ESCROW);
    }
    const usdc = stablecoinAddress("USDC", registryChainKey(activeChain.key), network) as
      | `0x${string}`
      | undefined;
    if (!usdc) throw new Error("USDC isn't available on this network to cash out.");
    // The on-chain leg moves USD (not cNGN), so don't report `received` as the
    // NGN figure — leave it unset so the payout + UI use the quote's NGN amount.
    const sent = await sendTokenDirect(smart, usdc, RAMP_ESCROW, amount);
    return { tx: sent.tx };
  }, [
    smart,
    solana,
    amount,
    walletIsSolana,
    walletIsEvm,
    recipientAddress,
    sendTokenAddr,
    effectiveSendToken,
    isCrossChain,
    crossReq,
    crossAdapter,
    activeChain.chain.id,
    activeChain.key,
    network,
  ]);

  const reset = () => {
    setStep("recipient");
    setRecipient(null);
    setAmountStr("");
    setPayout("bank");
    setBankDest(null);
    setRecipientAddress(undefined);
    setDestChainKey("");
    setSendToken("USDC");
    setTxHash(undefined);
    setActualReceive(undefined);
  };

  return {
    isAdvanced,
    sendCurrency,
    step,
    setStep,
    recipient,
    setRecipient,
    amountStr,
    setAmountStr,
    payout,
    setPayout,
    bankDest,
    setBankDest,
    recipientAddress,
    setRecipientAddress,
    txHash,
    setTxHash,
    payoutTxHash,
    setPayoutTxHash,
    actualReceive,
    setActualReceive,
    quote,
    live,
    executeReal,
    reset,
    /** Chain the funds will LAND on (dest for cross-chain, else the active chain). */
    walletChainLabel: walletIsSolana
      ? "Solana"
      : (isCrossChain && bridgeChains.find((c) => c.key === destChainKey)?.label) || activeChain.label,
    /** Wallet (EVM) send controls for choosing a destination chain. */
    walletIsEvm,
    destChainKey,
    setDestChainKey,
    sourceChainLabel: activeChain.label,
    destChainOptions: bridgeChains
      .filter((c) => c.key !== srcCctpKey)
      .map((c) => ({ key: c.key, label: c.label })),
    isCrossChain,
    /** Wallet send-token picker: which stablecoin a same-chain wallet send moves. */
    sendToken: effectiveSendToken,
    setSendToken,
    sendTokenOptions,
  };
}
