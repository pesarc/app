"use client";

// The Pesarc agent, kept deliberately simple: one clean column you can type or
// speak into, watch it think, and confirm before anything is sent. Tell it what
// you need in plain language (send money, pay a bill, top up airtime, spin up a
// market); it drafts the action, asks for a yes, then shows a receipt.

import { ArrowUp, Bot, Mic, Square, Paperclip, Plus } from "@/components/icons";
import { EXAMPLES } from "./helpers";
import { useAgentChat } from "./useAgentChat";
import { MessageList } from "./MessageList";
import SessionKeyGrant from "./SessionKeyGrant";

export default function AgentChat() {
  const {
    msgs,
    input,
    setInput,
    busy,
    thinking,
    thinkingStep,
    endRef,
    fileRef,
    speech,
    newChat,
    send,
    confirm,
    decline,
    uploadFile,
  } = useAgentChat();

  return (
    <div className="mx-auto w-full max-w-2xl px-4 sm:px-6 py-6 md:py-10 min-h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-sky uppercase tracking-widest mb-1">
            <Bot className="w-4 h-4" /> Pesarc agent
          </div>
          <h1 className="text-[26px] font-extrabold tracking-tight text-harbor">
            Just say what you need
          </h1>
          <p className="text-slate text-[15px] mt-0.5">
            In your own words. I&apos;ll show my work and always ask before I send.
          </p>
        </div>
        {msgs.some((m) => m.role === "user") && (
          <button
            onClick={newChat}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-fog bg-snow px-3 py-2 text-[13px] font-bold text-slate hover:text-ink hover:border-slate/40 transition"
          >
            <Plus className="w-4 h-4" /> New
          </button>
        )}
      </div>

      {/* Agent session-key grant (testnet + flag only; hides itself otherwise). */}
      <div className="mb-4">
        <SessionKeyGrant />
      </div>

      <div className="flex-1">
        <MessageList
          msgs={msgs}
          busy={busy}
          thinking={thinking}
          thinkingStep={thinkingStep}
          endRef={endRef}
          onConfirm={confirm}
          onDecline={decline}
        />
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
  );
}
