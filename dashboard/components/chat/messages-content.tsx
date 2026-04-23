"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { LeadList } from "./lead-list";
import { ChatArea } from "./chat-area";
import { LeadContextCard } from "./lead-context-card";
import { LeadDetailPanel } from "./lead-detail-panel";
import { MessageSquare } from "lucide-react";
import { fetchLeads, fetchMessages, toggleHumanTakeover, sendMessage } from "@/lib/api";
import { ChatInput } from "./chat-input";
import { RoleGate } from "@/components/role-gate";
import type { LeadWithPreview } from "@/lib/queries-messages";
import type { Message, EventLead } from "@/lib/types";
import { createClient } from "@/lib/supabase";

export function MessagesContent() {
  const searchParams = useSearchParams();
  const phoneFromUrl = searchParams.get("phone");
  const hasAutoSelected = useRef(false);

  const [leads, setLeads] = useState<LeadWithPreview[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedLead, setSelectedLead] = useState<LeadWithPreview | null>(null);
  const [eventLead, setEventLead] = useState<EventLead | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Refs to access latest state inside subscription callbacks (avoids stale closures)
  const selectedPhoneRef = useRef(selectedPhone);
  selectedPhoneRef.current = selectedPhone;

  const loadLeads = useCallback(async () => {
    try {
      const data = await fetchLeads();
      setLeads(data);

      // Keep selectedLead in sync with fresh data
      if (selectedPhoneRef.current) {
        const fresh = data.find((l: LeadWithPreview) => l.phone === selectedPhoneRef.current);
        if (fresh) setSelectedLead(fresh);
      }
    } catch (err) {
      console.error("Failed to load leads:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  async function selectLead(phone: string) {
    setSelectedPhone(phone);
    const lead = leads.find((l) => l.phone === phone) ?? null;
    setSelectedLead(lead);

    try {
      const data = await fetchMessages(phone);
      setMessages(data.messages);
      setEventLead(data.eventLead);
    } catch (err) {
      console.error("Failed to load messages:", err);
    }
  }

  async function handleToggleTakeover() {
    if (!selectedPhone || !selectedLead) return;
    const newState = !selectedLead.human_takeover;

    // Optimistic update
    setSelectedLead((prev) => prev ? { ...prev, human_takeover: newState } : prev);

    try {
      await toggleHumanTakeover(selectedPhone, newState);
    } catch (err) {
      // Revert on failure
      setSelectedLead((prev) => prev ? { ...prev, human_takeover: !newState } : prev);
      console.error("Failed to toggle takeover:", err);
    }
  }

  async function handleSendMessage(content: string) {
    if (!selectedPhone) return;

    // Optimistic update — show message immediately in chat
    const optimisticMsg: Message = {
      id: `temp-${Date.now()}`,
      phone: selectedPhone,
      direction: "outbound",
      content,
      media_type: "text",
      wamid: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      await sendMessage(selectedPhone, content);
    } catch (err) {
      // Remove optimistic message on failure
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      throw err; // re-throw so ChatInput shows the error
    }
  }

  // Auto-select lead from URL query param
  useEffect(() => {
    if (phoneFromUrl && leads.length > 0 && !hasAutoSelected.current) {
      hasAutoSelected.current = true;
      selectLead(phoneFromUrl);
    }
  }, [phoneFromUrl, leads.length]);

  // Real-time subscriptions (single stable subscription, uses refs for latest state)
  useEffect(() => {
    loadLeads();

    const supabase = createClient();
    const channel = supabase
      .channel("messages-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "roberto_messages" },
        (payload) => {
          const newMsg = payload.new as Message;
          loadLeads();

          if (newMsg.phone === selectedPhoneRef.current) {
            // Deduplicate: skip if we already have this message (optimistic or duplicate event)
            setMessages((prev) => {
              const isDuplicate = prev.some(
                (m) => m.wamid === newMsg.wamid && newMsg.wamid !== null
              );
              if (isDuplicate) return prev;

              // Replace optimistic message (temp-*) with real one if content matches
              const optimisticIdx = prev.findIndex(
                (m) => m.id.startsWith("temp-") && m.content === newMsg.content
              );
              if (optimisticIdx !== -1) {
                const updated = [...prev];
                updated[optimisticIdx] = newMsg;
                return updated;
              }

              return [...prev, newMsg];
            });
          }
        }
      )
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

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] -m-8 animate-fade-in">
        <div className="w-80 border-r border-white/[0.06] bg-[oklch(0.11_0.005_260)] p-4 space-y-3">
          <div className="h-9 rounded-xl animate-shimmer" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 rounded-xl animate-shimmer" />
          ))}
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="h-8 w-48 rounded-xl animate-shimmer" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] -m-8 animate-fade-in">
      <LeadList leads={leads} selectedPhone={selectedPhone} onSelectLead={selectLead} />

      <div className="flex flex-1 flex-col bg-[oklch(0.09_0.005_260)]">
        {selectedLead ? (
          <>
            <LeadContextCard
              lead={selectedLead}
              eventLead={eventLead}
              onOpenDetails={() => setDetailsOpen(true)}
              onToggleTakeover={handleToggleTakeover}
              isHumanControlled={selectedLead.human_takeover}
            />
            <ChatArea messages={messages} />
            <RoleGate minRole="operator">
              {selectedLead.human_takeover && (
                <ChatInput onSend={handleSendMessage} />
              )}
            </RoleGate>
            <LeadDetailPanel lead={selectedLead} eventLead={eventLead} isOpen={detailsOpen} onClose={() => setDetailsOpen(false)} />
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/[0.04] border border-white/[0.06] animate-float">
              <MessageSquare className="h-10 w-10 text-muted-foreground/30" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground">Selecione um lead</p>
              <p className="text-xs text-muted-foreground/50 mt-1">Escolha uma conversa à esquerda para visualizar</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
