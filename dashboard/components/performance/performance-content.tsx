"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  MessageSquare,
  CheckCircle,
  PhoneForwarded,
  XCircle,
  TrendingUp,
} from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { fetchPerformance } from "@/lib/api";
import type { Metric, ProfileStat } from "@/lib/types";

const PROFILE_CONFIG: Record<
  string,
  { emoji: string; label: string; color: string }
> = {
  tubarao: { emoji: "🦈", label: "Tubarão", color: "oklch(0.65 0.2 25)" },
  aguia: { emoji: "🦅", label: "Águia", color: "oklch(0.7 0.18 50)" },
  lobo: { emoji: "🐺", label: "Lobo", color: "oklch(0.65 0.18 250)" },
  gato: { emoji: "🐱", label: "Gato", color: "oklch(0.65 0.2 310)" },
  neutro: { emoji: "⚪", label: "Neutro", color: "oklch(0.6 0 0)" },
};

export function PerformanceContent() {
  const [metrics, setMetrics] = useState<Metric | null>(null);
  const [profiles, setProfiles] = useState<ProfileStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPerformance()
      .then((data) => {
        setMetrics(data.metrics);
        setProfiles(data.profiles);
      })
      .catch((err) => console.error("Failed to load performance:", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-8 w-48 rounded-xl animate-shimmer" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 rounded-2xl animate-shimmer" />
          ))}
        </div>
        <div className="h-64 rounded-2xl animate-shimmer" />
      </div>
    );
  }

  const totalLeads = profiles.reduce((sum, p) => sum + p.total, 0);
  const conversionRate =
    metrics && metrics.total_conversas > 0
      ? ((metrics.total_conversoes / metrics.total_conversas) * 100).toFixed(1)
      : "0";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="animate-fade-in-up">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Performance
          </h1>
          <div className="flex items-center gap-1.5 rounded-full border border-[oklch(0.72_0.19_155)]/20 bg-[oklch(0.72_0.19_155)]/10 px-2.5 py-1">
            <TrendingUp className="h-3 w-3 text-[oklch(0.72_0.19_155)]" />
            <span className="text-[10px] font-semibold text-[oklch(0.72_0.19_155)]">
              {conversionRate}% CONVERSÃO
            </span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Métricas de desempenho do Agente Roberto
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="animate-fade-in-up stagger-1">
          <KpiCard
            title="Total Conversas"
            value={metrics?.total_conversas ?? 0}
            icon={MessageSquare}
            trend="neutral"
            accentColor="oklch(0.65 0.18 250)"
          />
        </div>
        <div className="animate-fade-in-up stagger-2">
          <KpiCard
            title="Conversões"
            value={metrics?.total_conversoes ?? 0}
            icon={CheckCircle}
            trend="up"
            accentColor="oklch(0.72 0.19 155)"
          />
        </div>
        <div className="animate-fade-in-up stagger-3">
          <KpiCard
            title="Handoffs"
            value={metrics?.total_handoffs ?? 0}
            icon={PhoneForwarded}
            trend="neutral"
            accentColor="oklch(0.7 0.18 50)"
          />
        </div>
        <div className="animate-fade-in-up stagger-4">
          <KpiCard
            title="Perdidos"
            value={metrics?.total_perdidos ?? 0}
            icon={XCircle}
            trend="down"
            accentColor="oklch(0.65 0.2 25)"
          />
        </div>
      </div>

      {/* Profile distribution */}
      <div className="rounded-2xl border border-white/[0.06] bg-[oklch(0.155_0.005_260)] p-6 animate-fade-in-up stagger-5">
        <h3 className="text-sm font-semibold text-foreground mb-6">
          Distribuição de Perfis Comportamentais
        </h3>

        {profiles.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem dados de perfil</p>
        ) : (
          <div className="space-y-5">
            {profiles.map((p) => {
              const pct =
                totalLeads > 0
                  ? ((p.total / totalLeads) * 100).toFixed(0)
                  : "0";
              const config = PROFILE_CONFIG[p.profile];
              const convRate =
                p.total > 0
                  ? ((p.converted / p.total) * 100).toFixed(0)
                  : "0";

              return (
                <div key={p.profile} className="group">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{config?.emoji}</span>
                      <span className="text-sm font-medium text-foreground capitalize">
                        {config?.label ?? p.profile}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-muted-foreground">
                        {p.total} leads
                      </span>
                      <span className="text-green-400 font-medium">
                        {convRate}% conv.
                      </span>
                      <span className="font-semibold text-foreground">
                        {pct}%
                      </span>
                    </div>
                  </div>
                  <div className="h-2.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-1000 ease-out"
                      style={{
                        width: `${pct}%`,
                        background: `linear-gradient(90deg, ${config?.color ?? "oklch(0.6 0 0)"}, color-mix(in oklch, ${config?.color ?? "oklch(0.6 0 0)"}, white 20%))`,
                        boxShadow: `0 0 12px color-mix(in oklch, ${config?.color ?? "oklch(0.6 0 0)"}, transparent 60%)`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
