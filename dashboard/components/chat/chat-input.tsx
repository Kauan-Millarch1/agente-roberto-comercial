"use client";

import { useState } from "react";
import { Send, Loader2 } from "lucide-react";

interface ChatInputProps {
  onSend: (content: string) => Promise<void>;
}

export function ChatInput({ onSend }: ChatInputProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setSending(true);
    try {
      await onSend(trimmed);
      setText("");
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="border-t border-amber-500/20 bg-[oklch(0.12_0.01_80)] px-4 py-3 animate-fade-in">
      <div className="flex items-center gap-2 text-[10px] text-amber-400/70 mb-2 px-1">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
        </span>
        Você está no controle da conversa
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="Digite sua mensagem..."
          disabled={sending}
          className="flex-1 rounded-xl bg-white/[0.06] border border-amber-500/15 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-amber-500/30 focus:ring-1 focus:ring-amber-500/10 transition-all disabled:opacity-50"
        />
        <button
          onClick={handleSubmit}
          disabled={!text.trim() || sending}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}
