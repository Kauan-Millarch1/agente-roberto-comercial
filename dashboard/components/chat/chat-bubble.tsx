import { cn } from "@/lib/utils";
import { Mic, Bot, User } from "lucide-react";
import type { Message } from "@/lib/types";

interface ChatBubbleProps {
  message: Message;
  showAvatar?: boolean;
}

export function ChatBubble({ message, showAvatar = true }: ChatBubbleProps) {
  const isOutbound = message.direction === "outbound";
  const isAudio =
    message.media_type === "audio_input" ||
    message.media_type === "audio_output";

  return (
    <div
      className={cn(
        "group flex gap-2 animate-fade-in-up",
        isOutbound ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      {showAvatar && (
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full mt-1",
            isOutbound
              ? "bg-[oklch(0.72_0.19_155)]/20"
              : "bg-[oklch(0.65_0.18_250)]/20"
          )}
        >
          {isOutbound ? (
            <Bot className="h-4 w-4 text-[oklch(0.72_0.19_155)]" />
          ) : (
            <User className="h-4 w-4 text-[oklch(0.65_0.18_250)]" />
          )}
        </div>
      )}

      {/* Bubble */}
      <div
        className={cn(
          "relative max-w-[65%] rounded-2xl px-4 py-2.5 transition-all duration-200",
          isOutbound
            ? "bg-[oklch(0.72_0.19_155)]/15 border border-[oklch(0.72_0.19_155)]/10 rounded-br-md"
            : "bg-white/[0.06] border border-white/[0.06] rounded-bl-md",
          "group-hover:shadow-lg group-hover:shadow-black/10"
        )}
      >
        {/* Audio indicator */}
        {isAudio && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[oklch(0.72_0.19_155)]/20">
              <Mic className="h-3 w-3 text-[oklch(0.72_0.19_155)]" />
            </div>
            <span className="text-[10px] font-medium text-[oklch(0.72_0.19_155)]/70">
              Áudio transcrito
            </span>
          </div>
        )}

        {/* Content */}
        <p className="text-[13px] leading-relaxed text-foreground/90 whitespace-pre-wrap">
          {message.content ?? "—"}
        </p>

        {/* Timestamp */}
        <div
          className={cn(
            "mt-1 flex items-center gap-1",
            isOutbound ? "justify-end" : "justify-start"
          )}
        >
          <span className="text-[10px] text-muted-foreground/60">
            {new Date(message.created_at).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      </div>
    </div>
  );
}
