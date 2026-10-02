"use client";

// The agent's multi-hop route, rendered in chat: the planned path, a Test/Live
// choice, and a Start button. Once started it runs each leg with the in-app smart
// wallet (gasless), waits for CCTP settlement between hops, and shows the burn +
// mint transaction for every leg as it lands. Moving funds needs a deliberate
// tap, so nothing runs until the user presses Start.

import { useState } from "react";
import { ArrowRight, Check, ExternalLink, Sparkles } from "@/components/icons";
import { Button, Segmented } from "@/components/app/ui";
import type { CctpNetwork } from "@pesarc/sdk/chain/cctp/network";
import type { RoutePlan } from "@pesarc/sdk/agent/run";
import { useRouteRunner, type LegPhase } from "./useRouteRunner";

const PHASE_LABEL: Record<LegPhase, string> = {
  pending: "Waiting",
  switching: "Switching network",
  sending: "Signing & sending",
  settling: "Settling on-chain",
  done: "Settled",
  error: "Failed",
};

function Dot({ phase }: { phase: LegPhase }) {
  if (phase === "done") return <Check className="h-4 w-4 text-harbor" strokeWidth={2.5} />;
  if (phase === "error") return <span className="h-2.5 w-2.5 rounded-full bg-alert" />;
  if (phase === "pending") return <span className="h-2 w-2 rounded-full bg-slate/30" />;
  return (
    <span className="flex gap-0.5">
      <span className="h-1 w-1 animate-bounce rounded-full bg-sky [animation-delay:-0.2s]" />
      <span className="h-1 w-1 animate-bounce rounded-full bg-sky [animation-delay:-0.1s]" />
      <span className="h-1 w-1 animate-bounce rounded-full bg-sky" />
    </span>
  );
}

export function RouteCard({ plan }: { plan: RoutePlan }) {
  const runner = useRouteRunner();
  const [network, setNetwork] = useState<CctpNetwork>("testnet");
  const [err, setErr] = useState("");
  const running = runner.status === "running";
  const started = runner.status !== "idle";

  const begin = () => {
    setErr("");
    const problem = runner.start(plan, network);
    if (problem) setErr(problem);
  };

  return (
    <div className="mt-3 rounded-2xl border border-sky/30 bg-sky-tint/20 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-sky" />
        <span className="text-xs font-bold uppercase tracking-widest text-sky">
          Confirm swap &middot; {plan.chains.length - 1} {plan.chains.length - 1 === 1 ? "hop" : "hops"}
        </span>
      </div>

      {/* Exactly what will move — the user affirms this is correct before signing. */}
      {!started && (
        <div className="mb-3 rounded-xl bg-white/70 px-3 py-2.5">
          <div className="text-[11px] font-bold uppercase tracking-widest text-slate">You&apos;re swapping</div>
          <div className="text-[15px] font-bold text-harbor">
            {plan.amount ? `${plan.amount} ` : ""}USDC &middot; {plan.chains[0]} <ArrowRight className="inline h-3.5 w-3.5 text-slate" /> {plan.chains[plan.chains.length - 1]}
          </div>
          <div className="mt-0.5 text-[12px] text-slate">Check the token, amount and chains are correct, then confirm.</div>
        </div>
      )}

      {/* Planned path */}
      <div className="mb-3 flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {plan.chains.map((c, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <span className="rounded-full bg-white px-2.5 py-1 text-[13px] font-bold text-harbor border border-black/[0.06]">{c}</span>
            {i < plan.chains.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-slate" />}
          </span>
        ))}
      </div>

      {!started ? (
        <>
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="text-[13px] text-slate">
              {plan.amount ? `${plan.amount} USDC` : "USDC"} &middot; gasless &middot; signed in your wallet
            </span>
            <Segmented
              aria-label="Network"
              size="sm"
              value={network}
              onChange={(v) => setNetwork(v as CctpNetwork)}
              options={[
                { value: "testnet", label: "Test" },
                { value: "mainnet", label: "Live" },
              ]}
            />
          </div>
          {network === "mainnet" && (
            <p className="mb-2 text-[12px] font-semibold text-alert">Live moves real USDC across every hop.</p>
          )}
          <Button onClick={begin} block>
            Confirm &amp; swap
          </Button>
          {err && <p className="mt-2 text-[13px] text-alert">{err}</p>}
        </>
      ) : (
        <ul className="space-y-2.5">
          {runner.legs.map((leg, i) => {
            const st = runner.states[i] ?? { phase: "pending" as LegPhase };
            return (
              <li key={i} className="rounded-xl bg-white/70 px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[14px] font-semibold text-harbor">
                    <span className="flex w-4 justify-center">
                      <Dot phase={st.phase} />
                    </span>
                    {leg.fromLabel} <ArrowRight className="h-3.5 w-3.5 text-slate" /> {leg.toLabel}
                  </div>
                  <span
                    className={`text-[12px] font-medium ${st.phase === "error" ? "text-alert" : st.phase === "done" ? "text-harbor" : "text-slate"}`}
                  >
                    {PHASE_LABEL[st.phase]}
                  </span>
                </div>
                {(st.burnTx || st.mintTx || st.note) && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 pl-6 text-[12px]">
                    {st.burnTx && (
                      <a href={runner.explorerTx(leg.fromCctp, st.burnTx)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sky hover:underline">
                        Sent on {leg.fromLabel} <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {st.mintTx && (
                      <a href={runner.explorerTx(leg.toCctp, st.mintTx)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sky hover:underline">
                        Arrived on {leg.toLabel} <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {st.note && <span className="text-alert">{st.note}</span>}
                  </div>
                )}
                {/* This hop is on another chain: prompt the user to switch their
                    in-app network, then it signs once the wallet is ready there. */}
                {i === runner.activeIdx && st.phase === "switching" && (
                  runner.needsSwitch(i) ? (
                    <div className="mt-2 pl-6">
                      <Button onClick={() => runner.switchTo(i)}>Switch to {leg.fromLabel}</Button>
                      <p className="mt-1 text-[12px] text-slate">
                        Change your network to {leg.fromLabel} to sign this hop in your wallet.
                      </p>
                    </div>
                  ) : !runner.sourceReady(i) ? (
                    <p className="mt-1.5 pl-6 text-[12px] text-slate">
                      Getting your wallet ready on {leg.fromLabel}…
                    </p>
                  ) : null
                )}
              </li>
            );
          })}
          {runner.status === "done" && (
            <li className="flex items-center gap-1.5 pt-1 text-[13px] font-semibold text-harbor">
              <Check className="h-4 w-4" /> Route complete. Every hop settled on-chain.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
