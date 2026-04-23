import { NextResponse, NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { requireRole } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;

export async function POST(request: NextRequest) {
  const { authorized, userId, response } = await requireRole("operator");
  if (!authorized || !userId) return response;

  const { phone, content } = await request.json();

  if (!phone || !content) {
    return NextResponse.json(
      { error: "phone and content are required" },
      { status: 400 }
    );
  }

  const webhookUrl = process.env.N8N_WEBHOOK_SEND_MESSAGE;
  if (!webhookUrl) {
    return NextResponse.json(
      { error: "N8N_WEBHOOK_SEND_MESSAGE not configured" },
      { status: 500 }
    );
  }

  const supabase = createServiceClient();

  const { data: lead, error: leadError } = await supabase
    .from("roberto_leads")
    .select("phone")
    .eq("phone", phone)
    .maybeSingle();

  if (leadError) {
    console.error("[api/messages/send] Lead lookup failed", { leadError });
    return NextResponse.json(
      { error: "Erro ao validar lead" },
      { status: 500 }
    );
  }

  if (!lead) {
    return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
  }

  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count, error: countError } = await supabase
    .from("roberto_audit_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", windowStart);

  if (countError) {
    console.error("[api/messages/send] Rate limit check failed", { countError });
    return NextResponse.json(
      { error: "Erro interno" },
      { status: 500 }
    );
  }

  if ((count ?? 0) >= RATE_LIMIT_MAX) {
    return NextResponse.json(
      { error: "Rate limit excedido" },
      { status: 429 }
    );
  }

  const contentHash = createHash("sha256").update(content, "utf8").digest("hex");

  const { error: auditError } = await supabase.from("roberto_audit_log").insert({
    user_id: userId,
    action: "send_message",
    phone,
    content_hash: contentHash,
    metadata: { content_length: content.length },
  });

  if (auditError) {
    console.error("[api/messages/send] Audit log write failed", { auditError });
    return NextResponse.json(
      { error: "Erro interno" },
      { status: 500 }
    );
  }

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, content }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[api/messages/send] N8N webhook failed", { status: res.status, body: text });
    return NextResponse.json(
      { error: "Falha ao enviar mensagem. Tente novamente." },
      { status: 502 }
    );
  }

  const data = await res.json();
  return NextResponse.json(data);
}
