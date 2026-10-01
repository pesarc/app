"use client";

// Presentational card for the USDC-over-CCTP move (and the EVM->Solana LI.FI
// corridor). All state, the prefill, and the burn/mint `run()` flow live in the
// parent CrossChainBridge; this component only renders the form and reports
// changes back through callbacks, so the money logic stays in one place.
import { Button, Card } from "@/components/app/ui";
import { Dropdown } from "@/components/app/Dropdown";
import { chainLogoUrlForLabel } from "@/lib/chainLogos";
import { cctpChains, type CctpNetwork } from "@pesarc/sdk/chain/cctp/network";
import { type BridgeQuote, formatUsdc } from "@pesarc/sdk/chain/cctp/bridge";
import { type LifiQuote } from "@pesarc/sdk/chain/aggregator/lifi";

// The element type of the CCTP chain map, without reaching into an internal
// subpath — both src/dst and the dropdown options are these objects.
type CctpChain = ReturnType<typeof cctpChains>[string];

type CctpTransferCardProps = {
  coin: string;
  busy: boolean;
  srcKey: string;
  dstKey: string;
  pickSrc: (v: string) => void;
  setDstKey: (v: string) => void;
  srcChains: CctpChain[];
  dstChains: CctpChain[];
  src: CctpChain;
  dst: CctpChain;
  viaLifi: boolean;
  speed: "fast" | "standard";
  setSpeed: (v: "fast" | "standard") => void;
  fastBps: number | null;
  feeLoading: boolean;
  amount: string;
  setAmount: (v: string) => void;
  recipient: string;
  setRecipient: (v: string) => void;
  smartAddress?: string;
  srcBal: { amount?: number; loading: boolean };
  q: BridgeQuote | null;
  lifiLoading: boolean;
  lifiQ: LifiQuote | null;
  submitDisabled: boolean;
  onSubmit: () => void;
  note: string;
  isError: boolean;
  burnTx: string;
  mintTx: string;
};

export default function CctpTransferCard({
  coin,
  busy,
  srcKey,
  dstKey,
  pickSrc,
  setDstKey,
  srcChains,
  dstChains,
  src,
  dst,
  viaLifi,
  speed,
  setSpeed,
  fastBps,
  feeLoading,
  amount,
  setAmount,
  recipient,
  setRecipient,
  smartAddress,
  srcBal,
  q,
  lifiLoading,
  lifiQ,
  submitDisabled,
  onSubmit,
  note,
  isError,
  burnTx,
  mintTx,
}: CctpTransferCardProps) {
  return (
    <Card className="mt-4 flex flex-col gap-4 p-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs font-bold text-slate mb-1">From</div>
          <div className={busy ? "pointer-events-none opacity-60" : ""}>
            <Dropdown
              ariaLabel="Source chain"
              value={srcKey}
              onChange={pickSrc}
              options={srcChains.map((c) => ({
                value: c.key,
                label: c.label,
                icon: chainLogoUrlForLabel(c.label),
              }))}
            />
          </div>
        </div>
        <div>
          <div className="text-xs font-bold text-slate mb-1">To</div>
          <div className={busy ? "pointer-events-none opacity-60" : ""}>
            <Dropdown
              ariaLabel="Destination chain"
              value={dstKey}
              onChange={setDstKey}
              options={dstChains.map((c) => ({
                value: c.key,
                label: c.label,
                icon: chainLogoUrlForLabel(c.label),
              }))}
            />
          </div>
        </div>
      </div>

      {!viaLifi && (
        <div>
          <span className="text-xs font-bold text-slate">Speed</span>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSpeed("fast")}
              disabled={busy || fastBps == null}
              className={`rounded-xl border p-2 text-left text-xs transition ${
                speed === "fast" && fastBps != null
                  ? "border-sky bg-sky-tint/40"
                  : "border-fog bg-snow"
              } disabled:opacity-50`}
            >
              <div className="font-bold text-ink">Fast</div>
              <div className="text-slate">
                {feeLoading ? "checking…" : fastBps == null ? "unavailable" : "Arrives in seconds"}
              </div>
            </button>
            <button
              type="button"
              onClick={() => setSpeed("standard")}
              disabled={busy}
              className={`rounded-xl border p-2 text-left text-xs transition ${
                speed === "standard" || fastBps == null
                  ? "border-sky bg-sky-tint/40"
                  : "border-fog bg-snow"
              }`}
            >
              <div className="font-bold text-ink">Standard</div>
              <div className="text-slate">About 15 min, free</div>
            </button>
          </div>
        </div>
      )}

      <label className="text-xs font-bold text-slate">
        Amount ({coin})
        <input
          inputMode="decimal"
          placeholder="0.00"
          className="mt-1 w-full rounded-xl border border-fog bg-snow p-2 text-lg font-bold text-ink"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          disabled={busy}
        />
        <div className="mt-1 flex items-center justify-between text-[11px] font-normal">
          <span className="text-slate">
            {!smartAddress
              ? "Sign in to see your balance"
              : srcBal.loading
                ? "Checking balance…"
                : srcBal.amount !== undefined
                  ? `Balance ${srcBal.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${coin} on ${src.label}`
                  : ""}
          </span>
          {srcBal.amount ? (
            <button
              type="button"
              className="font-bold text-sky"
              onClick={() => setAmount(String(srcBal.amount))}
              disabled={busy}
            >
              Max
            </button>
          ) : null}
        </div>
      </label>

      <label className="text-xs font-bold text-slate">
        Recipient on {dst.label}{" "}
        <span className="font-normal">
          {dst.kind === "solana"
            ? "(required, Solana address)"
            : src.kind === "solana"
              ? "(required, destination address)"
              : "(optional, defaults to your address)"}
        </span>
        <input
          placeholder={dst.kind === "solana" ? "Solana address…" : "0x…"}
          className="mt-1 w-full rounded-xl border border-fog bg-snow p-2 text-sm font-mono text-ink"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value.trim())}
          disabled={busy}
        />
      </label>

      {q && (
        <div className="rounded-xl bg-black/[0.03] p-3 text-sm">
          <Row k="You send" v={`${formatUsdc(q.amountIn)} USDC on ${src.label}`} />
          <Row k="They receive" v={`${formatUsdc(q.amountOut)} USDC on ${dst.label}`} />
          <Row k="Fee" v={feeLabel(q.feeUsdc)} />
          <Row k="Arrives in" v={q.etaLabel} />
        </div>
      )}

      {viaLifi && (
        <div className="rounded-xl bg-black/[0.03] p-3 text-sm">
          {lifiLoading && <p className="text-slate">Finding the best route…</p>}
          {!lifiLoading && lifiQ && (
            <>
              <Row k="You send" v={`${amount || "0"} USDC on ${src.label}`} />
              <Row k="They receive" v={`${(Number(lifiQ.toAmount) / 1e6).toFixed(2)} USDC on Solana`} />
              <Row k="Fee" v={`~$${(lifiQ.feeUSD + lifiQ.gasUSD).toFixed(2)}`} />
              <Row k="Arrives in" v={`~${Math.max(1, Math.round(lifiQ.durationSec / 60))} min`} />
            </>
          )}
          {!lifiLoading && !lifiQ && (
            <p className="text-slate">Enter a Solana address to see the details.</p>
          )}
        </div>
      )}

      <Button onClick={onSubmit} disabled={submitDisabled}>
        {busy ? "Moving…" : `Move to ${dst.label}`}
      </Button>

      {note && (
        <p className={`text-sm ${isError ? "text-alert" : "text-slate"}`}>{note}</p>
      )}
      {burnTx && (
        <a className="text-xs font-semibold text-sky-deep underline" href={src.explorerTx(burnTx)} target="_blank" rel="noreferrer">
          View on {src.label} ↗
        </a>
      )}
      {mintTx && (
        <a className="text-xs font-semibold text-sky-deep underline" href={dst.explorerTx(mintTx)} target="_blank" rel="noreferrer">
          View on {dst.label} ↗
        </a>
      )}
    </Card>
  );
}

function feeLabel(v: bigint): string {
  if (v === 0n) return "Free";
  const usd = Number(v) / 1_000_000;
  if (usd < 0.01) return `~$${usd.toFixed(4)}`;
  return `${usd.toFixed(2)} USDC`;
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-slate">{k}</span>
      <span className="font-semibold text-ink">{v}</span>
    </div>
  );
}
