"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { KanbanCard } from "./kanban-card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { LeadWithPreview } from "@/lib/queries-messages";
import type { LeadStatus } from "@/lib/types";

const STATUS_CONFIG: Record<string, { badge: string; badgeText: string; accent: string }> = {
  BASE: { badge: "bg-zinc-600", badgeText: "text-zinc-100", accent: "border-zinc-500/40" },
  "EM CONTATO": { badge: "bg-blue-600", badgeText: "text-blue-100", accent: "border-blue-500/40" },
  INTERESSADO: { badge: "bg-yellow-600", badgeText: "text-yellow-100", accent: "border-yellow-500/40" },
  OFERTA_ENVIADA: { badge: "bg-purple-600", badgeText: "text-purple-100", accent: "border-purple-500/40" },
  COMPROU: { badge: "bg-green-600", badgeText: "text-green-100", accent: "border-green-500/40" },
  PERDIDO: { badge: "bg-red-600", badgeText: "text-red-100", accent: "border-red-500/40" },
  HANDOFF: { badge: "bg-orange-600", badgeText: "text-orange-100", accent: "border-orange-500/40" },
};

interface KanbanColumnProps {
  status: LeadStatus;
  leads: LeadWithPreview[];
  onDrop: (phone: string, newStatus: LeadStatus) => void;
  onSelectLead: (phone: string) => void;
}

export function KanbanColumn({ status, leads, onDrop, onSelectLead }: KanbanColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.BASE;

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsDragOver(true);
  }

  function handleDragLeave() {
    setIsDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const phone = e.dataTransfer.getData("text/plain");
    if (phone) onDrop(phone, status);
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "flex flex-col h-full min-w-[220px] w-[220px] rounded-2xl border transition-all duration-200",
        isDragOver
          ? `bg-white/[0.06] ${config.accent} border-dashed`
          : "bg-[oklch(0.11_0.005_260)] border-white/[0.06]"
      )}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-white/[0.06]">
        <span className={cn(
          "inline-flex items-center rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide",
          config.badge, config.badgeText
        )}>
          {status.replace("_", " ")}
        </span>
        <span className="text-[11px] font-semibold text-muted-foreground">
          {leads.length}
        </span>
      </div>

      {/* Cards */}
      <ScrollArea className="flex-1 px-2 py-2">
        <div className="space-y-2">
          {leads.map((lead) => (
            <KanbanCard key={lead.phone} lead={lead} onSelect={onSelectLead} />
          ))}
          {leads.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-[10px] text-muted-foreground/30">Nenhum lead</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
