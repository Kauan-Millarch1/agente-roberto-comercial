"use client";

import { useEffect, useState } from "react";
import {
  Users,
  DollarSign,
  TrendingUp,
  ShoppingCart,
  Activity,
} from "lucide-react";
import { KpiCard } from "./kpi-card";
import { MessageFeed } from "./message-feed";
import { BrazilMap } from "./brazil-map";
import { fetchDashboardData } from "@/lib/api";
import { createClient } from "@/lib/supabase";
import { countLeadsByState } from "@/lib/ddd-to-state";
import type { StateLeadCount } from "@/lib/ddd-to-state";
import type { Message } from "@/lib/types";

interface FeedMessage extends Message {
  lead_name: string | null;
}

export function HomeContent() {
  const [activeLeads, setActiveLeads] = useState({ total: 0, today: 0 });
  const [purchased, setPurchased] = useState(0);
  const [costs, setCosts] = useState({ prompt: 0, completion: 0, elevenlabs: 0 });
  const [metrics, setMetrics] = useState<{
    total_conversoes: number;
    total_conversas: number;
  } | null>(null);
  const [messages, setMessages] = useState<FeedMessage[]>([]);
  const [stateData, setStateData] = useState<StateLeadCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    try {
      const data = await fetchDashboardData();
      setActiveLeads(data.activeLeads);
      setPurchased(data.purchased);
      setCosts(data.costs);
      setMetrics(data.metrics);
      setMessages(data.messages);
      setStateData(countLeadsByState(data.phones));
      setError(null);
    } catch (err) {
      setError("Erro ao carregar dados");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();

    // Realtime uses anon key (safe for browser)
    const supabase = createClient();
    const channel = supabase
      .channel("home-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "roberto_messages" },
        () => loadData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "roberto_leads" },
        () => loadData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const conversionRate =
    metrics && metrics.total_conversas > 0
      ? ((metrics.total_conversoes / metrics.total_conversas) * 100).toFixed(1)
      : "0";

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 rounded-2xl border border-white/[0.06] animate-shimmer" />
          ))}
        </div>
        <div className="h-48 rounded-2xl border border-white/[0.06] animate-shimmer" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={loadData} className="mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="animate-fade-in-up">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Dashboard</h1>
          <div className="flex items-center gap-1.5 rounded-full border border-[oklch(0.72_0.19_155)]/20 bg-[oklch(0.72_0.19_155)]/10 px-2.5 py-1">
            <Activity className="h-3 w-3 text-[oklch(0.72_0.19_155)]" />
            <span className="text-[10px] font-semibold text-[oklch(0.72_0.19_155)]">LIVE</span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">Visão geral do Agente Roberto em tempo real</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="animate-fade-in-up stagger-1">
          <KpiCard title="Leads em Contato" value={activeLeads.total} delta={`+${activeLeads.today} hoje`} icon={Users} trend="up" accentColor="oklch(0.65 0.18 250)" />
        </div>
        <div className="animate-fade-in-up stagger-2">
          <KpiCard title="Leads Convertidos" value={purchased} icon={ShoppingCart} trend="up" accentColor="oklch(0.72 0.19 155)" />
        </div>
        <div className="animate-fade-in-up stagger-3">
          <KpiCard title="Taxa de Conversão" value={`${conversionRate}%`} icon={TrendingUp} trend="neutral" accentColor="oklch(0.7 0.18 50)" />
        </div>
        <div className="animate-fade-in-up stagger-4">
          <KpiCard title="Custo Total (tokens)" value={(costs.prompt + costs.completion + costs.elevenlabs).toLocaleString("pt-BR")} icon={DollarSign} trend="neutral" accentColor="oklch(0.65 0.2 310)" />
        </div>
      </div>

      <div className="animate-fade-in-up stagger-5">
        <BrazilMap stateData={stateData} />
      </div>

      <div className="animate-fade-in-up stagger-6">
        <MessageFeed messages={messages} />
      </div>
    </div>
  );
}
