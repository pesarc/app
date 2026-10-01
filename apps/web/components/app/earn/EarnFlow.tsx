"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  PiggyBank,
  Radio,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "@/components/icons";
import { POOLS, poolApy, VAULT_POOL_ID, type Pool } from "@pesarc/sdk/earn";
import { fetchLiveCorridorTvl, liveTvlAvailable } from "@pesarc/sdk/chain/livePool";
import { fetchVaultSnapshot, type VaultSnapshot } from "@pesarc/sdk/chain/vault-read";
import { chainByKey } from "@pesarc/sdk/chain/registry";
import { authedFetch, authedPostJson } from "@pesarc/sdk/api/client";
import { ACCOUNT } from "@pesarc/sdk/account";
import { formatMoney, CURRENCIES } from "@pesarc/sdk/money";
import { defaultStablecoin, currencyOf } from "@pesarc/sdk/stablecoins";
import { useUIMode } from "@pesarc/sdk/ui-mode";
import { usePrefs } from "@pesarc/sdk/prefs";
import { useLiveBalance } from "@pesarc/sdk/chain/useLiveBalance";
import { useSmartWallet } from "@pesarc/sdk/wallet/smartWallet";
import { useActiveEvmChain } from "@pesarc/sdk/chain/activeChain";
import { corridorVaultFor, evmVaultDeposit, evmVaultWithdraw } from "@pesarc/sdk/chain/vault-write";
import AllocationBreakdown from "./AllocationBreakdown";
import { Button, Card } from "@/components/app/ui";
import { StablecoinSelect } from "@/components/app/StablecoinSelect";
import NetworkSwitcher from "@/components/app/NetworkSwitcher";
import { Pagination, usePaged } from "@/components/app/Pagination";

const POOLS_PER_PAGE = 4;

type Position = { poolId: string; principal: number };

/** POOLS with the live corridor's TVL overlaid from on-chain when available. */
function useLivePools(): Pool[] {
  const [tvl, setTvl] = useState<number | null>(null);
  useEffect(() => {
    if (!liveTvlAvailable()) return;
    let ok = true;
    fetchLiveCorridorTvl().then((r) => {
      if (ok && r) setTvl(r.tvlUsd);
    });
    return () => {
      ok = false;
    };
  }, []);
  return useMemo(
    () => POOLS.map((p) => (p.live && tvl != null ? { ...p, tvlUsd: tvl } : p)),
    [tvl],
  );
}

export default function EarnFlow() {
  const { isAdvanced } = useUIMode();
  const basePools = useLivePools();
  const smart = useSmartWallet();
  const { chain } = useActiveEvmChain();
  const [positions, setPositions] = useState<Position[]>([]);
  const [depositPool, setDepositPool] = useState<Pool | null>(null);

  // On-chain Earn: when a CorridorVault is deployed for the active chain and the
  // smart wallet is ready, deposits/withdrawals go through the real ERC-4626
  // vault (gasless). The server ledger mirrors it for display. Chains without a
  // vault stay ledger-only (unchanged).
  const vault = corridorVaultFor(chain.key);
  const usdc = (chain.tokens as Record<string, `0x${string}`>)?.USD;
  const onChainEarn = Boolean(vault && usdc && smart.ready && smart.address);

  // Read the live vault (TVL + the user's real position) so Earn shows the
  // on-chain CorridorVault, not an illustrative venue. Re-reads when the chain,
  // vault or wallet changes, and after a deposit/withdraw settles.
  const [snap, setSnap] = useState<VaultSnapshot | null>(null);
  const [snapTick, setSnapTick] = useState(0);
  useEffect(() => {
    const cfg = chainByKey(chain.key);
    if (!vault || !cfg) {
      setSnap(null);
      return;
    }
    let ok = true;
    fetchVaultSnapshot(cfg, vault, smart.address as `0x${string}` | undefined).then((s) => {
      if (ok) setSnap(s);
    });
    return () => {
      ok = false;
    };
  }, [chain.key, vault, smart.address, snapTick]);

  // When the vault is live, overlay its pool with the real on-chain TVL and venue
  // so the Earn list reflects the CorridorVault instead of an illustrative label.
  const pools = useMemo(() => {
    if (!onChainEarn || !snap) return basePools;
    return basePools.map((p) =>
      p.id === VAULT_POOL_ID
        ? { ...p, venue: "Pesarc vault" as const, live: true, tvlUsd: snap.tvl }
        : p,
    );
  }, [basePools, onChainEarn, snap]);

  // Positions are durable server-side records now — load the account's own.
  useEffect(() => {
    let ok = true;
    authedFetch("/api/earn")
      .then((r) => r.json())
      .then((d) => {
        if (ok && d.ok) {
          setPositions(d.positions.map((p: any) => ({ poolId: p.poolId, principal: p.principal })));
        }
      })
      .catch(() => {});
    return () => {
      ok = false;
    };
  }, []);

  const deposit = async (poolId: string, principal: number) => {
    setDepositPool(null);
    // Real on-chain deposit first when a vault is live; only record it on success.
    if (onChainEarn) {
      try {
        const hash = await evmVaultDeposit(smart, { vault: vault!, asset: usdc!, amount: principal });
        if (!hash) return;
        setSnapTick((t) => t + 1); // re-read the vault so the position/TVL update
      } catch {
        return;
      }
    }
    setPositions((prev) => {
      const existing = prev.find((p) => p.poolId === poolId);
      if (existing) {
        return prev.map((p) => (p.poolId === poolId ? { ...p, principal: p.principal + principal } : p));
      }
      return [...prev, { poolId, principal }];
    });
    // Mirror to the ledger for display (best-effort).
    authedPostJson("/api/earn", { poolId, amount: principal, chainKey: chain.key }).catch(() => {});
  };

  const withdraw = async (poolId: string) => {
    const pos = positions.find((p) => p.poolId === poolId);
    if (onChainEarn && pos && pos.principal > 0) {
      try {
        const hash = await evmVaultWithdraw(smart, { vault: vault!, amount: pos.principal });
        if (!hash) return;
        setSnapTick((t) => t + 1); // re-read the vault so the position/TVL update
      } catch {
        return;
      }
    }
    setPositions((prev) => prev.filter((p) => p.poolId !== poolId));
    authedFetch(`/api/earn?poolId=${encodeURIComponent(poolId)}`, { method: "DELETE" }).catch(() => {});
  };

  if (depositPool) {
    return (
      <DepositPanel
        pool={depositPool}
        onBack={() => setDepositPool(null)}
        onConfirm={(amt) => deposit(depositPool.id, amt)}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-6 md:py-10">
      <div className="flex items-center gap-3 mb-1.5">
        <h1 className="text-[27px] font-extrabold tracking-tight text-harbor">
          Earn
        </h1>
      </div>
      <p className="text-slate mb-6 max-w-xl">
        Put your money to work earning fees on a corridor. Bounded, insured
        risk — withdraw anytime.
      </p>

      {/* Live on-chain vault readout — real TVL and the user's own position. */}
      {onChainEarn && snap && <VaultStrip snap={snap} chainLabel={chain.label} />}
      {/* Where the pooled deposits are working across markets. */}
      {onChainEarn && vault && <AllocationBreakdown vault={vault} chainKey={chain.key} />}

      {/* Active positions */}
      {positions.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 mb-7">
          {positions.map((pos) => {
            const pool = pools.find((p) => p.id === pos.poolId)!;
            return (
              <PositionCard
                key={pos.poolId}
                pool={pool}
                principal={pos.principal}
                onWithdraw={() => withdraw(pos.poolId)}
                onAdd={() => setDepositPool(pool)}
              />
            );
          })}
        </div>
      )}

      {isAdvanced ? (
        <AdvancedList pools={pools} onPick={setDepositPool} />
      ) : (
        <BasicChoices pools={pools} onPick={setDepositPool} />
      )}
    </div>
  );
}

/* ---------------- Basic: one-tap Save / Invest ---------------- */

function BasicChoices({ pools, onPick }: { pools: Pool[]; onPick: (p: Pool) => void }) {
  const save = pools.find((p) => p.tier === "save")!;
  const invest = pools.find((p) => p.tier === "invest")!;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <ChoiceCard
        pool={save}
        title="Save"
        subtitle="Low-risk reserve · steady return"
        icon={PiggyBank}
        onPick={onPick}
      />
      <ChoiceCard
        pool={invest}
        title="Invest"
        subtitle="Recommended corridor · higher return"
        icon={TrendingUp}
        recommended
        onPick={onPick}
      />
      <p className="sm:col-span-2 text-xs text-slate leading-relaxed pt-2 px-1">
        Returns come from corridor fees, not interest on your balance. Each
        option is covered by the Safety Module. Switch to{" "}
        <span className="font-medium text-ink">Advanced</span> to choose
        specific pools and see the full rate breakdown.
      </p>
    </div>
  );
}

function ChoiceCard({
  pool,
  title,
  subtitle,
  icon: Icon,
  recommended,
  onPick,
}: {
  pool: Pool;
  title: string;
  subtitle: string;
  icon: typeof PiggyBank;
  recommended?: boolean;
  onPick: (p: Pool) => void;
}) {
  return (
    <button onClick={() => onPick(pool)} className="w-full text-left">
      <Card className="p-5 hover:border-sky/40 hover:shadow-pop-sm transition">
        <div className="flex items-center gap-3 mb-3">
          <span className="w-11 h-11 rounded-2xl bg-sky-tint flex items-center justify-center text-sky">
            <Icon className="w-5 h-5" strokeWidth={1.75} />
          </span>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-ink text-lg">{title}</span>
              {recommended && (
                <span className="text-[10px] font-semibold uppercase tracking-widest text-sky bg-sky-tint px-2 py-0.5 rounded-full">
                  Popular
                </span>
              )}
            </div>
            <div className="text-sm text-slate">{subtitle}</div>
          </div>
          <ArrowRight className="w-5 h-5 text-slate" />
        </div>
        <div className="flex items-center justify-between pt-3 border-t border-black/[0.06]">
          <InsuredBadge />
          <div className="text-right">
            <span className="text-2xl font-semibold text-sky numerals">
              {poolApy(pool)}%
            </span>
            <span className="text-xs text-slate ml-1">/ year</span>
          </div>
        </div>
      </Card>
    </button>
  );
}

/* ---------------- Advanced: full pool list ---------------- */

function AdvancedList({ pools, onPick }: { pools: Pool[]; onPick: (p: Pool) => void }) {
  const paged = usePaged(pools, POOLS_PER_PAGE);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold text-slate uppercase tracking-widest">
          All corridors
        </h2>
        <span className="text-xs text-slate">APY = fee + spread + rewards</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {paged.items.map((pool) => (
        <Card key={pool.id} className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="font-semibold text-ink flex items-center gap-2">
                <span>{pool.flags}</span> {pool.corridor}
                <PoolTag live={pool.live} />
              </div>
              <div className="text-xs text-slate mt-0.5">
                {pool.venue} · {pool.live ? "TVL" : "Target"} $
                {(pool.tvlUsd / 1_000_000).toFixed(2)}M · {pool.risk} risk
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-semibold text-sky numerals">
                {poolApy(pool)}%
              </div>
              <div className="text-[11px] text-slate">APY · indicative</div>
            </div>
          </div>

          {/* Breakdown */}
          <div className="grid grid-cols-3 gap-2 mb-3 text-center">
            <Breakdown label="Base fee" value={pool.baseFeeApy} />
            <Breakdown label="FX spread" value={pool.fxSpreadApy} />
            <Breakdown label="Rewards" value={pool.incentiveApy} />
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-black/[0.06]">
            <InsuredBadge />
            <Button size="md" onClick={() => onPick(pool)}>
              Deposit
            </Button>
          </div>
        </Card>
      ))}
      </div>

      <Pagination page={paged.page} pageCount={paged.pageCount} onChange={paged.setPage} />

      <p className="text-xs text-slate leading-relaxed pt-1 px-1">
        <span className="font-medium text-ink">Live</span> corridors read their
        pool size on-chain; others are launching soon and show target figures. APY
        figures are indicative until a pool is live. Corridor pools carry residual
        peg risk, backstopped by the Safety Module up to its coverage. Withdrawals
        are never frozen.
      </p>
    </div>
  );
}

function PoolTag({ live }: { live?: boolean }) {
  return live ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-sky/10 text-sky-deep text-[10px] font-bold uppercase tracking-wide px-2 py-0.5">
      <Radio className="w-3 h-3" /> Live
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-black/[0.05] text-slate text-[10px] font-bold uppercase tracking-wide px-2 py-0.5">
      Soon
    </span>
  );
}

function Breakdown({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-field bg-black/[0.03] py-2">
      <div className="text-sm font-semibold text-ink numerals">{value}%</div>
      <div className="text-[10px] text-slate uppercase tracking-wide">{label}</div>
    </div>
  );
}

/* ---------------- Deposit panel ---------------- */

function DepositPanel({
  pool,
  onBack,
  onConfirm,
}: {
  pool: Pool;
  onBack: () => void;
  onConfirm: (amount: number) => void;
}) {
  const { sendCurrency } = usePrefs();
  const { isAdvanced } = useUIMode();
  const [amountStr, setAmountStr] = useState("");
  const [payWith, setPayWith] = useState(defaultStablecoin(sendCurrency).symbol);
  const payCcy = currencyOf(payWith);
  const amount = parseFloat(amountStr) || 0;
  // Live on-chain balance of the selected stablecoin (demo fallback when no wallet).
  const bal = useLiveBalance(payCcy);
  const insufficient = bal.available && bal.amount !== undefined ? amount > bal.amount : false;
  const valid = amount > 0 && !insufficient;
  const projected = useMemo(
    () => (amount * poolApy(pool)) / 100,
    [amount, pool]
  );

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-8 md:py-12">
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={onBack}
          aria-label="Back"
          className="w-9 h-9 rounded-full bg-snow border border-fog flex items-center justify-center text-ink hover:border-black/20 transition shadow-card-flat"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Deposit
        </h1>
      </div>

      <Card className="p-4 mb-5 flex items-center justify-between">
        <div>
          <div className="font-semibold text-ink">
            {pool.flags} {pool.corridor}
          </div>
          <div className="text-xs text-slate">{pool.venue}</div>
        </div>
        <div className="text-right">
          <div className="text-xl font-semibold text-sky numerals">
            {poolApy(pool)}%
          </div>
          <div className="text-[11px] text-slate">APY · indicative</div>
        </div>
      </Card>

      <div className="mb-4">
        <StablecoinSelect value={payWith} onChange={setPayWith} label="Deposit with" />
      </div>

      {/* Network + live balance for the selected stablecoin (MetaMask-style). */}
      <div className="flex items-center justify-between mb-4 px-1">
        {isAdvanced ? <NetworkSwitcher /> : <span />}
        <span className="text-[13px] font-bold text-harbor">
          {bal.loading ? (
            <span className="text-slate">Checking…</span>
          ) : (
            <>
              {formatMoney(bal.amount ?? 0, payCcy)}
              {!bal.available && <span className="ml-1 text-[11px] font-semibold text-slate">demo</span>}
            </>
          )}
        </span>
      </div>

      <div className="text-center py-4">
        <label className="block text-xs font-semibold text-slate uppercase tracking-widest mb-3">
          Amount to deposit
        </label>
        <div className="flex items-center justify-center gap-1">
          <span className="text-4xl font-semibold text-ink/40">{CURRENCIES[payCcy].symbol}</span>
          <input
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value.replace(/[^0-9.]/g, ""))}
            inputMode="decimal"
            placeholder="0"
            aria-label="Deposit amount"
            className="w-[6ch] bg-transparent text-6xl font-semibold text-ink text-center outline-none numerals placeholder:text-ink/25"
          />
        </div>
        <p className={`mt-2 text-sm ${insufficient ? "font-bold text-alert" : "text-slate"}`}>
          {insufficient ? `Over your ${payWith} balance` : `Deposit in ${payWith}`}
        </p>
      </div>

      {valid && (
        <Card className="p-4 mb-5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate">Projected earnings</span>
            <span className="font-semibold text-sky numerals">
              ≈ {formatMoney(projected, payCcy)} / year
            </span>
          </div>
        </Card>
      )}

      <div className="flex items-center gap-2 text-sm text-slate mb-5 px-1">
        <ShieldCheck className="w-4 h-4 text-sky shrink-0" />
        Covered by the Safety Module · withdraw anytime
      </div>

      <Button size="lg" block disabled={!valid} onClick={() => onConfirm(amount)}>
        Confirm deposit
      </Button>
    </div>
  );
}

/* ---------------- Position card ---------------- */

function PositionCard({
  pool,
  principal,
  onWithdraw,
  onAdd,
}: {
  pool: Pool;
  principal: number;
  onWithdraw: () => void;
  onAdd: () => void;
}) {
  const projected = (principal * poolApy(pool)) / 100;
  return (
    <Card className="p-5 border-sky/30">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-sky" />
        <span className="text-xs font-semibold text-sky uppercase tracking-widest">
          Earning
        </span>
      </div>
      <div className="flex items-end justify-between mb-4">
        <div>
          <div className="text-xs text-slate mb-0.5">
            {pool.flags} {pool.corridor}
          </div>
          <div className="text-3xl font-semibold text-ink numerals">
            {formatMoney(principal, ACCOUNT.currency)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold text-sky numerals">
            {poolApy(pool)}%
          </div>
          <div className="text-[11px] text-slate">
            ≈ {formatMoney(projected, ACCOUNT.currency)}/yr
          </div>
        </div>
      </div>
      <div className="flex gap-3">
        <Button variant="secondary" block onClick={onWithdraw}>
          Withdraw
        </Button>
        <Button block onClick={onAdd}>
          Add
        </Button>
      </div>
    </Card>
  );
}

/* ---------------- Live vault strip ---------------- */

function VaultStrip({ snap, chainLabel }: { snap: VaultSnapshot; chainLabel: string }) {
  const usd = (n: number) =>
    "$" + n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return (
    <Card className="p-4 mb-7 border-sky/30">
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-flex items-center gap-1 rounded-full bg-sky/10 text-sky-deep text-[10px] font-bold uppercase tracking-wide px-2 py-0.5">
          <Radio className="w-3 h-3" /> Live vault
        </span>
        <span className="text-xs text-slate">Pesarc CorridorVault · {chainLabel}</span>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-slate mb-0.5">Your vault balance</div>
          <div className="text-2xl font-semibold text-ink numerals">{usd(snap.position)}</div>
        </div>
        <div>
          <div className="text-xs text-slate mb-0.5">Pool size (TVL)</div>
          <div className="text-2xl font-semibold text-ink numerals">{usd(snap.tvl)}</div>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-slate/80 leading-relaxed">
        Read live from the vault contract. Your balance grows with the vault's
        share price as the strategy earns; any headline rate is indicative.
      </p>
    </Card>
  );
}

function InsuredBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-sky">
      <Check className="w-3.5 h-3.5" /> Insured
    </span>
  );
}
