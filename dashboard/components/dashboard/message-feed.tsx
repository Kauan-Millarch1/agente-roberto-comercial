"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { MessageSquare, Mic, ArrowRight } from "lucide-react";
import type { Message } from "@/lib/types";

interface FeedMessage extends Message {
  lead_name: string | null;
}

interface MessageFeedProps {
  messages: FeedMessage[];
}

export function MessageFeed({ messages }: MessageFeedProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (messages.length === 0) return;

    const interval = setInterval(() => {
      setIsVisible(false);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % messages.length);
        setIsVisible(true);
      }, 400);
    }, 4500);

    return () => clearInterval(interval);
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-[oklch(0.155_0.005_260)] p-8 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04]">
            <MessageSquare className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">Nenhuma mensagem recente</p>
        </div>
      </div>
    );
  }

  const msg = messages[currentIndex];
  const isAudio = msg.media_type === "audio_input" || msg.media_type === "audio_output";
  const isInbound = msg.direction === "inbound";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[oklch(0.155_0.005_260)] p-6">
      {/* Background gradient animation */}
      <div className="absolute inset-0 bg-gradient-to-br from-[oklch(0.72_0.19_155)]/[0.03] via-transparent to-[oklch(0.65_0.18_250)]/[0.03] pointer-events-none" />

      {/* Header */}
      <div className="relative flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[oklch(0.72_0.19_155)]/10">
            <MessageSquare className="h-4 w-4 text-[oklch(0.72_0.19_155)]" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Atividade em Tempo Real</h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-[oklch(0.72_0.19_155)] animate-pulse" />
          <span className="text-xs text-muted-foreground">Ao vivo</span>
        </div>
      </div>

      {/* Message card */}
      <div
        className={cn(
          "relative transition-all duration-500 ease-out",
          isVisible
            ? "opacity-100 translate-y-0 scale-100"
            : "opacity-0 translate-y-4 scale-[0.98]"
        )}
      >
        <div className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-white/[0.1] transition-all duration-300">
          <div className="flex items-start gap-3">
            {/* Avatar */}
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                isInbound
                  ? "bg-[oklch(0.65_0.18_250)]/20 text-[oklch(0.75_0.18_250)]"
                  : "bg-[oklch(0.72_0.19_155)]/20 text-[oklch(0.72_0.19_155)]"
              )}
            >
              {isInbound
                ? (msg.lead_name?.[0]?.toUpperCase() ?? "L")
                : "R"}
            </div>

            <div className="flex-1 min-w-0">
              {/* Name + direction + time */}
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-foreground truncate">
                  {isInbound ? (msg.lead_name ?? msg.phone) : "Roberto"}
                </span>
                <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground truncate">
                  {isInbound ? "Roberto" : (msg.lead_name ?? msg.phone)}
                </span>
                <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                  {new Date(msg.created_at).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>

              {/* Content */}
              <div className="flex items-start gap-1.5">
                {isAudio && (
                  <Mic className="h-3.5 w-3.5 mt-0.5 text-[oklch(0.72_0.19_155)] shrink-0" />
                )}
                <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                  {msg.content ?? "—"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress dots */}
      <div className="flex items-center justify-center gap-1.5 mt-4">
        {messages.slice(0, Math.min(messages.length, 8)).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1 rounded-full transition-all duration-500",
              i === currentIndex
                ? "w-6 bg-[oklch(0.72_0.19_155)]"
                : "w-1 bg-white/10"
            )}
          />
        ))}
      </div>
    </div>
  );
}
