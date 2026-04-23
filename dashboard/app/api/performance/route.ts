import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { requireRole } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const { authorized, response } = await requireRole("viewer");
  if (!authorized) return response;

  const supabase = createServiceClient();

  const [metricsResult, profilesResult] = await Promise.all([
    supabase
      .from("roberto_metrics")
      .select("*")
      .order("data", { ascending: false })
      .limit(1)
      .single(),
    supabase.from("roberto_profile_stats").select("*"),
  ]);

  return NextResponse.json({
    metrics: metricsResult.data,
    profiles: profilesResult.data ?? [],
  });
}
