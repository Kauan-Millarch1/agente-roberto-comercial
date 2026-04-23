import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { requireRole } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const { authorized, response } = await requireRole("admin");
  if (!authorized) return response;

  const supabase = createServiceClient();

  const { data } = await supabase
    .from("roberto_costs")
    .select("*")
    .order("created_at", { ascending: false });

  return NextResponse.json(data ?? []);
}
