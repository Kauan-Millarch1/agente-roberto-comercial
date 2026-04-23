import { cn } from "@/lib/utils";
import {
  Phone,
  Mail,
  DollarSign,
  MapPin,
  Target,
  Briefcase,
  ChevronRight,
  Hand,
  Bot,
} from "lucide-react";
import { RoleGate } from "@/components/role-gate";
import type { Lead, EventLead } from "@/lib/types";

const PROFILE_CONFIG: Record<
  string,
  { label: string; emoji: string; color: string }
> = {
  tubarao: { label: "Tubarão", emoji: "🦈", color: "oklch(0.65 0.2 25)" },
  aguia: { label: "Águia", emoji: "🦅", color: "oklch(0.7 0.18 50)" },
  lobo: { label: "Lobo", emoji: "🐺", color: "oklch(0.65 0.18 250)" },
  gato: { label: "Gato", emoji: "🐱", color: "oklch(0.65 0.2 310)" },
  neutro: { label: "Neutro", emoji: "⚪", color: "oklch(0.6 0 0)" },
};

const STATUS_CONFIG: Record<string, { bg: string; text: string }> = {
  BASE: { bg: "bg-zinc-500/20", text: "text-zinc-400" },
  "EM CONTATO": { bg: "bg-blue-500/20", text: "text-blue-400" },
  INTERESSADO: { bg: "bg-yellow-500/20", text: "text-yellow-400" },
  OFERTA_ENVIADA: { bg: "bg-purple-500/20", text: "text-purple-400" },
  COMPROU: { bg: "bg-green-500/20", text: "text-green-400" },
  PERDIDO: { bg: "bg-red-500/20", text: "text-red-400" },
  HANDOFF: { bg: "bg-orange-500/20", text: "text-orange-400" },
};

interface LeadContextCardProps {
  lead: Lead;
  eventLead: EventLead | null;
  onOpenDetails?: () => void;
  onToggleTakeover?: () => void;
  isHumanControlled?: boolean;
}

export function LeadContextCard({ lead, eventLead, onOpenDetails, onToggleTakeover, isHumanControlled }: LeadContextCardProps) {
  const profile = lead.behavioral_profile
    ? PROFILE_CONFIG[lead.behavioral_profile]
    : null;
  const status = STATUS_CONFIG[lead.status] ?? STATUS_CONFIG.BASE;

  return (
    <div className="border-b border-white/[0.06] bg-[oklch(0.12_0.005_260)] px-6 py-4 animate-fade-in">
      {/* Top row - clickable */}
      <button
        onClick={onOpenDetails}
        className="group flex items-center gap-3 mb-3 w-full text-left hover:opacity-90 transition-all duration-300"
      >
        {/* Avatar with initials */}
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[oklch(0.65_0.18_250)]/20 text-sm font-bold text-[oklch(0.75_0.18_250)] group-hover:ring-2 group-hover:ring-[oklch(0.65_0.18_250)]/30 transition-all duration-300">
          {lead.name?.[0]?.toUpperCase() ?? "L"}
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-foreground truncate">
            {lead.name ?? lead.phone}
          </h2>
          <div className="flex items-center gap-2 mt-0.5">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                status.bg,
                status.text
              )}
            >
              {lead.status}
            </span>
            {profile && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{
                  background: `color-mix(in oklch, ${profile.color}, transparent 85%)`,
                  color: profile.color,
                }}
              >
                {profile.emoji} {profile.label}
              </span>
            )}
          </div>
        </div>

        {/* Arrow indicator */}
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-all duration-300">
            Ver detalhes
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground/60 group-hover:translate-x-0.5 transition-all duration-300" />
        </div>
      </button>

      {/* Human takeover toggle — operator+ only */}
      <RoleGate minRole="operator">
        {onToggleTakeover && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleTakeover();
            }}
            className={cn(
              "mt-2 flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-300",
              isHumanControlled
                ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/20"
                : "bg-white/[0.04] text-muted-foreground hover:bg-white/[0.08] border border-white/[0.06]"
            )}
          >
            {isHumanControlled ? (
              <>
                <Bot className="h-3.5 w-3.5" />
                Devolver p/ IA
              </>
            ) : (
              <>
                <Hand className="h-3.5 w-3.5" />
                Assumir conversa
              </>
            )}
          </button>
        )}
      </RoleGate>

      {/* Info pills */}
      <div className="flex flex-wrap gap-2">
        <InfoPill icon={Phone} text={lead.phone} />
        {(eventLead?.email || lead.email) && (
          <InfoPill icon={Mail} text={eventLead?.email ?? lead.email!} />
        )}
        {eventLead?.monthly_revenue && (
          <InfoPill icon={DollarSign} text={eventLead.monthly_revenue} />
        )}
        {eventLead?.company_state && (
          <InfoPill icon={MapPin} text={eventLead.company_state} />
        )}
        {lead.event_interest && (
          <InfoPill icon={Target} text={lead.event_interest} />
        )}
        {eventLead?.role && (
          <InfoPill icon={Briefcase} text={eventLead.role} />
        )}
      </div>
    </div>
  );
}

function InfoPill({
  icon: Icon,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  text: string;
}) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] px-2.5 py-1 text-xs text-muted-foreground">
      <Icon className="h-3 w-3 text-muted-foreground/60" />
      <span className="truncate max-w-[180px]">{text}</span>
    </div>
  );
}
