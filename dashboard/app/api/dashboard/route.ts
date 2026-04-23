import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServiceClient();

  const [
    activeLeadsResult,
    todayLeadsResult,
    purchasedResult,
    costsResult,
    metricsResult,
    messagesResult,
    allPhonesResult,
  ] = await Promise.all([
    supabase
      .from("roberto_leads")
      .select("*", { count: "exact", head: true })
      .in("status", ["EM CONTATO", "INTERESSADO", "OFERTA_ENVIADA"]),
    supabase
      .from("roberto_leads")
      .select("*", { count: "exact", head: true })
      .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
    supabase
      .from("roberto_leads")
      .select("*", { count: "exact", head: true })
      .eq("status", "COMPROU"),
    supabase
      .from("roberto_costs")
      .select("prompt_tokens, completion_tokens, elevenlabs_tokens"),
    supabase
      .from("roberto_metrics")
      .select("*")
      .order("data", { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from("roberto_messages")
      .select("id, phone, direction, content, media_type, wamid, created_at")
      .order("created_at", { ascending: false })
      .limit(15),
    supabase.from("roberto_leads").select("phone"),
  ]);

  // Get lead names for messages
  const messages = messagesResult.data ?? [];
  const phones = [...new Set(messages.map((m) => m.phone))];
  let leadNameMap: Record<string, string | null> = {};

  if (phones.length > 0) {
    const { data: leads } = await supabase
      .from("roberto_leads")
      .select("phone, name")
      .in("phone", phones);
    leadNameMap = Object.fromEntries(
      leads?.map((l) => [l.phone, l.name]) ?? []
    );
  }

  const costs = costsResult.data ?? [];
  const totalCosts = costs.reduce(
    (acc, row) => ({
      prompt: acc.prompt + row.prompt_tokens,
      completion: acc.completion + row.completion_tokens,
      elevenlabs: acc.elevenlabs + row.elevenlabs_tokens,
    }),
    { prompt: 0, completion: 0, elevenlabs: 0 }
  );

  return NextResponse.json({
    activeLeads: { total: activeLeadsResult.count ?? 0, today: todayLeadsResult.count ?? 0 },
    purchased: purchasedResult.count ?? 0,
    costs: totalCosts,
    metrics: metricsResult.data,
    messages: messages.map((m) => ({ ...m, lead_name: leadNameMap[m.phone] ?? null })),
    phones: allPhonesResult.data?.map((l) => l.phone) ?? [],
  });
}
