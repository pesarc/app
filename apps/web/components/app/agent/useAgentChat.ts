"use client";

// All chat state, persistence, streaming and upload logic for the Pesarc agent.
// The container (AgentChat.tsx) only renders what this hook exposes.

import { useCallback, useEffect, useRef, useState } from "react";
import { useSpeechInput } from "@/components/app/useSpeechInput";
import { fetchAgentBudget, type AgentBudget } from "@pesarc/sdk/agent-budget";
import type { ParsedUpload } from "@pesarc/sdk/agent/files";
import type { Msg, Thread } from "./types";
import {
  GREETING,
  MAX_THREADS,
  loadThreads,
  parseAmount,
  saveThreads,
} from "./helpers";

export function useAgentChat() {
  const [msgs, setMsgs] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
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
            billsUrl: data.billsUrl,
            pending:
              data.ok &&
              !data.matched &&
              !data.needsInput &&
              !data.createdMarket &&
              !data.billPaid,
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
        setMsgs((m) => [...m, { role: "agent", text: "I couldn't reach the network. Try again." }]);
      }
      setBusy(false);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    },
    [busy],
  );

  // Attach a file (CSV / ZIP / text). The agent READS it and DRAFTS a bulk
  // action; nothing is sent until the user confirms each row in Send.
  const uploadFile = useCallback(
    async (file: File) => {
      if (busy) return;
      setMsgs((m) => [...m, { role: "user", text: "Read this file and draft the payouts.", attachment: file.name }]);
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
  };
}
