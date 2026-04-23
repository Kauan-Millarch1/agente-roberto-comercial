import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
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
