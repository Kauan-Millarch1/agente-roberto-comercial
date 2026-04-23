"use client";

import { cn } from "@/lib/utils";
import {
  X,
  Phone,
  Mail,
  DollarSign,
  MapPin,
  Target,
  Briefcase,
  Building,
  Calendar,
  Globe,
  Link2,
  Tag,
  Clock,
  TrendingUp,
} from "lucide-react";
import type { Lead, EventLead } from "@/lib/types";

const PROFILE_CONFIG: Record<
  string,
  { label: string; emoji: string; color: string; description: string }
> = {
  tubarao: {
    label: "Tubarão",
    emoji: "🦈",
    color: "oklch(0.65 0.2 25)",
    description: "Direto, objetivo, foca em resultados e ROI",
  },
  aguia: {
    label: "Águia",
    emoji: "🦅",
    color: "oklch(0.7 0.18 50)",
    description: "Visionário, quer inovação e diferencial competitivo",
  },
  lobo: {
    label: "Lobo",
    emoji: "🐺",
    color: "oklch(0.65 0.18 250)",
    description: "Leal, valoriza relacionamento e confiança",
  },
  gato: {
    label: "Gato",
    emoji: "🐱",
    color: "oklch(0.65 0.2 310)",
    description: "Analítico, precisa de tempo e detalhes para decidir",
  },
  neutro: {
    label: "Neutro",
    emoji: "⚪",
    color: "oklch(0.6 0 0)",
    description: "Perfil ainda não identificado",
  },
};

const STATUS_CONFIG: Record<
  string,
  { bg: string; text: string; description: string }
> = {
  BASE: { bg: "bg-zinc-500/20", text: "text-zinc-400", description: "Lead cadastrado, sem interação" },
  "EM CONTATO": { bg: "bg-blue-500/20", text: "text-blue-400", description: "Roberto iniciou contato" },
  INTERESSADO: { bg: "bg-yellow-500/20", text: "text-yellow-400", description: "Lead demonstrou interesse" },
  OFERTA_ENVIADA: { bg: "bg-purple-500/20", text: "text-purple-400", description: "Proposta/oferta enviada" },
  COMPROU: { bg: "bg-green-500/20", text: "text-green-400", description: "Conversão realizada" },
  PERDIDO: { bg: "bg-red-500/20", text: "text-red-400", description: "Lead perdido" },
  HANDOFF: { bg: "bg-orange-500/20", text: "text-orange-400", description: "Transferido para humano" },
};

interface LeadDetailPanelProps {
  lead: Lead;
  eventLead: EventLead | null;
  isOpen: boolean;
  onClose: () => void;
}

export function LeadDetailPanel({
  lead,
  eventLead,
  isOpen,
  onClose,
}: LeadDetailPanelProps) {
  const profile = lead.behavioral_profile
    ? PROFILE_CONFIG[lead.behavioral_profile]
    : null;
  const status = STATUS_CONFIG[lead.status] ?? STATUS_CONFIG.BASE;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 animate-fade-in"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-[420px] bg-[oklch(0.12_0.005_260)] border-l border-white/[0.06] z-50 overflow-y-auto transition-transform duration-500 ease-out",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[oklch(0.12_0.005_260)]/95 backdrop-blur-md border-b border-white/[0.06] px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">
              Detalhes do Lead
            </h2>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] hover:bg-white/[0.08] transition-all duration-300"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6 animate-fade-in-up">
          {/* Profile card */}
          <div className="text-center">
            <div className="flex h-20 w-20 mx-auto items-center justify-center rounded-2xl bg-[oklch(0.65_0.18_250)]/20 text-2xl font-bold text-[oklch(0.75_0.18_250)] mb-3">
              {lead.name?.[0]?.toUpperCase() ?? "L"}
            </div>
            <h3 className="text-lg font-bold text-foreground">
              {lead.name ?? "Lead sem nome"}
            </h3>
            <div className="flex items-center justify-center gap-2 mt-2">
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
                  status.bg,
                  status.text
                )}
              >
                {lead.status}
              </span>
            </div>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {status.description}
            </p>
          </div>

          {/* Behavioral profile */}
          {profile && (
            <div
              className="rounded-xl p-4 border transition-all duration-300"
              style={{
                borderColor: `color-mix(in oklch, ${profile.color}, transparent 80%)`,
                background: `color-mix(in oklch, ${profile.color}, transparent 95%)`,
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{profile.emoji}</span>
                <div>
                  <span
                    className="text-sm font-bold"
                    style={{ color: profile.color }}
                  >
                    Perfil {profile.label}
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {profile.description}
              </p>
            </div>
          )}

          {/* Contact info */}
          <Section title="Contato">
            <InfoRow icon={Phone} label="Telefone" value={lead.phone} />
            {(eventLead?.email || lead.email) && (
              <InfoRow
                icon={Mail}
                label="Email"
                value={eventLead?.email ?? lead.email!}
              />
            )}
          </Section>

          {/* Business info */}
          {eventLead && (
            <Section title="Empresa">
              {eventLead.company_name && (
                <InfoRow
                  icon={Building}
                  label="Empresa"
                  value={eventLead.company_name}
                />
              )}
              {eventLead.role && (
                <InfoRow
                  icon={Briefcase}
                  label="Cargo"
                  value={eventLead.role}
                />
              )}
              {eventLead.monthly_revenue && (
                <InfoRow
                  icon={DollarSign}
                  label="Faturamento"
                  value={eventLead.monthly_revenue}
                />
              )}
              {eventLead.company_state && (
                <InfoRow
                  icon={MapPin}
                  label="Estado"
                  value={eventLead.company_state}
                />
              )}
            </Section>
          )}

          {/* Event interest */}
          <Section title="Evento">
            {lead.event_interest && (
              <InfoRow
                icon={Target}
                label="Interesse"
                value={lead.event_interest}
              />
            )}
            {eventLead?.product && (
              <InfoRow
                icon={Tag}
                label="Produto"
                value={eventLead.product}
              />
            )}
          </Section>

          {/* UTM / Origin */}
          {eventLead &&
            (eventLead.utm_source ||
              eventLead.utm_medium ||
              eventLead.utm_campaign) && (
              <Section title="Origem (UTM)">
                {eventLead.utm_source && (
                  <InfoRow
                    icon={Globe}
                    label="Source"
                    value={eventLead.utm_source}
                  />
                )}
                {eventLead.utm_medium && (
                  <InfoRow
                    icon={Link2}
                    label="Medium"
                    value={eventLead.utm_medium}
                  />
                )}
                {eventLead.utm_campaign && (
                  <InfoRow
                    icon={TrendingUp}
                    label="Campaign"
                    value={eventLead.utm_campaign}
                  />
                )}
              </Section>
            )}

          {/* Timestamps */}
          <Section title="Datas">
            <InfoRow
              icon={Calendar}
              label="Cadastro"
              value={new Date(lead.created_at).toLocaleDateString("pt-BR", {
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            />
            <InfoRow
              icon={Clock}
              label="Última atualização"
              value={new Date(lead.updated_at).toLocaleDateString("pt-BR", {
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            />
            {eventLead?.form_submitted_at && (
              <InfoRow
                icon={Calendar}
                label="Formulário preenchido"
                value={new Date(
                  eventLead.form_submitted_at
                ).toLocaleDateString("pt-BR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              />
            )}
          </Section>
        </div>
      </div>
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-3">
        {title}
      </h4>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-white/[0.02] border border-white/[0.04] p-3 hover:border-white/[0.08] transition-all duration-300">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.04]">
        <Icon className="h-3.5 w-3.5 text-muted-foreground/60" />
      </div>
      <div className="min-w-0">
        <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">
          {label}
        </span>
        <p className="text-sm text-foreground break-all">{value}</p>
      </div>
    </div>
  );
}
