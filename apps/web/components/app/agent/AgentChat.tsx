"use client";

// The Pesarc agent. Tell it what you need in plain language (send money, pay a
// bill, top up airtime, spin up a market); it understands and settles in the
// user's own currency. Provider-agnostic LLM brain lives in sdk/llm/extract.ts.

import { motion } from "framer-motion";
import {
  ArrowUp,
  Bot,
  ShieldCheck,
  Mic,
  Square,
  Paperclip,
} from "@/components/icons";
import { Card } from "@/components/app/ui";
import { currencyName } from "@pesarc/sdk/money";
import { EXAMPLES } from "./helpers";
import { useAgentChat } from "./useAgentChat";
import { MessageList } from "./MessageList";
import { ChatHistory } from "./ChatHistory";
import { AgentCapabilities } from "./AgentCapabilities";

export default function AgentChat() {
  const {
    msgs,
    input,
    setInput,
    busy,
    budget,
    threads,
    activeId,
    endRef,
    fileRef,
    speech,
    newChat,
    openThread,
    deleteThread,
    send,
    uploadFile,
  } = useAgentChat();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-6 md:py-10">
      <div className="mb-5">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-sky uppercase tracking-widest mb-1">
          <Bot className="w-4 h-4" /> Pesarc agent
        </div>
        <h1 className="text-[27px] font-extrabold tracking-tight text-harbor mb-1.5">
          Just say what to send
        </h1>
        <p className="text-slate max-w-xl">
          Tell it in plain language, or attach a CSV of recipients, and it drafts
          the payout and settles peer-to-peer in your own currency.
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
                {currencyName(budget.token)} {Math.round(budget.remaining).toLocaleString()}
              </span>
              <span className="text-xs text-slate">
                of {currencyName(budget.token)} {budget.cap.toLocaleString()} cap
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
              The agent can only spend up to this limit, which you set.
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
      <MessageList msgs={msgs} busy={busy} endRef={endRef} />

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
          placeholder={
            speech.listening
              ? "Listening…"
              : speech.supported
                ? "Speak or type, e.g. buy 1GB of MTN data"
                : "e.g. send 50,000 naira to Ghana"
          }
          aria-label="Message the agent"
          className="flex-1 bg-snow rounded-field border border-fog px-4 py-3 text-[15px] text-ink placeholder:text-slate/70 shadow-card-flat focus:outline-none focus:border-sky/50"
        />
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.tsv,.zip,.txt,.md,text/csv,application/zip,text/plain"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadFile(f);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          aria-label="Attach a file for the agent to read"
          title="Attach a CSV or ZIP of recipients"
          className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 border bg-snow text-slate border-fog hover:text-ink hover:border-slate/40 transition disabled:opacity-40"
        >
          <Paperclip className="w-5 h-5" />
        </button>
        {speech.supported && (
          <button
            type="button"
            onClick={speech.toggle}
            aria-label={speech.listening ? "Stop listening" : "Speak to the agent"}
            className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 border transition ${
              speech.listening
                ? "bg-sky text-white border-sky animate-pulse"
                : "bg-snow text-slate border-fog hover:text-ink hover:border-slate/40"
            }`}
          >
            {speech.listening ? <Square className="w-4 h-4" /> : <Mic className="w-5 h-5" />}
          </button>
        )}
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
