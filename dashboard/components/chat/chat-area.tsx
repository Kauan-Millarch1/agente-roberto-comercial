"use client";

import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatBubble } from "./chat-bubble";
import { MessageSquare } from "lucide-react";
import type { Message } from "@/lib/types";

interface ChatAreaProps {
  messages: Message[];
}

export function ChatArea({ messages }: ChatAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-muted-foreground">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.04] border border-white/[0.06]">
          <MessageSquare className="h-8 w-8 text-muted-foreground/40" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium">Nenhuma mensagem</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            As mensagens aparecerão aqui quando houver conversa
          </p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="space-y-3 p-6">
        {/* Date separator */}
        <div className="flex items-center justify-center mb-4">
          <div className="rounded-full bg-white/[0.04] border border-white/[0.06] px-4 py-1">
            <span className="text-[10px] font-medium text-muted-foreground">
              {new Date(messages[0].created_at).toLocaleDateString("pt-BR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
          </div>
        </div>

        {messages.map((msg, i) => {
          const prevMsg = messages[i - 1];
          const showAvatar =
            !prevMsg || prevMsg.direction !== msg.direction;

          return (
            <ChatBubble
              key={msg.id}
              message={msg}
              showAvatar={showAvatar}
            />
          );
        })}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
