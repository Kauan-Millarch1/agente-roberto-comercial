import { createClient } from "./supabase";
import type { Metric, ProfileStat } from "./types";

export async function getActiveLeadsCount(): Promise<{
  total: number;
  today: number;
}> {
  const supabase = createClient();
  const { count: total } = await supabase
    .from("roberto_leads")
    .select("*", { count: "exact", head: true })
    .in("status", ["EM CONTATO", "INTERESSADO", "OFERTA_ENVIADA"]);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { count: today } = await supabase
    .from("roberto_leads")
    .select("*", { count: "exact", head: true })
    .gte("created_at", todayStart.toISOString());

  return { total: total ?? 0, today: today ?? 0 };
}

export async function getPurchasedLeadsCount(): Promise<number> {
  const supabase = createClient();
  const { count } = await supabase
    .from("roberto_leads")
    .select("*", { count: "exact", head: true })
    .eq("status", "COMPROU");
  return count ?? 0;
}

export async function getTotalCosts(): Promise<{
  prompt: number;
  completion: number;
  elevenlabs: number;
}> {
  const supabase = createClient();
  const { data } = await supabase
    .from("roberto_costs")
    .select("prompt_tokens, completion_tokens, elevenlabs_tokens");

  if (!data) return { prompt: 0, completion: 0, elevenlabs: 0 };

  return data.reduce(
    (acc, row) => ({
      prompt: acc.prompt + row.prompt_tokens,
      completion: acc.completion + row.completion_tokens,
      elevenlabs: acc.elevenlabs + row.elevenlabs_tokens,
    }),
    { prompt: 0, completion: 0, elevenlabs: 0 }
  );
}

export async function getLatestMetrics(): Promise<Metric | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("roberto_metrics")
    .select("*")
    .order("data", { ascending: false })
    .limit(1)
    .single();
  return data;
}

export async function getRecentMessages(
  limit = 20
): Promise<
  Array<{
    id: string;
    phone: string;
    direction: string;
    content: string | null;
    media_type: string;
    wamid: string | null;
    created_at: string;
    lead_name: string | null;
  }>
> {
  const supabase = createClient();
  const { data: messages } = await supabase
    .from("roberto_messages")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!messages) return [];

  const phones = [...new Set(messages.map((m) => m.phone))];
  const { data: leads } = await supabase
    .from("roberto_leads")
    .select("phone, name")
    .in("phone", phones);

  const leadMap = new Map(leads?.map((l) => [l.phone, l.name]) ?? []);

  return messages.map((m) => ({
    ...m,
    lead_name: leadMap.get(m.phone) ?? null,
  }));
}

export async function getProfileStats(): Promise<ProfileStat[]> {
  const supabase = createClient();
  const { data } = await supabase.from("roberto_profile_stats").select("*");
  return data ?? [];
}
