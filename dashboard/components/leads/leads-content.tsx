"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { fetchLeads, fetchMessages, updateLeadStatus } from "@/lib/api";
import { Search, Users, MessageSquare } from "lucide-react";
import { KanbanColumn } from "./kanban-column";
import { LeadDetailPanel } from "@/components/chat/lead-detail-panel";
import { createClient } from "@/lib/supabase";
import type { LeadWithPreview } from "@/lib/queries-messages";
import type { LeadStatus, EventLead } from "@/lib/types";

const STATUSES: LeadStatus[] = [
  "BASE",
  "EM CONTATO",
  "INTERESSADO",
  "OFERTA_ENVIADA",
  "COMPROU",
  "PERDIDO",
  "HANDOFF",
];

export function LeadsContent() {
  const router = useRouter();
  const [leads, setLeads] = useState<LeadWithPreview[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Detail panel state
  const [selectedLead, setSelectedLead] = useState<LeadWithPreview | null>(null);
  const [eventLead, setEventLead] = useState<EventLead | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const loadLeads = useCallback(async () => {
    try {
      const data = await fetchLeads();
      setLeads(data ?? []);
    } catch (err) {
      console.error("Failed to load leads:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + real-time subscription
  useEffect(() => {
    loadLeads();

    const supabase = createClient();
    const channel = supabase
      .channel("leads-kanban-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "roberto_leads" },
        () => loadLeads()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadLeads]);

  // Filter leads by search
  const filtered = leads.filter((lead) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      lead.name?.toLowerCase().includes(term) || lead.phone.includes(term)
    );
  });

  // Group leads by status
  const columns = STATUSES.map((status) => ({
    status,
    leads: filtered.filter((l) => l.status === status),
  }));

  // Handle drag & drop
  async function handleDrop(phone: string, newStatus: LeadStatus) {
    const lead = leads.find((l) => l.phone === phone);
    if (!lead || lead.status === newStatus) return;

    // Optimistic update
    setLeads((prev) =>
      prev.map((l) => (l.phone === phone ? { ...l, status: newStatus } : l))
    );

    try {
      await updateLeadStatus(phone, newStatus);
    } catch (err) {
      // Revert on failure
      setLeads((prev) =>
        prev.map((l) =>
          l.phone === phone ? { ...l, status: lead.status } : l
        )
      );
      console.error("Failed to update lead status:", err);
    }
  }

  // Handle card click — open detail panel
  async function handleSelectLead(phone: string) {
    const lead = leads.find((l) => l.phone === phone) ?? null;
    setSelectedLead(lead);
    setDetailsOpen(true);

    // Fetch event lead data for enriched details
    try {
      const data = await fetchMessages(phone);
      setEventLead(data.eventLead);
    } catch {
      setEventLead(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-8 w-32 rounded-xl animate-shimmer" />
        <div className="flex gap-4 h-[calc(100vh-12rem)]">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="w-[220px] shrink-0 rounded-2xl animate-shimmer" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 h-[calc(100vh-6rem)] flex flex-col">
      {/* Header */}
      <div className="animate-fade-in-up shrink-0">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Leads
          </h1>
          <span className="text-xs font-medium text-muted-foreground rounded-full bg-white/[0.06] border border-white/[0.06] px-2.5 py-1">
            {filtered.length} de {leads.length}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Arraste os cards para mover leads entre estágios
        </p>
      </div>

      {/* Search */}
      <div className="animate-fade-in-up stagger-1 shrink-0">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
          <Input
            placeholder="Buscar por nome ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-10 bg-[oklch(0.155_0.005_260)] border-white/[0.06] rounded-xl text-sm placeholder:text-muted-foreground/40 focus:border-[oklch(0.72_0.19_155)]/30 transition-all"
          />
        </div>
      </div>

      {/* Kanban Board */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-3">
          <Users className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            Nenhum lead encontrado
          </p>
        </div>
      ) : (
        <div className="flex gap-3 flex-1 overflow-x-auto pb-4 animate-fade-in-up stagger-2">
          {columns.map(({ status, leads: columnLeads }) => (
            <KanbanColumn
              key={status}
              status={status}
              leads={columnLeads}
              onDrop={handleDrop}
              onSelectLead={handleSelectLead}
            />
          ))}
        </div>
      )}

      {/* Detail panel + "Abrir chat" button */}
      {selectedLead && (
        <LeadDetailPanel
          lead={selectedLead}
          eventLead={eventLead}
          isOpen={detailsOpen}
          onClose={() => setDetailsOpen(false)}
        />
      )}

      {/* Floating "Abrir chat" button when panel is open */}
      {detailsOpen && selectedLead && (
        <button
          onClick={() => router.push(`/mensagens?phone=${encodeURIComponent(selectedLead.phone)}`)}
          className="fixed bottom-6 right-[440px] z-50 flex items-center gap-2 rounded-xl bg-[oklch(0.72_0.19_155)] px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-[oklch(0.72_0.19_155)]/20 hover:brightness-110 transition-all animate-fade-in"
        >
          <MessageSquare className="h-4 w-4" />
          Abrir chat
        </button>
      )}
    </div>
  );
}
