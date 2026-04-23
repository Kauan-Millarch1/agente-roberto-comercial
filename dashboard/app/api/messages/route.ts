import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { requireRole } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { authorized, response } = await requireRole("viewer");
  if (!authorized) return response;

  const { searchParams } = new URL(request.url);
  const phone = searchParams.get("phone");

  if (!phone) {
    return NextResponse.json({ error: "phone parameter required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Fetch messages and event lead in parallel
  const cleanPhone = phone.replace(/\D/g, "");
  const [messagesResult, eventLeadResult] = await Promise.all([
    supabase
      .from("roberto_messages")
      .select("*")
      .eq("phone", phone)
      .order("created_at", { ascending: true }),
    supabase
      .from("event_leads")
      .select("*")
      .ilike("phone", `%${cleanPhone.slice(-10)}%`)
      .order("created_at", { ascending: false })
      .limit(1)
      .single(),
  ]);

  return NextResponse.json({
    messages: messagesResult.data ?? [],
    eventLead: eventLeadResult.data,
  });
}
