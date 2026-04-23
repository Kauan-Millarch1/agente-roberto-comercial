import { NextResponse, NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { requireRole } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
  const { authorized, response } = await requireRole("operator");
  if (!authorized) return response;

  const body = await request.json();
  const { phone, human_takeover, operator, status } = body;

  if (!phone) {
    return NextResponse.json(
      { error: "phone is required" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();
  const updateData: Record<string, unknown> = {};

  // Handle human_takeover toggle
  if (typeof human_takeover === "boolean") {
    if (human_takeover) {
      updateData.human_takeover = true;
      updateData.human_takeover_at = new Date().toISOString();
      updateData.human_takeover_by = operator || "dashboard";
    } else {
      updateData.human_takeover = false;
      updateData.human_takeover_at = null;
      updateData.human_takeover_by = null;
    }
  }

  // Handle status change (Kanban drag & drop)
  if (status) {
    updateData.status = status;
    // Moving to HANDOFF auto-activates human takeover
    if (status === "HANDOFF" && !updateData.human_takeover) {
      updateData.human_takeover = true;
      updateData.human_takeover_at = new Date().toISOString();
      updateData.human_takeover_by = operator || "dashboard";
    }
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { error: "No fields to update" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("roberto_leads")
    .update(updateData)
    .eq("phone", phone)
    .select()
    .single();

  if (error) {
    console.error("[api/leads PATCH] update failed", { error });
    return NextResponse.json(
      { error: "Erro ao atualizar lead" },
      { status: 500 }
    );
  }

  // Cancel active vacuums when human takes over
  if (updateData.human_takeover === true) {
    await supabase
      .from("roberto_vacuum")
      .update({ status: "cancelado" })
      .eq("phone", phone)
      .eq("status", "ativo");
  }

  return NextResponse.json(data);
}

export async function GET() {
  const { authorized, response } = await requireRole("viewer");
  if (!authorized) return response;

  const supabase = createServiceClient();

  const [leadsResult, eventLeadsResult, messagesResult] = await Promise.all([
    supabase
      .from("roberto_leads")
      .select("*")
      .order("updated_at", { ascending: false }),
    supabase.from("event_leads").select("*"),
    supabase
      .from("roberto_messages")
      .select("phone, content, created_at, direction")
      .order("created_at", { ascending: false }),
  ]);

  const leads = leadsResult.data ?? [];
  const eventLeads = eventLeadsResult.data ?? [];
  const messages = messagesResult.data ?? [];

  // Build event leads map (normalized phone)
  const eventLeadMap = new Map<string, (typeof eventLeads)[0]>();
  for (const ev of eventLeads) {
    const cleanPhone = ev.phone.replace(/\D/g, "");
    eventLeadMap.set(cleanPhone, ev);
  }

  // Build last message map
  const lastMsgMap = new Map<string, { content: string | null; created_at: string; direction: string }>();
  const unrespondedMap = new Map<string, string | null>();

  for (const msg of messages) {
    if (!lastMsgMap.has(msg.phone)) {
      lastMsgMap.set(msg.phone, {
        content: msg.content,
        created_at: msg.created_at,
        direction: msg.direction,
      });
      unrespondedMap.set(msg.phone, msg.direction === "inbound" ? msg.created_at : null);
    }
  }

  const enrichedLeads = leads.map((lead) => {
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

  return NextResponse.json(enrichedLeads);
}
