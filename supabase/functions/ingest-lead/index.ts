import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface LeadPayload {
  product: string;
  email: string;
  full_name: string;
  company_name?: string;
  role?: string;
  phone: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  created_at?: string;
  company_state?: string;
  monthly_revenue?: string;
  knowledge_investment?: string;
  tax_regime?: string;
}

/** Normalize phone to digits-only with +55 prefix */
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) {
    return "+" + digits;
  }
  if (digits.length === 10 || digits.length === 11) {
    return "+55" + digits;
  }
  return "+" + digits;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const secret = req.headers.get("X-Webhook-Secret");
  if (!secret || secret !== WEBHOOK_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let payload: LeadPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const required = ["product", "email", "full_name", "phone"] as const;
  for (const field of required) {
    if (!payload[field]) {
      return new Response(
        JSON.stringify({ error: `Missing required field: ${field}` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  const formSubmittedAt = payload.created_at
    ? new Date(payload.created_at)
    : new Date();
  const eventMonth = new Date(
    formSubmittedAt.getFullYear(),
    formSubmittedAt.getMonth(),
    1
  )
    .toISOString()
    .split("T")[0];

  const row = {
    product: payload.product,
    email: payload.email.trim().toLowerCase(),
    full_name: payload.full_name,
    company_name: payload.company_name ?? null,
    role: payload.role ?? null,
    phone: normalizePhone(payload.phone),
    utm_source: payload.utm_source ?? null,
    utm_medium: payload.utm_medium ?? null,
    utm_campaign: payload.utm_campaign ?? null,
    utm_content: payload.utm_content ?? null,
    utm_term: payload.utm_term ?? null,
    company_state: payload.company_state ?? null,
    monthly_revenue: payload.monthly_revenue ?? null,
    knowledge_investment: payload.knowledge_investment ?? null,
    tax_regime: payload.tax_regime ?? null,
    form_submitted_at: formSubmittedAt.toISOString(),
    event_month: eventMonth,
  };

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data, error } = await supabase
    .from("event_leads")
    .insert(row)
    .select("id, email, product, event_month")
    .single();

  if (error) {
    if (error.code === "23505") {
      return new Response(
        JSON.stringify({
          error: "Duplicate lead",
          detail: "Lead with same email, product and month already exists",
        }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ success: true, lead: data }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
});
