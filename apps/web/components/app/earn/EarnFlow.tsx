"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  PiggyBank,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { POOLS, poolApy, type Pool } from "@pesarc/sdk/earn";
import { ACCOUNT } from "@pesarc/sdk/account";
import { formatMoney } from "@pesarc/sdk/money";
import { useUIMode } from "@pesarc/sdk/ui-mode";
import { Button, Card } from "@/components/app/ui";

type Position = { poolId: string; principal: number };

export default function EarnFlow() {
  const { isAdvanced } = useUIMode();
  const [positions, setPositions] = useState<Position[]>([]);
  const [depositPool, setDepositPool] = useState<Pool | null>(null);

  const deposit = (poolId: string, principal: number) => {
    setPositions((prev) => {
      const existing = prev.find((p) => p.poolId === poolId);
      if (existing) {
        return prev.map((p) =>
          p.poolId === poolId ? { ...p, principal: p.principal + principal } : p
        );
      }
      return [...prev, { poolId, principal }];
    });
    setDepositPool(null);
  };

  const withdraw = (poolId: string) =>
    setPositions((prev) => prev.filter((p) => p.poolId !== poolId));

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

      {/* Active positions */}
      {positions.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 mb-7">
          {positions.map((pos) => {
            const pool = POOLS.find((p) => p.id === pos.poolId)!;
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
        <AdvancedList onPick={setDepositPool} />
      ) : (
        <BasicChoices onPick={setDepositPool} />
      )}
    </div>
  );
}

/* ---------------- Basic: one-tap Save / Invest ---------------- */

function BasicChoices({ onPick }: { onPick: (p: Pool) => void }) {
  const save = POOLS.find((p) => p.tier === "save")!;
  const invest = POOLS.find((p) => p.tier === "invest")!;

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

function AdvancedList({ onPick }: { onPick: (p: Pool) => void }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold text-slate uppercase tracking-widest">
          All corridors
        </h2>
        <span className="text-xs text-slate">APY = fee + spread + rewards</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {POOLS.map((pool) => (
        <Card key={pool.id} className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="font-semibold text-ink flex items-center gap-2">
                <span>{pool.flags}</span> {pool.corridor}
              </div>
              <div className="text-xs text-slate mt-0.5">
                {pool.venue} · TVL ${(pool.tvlUsd / 1_000_000).toFixed(2)}M ·{" "}
                {pool.risk} risk
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-semibold text-sky numerals">
                {poolApy(pool)}%
              </div>
              <div className="text-[11px] text-slate">APY</div>
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

      <p className="text-xs text-slate leading-relaxed pt-1 px-1">
        Variable APY. Corridor pools carry residual peg risk, backstopped by the
        Safety Module up to its coverage. Withdrawals are never frozen.
      </p>
    </div>
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
  const [amountStr, setAmountStr] = useState("");
  const amount = parseFloat(amountStr) || 0;
  const insufficient = amount > ACCOUNT.balance;
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
          <div className="text-[11px] text-slate">APY</div>
        </div>
      </Card>

      <div className="text-center py-4">
        <label className="block text-xs font-semibold text-slate uppercase tracking-widest mb-3">
          Amount to deposit
        </label>
        <div className="flex items-center justify-center gap-1">
          <span className="text-4xl font-semibold text-ink/40">£</span>
          <input
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value.replace(/[^0-9.]/g, ""))}
            inputMode="decimal"
            placeholder="0"
            aria-label="Deposit amount"
            className="w-[6ch] bg-transparent text-6xl font-semibold text-ink text-center outline-none numerals placeholder:text-ink/25"
          />
        </div>
        <p
          className={`mt-2 text-sm ${
            insufficient ? "text-alert font-medium" : "text-slate"
          }`}
        >
          {insufficient
            ? `Balance is ${formatMoney(ACCOUNT.balance, ACCOUNT.currency)}`
            : `Balance ${formatMoney(ACCOUNT.balance, ACCOUNT.currency)}`}
        </p>
      </div>

      {valid && (
        <Card className="p-4 mb-5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate">Projected earnings</span>
            <span className="font-semibold text-sky numerals">
              ≈ {formatMoney(projected, ACCOUNT.currency)} / year
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

function InsuredBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-sky">
      <Check className="w-3.5 h-3.5" /> Insured
    </span>
  );
}
