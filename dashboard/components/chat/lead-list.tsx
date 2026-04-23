"use client";

import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Search, MessageSquare, Hand } from "lucide-react";
import type { LeadWithPreview } from "@/lib/queries-messages";

const STATUS_CONFIG: Record<string, { bg: string; text: string }> = {
  BASE: { bg: "bg-zinc-500/20", text: "text-zinc-400" },
  "EM CONTATO": { bg: "bg-blue-500/20", text: "text-blue-400" },
  INTERESSADO: { bg: "bg-yellow-500/20", text: "text-yellow-400" },
  OFERTA_ENVIADA: { bg: "bg-purple-500/20", text: "text-purple-400" },
  COMPROU: { bg: "bg-green-500/20", text: "text-green-400" },
  PERDIDO: { bg: "bg-red-500/20", text: "text-red-400" },
  HANDOFF: { bg: "bg-orange-500/20", text: "text-orange-400" },
};

const PROFILE_EMOJI: Record<string, string> = {
  tubarao: "🦈",
  aguia: "🦅",
  lobo: "🐺",
  gato: "🐱",
  neutro: "⚪",
};

interface LeadListProps {
  leads: LeadWithPreview[];
  selectedPhone: string | null;
  onSelectLead: (phone: string) => void;
}

function getTimeSince(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function LeadList({
  leads,
  selectedPhone,
  onSelectLead,
}: LeadListProps) {
  const [search, setSearch] = useState("");

  const filtered = leads.filter((lead) => {
    const term = search.toLowerCase();
    return (
      lead.name?.toLowerCase().includes(term) || lead.phone.includes(term)
    );
  });

  return (
    <div className="flex h-full w-80 flex-col bg-[oklch(0.11_0.005_260)] border-r border-white/[0.06] animate-slide-in-left">
      {/* Header */}
      <div className="p-4 border-b border-white/[0.06]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-[oklch(0.72_0.19_155)]" />
            <h3 className="text-sm font-semibold text-foreground">Conversas</h3>
          </div>
          <span className="text-[10px] font-medium text-muted-foreground rounded-full bg-white/[0.06] px-2 py-0.5">
            {leads.length}
          </span>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
          <Input
            placeholder="Buscar lead..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9 bg-white/[0.04] border-white/[0.06] rounded-xl text-sm placeholder:text-muted-foreground/40 focus:border-[oklch(0.72_0.19_155)]/30 focus:ring-[oklch(0.72_0.19_155)]/10 transition-all"
          />
        </div>
      </div>

      {/* Lead list */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-0.5">
          {filtered.map((lead, i) => {
            const isSelected = selectedPhone === lead.phone;
            const status =
              STATUS_CONFIG[lead.status] ?? STATUS_CONFIG.BASE;

            return (
              <button
                key={lead.phone}
                onClick={() => onSelectLead(lead.phone)}
                className={cn(
                  "group relative flex w-full flex-col gap-1.5 rounded-xl p-3 text-left transition-all duration-300",
                  isSelected
                    ? "bg-white/[0.08] border border-white/[0.08]"
                    : "hover:bg-white/[0.04] border border-transparent",
                  `animate-fade-in-up stagger-${Math.min(i + 1, 6)}`
                )}
              >
                {/* Active indicator */}
                {isSelected && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-[3px] rounded-r-full bg-[oklch(0.72_0.19_155)] shadow-sm shadow-[oklch(0.72_0.19_155)]/40" />
                )}

                {/* Row 1: Avatar + Name + Time */}
                <div className="flex items-center gap-2.5">
                  <div className="relative shrink-0">
                    <div
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-all duration-300",
                        isSelected
                          ? "bg-[oklch(0.65_0.18_250)]/25 text-[oklch(0.75_0.18_250)]"
                          : "bg-white/[0.06] text-muted-foreground group-hover:bg-white/[0.1]"
                      )}
                    >
                      {lead.name?.[0]?.toUpperCase() ?? "L"}
                    </div>
                    {lead.human_takeover && (
                      <div className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500/30 border border-[oklch(0.11_0.005_260)]">
                        <Hand className="h-2.5 w-2.5 text-amber-400" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-foreground truncate">
                          {lead.name ?? lead.phone}
                        </span>
                        {lead.behavioral_profile && (
                          <span className="text-xs">
                            {PROFILE_EMOJI[lead.behavioral_profile]}
                          </span>
                        )}
                      </div>
                      {lead.last_message_at && (
                        <span className="text-[10px] text-muted-foreground/60 shrink-0 ml-2">
                          {getTimeSince(lead.last_message_at)}
                        </span>
                      )}
                    </div>

                    {/* Status + Event */}
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-1.5 py-0 text-[9px] font-semibold",
                          status.bg,
                          status.text
                        )}
                      >
                        {lead.status}
                      </span>
                      {lead.event_interest && (
                        <span className="text-[10px] text-muted-foreground/50 truncate">
                          {lead.event_interest}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Row 2: Typeform enriched data */}
                {(lead.company_name || lead.monthly_revenue || lead.role) && (
                  <div className="flex flex-wrap gap-1 pl-[46px]">
                    {lead.company_name && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[9px] text-muted-foreground/70">
                        🏢 {lead.company_name}
                      </span>
                    )}
                    {lead.monthly_revenue && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-[oklch(0.72_0.19_155)]/8 px-1.5 py-0.5 text-[9px] text-[oklch(0.72_0.19_155)]/80">
                        💰 {lead.monthly_revenue.replace("R$ ", "").replace("R$", "")}
                      </span>
                    )}
                    {lead.role && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[9px] text-muted-foreground/70">
                        💼 {lead.role}
                      </span>
                    )}
                    {lead.company_state && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[9px] text-muted-foreground/70">
                        📍 {lead.company_state}
                      </span>
                    )}
                  </div>
                )}

                {/* Row 3: Message preview */}
                {lead.last_message_content && (
                  <p className="text-xs text-muted-foreground/60 truncate pl-[46px]">
                    {lead.last_message_direction === "outbound"
                      ? "Roberto: "
                      : ""}
                    {lead.last_message_content}
                  </p>
                )}

                {/* Urgency indicator */}
                {lead.unresponded_since && (
                  <div className="flex items-center gap-1.5 pl-[46px]">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                    </span>
                    <span className="text-[10px] font-medium text-red-400">
                      Aguardando há {getTimeSince(lead.unresponded_since)}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
