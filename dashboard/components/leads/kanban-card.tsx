"use client";

import { Hand, MessageSquare } from "lucide-react";
import type { LeadWithPreview } from "@/lib/queries-messages";

const PROFILE_EMOJI: Record<string, string> = {
  tubarao: "🦈",
  aguia: "🦅",
  lobo: "🐺",
  gato: "🐱",
  neutro: "⚪",
};

function getTimeSince(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

interface KanbanCardProps {
  lead: LeadWithPreview;
  onSelect: (phone: string) => void;
}

export function KanbanCard({ lead, onSelect }: KanbanCardProps) {
  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.setData("text/plain", lead.phone);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleClick() {
    onSelect(lead.phone);
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={handleClick}
      className="group relative rounded-xl bg-white/[0.04] border border-white/[0.06] p-3 cursor-grab active:cursor-grabbing hover:bg-white/[0.07] hover:border-white/[0.1] transition-all duration-200 animate-fade-in"
    >
      {/* Row 1: Avatar + Name + Time */}
      <div className="flex items-center gap-2 mb-2">
        <div className="relative shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.08] text-xs font-bold text-muted-foreground">
            {lead.name?.[0]?.toUpperCase() ?? "L"}
          </div>
          {lead.human_takeover && (
            <div className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500/30 border border-[oklch(0.13_0.005_260)]">
              <Hand className="h-2 w-2 text-amber-400" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-medium text-foreground truncate block">
            {lead.name ?? lead.phone}
          </span>
        </div>
        {lead.last_message_at && (
          <span className="text-[9px] text-muted-foreground/50 shrink-0">
            {getTimeSince(lead.last_message_at)}
          </span>
        )}
      </div>

      {/* Row 2: Profile + Event */}
      <div className="flex items-center gap-1.5 mb-1.5">
        {lead.behavioral_profile && (
          <span className="text-[10px]">
            {PROFILE_EMOJI[lead.behavioral_profile]}
          </span>
        )}
        {lead.event_interest && (
          <span className="text-[9px] text-muted-foreground/60 truncate">
            {lead.event_interest}
          </span>
        )}
      </div>

      {/* Row 3: Last message preview */}
      {lead.last_message_content && (
        <p className="text-[10px] text-muted-foreground/50 truncate">
          {lead.last_message_direction === "outbound" ? "Roberto: " : ""}
          {lead.last_message_content}
        </p>
      )}

      {/* Row 4: Urgency + Chat shortcut */}
      <div className="flex items-center justify-between mt-2">
        {lead.unresponded_since ? (
          <div className="flex items-center gap-1">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
            </span>
            <span className="text-[9px] font-medium text-red-400">
              {getTimeSince(lead.unresponded_since)}
            </span>
          </div>
        ) : (
          <div />
        )}
        <MessageSquare className="h-3 w-3 text-muted-foreground/20 group-hover:text-muted-foreground/50 transition-colors" />
      </div>
    </div>
  );
}
