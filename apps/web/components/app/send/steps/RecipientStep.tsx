"use client";

import { useEffect, useState } from "react";
import { ArrowRight, ChevronRight, Search } from "@/components/icons";
import { RECIPIENTS, initials, type Recipient } from "@pesarc/sdk/account";
import { type PayoutMethod } from "@pesarc/sdk/quote";
import { authedFetch } from "@pesarc/sdk/api/client";
import type { SavedRecipient } from "@pesarc/sdk/recipients";
import { Avatar, Button, Card, Segmented } from "@/components/app/ui";
import BankDetails, { type BankDestination } from "../BankDetails";
import {
  detectPhone,
  isEvmAddress,
  recipientFromAddress,
  recipientFromBank,
  recipientFromPhone,
  savedToRecipient,
} from "../helpers";

export function RecipientStep({
  onSelect,
}: {
  onSelect: (
    r: Recipient,
    opts?: { bankDest?: BankDestination; payout?: PayoutMethod; address?: string },
  ) => void;
}) {
  const [mode, setMode] = useState<"people" | "bank" | "wallet">("people");
  const [query, setQuery] = useState("");
  const [bankDest, setBankDest] = useState<BankDestination | null>(null);
  const [walletAddr, setWalletAddr] = useState("");
  const [saved, setSaved] = useState<Recipient[]>([]);

  // Load the account's saved recipients (people you've sent to before).
  useEffect(() => {
    let alive = true;
    authedFetch("/api/recipients")
      .then((r) => r.json())
      .then((d) => {
        if (alive && d?.ok) setSaved((d.recipients as SavedRecipient[]).map(savedToRecipient));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Saved recipients first, then the seed contacts (deduped by handle).
  const contacts = [...saved, ...RECIPIENTS.filter((m) => !saved.some((s) => s.handle === m.handle))];
  const recents = saved.length ? saved.slice(0, 5) : RECIPIENTS.filter((r) => r.recent);
  const rest = contacts.filter((c) => !recents.some((x) => x.handle === c.handle));
  const filtered = query
    ? contacts.filter(
        (r) =>
          r.name.toLowerCase().includes(query.toLowerCase()) ||
          r.handle.toLowerCase().includes(query.toLowerCase())
      )
    : contacts;
  const phone = detectPhone(query);
  const showNewPhone = !!phone && filtered.length === 0;

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight text-ink mb-1.5">
        Who are you sending to?
      </h1>
      <p className="text-slate mb-5">
        Send to a contact, a phone number, a bank account, or a wallet address.
      </p>

      <div className="mb-5">
        <Segmented
          aria-label="Recipient type"
          value={mode}
          size="sm"
          onChange={(v) => setMode(v as "people" | "bank" | "wallet")}
          options={[
            { value: "people", label: "Contact" },
            { value: "bank", label: "Bank" },
            { value: "wallet", label: "Wallet" },
          ]}
        />
      </div>

      {mode === "people" && (
        <>
          <div className="relative mb-6">
            <Search className="w-4 h-4 text-slate absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, phone, or @alias"
              aria-label="Search recipients"
              className="w-full bg-snow rounded-field border border-fog pl-11 pr-4 py-3.5 text-[15px] text-ink placeholder:text-slate/70 shadow-card-flat focus:outline-none focus:border-sky/50 focus:ring-2 focus:ring-sky/15 transition"
            />
          </div>

          {showNewPhone && phone && (
            <button onClick={() => onSelect(recipientFromPhone(phone))} className="w-full mb-6">
              <Card className="flex items-center gap-3 p-4 hover:border-sky/40 transition">
                <span className="w-10 h-10 rounded-full bg-sky-tint flex items-center justify-center text-sky">
                  <ArrowRight className="w-5 h-5" />
                </span>
                <div className="text-left">
                  <div className="font-semibold text-ink">Send to {phone.pretty}</div>
                  <div className="text-sm text-slate">
                    {phone.flag} {phone.country} · receives {phone.ccy}
                  </div>
                </div>
              </Card>
            </button>
          )}

          {!query && (
            <p className="text-xs font-semibold text-slate uppercase tracking-widest mb-3">
              Recent
            </p>
          )}
          <div className="space-y-2">
            {(query ? filtered : recents).map((r) => (
              <RecipientRow key={r.id} r={r} onSelect={onSelect} />
            ))}
          </div>

          {!query && rest.length > 0 && (
            <>
              <p className="text-xs font-semibold text-slate uppercase tracking-widest mt-6 mb-3">
                All contacts
              </p>
              <div className="space-y-2">
                {rest.map((r) => (
                  <RecipientRow key={r.id} r={r} onSelect={onSelect} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {mode === "bank" && (
        <>
          <p className="text-slate text-sm mb-3">
            Enter the account and we&apos;ll confirm the name before you send.
          </p>
          <BankDetails onChange={setBankDest} />
          <Button
            size="lg"
            block
            className="mt-5"
            disabled={!bankDest}
            onClick={() =>
              bankDest && onSelect(recipientFromBank(bankDest), { bankDest, payout: "bank" })
            }
          >
            {bankDest?.accountName ? `Send to ${bankDest.accountName}` : "Continue"}
            <ArrowRight className="w-4 h-4" />
          </Button>
        </>
      )}

      {mode === "wallet" && (
        <>
          <p className="text-slate text-sm mb-3">
            Paste any wallet address. The funds settle on-chain straight to it.
          </p>
          <input
            value={walletAddr}
            onChange={(e) => setWalletAddr(e.target.value.trim())}
            placeholder="0x… wallet address"
            aria-label="Recipient wallet address"
            spellCheck={false}
            className="w-full bg-snow rounded-field border border-fog px-4 py-3.5 text-[15px] font-mono text-ink placeholder:text-slate/70 shadow-card-flat focus:outline-none focus:border-sky/50 focus:ring-2 focus:ring-sky/15 transition"
          />
          {walletAddr && !isEvmAddress(walletAddr) && (
            <p className="text-[12px] text-alert mt-2">Enter a valid 0x wallet address (42 chars).</p>
          )}
          <Button
            size="lg"
            block
            className="mt-5"
            disabled={!isEvmAddress(walletAddr)}
            onClick={() =>
              isEvmAddress(walletAddr) &&
              onSelect(recipientFromAddress(walletAddr), { payout: "wallet", address: walletAddr })
            }
          >
            Send to this wallet
            <ArrowRight className="w-4 h-4" />
          </Button>
        </>
      )}
    </div>
  );
}

function RecipientRow({
  r,
  onSelect,
}: {
  r: Recipient;
  onSelect: (r: Recipient) => void;
}) {
  return (
    <button onClick={() => onSelect(r)} className="w-full">
      <Card className="flex items-center gap-3 p-3.5 hover:border-sky/40 hover:shadow-pop-sm transition">
        <Avatar initials={initials(r.name)} color={r.initialsColor} />
        <div className="text-left flex-1 min-w-0">
          <div className="font-semibold text-ink truncate">{r.name}</div>
          <div className="text-sm text-slate truncate">
            {r.flag} {r.handle}
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-slate shrink-0" />
      </Card>
    </button>
  );
}
