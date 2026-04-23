import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const N8N_WEBHOOK_SEND_MESSAGE = Deno.env.get("N8N_WEBHOOK_SEND_MESSAGE")
  || "https://ecommercepuro.app.n8n.cloud/webhook/roberto-envia-manual";

// Vacuum escalation: attempt -> wait time in minutes
const WAIT_MINUTES: Record<number, number> = {
  0: 15,    // 1st vacuum after 15min
  1: 60,    // 2nd vacuum after 1h
  2: 1440,  // 3rd vacuum after 24h
};

// Message pools per attempt (randomly selected)
const MESSAGES: Record<number, string[]> = {
  0: [
    "{nome}, tá por aí? 😊",
    "Oi {nome}! Conseguiu ver minha mensagem?",
    "{nome}? 👀",
  ],
  1: [
    "{nome}, sei que a correria é grande! Quando tiver um tempinho me avisa, tá?",
    "Oi {nome}, tô por aqui caso queira continuar nossa conversa 😊",
    "{nome}, qualquer coisa me chama! Sem pressa",
  ],
  2: [
    "{nome}, vou deixar sua conversa por aqui. Se precisar, é só me chamar! 💜",
    "{nome}, vou encerrar por aqui, tá? Se mudar de ideia, me manda um oi! 😊",
  ],
};

function pickRandom(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

function isBusinessHours(): boolean {
  const now = new Date();
  // GMT-3 (Brasilia)
  const brHour = (now.getUTCHours() - 3 + 24) % 24;
  return brHour >= 7 && brHour < 23;
}

function minutesSince(timestamp: string): number {
  return (Date.now() - new Date(timestamp).getTime()) / 60000;
}

Deno.serve(async (_req: Request) => {
  if (!isBusinessHours()) {
    return new Response(
      JSON.stringify({ skipped: true, reason: "outside business hours (07-23h GMT-3)" }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Step 1: Find leads where last message is outbound (within last 48h) and no inbound after it
  const { data: lastMessages, error: msgError } = await supabase.rpc(
    "get_vacuum_candidates"
  );

  // Filter: only consider outbound messages within last 48 hours (2880 min)
  // This prevents resurrecting old dead conversations
  const MAX_AGE_MINUTES = 2880;
  const recentCandidates = (lastMessages || []).filter(
    (c: { last_outbound_at: string }) => minutesSince(c.last_outbound_at) <= MAX_AGE_MINUTES
  );

  if (msgError) {
    return new Response(
      JSON.stringify({ error: msgError.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  if (recentCandidates.length === 0) {
    return new Response(
      JSON.stringify({ processed: 0, reason: "no vacuum candidates within 48h" }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  const results: Array<{ phone: string; action: string }> = [];

  for (const candidate of recentCandidates) {
    const { phone, last_outbound_at, lead_name } = candidate;
    const firstName = (lead_name || "").split(" ")[0] || "Oi";

    // Step 2: Check existing vacuum record
    const { data: vacuum } = await supabase
      .from("roberto_vacuum")
      .select("*")
      .eq("phone", phone)
      .single();

    if (vacuum && vacuum.status === "esgotado") {
      continue; // Already exhausted, skip
    }

    if (vacuum && vacuum.status === "cancelado") {
      // Only reset if the last outbound is NEWER than the vacuum cancellation
      // (meaning Roberto sent a new message after the lead responded)
      const outboundTime = new Date(last_outbound_at).getTime();
      const vacuumTime = new Date(vacuum.updated_at).getTime();
      if (outboundTime <= vacuumTime) {
        continue; // Outbound is from before/during the last vacuum cycle, skip
      }

      // New outbound after cancellation — check if enough time passed
      const timeSinceOutbound = minutesSince(last_outbound_at);
      if (timeSinceOutbound < WAIT_MINUTES[0]) {
        continue; // Not enough time passed for first vacuum
      }

      // Reset for new vacuum cycle
      await supabase
        .from("roberto_vacuum")
        .update({ attempt: 0, status: "ativo", updated_at: new Date().toISOString() })
        .eq("phone", phone);

      // Send first vacuum message
      const msg = pickRandom(MESSAGES[0]).replace("{nome}", firstName);
      await sendVacuumMessage(phone, msg);
      await supabase
        .from("roberto_vacuum")
        .update({ attempt: 1, updated_at: new Date().toISOString() })
        .eq("phone", phone);

      results.push({ phone, action: "reset+sent_vacuum_1" });
      continue;
    }

    if (vacuum && vacuum.status === "ativo") {
      const attempt = vacuum.attempt;
      const waitRequired = WAIT_MINUTES[attempt];

      if (!waitRequired) {
        // attempt >= 3, mark exhausted
        await supabase
          .from("roberto_vacuum")
          .update({ status: "esgotado", updated_at: new Date().toISOString() })
          .eq("phone", phone);
        await supabase
          .from("roberto_leads")
          .update({ status: "PERDIDO" })
          .eq("phone", phone);

        results.push({ phone, action: "marked_perdido" });
        continue;
      }

      const timeSinceLastAction = minutesSince(vacuum.updated_at);
      if (timeSinceLastAction < waitRequired) {
        continue; // Not enough time passed
      }

      // Send vacuum message for this attempt
      const pool = MESSAGES[attempt];
      if (!pool) continue;
      const msg = pickRandom(pool).replace("{nome}", firstName);
      await sendVacuumMessage(phone, msg);
      await supabase
        .from("roberto_vacuum")
        .update({ attempt: attempt + 1, updated_at: new Date().toISOString() })
        .eq("phone", phone);

      results.push({ phone, action: `sent_vacuum_${attempt + 1}` });
      continue;
    }

    // No vacuum record exists — check if enough time for first vacuum
    const timeSinceOutbound = minutesSince(last_outbound_at);
    if (timeSinceOutbound < WAIT_MINUTES[0]) {
      continue;
    }

    // Create vacuum record and send first message
    await supabase.from("roberto_vacuum").upsert({
      phone,
      attempt: 1,
      lead_name: lead_name || "",
      status: "ativo",
      updated_at: new Date().toISOString(),
    });

    const msg = pickRandom(MESSAGES[0]).replace("{nome}", firstName);
    await sendVacuumMessage(phone, msg);

    results.push({ phone, action: "created+sent_vacuum_1" });
  }

  return new Response(
    JSON.stringify({ processed: results.length, results }),
    { headers: { "Content-Type": "application/json" } }
  );
});

async function sendVacuumMessage(phone: string, content: string) {
  await fetch(N8N_WEBHOOK_SEND_MESSAGE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, content }),
  });
}
