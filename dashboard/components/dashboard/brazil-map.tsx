"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Activity } from "lucide-react";
import type { StateLeadCount } from "@/lib/ddd-to-state";
import { getStateName } from "@/lib/ddd-to-state";

interface GeoFeature {
  type: "Feature";
  properties: { sigla: string; name: string };
  geometry: {
    type: string;
    coordinates: number[][][] | number[][][][];
  };
}

interface BrazilMapProps {
  stateData: StateLeadCount[];
}

export function BrazilMap({ stateData }: BrazilMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [features, setFeatures] = useState<GeoFeature[]>([]);
  const [hoveredState, setHoveredState] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [loaded, setLoaded] = useState(false);

  // Build count map
  const countMap = new Map(stateData.map((s) => [s.state, s.count]));
  const maxCount = Math.max(...stateData.map((s) => s.count), 1);
  const totalLeads = stateData.reduce((sum, s) => sum + s.count, 0);
  const statesWithLeads = stateData.filter((s) => s.count > 0).length;

  useEffect(() => {
    fetch("/brazil-states.geojson")
      .then((r) => r.json())
      .then((data) => {
        setFeatures(data.features);
        setLoaded(true);
      });
  }, []);

  const projectPoint = useCallback(
    (lon: number, lat: number): [number, number] => {
      // Simple Mercator projection tuned for Brazil — larger scale
      const scale = 11;
      const centerLon = -54;
      const centerLat = -15;
      const x = (lon - centerLon) * scale + 500;
      const y = -(lat - centerLat) * scale + 500;
      return [x, y];
    },
    []
  );

  function projectCoords(
    coords: number[][] | number[][][]
  ): string {
    if (typeof coords[0][0] === "number") {
      // Simple polygon ring
      const ring = coords as number[][];
      return ring
        .map((c, i) => {
          const [x, y] = projectPoint(c[0], c[1]);
          return `${i === 0 ? "M" : "L"}${x},${y}`;
        })
        .join(" ") + " Z";
    }
    // Multi ring
    const rings = coords as number[][][];
    return rings
      .map((ring) =>
        ring
          .map((c, i) => {
            const [x, y] = projectPoint(c[0], c[1]);
            return `${i === 0 ? "M" : "L"}${x},${y}`;
          })
          .join(" ") + " Z"
      )
      .join(" ");
  }

  function getPathD(feature: GeoFeature): string {
    if (feature.geometry.type === "Polygon") {
      return projectCoords(
        feature.geometry.coordinates as number[][][]
      );
    }
    if (feature.geometry.type === "MultiPolygon") {
      return (feature.geometry.coordinates as number[][][][])
        .map((poly) => projectCoords(poly))
        .join(" ");
    }
    return "";
  }

  function getOpacity(sigla: string): number {
    const count = countMap.get(sigla) ?? 0;
    if (count === 0) return 0.08;
    return 0.2 + (count / maxCount) * 0.8;
  }

  function handleMouseMove(e: React.MouseEvent) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltipPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }

  const hoveredData = hoveredState
    ? {
        name: getStateName(hoveredState),
        count: countMap.get(hoveredState) ?? 0,
        sigla: hoveredState,
      }
    : null;

  return (
    <div className="relative rounded-2xl border border-white/[0.06] bg-[oklch(0.155_0.005_260)] p-4 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[oklch(0.72_0.19_155)]/[0.02] via-transparent to-transparent pointer-events-none" />

      {/* Header */}
      <div className="relative flex items-center justify-between mb-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Mapa de Interações em Tempo Real
          </h3>
          <p className="text-xs text-muted-foreground/60 mt-0.5">
            Distribuição geográfica dos leads por DDD
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-lg font-bold text-foreground">{totalLeads}</span>
            <span className="text-xs text-muted-foreground/60 ml-1">leads</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-[oklch(0.72_0.19_155)]/20 bg-[oklch(0.72_0.19_155)]/10 px-2.5 py-1">
            <Activity className="h-3 w-3 text-[oklch(0.72_0.19_155)]" />
            <span className="text-[10px] font-semibold text-[oklch(0.72_0.19_155)]">
              {statesWithLeads} ESTADOS
            </span>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="relative flex justify-center">
        {!loaded ? (
          <div className="h-[350px] w-full flex items-center justify-center">
            <div className="h-8 w-32 rounded-xl animate-shimmer" />
          </div>
        ) : (
          <svg
            ref={svgRef}
            viewBox="150 120 700 750"
            className="h-[600px] w-auto mx-auto"
            onMouseMove={handleMouseMove}
          >
            {/* Glow filter */}
            <defs>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
              <filter id="shadow">
                <feDropShadow
                  dx="0"
                  dy="0"
                  stdDeviation="4"
                  floodColor="oklch(0.72 0.19 155)"
                  floodOpacity="0.3"
                />
              </filter>
            </defs>

            {/* State paths */}
            {features.map((feature) => {
              const sigla = feature.properties.sigla;
              const count = countMap.get(sigla) ?? 0;
              const isHovered = hoveredState === sigla;
              const opacity = getOpacity(sigla);

              return (
                <path
                  key={sigla}
                  d={getPathD(feature)}
                  fill={
                    count > 0
                      ? `oklch(0.72 0.19 155 / ${opacity})`
                      : "oklch(0.2 0.005 260 / 0.5)"
                  }
                  stroke={
                    isHovered
                      ? "oklch(0.72 0.19 155)"
                      : count > 0
                        ? "oklch(0.72 0.19 155 / 0.6)"
                        : "oklch(0.3 0.005 260 / 0.4)"
                  }
                  strokeWidth={isHovered ? 2 : 0.8}
                  filter={isHovered && count > 0 ? "url(#shadow)" : undefined}
                  className="transition-all duration-300 cursor-pointer"
                  style={{
                    transform: isHovered ? "scale(1.01)" : "scale(1)",
                    transformOrigin: "center",
                  }}
                  onMouseEnter={() => setHoveredState(sigla)}
                  onMouseLeave={() => setHoveredState(null)}
                />
              );
            })}

            {/* No labels on map — info shows on hover tooltip */}
          </svg>
        )}

        {/* Tooltip */}
        {hoveredData && (
          <div
            className="absolute pointer-events-none z-10 animate-fade-in"
            style={{
              left: tooltipPos.x + 16,
              top: tooltipPos.y - 16,
            }}
          >
            <div className="rounded-xl bg-[oklch(0.12_0.005_260)] border border-white/[0.1] shadow-2xl shadow-black/40 px-4 py-3 backdrop-blur-md">
              <div className="flex items-center gap-2 mb-1">
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{
                    background:
                      hoveredData.count > 0
                        ? "oklch(0.72 0.19 155)"
                        : "oklch(0.4 0 0)",
                    boxShadow:
                      hoveredData.count > 0
                        ? "0 0 6px oklch(0.72 0.19 155 / 0.5)"
                        : "none",
                  }}
                />
                <span className="text-sm font-semibold text-foreground">
                  {hoveredData.name}
                </span>
                <span className="text-[10px] text-muted-foreground/50">
                  {hoveredData.sigla}
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-[oklch(0.72_0.19_155)]">
                  {hoveredData.count}
                </span>
                <span className="text-xs text-muted-foreground">
                  {hoveredData.count === 1 ? "lead" : "leads"}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
