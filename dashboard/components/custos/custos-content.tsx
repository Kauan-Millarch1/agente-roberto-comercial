"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Cpu,
  MessageCircle,
  Volume2,
  Users,
  DollarSign,
  Zap,
} from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { fetchCosts } from "@/lib/api";
import type { Cost } from "@/lib/types";

export function CustosContent() {
  const [costs, setCosts] = useState<Cost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchCosts();
        setCosts(data ?? []);
      } catch (err) {
        console.error("Failed to load costs:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-8 w-32 rounded-xl animate-shimmer" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 rounded-2xl animate-shimmer" />
          ))}
        </div>
        <div className="h-48 rounded-2xl animate-shimmer" />
      </div>
    );
  }

  const totals = costs.reduce(
    (acc, c) => ({
      prompt: acc.prompt + c.prompt_tokens,
      completion: acc.completion + c.completion_tokens,
      elevenlabs: acc.elevenlabs + c.elevenlabs_tokens,
      count: acc.count + 1,
    }),
    { prompt: 0, completion: 0, elevenlabs: 0, count: 0 }
  );

  const uniquePhones = new Set(
    costs.filter((c) => c.phone).map((c) => c.phone)
  ).size;
  const costPerLead =
    uniquePhones > 0
      ? Math.round((totals.prompt + totals.completion) / uniquePhones)
      : 0;
  const totalTokens = totals.prompt + totals.completion + totals.elevenlabs;

  // Token distribution for visual breakdown
  const segments = [
    {
      label: "GPT Prompt",
      value: totals.prompt,
      color: "oklch(0.65 0.18 250)",
      icon: Cpu,
    },
    {
      label: "GPT Completion",
      value: totals.completion,
      color: "oklch(0.72 0.19 155)",
      icon: MessageCircle,
    },
    {
      label: "ElevenLabs",
      value: totals.elevenlabs,
      color: "oklch(0.7 0.18 50)",
      icon: Volume2,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="animate-fade-in-up">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Custos
          </h1>
          <div className="flex items-center gap-1.5 rounded-full border border-[oklch(0.65_0.18_250)]/20 bg-[oklch(0.65_0.18_250)]/10 px-2.5 py-1">
            <Zap className="h-3 w-3 text-[oklch(0.65_0.18_250)]" />
            <span className="text-[10px] font-semibold text-[oklch(0.65_0.18_250)]">
              {totalTokens.toLocaleString("pt-BR")} TOKENS
            </span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Consumo de API e custos operacionais do Roberto
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="animate-fade-in-up stagger-1">
          <KpiCard
            title="Tokens GPT (Prompt)"
            value={totals.prompt.toLocaleString("pt-BR")}
            icon={Cpu}
            trend="neutral"
            accentColor="oklch(0.65 0.18 250)"
          />
        </div>
        <div className="animate-fade-in-up stagger-2">
          <KpiCard
            title="Tokens GPT (Completion)"
            value={totals.completion.toLocaleString("pt-BR")}
            icon={MessageCircle}
            trend="neutral"
            accentColor="oklch(0.72 0.19 155)"
          />
        </div>
        <div className="animate-fade-in-up stagger-3">
          <KpiCard
            title="Tokens ElevenLabs"
            value={totals.elevenlabs.toLocaleString("pt-BR")}
            icon={Volume2}
            trend="neutral"
            accentColor="oklch(0.7 0.18 50)"
          />
        </div>
        <div className="animate-fade-in-up stagger-4">
          <KpiCard
            title="Tokens/Lead (média)"
            value={costPerLead.toLocaleString("pt-BR")}
            icon={Users}
            trend="neutral"
            accentColor="oklch(0.65 0.2 310)"
          />
        </div>
      </div>

      {/* Token breakdown visual */}
      <div className="rounded-2xl border border-white/[0.06] bg-[oklch(0.155_0.005_260)] p-6 animate-fade-in-up stagger-5">
        <h3 className="text-sm font-semibold text-foreground mb-6">
          Distribuição de Consumo
        </h3>

        {/* Stacked bar */}
        <div className="h-4 rounded-full bg-white/[0.06] overflow-hidden flex mb-6">
          {segments.map((seg) => {
            const pct = totalTokens > 0 ? (seg.value / totalTokens) * 100 : 0;
            return (
              <div
                key={seg.label}
                className="h-full transition-all duration-1000 ease-out first:rounded-l-full last:rounded-r-full"
                style={{
                  width: `${pct}%`,
                  background: seg.color,
                  boxShadow: `0 0 12px color-mix(in oklch, ${seg.color}, transparent 60%)`,
                }}
              />
            );
          })}
        </div>

        {/* Legend */}
        <div className="grid grid-cols-3 gap-4">
          {segments.map((seg) => {
            const pct =
              totalTokens > 0
                ? ((seg.value / totalTokens) * 100).toFixed(1)
                : "0";
            const Icon = seg.icon;
            return (
              <div
                key={seg.label}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition-all duration-300 hover:border-white/[0.1] hover:bg-white/[0.04]"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{
                      background: `color-mix(in oklch, ${seg.color}, transparent 85%)`,
                    }}
                  >
                    <Icon className="h-4 w-4" style={{ color: seg.color }} />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">
                    {seg.label}
                  </span>
                </div>
                <div className="text-xl font-bold text-foreground">
                  {seg.value.toLocaleString("pt-BR")}
                </div>
                <span className="text-xs text-muted-foreground/60">
                  {pct}% do total
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary card */}
      <div className="rounded-2xl border border-white/[0.06] bg-[oklch(0.155_0.005_260)] p-6 animate-fade-in-up stagger-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[oklch(0.72_0.19_155)]/10">
            <DollarSign className="h-5 w-5 text-[oklch(0.72_0.19_155)]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Resumo</h3>
            <p className="text-xs text-muted-foreground">
              Visão consolidada de custos
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <span className="text-xs text-muted-foreground/60">
              Total de interações
            </span>
            <div className="text-2xl font-bold text-foreground mt-1">
              {totals.count}
            </div>
          </div>
          <div>
            <span className="text-xs text-muted-foreground/60">
              Leads únicos
            </span>
            <div className="text-2xl font-bold text-foreground mt-1">
              {uniquePhones}
            </div>
          </div>
          <div>
            <span className="text-xs text-muted-foreground/60">
              Tokens totais
            </span>
            <div className="text-2xl font-bold text-foreground mt-1">
              {totalTokens.toLocaleString("pt-BR")}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
