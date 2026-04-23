"use client";

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { ArrowUp, ArrowDown } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: string | number;
  delta?: string;
  icon: LucideIcon;
  trend?: "up" | "down" | "neutral";
  accentColor?: string;
}

export function KpiCard({
  title,
  value,
  delta,
  icon: Icon,
  trend,
  accentColor = "oklch(0.72 0.19 155)",
}: KpiCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[oklch(0.155_0.005_260)] p-5 transition-all duration-500 hover:border-white/[0.12] hover:shadow-lg hover:shadow-black/20 hover:-translate-y-1">
      {/* Gradient glow on hover */}
      <div
        className="absolute -top-12 -right-12 h-32 w-32 rounded-full opacity-0 blur-3xl transition-opacity duration-700 group-hover:opacity-20"
        style={{ background: accentColor }}
      />

      {/* Top row: title + icon */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-500 group-hover:scale-110"
          style={{
            background: `color-mix(in oklch, ${accentColor}, transparent 85%)`,
          }}
        >
          <Icon
            className="h-4 w-4 transition-all duration-500"
            style={{ color: accentColor }}
          />
        </div>
      </div>

      {/* Value */}
      <div className="text-3xl font-bold tracking-tight text-foreground animate-count-up">
        {value}
      </div>

      {/* Delta */}
      {delta && (
        <div className="mt-2 flex items-center gap-1">
          {trend === "up" && (
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500/15">
              <ArrowUp className="h-3 w-3 text-green-400" />
            </div>
          )}
          {trend === "down" && (
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500/15">
              <ArrowDown className="h-3 w-3 text-red-400" />
            </div>
          )}
          <span
            className={cn(
              "text-xs font-medium",
              trend === "up" && "text-green-400",
              trend === "down" && "text-red-400",
              trend === "neutral" && "text-muted-foreground"
            )}
          >
            {delta}
          </span>
        </div>
      )}

      {/* Bottom accent line */}
      <div
        className="absolute bottom-0 left-0 h-[2px] w-0 transition-all duration-700 group-hover:w-full"
        style={{ background: `linear-gradient(90deg, ${accentColor}, transparent)` }}
      />
    </div>
  );
}
