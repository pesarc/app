"use client";

// The Pesarc settlement agent — Celo "Agents at Work" submission.
// Tell it what to send in plain language; it turns that into an on-chain
// intent and settles it peer-to-peer in local currency, no dollar in the path.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowUp,
  Check,
  ExternalLink,
  Loader2,
  Sparkles,
  Bot,
  ShieldCheck,
  Plus,
  Trash2,
  MessageSquare,
  BarChart3,
} from "lucide-react";
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
      marketsUrl?: string;
    };

const EXAMPLES = [
  "Send 50,000 naira to Ghana",
  "Create a market: will USD/NGN cross ₦2,000 by June?",
  "New market: 2027 winner? options: Party A, Party B, Party C",
];

const GREETING: Msg = {
  role: "agent",
  text:
    "Hi — I'm Pesarc's settlement agent. Tell me what to send between naira, cedis and shillings and I'll settle it peer-to-peer in local currency — or say “create a market: …” and I'll spin up a prediction market for you. Try an example below.",
};

// ---- Chat history (per-device, localStorage) ----------------------------
type Thread = { id: string; title: string; msgs: Msg[]; updatedAt: number };
const HISTORY_KEY = "pesarc.agent.threads";
const MAX_THREADS = 30;

function loadThreads(): Thread[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    const list = raw ? (JSON.parse(raw) as Thread[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveThreads(list: Thread[]) {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, MAX_THREADS)));
  } catch {
    /* ignore */
  }
}

function relativeTime(ts: number): string {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export default function AgentChat() {
  const [msgs, setMsgs] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [budget, setBudget] = useState<AgentBudget | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const activeId = useRef<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    fetchAgentBudget().then((b) => alive && setBudget(b));
    return () => {
      alive = false;
    };
  }, []);

  // Load saved threads; reopen the most recent one so history persists across
  // visits (this is a per-device record — nothing leaves the browser).
  useEffect(() => {
    const list = loadThreads();
    setThreads(list);
    if (list.length && list[0].msgs.length) {
      activeId.current = list[0].id;
      setMsgs(list[0].msgs);
    }
  }, []);

  // Persist the running conversation into its thread after every exchange.
  useEffect(() => {
    if (!msgs.some((m) => m.role === "user")) return; // don't save an empty greeting
    const id = activeId.current ?? `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    activeId.current = id;
    const title = (msgs.find((m) => m.role === "user")?.text ?? "Chat").slice(0, 48);
    setThreads((prev) => {
      const rest = prev.filter((t) => t.id !== id);
      const next = [{ id, title, msgs, updatedAt: Date.now() }, ...rest].slice(0, MAX_THREADS);
      saveThreads(next);
      return next;
    });
  }, [msgs]);

  const newChat = useCallback(() => {
    activeId.current = null;
    setMsgs([GREETING]);
    setInput("");
  }, []);

  const openThread = useCallback((t: Thread) => {
    activeId.current = t.id;
    setMsgs(t.msgs.length ? t.msgs : [GREETING]);
    setInput("");
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "auto" }), 50);
  }, []);

  const deleteThread = useCallback((id: string) => {
    setThreads((prev) => {
      const next = prev.filter((t) => t.id !== id);
      saveThreads(next);
      return next;
    });
    if (activeId.current === id) {
      activeId.current = null;
      setMsgs([GREETING]);
    }
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
            marketsUrl: data.marketsUrl,
            pending: data.ok && !data.matched && !data.needsInput && !data.createdMarket,
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
    <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-6 md:py-10">
      <div className="mb-5">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-sky uppercase tracking-widest mb-1">
          <Bot className="w-4 h-4" /> Settlement agent · Celo
        </div>
        <h1 className="text-[27px] font-extrabold tracking-tight text-harbor mb-1.5">
          Just say what to send
        </h1>
        <p className="text-slate max-w-xl">
          The agent turns plain language into an on-chain settlement and matches
          it peer-to-peer — local currency, zero dollars.
        </p>
      </div>

      <div className="lg:grid lg:grid-cols-[340px_1fr] lg:gap-6 lg:items-start">
      <div className="space-y-4 mb-4 lg:mb-0 lg:sticky lg:top-20">
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
      <ChatHistory
        threads={threads}
        activeId={activeId.current}
        onNew={newChat}
        onOpen={openThread}
        onDelete={deleteThread}
      />
      <AgentCapabilities />
      </div>

      <div className="min-w-0">
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
                  {m.marketsUrl && (
                    <Link
                      href={m.marketsUrl}
                      className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-sky text-white text-xs font-bold px-3 py-1.5 hover:-translate-y-0.5 transition-transform"
                    >
                      <BarChart3 className="w-3.5 h-3.5" /> Open Markets
                    </Link>
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
      </div>
    </div>
  );
}

/* Per-device chat history — resume or clear past conversations. */
function ChatHistory({
  threads,
  activeId,
  onNew,
  onOpen,
  onDelete,
}: {
  threads: Thread[];
  activeId: string | null;
  onNew: () => void;
  onOpen: (t: Thread) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-bold uppercase tracking-widest text-slate">History</span>
        <button
          onClick={onNew}
          className="inline-flex items-center gap-1 rounded-full bg-sky text-white text-[12px] font-bold px-2.5 py-1 shadow-pop-sm hover:-translate-y-0.5 transition-transform"
        >
          <Plus className="w-3.5 h-3.5" /> New chat
        </button>
      </div>
      {threads.length === 0 ? (
        <p className="text-[12.5px] text-slate leading-snug">
          Your conversations will appear here — saved on this device.
        </p>
      ) : (
        <ul className="space-y-1 max-h-64 overflow-y-auto -mr-1 pr-1">
          {threads.map((t) => {
            const active = t.id === activeId;
            return (
              <li key={t.id} className="group flex items-center gap-1">
                <button
                  onClick={() => onOpen(t)}
                  className={`flex-1 min-w-0 flex items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-colors ${
                    active ? "bg-sky-tint/50" : "hover:bg-black/[0.03]"
                  }`}
                >
                  <MessageSquare
                    className={`w-3.5 h-3.5 shrink-0 ${active ? "text-sky-deep" : "text-slate"}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-harbor truncate">
                      {t.title}
                    </span>
                    <span className="block text-[11px] text-slate">{relativeTime(t.updatedAt)}</span>
                  </span>
                </button>
                <button
                  onClick={() => onDelete(t.id)}
                  aria-label="Delete conversation"
                  className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-slate opacity-0 group-hover:opacity-100 hover:text-alert hover:bg-alert/10 transition-opacity"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/* Bounded on-chain authority — what makes the agent safe to trust. */
function AgentCapabilities() {
  const items = [
    { icon: ShieldCheck, title: "Session-key spend cap", body: "Every action is metered against an on-chain cap and expiry you granted." },
    { icon: Bot, title: "ERC-8004 identity", body: "The agent has its own on-chain identity — actions are attributable, not anonymous." },
    { icon: Sparkles, title: "x402-metered tools", body: "Paid tools charge per call over x402; no standing access, no surprises." },
  ];
  return (
    <Card className="p-4">
      <div className="text-[11px] font-bold uppercase tracking-widest text-slate mb-3">
        Bounded, on-chain
      </div>
      <div className="space-y-3.5">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <div key={it.title} className="flex gap-3">
              <span className="w-8 h-8 shrink-0 rounded-full bg-sky-tint/60 flex items-center justify-center text-sky-deep">
                <Icon className="w-4 h-4" />
              </span>
              <div>
                <div className="text-[13.5px] font-bold text-harbor leading-tight">{it.title}</div>
                <div className="text-[12.5px] text-slate leading-snug mt-0.5">{it.body}</div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
