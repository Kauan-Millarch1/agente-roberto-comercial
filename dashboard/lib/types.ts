export type LeadStatus =
  | "BASE"
  | "EM CONTATO"
  | "INTERESSADO"
  | "OFERTA_ENVIADA"
  | "COMPROU"
  | "PERDIDO"
  | "HANDOFF";

export type BehavioralProfile =
  | "tubarao"
  | "aguia"
  | "lobo"
  | "gato"
  | "neutro";

export type MediaType = "text" | "audio_input" | "audio_output" | "image";

export interface Lead {
  phone: string;
  name: string | null;
  email: string | null;
  event_interest: string | null;
  status: LeadStatus;
  behavioral_profile: BehavioralProfile | null;
  clickup_task_id: string | null;
  human_takeover: boolean;
  human_takeover_at: string | null;
  human_takeover_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  phone: string;
  direction: "inbound" | "outbound";
  content: string | null;
  media_type: MediaType;
  wamid: string | null;
  created_at: string;
}

export interface EventLead {
  id: string;
  product: string;
  email: string;
  full_name: string;
  company_name: string | null;
  role: string | null;
  phone: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  company_state: string | null;
  monthly_revenue: string | null;
  knowledge_investment: string | null;
  tax_regime: string | null;
  form_submitted_at: string | null;
  event_month: string | null;
  contacted_at: string | null;
  proactive_sent_at: string | null;
  status: string;
  created_at: string;
}

export interface Cost {
  id: string;
  phone: string | null;
  model: string | null;
  prompt_tokens: number;
  completion_tokens: number;
  elevenlabs_tokens: number;
  created_at: string;
}

export interface Metric {
  id: string;
  agent_id: string;
  data: string;
  total_mensagens: number;
  total_conversas: number;
  total_conversoes: number;
  total_handoffs: number;
  total_perdidos: number;
  updated_at: string;
}

export interface ProfileStat {
  profile: BehavioralProfile;
  total: number;
  converted: number;
  lost: number;
}

export interface Vacuum {
  phone: string;
  attempt: number;
  lead_name: string | null;
  status: "ativo" | "cancelado" | "esgotado";
  last_context: string | null;
  updated_at: string;
}
