"use client";

// The Pesarc settlement agent — Celo "Agents at Work" submission.
// Tell it what to send in plain language; it turns that into an on-chain
// intent and settles it peer-to-peer in local currency, no dollar in the path.

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp, Check, ExternalLink, Loader2, Sparkles, Bot, ShieldCheck } from "lucide-react";
import { Card } from "@/components/app/ui";
import { fetchAgentBudget, type AgentBudget } from "@pesarc/sdk/agent-budget";

/** Pull the first amount out of a message, e.g. "send 50,000 naira" → 50000. */
function parseAmount(text: string): number {
  const m = text.replace(/,/g, "").match(/\d+(\.\d+)?/);
  return m ? Number(m[0]) : 0;
}

type Msg =
  | { role: "user"; text: string }
  | {
      role: "agent";
      text: string;
      matched?: boolean;
      submitUrl?: string;
      settlements?: { kind: string; url: string }[];
      pending?: boolean;
    };

const EXAMPLES = [
  "Send 50,000 naira to Ghana",
  "Move 200 cedis to Kenya for 0x1111111111111111111111111111111111111111",
  "Pay 30,000 shillings to Nigeria",
];

export default function AgentChat() {
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "agent",
      text:
        "Hi — I'm Pesarc's settlement agent on Celo. Tell me what you'd like to send between naira, cedis, and shillings, and I'll settle it peer-to-peer in local currency, with no US dollar in the path. Try one of the examples below.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [budget, setBudget] = useState<AgentBudget | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    fetchAgentBudget().then((b) => alive && setBudget(b));
    return () => {
      alive = false;
    };
  }, []);

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || busy) return;
      setMsgs((m) => [...m, { role: "user", text }]);
      setInput("");
      setBusy(true);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      try {
        const res = await fetch("/api/agent/settle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text }),
        });
        const data = await res.json();
        setMsgs((m) => [
          ...m,
          {
            role: "agent",
            text: data.reply ?? "Something went wrong.",
            matched: data.matched,
            submitUrl: data.submitUrl,
            settlements: data.settlements,
            pending: data.ok && !data.matched && !data.needsInput,
          },
        ]);
        // Reflect the spend against the on-chain session-key cap.
        if (data.ok && !data.needsInput) {
          const amt = parseAmount(text);
          if (amt > 0) {
            setBudget((b) =>
              b ? { ...b, remaining: Math.max(0, b.remaining - amt) } : b,
            );
          }
        }
      } catch {
        setMsgs((m) => [...m, { role: "agent", text: "I couldn't reach the network — try again." }]);
      }
      setBusy(false);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    },
    [busy],
  );

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-8 md:py-12">
      <div className="mb-5">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-sky uppercase tracking-widest mb-1">
          <Bot className="w-4 h-4" /> Settlement agent · Celo
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-ink mb-1.5">
          Just say what to send
        </h1>
        <p className="text-slate">
          The agent turns plain language into an on-chain settlement and matches
          it peer-to-peer — local currency, zero dollars.
        </p>
      </div>

      {budget && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="p-4 mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-harbor">
                <ShieldCheck className="w-4 h-4 text-sky" /> Agent budget · today
              </span>
              <span
                className={`text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 ${
                  budget.live ? "bg-sky-tint text-sky-deep" : "bg-black/[0.05] text-slate"
                }`}
              >
                {budget.live ? "Live" : "Demo"}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-semibold numerals text-harbor">
                {budget.token} {Math.round(budget.remaining).toLocaleString()}
              </span>
              <span className="text-xs text-slate">
                of {budget.token} {budget.cap.toLocaleString()} cap
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-black/[0.06] overflow-hidden mt-2">
              <motion.div
                className="h-full bg-sky rounded-full"
                initial={false}
                animate={{
                  width: `${Math.max(0, Math.min(100, (budget.remaining / budget.cap) * 100))}%`,
                }}
                transition={{ type: "spring", stiffness: 200, damping: 26 }}
              />
            </div>
            <p className="text-[11px] text-slate mt-2">
              The agent can only spend up to this cap — enforced on-chain by your session key.
            </p>
          </Card>
        </motion.div>
      )}

      <div className="space-y-3 mb-4">
        {msgs.map((m, i) =>
          m.role === "user" ? (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="flex justify-end"
            >
              <div className="bg-sky text-white rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[85%] text-[15px]">
                {m.text}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="flex justify-start"
            >
              <div className="max-w-[90%]">
                <Card className="rounded-2xl rounded-bl-sm px-4 py-3 text-[15px] text-ink">
                  {m.text}
                  {(m.submitUrl || m.settlements?.length) && (
                    <div className="mt-2.5 pt-2.5 border-t border-black/[0.06] space-y-1.5">
                      {m.matched && (
                        <div className="flex items-center gap-1.5 text-xs text-sky font-medium">
                          <Check className="w-3.5 h-3.5" /> Matched peer-to-peer · zero USD
                        </div>
                      )}
                      {m.pending && (
                        <div className="flex items-center gap-1.5 text-xs text-harbor font-medium">
                          <Sparkles className="w-3.5 h-3.5" /> Waiting for opposing flow
                        </div>
                      )}
                      {m.submitUrl && (
                        <a
                          href={m.submitUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-sky hover:underline"
                        >
                          Intent on-chain <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {m.settlements?.map((s, j) => (
                        <a
                          key={j}
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block text-xs text-sky hover:underline"
                        >
                          Settlement ({s.kind}) <ExternalLink className="w-3 h-3 inline" />
                        </a>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            </motion.div>
          ),
        )}
        {busy && (
          <div className="flex justify-start">
            <Card className="rounded-2xl rounded-bl-sm px-4 py-3">
              <Loader2 className="w-4 h-4 animate-spin text-sky" />
            </Card>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {msgs.length <= 1 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {EXAMPLES.map((e) => (
            <button
              key={e}
              onClick={() => send(e)}
              className="text-xs bg-snow border border-fog rounded-full px-3 py-1.5 text-ink/80 hover:border-sky/40 transition"
            >
              {e}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2 sticky bottom-4"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. send 50,000 naira to Ghana"
          aria-label="Message the agent"
          className="flex-1 bg-snow rounded-field border border-fog px-4 py-3 text-[15px] text-ink placeholder:text-slate/70 shadow-card-flat focus:outline-none focus:border-sky/50"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          aria-label="Send"
          className="w-12 h-12 rounded-full bg-sky text-white flex items-center justify-center disabled:opacity-40 shrink-0"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}
