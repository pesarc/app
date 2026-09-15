"use client";

// Local corridor: send local currency to local currency with no dollar in the
// path. The send becomes an *intent*; the solver pairs it with someone going
// the other way (or a ring of three), and the two settle directly against each
// other. docs/LOCAL_CURRENCY_SETTLEMENT.md

import { useCallback, useEffect, useMemo, useState } from "react";
import { encodeFunctionData, parseUnits } from "viem";
import {
  ArrowRight,
  Check,
  Clock,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button, Card } from "@/components/app/ui";
import { useWallet } from "@stablearc/sdk/wallet/WalletProvider";
import { useSmartWallet } from "@stablearc/sdk/wallet/smartWallet";
import { CONTRACTS } from "@stablearc/sdk/chain/contracts";
import { chainLabel, explorerTxUrl } from "@stablearc/sdk/chain/chains";
import { erc20Abi } from "@stablearc/abi";
import { intentMatcherAbi } from "@stablearc/abi";
import {
  currencyByAddress,
  fetchRealizedRate,
  fetchUserIntents,
  localCorridorsReady,
  localCurrencies,
  type LocalCurrency,
  type UserIntent,
} from "@stablearc/sdk/chain/localCorridors";

/** Slippage the maker accepts vs the reference rate when setting their floor. */
const LIMIT_TOLERANCE = 0.02; // 2%

export default function CorridorFlow() {
  const { mode, authenticated } = useWallet();
  const smart = useSmartWallet();
  const live = mode === "live" && authenticated && Boolean(smart.address);

  const currencies = useMemo(() => localCurrencies(), []);
  const [fromIdx, setFromIdx] = useState(0);
  const [toIdx, setToIdx] = useState(1);
  const [amountStr, setAmountStr] = useState("");
  const [recipient, setRecipient] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tx?: string; ok: boolean } | null>(
    null,
  );
  const [intents, setIntents] = useState<UserIntent[]>([]);
  const [loading, setLoading] = useState(false);
  const [rate, setRate] = useState<number | null>(null);

  const from = currencies[fromIdx];
  const to = currencies[toIdx];
  const amount = parseFloat(amountStr) || 0;

  const refresh = useCallback(async () => {
    if (!smart.address) return;
    setLoading(true);
    setIntents(await fetchUserIntents(smart.address as `0x${string}`));
    setLoading(false);
  }, [smart.address]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // The rate we show is discovered from our own settled flow — not a feed.
  useEffect(() => {
    setRate(null);
    if (!from || !to || from.address === to.address) return;
    let stale = false;
    fetchRealizedRate(from.address, to.address).then((r) => {
      if (!stale) setRate(r);
    });
    return () => {
      stale = true;
    };
  }, [from, to]);

  const expectedOut = rate !== null ? amount * rate : null;
  const minOut = expectedOut !== null ? expectedOut * (1 - LIMIT_TOLERANCE) : null;

  const submit = useCallback(async () => {
    if (!from || !to || amount <= 0) return;
    const to_ = (recipient.trim() || smart.address) as `0x${string}`;
    if (!/^0x[0-9a-fA-F]{40}$/.test(to_ ?? "")) {
      setNotice({ ok: false, text: "Enter a valid recipient address." });
      return;
    }
    if (minOut === null || minOut <= 0) {
      setNotice({
        ok: false,
        text: "No realized rate for this pair yet — it appears once the corridor has settled once.",
      });
      return;
    }

    setBusy(true);
    setNotice(null);
    try {
      const amountIn = parseUnits(amount.toFixed(6), 18);
      const minAmountOut = parseUnits(minOut.toFixed(6), 18);
      const expiry = BigInt(Math.floor(Date.now() / 1000) + 24 * 3600);
      const matcher = CONTRACTS.intentMatcher as `0x${string}`;

      // Approve + submit in one gas-sponsored user op.
      const tx = await smart.sendCalls([
        {
          to: from.address,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: "approve",
            args: [matcher, amountIn],
          }),
        },
        {
          to: matcher,
          data: encodeFunctionData({
            abi: intentMatcherAbi,
            functionName: "submitIntent",
            args: [
              from.address,
              to.address,
              amountIn,
              minAmountOut,
              to_,
              expiry,
              `0x${Buffer.from(`${from.code}-${to.code}`).toString("hex").padEnd(64, "0").slice(0, 64)}` as `0x${string}`,
            ],
          }),
        },
      ]);
      setNotice({
        ok: true,
        text: "Intent submitted — the solver will match it with someone going the other way.",
        tx,
      });
      setAmountStr("");
      await refresh();
    } catch (e) {
      setNotice({
        ok: false,
        text: e instanceof Error ? e.message.slice(0, 140) : "Submit failed.",
      });
    }
    setBusy(false);
  }, [from, to, amount, recipient, minOut, smart, refresh]);

  const cancel = useCallback(
    async (id: bigint) => {
      setBusy(true);
      try {
        await smart.sendCalls([
          {
            to: CONTRACTS.intentMatcher as `0x${string}`,
            data: encodeFunctionData({
              abi: intentMatcherAbi,
              functionName: "cancelIntent",
              args: [id],
            }),
          },
        ]);
        await refresh();
      } catch {
        /* best-effort */
      }
      setBusy(false);
    },
    [smart, refresh],
  );

  if (!localCorridorsReady()) {
    return (
      <Shell>
        <Card className="p-6 text-sm text-muted">
          Local corridors aren&apos;t configured on this deployment yet (needs
          <code className="mx-1">NEXT_PUBLIC_ARB_INTENT_MATCHER</code> and at
          least two local stables).
        </Card>
      </Shell>
    );
  }

  return (
    <Shell>
      {/* The claim, up front */}
      <Card className="p-4 mb-5 flex items-start gap-3 bg-emerald-50/60 border-emerald/20">
        <ShieldCheck className="w-5 h-5 text-emerald shrink-0 mt-0.5" />
        <div className="text-sm">
          <div className="font-semibold text-deepink">No dollar in the path</div>
          <div className="text-muted">
            Your send is matched against someone going the other way and settles
            directly, local currency to local currency — no pool, no bridge, no
            USD.
          </div>
        </div>
      </Card>

      <Card className="p-5 mb-4">
        {/* From / To */}
        <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end mb-4">
          <CurrencyPicker
            label="You send"
            list={currencies}
            idx={fromIdx}
            onChange={(i) => {
              setFromIdx(i);
              if (i === toIdx) setToIdx((i + 1) % currencies.length);
            }}
          />
          <div className="pb-3 text-muted">
            <ArrowRight className="w-4 h-4" />
          </div>
          <CurrencyPicker
            label="They receive"
            list={currencies}
            idx={toIdx}
            onChange={(i) => {
              setToIdx(i);
              if (i === fromIdx) setFromIdx((i + 1) % currencies.length);
            }}
          />
        </div>

        <label className="block text-xs font-semibold text-muted uppercase tracking-widest mb-1.5">
          Amount
        </label>
        <div className="flex items-center gap-2 bg-white rounded-field border border-black/10 px-4 py-3 mb-3">
          <span className="text-lg font-semibold text-deepink/50">
            {from?.symbol}
          </span>
          <input
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value.replace(/[^0-9.]/g, ""))}
            inputMode="decimal"
            placeholder="0"
            aria-label="Amount to send"
            className="flex-1 bg-transparent text-lg font-semibold text-deepink outline-none numerals placeholder:text-deepink/25"
          />
        </div>

        <label className="block text-xs font-semibold text-muted uppercase tracking-widest mb-1.5">
          Recipient address {smart.address && "(blank = yourself)"}
        </label>
        <input
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="0x…"
          aria-label="Recipient address"
          className="w-full bg-white rounded-field border border-black/10 px-4 py-3 text-sm font-mono text-deepink placeholder:text-muted/60 mb-4"
        />

        {/* Rate — from our own flow */}
        <div className="rounded-field bg-black/[0.03] px-4 py-3 text-sm mb-4">
          {rate === null ? (
            <span className="text-muted">
              No realized rate for {from?.code}/{to?.code} yet — it appears once
              this corridor settles once.
            </span>
          ) : (
            <>
              <div className="flex justify-between mb-1">
                <span className="text-muted">Realized rate</span>
                <span className="font-medium text-deepink numerals">
                  1 {from.code} = {fmt(rate)} {to.code}
                </span>
              </div>
              {expectedOut !== null && amount > 0 && (
                <div className="flex justify-between mb-1">
                  <span className="text-muted">They receive ≈</span>
                  <span className="font-semibold text-emerald numerals">
                    {to.symbol}
                    {fmt(expectedOut)}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-xs text-muted pt-1">
                <Sparkles className="w-3.5 h-3.5 text-emerald" />
                Discovered from settled flow on {chainLabel()} — not a price feed
              </div>
            </>
          )}
        </div>

        <Button
          block
          size="lg"
          disabled={!live || busy || amount <= 0 || rate === null}
          onClick={submit}
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
          Submit intent
        </Button>
        {!live && (
          <p className="text-xs text-muted mt-3 text-center">
            Sign in with a live wallet to send on the local corridor.
          </p>
        )}
      </Card>

      {notice && (
        <Card className={`p-3.5 mb-4 flex items-center gap-2 text-sm ${notice.ok ? "" : "border-alert/40"}`}>
          {notice.ok ? (
            <Check className="w-4 h-4 text-emerald shrink-0" />
          ) : null}
          <span className={notice.ok ? "text-deepink flex-1" : "text-alert flex-1"}>
            {notice.text}
          </span>
          {notice.tx && (
            <a
              href={explorerTxUrl(notice.tx)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-emerald font-medium hover:underline"
            >
              tx <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </Card>
      )}

      {/* Your intents */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-widest">
          Your sends
        </h2>
        <button
          onClick={refresh}
          aria-label="Refresh"
          className="text-muted hover:text-deepink transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {intents.length === 0 ? (
        <Card className="p-5 text-sm text-muted">
          No sends yet. Submit an intent above — it settles as soon as someone
          goes the other way.
        </Card>
      ) : (
        <div className="space-y-2">
          {intents.map((i) => (
            <IntentRow key={i.id.toString()} intent={i} onCancel={cancel} busy={busy} />
          ))}
        </div>
      )}
    </Shell>
  );
}

function IntentRow({
  intent,
  onCancel,
  busy,
}: {
  intent: UserIntent;
  onCancel: (id: bigint) => void;
  busy: boolean;
}) {
  const from = currencyByAddress(intent.tokenIn);
  const to = currencyByAddress(intent.tokenOut);
  const pct =
    intent.amountIn > 0 ? Math.round((intent.filledIn / intent.amountIn) * 100) : 0;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold text-deepink">
          {from?.flag} {fmt(intent.amountIn)} {from?.code}
          <span className="text-muted font-normal mx-1.5">→</span>
          {to?.flag} {to?.code}
        </div>
        <StatusBadge status={intent.status} pct={pct} />
      </div>

      {intent.status === "settled" ? (
        <div className="flex items-center gap-1.5 text-xs text-emerald font-medium">
          <ShieldCheck className="w-3.5 h-3.5" />
          Matched peer-to-peer · settled in local currency · zero USD
        </div>
      ) : intent.status === "open" ? (
        <>
          {pct > 0 && (
            <div className="h-1.5 rounded-full bg-black/[0.06] overflow-hidden mb-2">
              <div className="h-full bg-emerald" style={{ width: `${pct}%` }} />
            </div>
          )}
          <div className="flex items-center justify-between text-xs text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {pct > 0
                ? `${pct}% matched · waiting for the rest`
                : "Waiting for a match"}
            </span>
            <button
              onClick={() => onCancel(intent.id)}
              disabled={busy}
              className="font-medium text-muted hover:text-alert transition disabled:opacity-50"
            >
              Cancel &amp; refund
            </button>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-between text-xs text-muted">
          <span>Expired — funds are refundable</span>
          <button
            onClick={() => onCancel(intent.id)}
            disabled={busy}
            className="font-medium text-emerald hover:underline disabled:opacity-50"
          >
            Refund
          </button>
        </div>
      )}
    </Card>
  );
}

function StatusBadge({ status, pct }: { status: string; pct: number }) {
  const map: Record<string, string> = {
    settled: "bg-emerald-50 text-emerald",
    open: "bg-gold/15 text-gold",
    expired: "bg-black/[0.06] text-muted",
  };
  const label =
    status === "settled" ? "Settled" : status === "open" ? (pct > 0 ? "Partly matched" : "Matching") : "Expired";
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${map[status]}`}>
      {label}
    </span>
  );
}

function CurrencyPicker({
  label,
  list,
  idx,
  onChange,
}: {
  label: string;
  list: LocalCurrency[];
  idx: number;
  onChange: (i: number) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-muted uppercase tracking-widest mb-1.5">
        {label}
      </label>
      <select
        value={idx}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="w-full bg-white rounded-field border border-black/10 px-3 py-3 text-sm font-medium text-deepink focus:outline-none focus:border-emerald/50"
      >
        {list.map((c, i) => (
          <option key={c.code} value={i}>
            {c.flag} {c.code}
          </option>
        ))}
      </select>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-8 md:py-12">
      <div className="mb-6">
        <div className="text-xs font-semibold text-muted uppercase tracking-widest mb-1">
          Local corridor
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-deepink mb-1.5">
          Send locally
        </h1>
        <p className="text-muted">
          Naira to cedis, cedis to shillings — matched against real flow going
          the other way.
        </p>
      </div>
      {children}
    </div>
  );
}

function fmt(n: number): string {
  return n.toLocaleString(undefined, {
    maximumFractionDigits: n < 10 ? 4 : 2,
  });
}
