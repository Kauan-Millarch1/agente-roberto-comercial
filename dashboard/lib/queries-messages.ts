import { createClient } from "./supabase";
import type { Lead, Message, EventLead } from "./types";

export interface LeadWithPreview extends Lead {
  last_message_content: string | null;
  last_message_at: string | null;
  last_message_direction: string | null;
  unresponded_since: string | null;
  // Enriched from event_leads (Typeform)
  company_name: string | null;
  role: string | null;
  monthly_revenue: string | null;
  company_state: string | null;
  tax_regime: string | null;
}

/**
 * Normalizes phone to match between tables.
 * roberto_leads: "55XXYYYYYYYYY" (no +)
 * event_leads: "+55XXYYYYYYYYY" (with +)
 */
function phoneVariants(phone: string): string[] {
  const clean = phone.replace(/\D/g, "");
  return [clean, `+${clean}`, phone];
}

export async function getLeadsWithPreviews(): Promise<LeadWithPreview[]> {
  const supabase = createClient();

  const { data: leads } = await supabase
    .from("roberto_leads")
    .select("*")
    .order("updated_at", { ascending: false });

  if (!leads || leads.length === 0) return [];

  const phones = leads.map((l) => l.phone);

  // Fetch messages and event_leads in parallel
  const [messagesResult, eventLeadsResult] = await Promise.all([
    supabase
      .from("roberto_messages")
      .select("phone, content, created_at, direction")
      .in("phone", phones)
      .order("created_at", { ascending: false }),
    supabase.from("event_leads").select("*"),
  ]);

  const messages = messagesResult.data;
  const eventLeads = eventLeadsResult.data;

  // Build last message map
  const lastMsgMap = new Map<
    string,
    { content: string | null; created_at: string; direction: string }
  >();
  const unrespondedMap = new Map<string, string | null>();

  if (messages) {
    for (const msg of messages) {
      if (!lastMsgMap.has(msg.phone)) {
        lastMsgMap.set(msg.phone, {
          content: msg.content,
          created_at: msg.created_at,
          direction: msg.direction,
        });
        unrespondedMap.set(
          msg.phone,
          msg.direction === "inbound" ? msg.created_at : null
        );
      }
    }
  }

  // Build event_leads map with normalized phone matching
  const eventLeadMap = new Map<string, EventLead>();
  if (eventLeads) {
    for (const ev of eventLeads) {
      const cleanPhone = ev.phone.replace(/\D/g, "");
      eventLeadMap.set(cleanPhone, ev);
    }
  }

  return leads.map((lead) => {
    const lastMsg = lastMsgMap.get(lead.phone);
    const cleanPhone = lead.phone.replace(/\D/g, "");
    const ev = eventLeadMap.get(cleanPhone) ?? null;

    return {
      ...lead,
      last_message_content: lastMsg?.content ?? null,
      last_message_at: lastMsg?.created_at ?? null,
      last_message_direction: lastMsg?.direction ?? null,
      unresponded_since: unrespondedMap.get(lead.phone) ?? null,
      company_name: ev?.company_name ?? null,
      role: ev?.role ?? null,
      monthly_revenue: ev?.monthly_revenue ?? null,
      company_state: ev?.company_state ?? null,
      tax_regime: ev?.tax_regime ?? null,
    };
  });
}

export async function getMessagesForLead(phone: string): Promise<Message[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("roberto_messages")
    .select("*")
    .eq("phone", phone)
    .order("created_at", { ascending: true });
  return data ?? [];
}

export async function getEventLeadByPhone(
  phone: string
): Promise<EventLead | null> {
  const supabase = createClient();

  // Try all phone variants to handle format mismatch
  const variants = phoneVariants(phone);

  for (const variant of variants) {
    const { data } = await supabase
      .from("event_leads")
      .select("*")
      .eq("phone", variant)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (data) return data;
  }

  // Also try ilike for partial match
  const clean = phone.replace(/\D/g, "");
  const { data } = await supabase
    .from("event_leads")
    .select("*")
    .ilike("phone", `%${clean.slice(-10)}%`)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return data;
}
