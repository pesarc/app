"use client";

import { Plus, Trash2, MessageSquare } from "@/components/icons";
import { Card } from "@/components/app/ui";
import type { Thread } from "./types";
import { relativeTime } from "./helpers";

/* Per-device chat history — resume or clear past conversations. */
export function ChatHistory({
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
          Your conversations will appear here, saved on this device.
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
