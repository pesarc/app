"use client";

// All chat state, persistence, streaming and upload logic for the Pesarc agent.
// The container (AgentChat.tsx) only renders what this hook exposes.

import { useCallback, useEffect, useRef, useState } from "react";
import { useSmartWallet } from "@pesarc/sdk/wallet/smartWallet";
import { useActiveEvmChain } from "@pesarc/sdk/chain/activeChain";
import { useSpeechInput } from "@/components/app/useSpeechInput";
import { fetchAgentBudget, type AgentBudget } from "@pesarc/sdk/agent-budget";
import type { ParsedUpload } from "@pesarc/sdk/agent/files";
import type { AgentDraft, AgentReceipt } from "@pesarc/sdk/agent/run";
import { AGENT_STEPS } from "@pesarc/sdk/agent/progress";
import type { Msg, Thread } from "./types";
import { GREETING, MAX_THREADS, loadThreads, saveThreads } from "./helpers";

/** Parse one SSE frame ("event: x\ndata: {...}") into {event, data}. */
function parseSse(frame: string): { event: string; data: unknown } | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (!dataLines.length) return null;
  try {
    return { event, data: JSON.parse(dataLines.join("\n")) };
  } catch {
    return null;
  }
}

export function useAgentChat() {
  const smart = useSmartWallet();
  const { chainKey } = useActiveEvmChain();
  const [msgs, setMsgs] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  // The active work-trace steps, and (when server-driven over SSE) the live step
  // index; undefined index = advance on the client's own timer.
  const [thinking, setThinking] = useState<string[] | undefined>(undefined);
  const [thinkingStep, setThinkingStep] = useState<number | undefined>(undefined);
  const [budget, setBudget] = useState<AgentBudget | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const activeId = useRef<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Voice input: live-fill the composer with what's spoken; the user reviews
  // and taps send. Hidden entirely where the browser has no Web Speech API.
  const speech = useSpeechInput(
    useCallback((text: string) => setInput(text), []),
  );

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
      setThinking(AGENT_STEPS.understand);
      setThinkingStep(undefined);
      setBusy(true);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      try {
        const res = await fetch("/api/agent/settle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, wallet: smart.address, chain: chainKey }),
        });
        const data = await res.json();
        // A money-moving action comes back as a `draft` to confirm; anything
        // else (a created market, a paid-in-full-info bill, a question) renders
        // as before.
        setMsgs((m) => [
          ...m,
          {
            role: "agent",
            text: data.reply ?? "Something went wrong.",
            matched: data.matched,
            submitUrl: data.submitUrl,
            settlements: data.settlements,
            marketsUrl: data.marketsUrl,
            billsUrl: data.billsUrl,
            crossChainUrl: data.crossChainUrl,
            route: data.route,
            draft: data.draft,
            draftState: data.draft ? "pending" : undefined,
          },
        ]);
      } catch {
        setMsgs((m) => [...m, { role: "agent", text: "I couldn't reach the network. Try again." }]);
      }
      setBusy(false);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    },
    [busy, smart.address, chainKey],
  );

  // The user consented to a drafted action: execute it and show the receipt.
  const confirm = useCallback(
    async (index: number, draft: AgentDraft) => {
      if (busy) return;
      setMsgs((m) => m.map((x, i) => (i === index ? { ...x, draftState: "confirmed" } : x)));
      setThinking(AGENT_STEPS[draft.type] ?? AGENT_STEPS.understand);
      setThinkingStep(0);
      setBusy(true);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      try {
        const res = await fetch("/api/agent/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
          body: JSON.stringify({ draft }),
        });

        // Stream live progress when the server sends SSE; else read plain JSON.
        let data: {
          ok?: boolean;
          reply?: string;
          matched?: boolean;
          submitUrl?: string;
          settlements?: { kind: string; url: string }[];
          billsUrl?: string;
          receipt?: AgentReceipt;
        } | null = null;
        const ctype = res.headers.get("content-type") ?? "";
        if (res.body && ctype.includes("text/event-stream")) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buf = "";
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            let sep: number;
            while ((sep = buf.indexOf("\n\n")) !== -1) {
              const frame = buf.slice(0, sep);
              buf = buf.slice(sep + 2);
              const ev = parseSse(frame);
              if (!ev) continue;
              if (ev.event === "step") setThinkingStep((ev.data as { index?: number }).index ?? 0);
              else if (ev.event === "result") data = ev.data as typeof data;
            }
          }
        } else {
          data = await res.json();
        }
        if (!data) data = { ok: false, reply: "Something went wrong." };
        setMsgs((m) => [
          ...m,
          {
            role: "agent",
            text: data.reply ?? "Something went wrong.",
            matched: data.matched,
            submitUrl: data.submitUrl,
            settlements: data.settlements,
            billsUrl: data.billsUrl,
            receipt: data.receipt,
          },
        ]);
        // Decrement the send budget for money that leaves to a third party.
        // Earn stays in the user's own savings, so it doesn't count against it.
        if (data.ok && draft.type !== "earn") {
          const amt = draft.type === "payout" ? draft.amountNgn : draft.amount ?? 0;
          if (amt > 0) setBudget((b) => (b ? { ...b, remaining: Math.max(0, b.remaining - amt) } : b));
        }
      } catch {
        setMsgs((m) => [...m, { role: "agent", text: "I couldn't complete that. Nothing was sent." }]);
      }
      setBusy(false);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    },
    [busy],
  );

  // The user declined a drafted action: nothing is sent.
  const decline = useCallback((index: number) => {
    setMsgs((m) => {
      const next = m.map((x, i) => (i === index ? { ...x, draftState: "cancelled" as const } : x));
      return [...next, { role: "agent", text: "Okay, cancelled. Nothing was sent." }];
    });
  }, []);

  // Attach a file (CSV / ZIP / text). The agent READS it and DRAFTS a bulk
  // action; nothing is sent until the user confirms each row in Send.
  const uploadFile = useCallback(
    async (file: File) => {
      if (busy) return;
      setMsgs((m) => [...m, { role: "user", text: "Read this file and draft the payouts.", attachment: file.name }]);
      setThinking(AGENT_STEPS.upload);
      setThinkingStep(undefined);
      setBusy(true);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/agent/upload", { method: "POST", body: fd });
        const data = (await res.json()) as ParsedUpload;
        setMsgs((m) => [
          ...m,
          {
            role: "agent",
            text: data.summary ?? "I couldn't read that file.",
            upload: data.kind === "payouts" && data.rows?.length ? data : undefined,
          },
        ]);
      } catch {
        setMsgs((m) => [...m, { role: "agent", text: "I couldn't read that file, please try again." }]);
      }
      setBusy(false);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    },
    [busy],
  );

  return {
    msgs,
    input,
    setInput,
    busy,
    thinking,
    thinkingStep,
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
    confirm,
    decline,
    uploadFile,
  };
}
