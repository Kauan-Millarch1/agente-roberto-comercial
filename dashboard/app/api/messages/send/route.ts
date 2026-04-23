import { NextResponse, NextRequest } from "next/server";
import { requireRole } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const { authorized, response } = await requireRole("operator");
  if (!authorized) return response;

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

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, content }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: `N8N webhook failed: ${text}` },
      { status: 502 }
    );
  }

  const data = await res.json();
  return NextResponse.json(data);
}
