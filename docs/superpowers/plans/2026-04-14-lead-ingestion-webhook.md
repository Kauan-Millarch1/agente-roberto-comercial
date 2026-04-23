# Lead Ingestion via Webhook — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Receive event leads via authenticated webhook, store in Supabase, and send proactive WhatsApp messages to leads that don't contact Roberto within 1 hour.

**Architecture:** Supabase Edge Function receives POSTs from landing pages, validates auth + payload, inserts into `event_leads` table. N8N cron job (every 10min) queries pending leads and sends proactive WhatsApp messages. Roberto's main workflow marks `contacted_at` on inbound messages.

**Tech Stack:** Supabase (PostgreSQL + Edge Functions/Deno), N8N (cron + WhatsApp), WhatsApp Business API (Meta Official), Redis (existing patterns)

**Spec source:** `spec-lead-ingestion.md` (from Will Pagane, 2026-04-14)

---

## Gaps Found in Spec (must address during implementation)

| # | Gap | Impact | Resolution |
|---|---|---|---|
| G1 | Phone not normalized in Edge Function | JOIN with `roberto_leads` (phone PK) will fail if formats differ | Add normalization: strip spaces, dashes, parens → digits only, ensure `+55` prefix |
| G2 | No `supabase/` CLI directory in project | Can't deploy Edge Function via CLI | Use Supabase Dashboard to deploy, or init CLI first |
| G3 | `event_leads` has no `roberto_leads` FK | Intentional — table serves multiple agents | No action needed, JOIN by phone at query time |
| G4 | Proactive message template not defined | Spec has example but Roberto's tone/rules may differ | Use spec example as base, adapt to Roberto's voice rules (Section 4 of system prompt) |
| G5 | No retry limit column for proactive send | Spec says "after 24h stop trying" but relies on time math | Acceptable — `form_submitted_at < NOW() - 24h` as secondary filter in cron query |

---

## Chunk 1: Supabase Table + Edge Function

### Task 1: Create `event_leads` table via migration

**Files:**
- Create: Migration via Supabase MCP (`create_event_leads_table`)

**Context:** This is a NEW table — not prefixed with `roberto_` because it will serve multiple agents. The unique constraint prevents the same lead from being inserted twice for the same event in the same month.

- [ ] **Step 1: Apply migration via Supabase MCP**

```sql
-- rollback: DROP TABLE IF EXISTS event_leads;

CREATE TABLE IF NOT EXISTS event_leads (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product               TEXT        NOT NULL,
  email                 TEXT        NOT NULL,
  full_name             TEXT        NOT NULL,
  company_name          TEXT,
  role                  TEXT,
  phone                 TEXT        NOT NULL,
  utm_source            TEXT,
  utm_medium            TEXT,
  utm_campaign          TEXT,
  utm_content           TEXT,
  utm_term              TEXT,
  company_state         TEXT,
  monthly_revenue       TEXT,
  knowledge_investment  TEXT,
  tax_regime            TEXT,
  form_submitted_at     TIMESTAMPTZ,
  event_month           DATE        NOT NULL,
  contacted_at          TIMESTAMPTZ,
  proactive_sent_at     TIMESTAMPTZ,
  status                TEXT        NOT NULL DEFAULT 'new'
                                    CHECK (status IN ('new', 'contacted', 'proactive_sent')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE event_leads
  ADD CONSTRAINT unq_event_leads_email_product_month
  UNIQUE (email, product, event_month);

CREATE INDEX idx_event_leads_proactive_pending
  ON event_leads (form_submitted_at)
  WHERE contacted_at IS NULL
    AND proactive_sent_at IS NULL
    AND status = 'new';

ALTER TABLE event_leads ENABLE ROW LEVEL SECURITY;
```

Migration name: `create_event_leads_table`

- [ ] **Step 2: Verify table exists**

Run SQL: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'event_leads' ORDER BY ordinal_position;`

Expected: All 20 columns listed with correct types.

- [ ] **Step 3: Verify unique constraint**

Run SQL:
```sql
INSERT INTO event_leads (product, email, full_name, phone, event_month)
VALUES ('Test Event', 'test@test.com', 'Test User', '+5541999999999', '2026-04-01');

-- This should fail with 23505:
INSERT INTO event_leads (product, email, full_name, phone, event_month)
VALUES ('Test Event', 'test@test.com', 'Test User', '+5541999999999', '2026-04-01');
```

Expected: First INSERT succeeds, second fails with unique violation.

- [ ] **Step 4: Clean up test data**

```sql
DELETE FROM event_leads WHERE email = 'test@test.com';
```

---

### Task 2: Create and deploy Edge Function `ingest-lead`

**Files:**
- Create: `supabase/functions/ingest-lead/index.ts` (deploy via Dashboard)

**Context:** This is the first Edge Function in the project. It receives POST from landing pages, validates the `X-Webhook-Secret` header, normalizes data, and inserts into `event_leads`. The `WEBHOOK_SECRET` is `pfx_ade13ce9e7be4417303615d80862989f71ee30541534465b`.

- [ ] **Step 1: Set the WEBHOOK_SECRET in Supabase**

Via Supabase Dashboard → Project Settings → Edge Functions → Secrets:
- Key: `WEBHOOK_SECRET`
- Value: `pfx_ade13ce9e7be4417303615d80862989f71ee30541534465b`

Note: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected by Supabase.

- [ ] **Step 2: Create the Edge Function code**

File: `supabase/functions/ingest-lead/index.ts`

```typescript
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
```

**Difference from spec:** Added `normalizePhone()` function (Gap G1) — strips non-digits, ensures `+55` prefix. This guarantees phone format matches `roberto_leads` for future JOINs.

- [ ] **Step 3: Deploy via Supabase Dashboard**

Go to: Supabase Dashboard → Edge Functions → New Function → Name: `ingest-lead` → Paste code → Deploy

Alternative (if CLI is set up):
```bash
supabase functions deploy ingest-lead
```

- [ ] **Step 4: Test — successful insertion**

```bash
curl -X POST https://zlwgtfdwnibaavlcqttu.supabase.co/functions/v1/ingest-lead \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: pfx_ade13ce9e7be4417303615d80862989f71ee30541534465b" \
  -d '{
    "product": "Performance Shopee",
    "email": "teste@exemplo.com",
    "full_name": "Lead Teste",
    "phone": "+55 41 99999-9999",
    "company_name": "Empresa Teste",
    "role": "Gerente",
    "utm_source": "google",
    "utm_medium": "cpc",
    "utm_campaign": "lancamento",
    "created_at": "2026-04-14T15:00:00Z",
    "company_state": "PR",
    "monthly_revenue": "50k-100k",
    "knowledge_investment": "ate-500",
    "tax_regime": "simples"
  }'
```

Expected: `201` with `{ "success": true, "lead": { "id": "...", ... } }`

- [ ] **Step 5: Test — unauthorized (no secret)**

```bash
curl -X POST https://zlwgtfdwnibaavlcqttu.supabase.co/functions/v1/ingest-lead \
  -H "Content-Type: application/json" \
  -d '{"product": "Test", "email": "a@b.com", "full_name": "X", "phone": "123"}'
```

Expected: `401` with `{ "error": "Unauthorized" }`

- [ ] **Step 6: Test — duplicate**

Run the same curl from Step 4 again.

Expected: `409` with `{ "error": "Duplicate lead" }`

- [ ] **Step 7: Test — missing field**

```bash
curl -X POST https://zlwgtfdwnibaavlcqttu.supabase.co/functions/v1/ingest-lead \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: pfx_ade13ce9e7be4417303615d80862989f71ee30541534465b" \
  -d '{"product": "Test", "email": "a@b.com"}'
```

Expected: `400` with `{ "error": "Missing required field: full_name" }`

- [ ] **Step 8: Verify phone normalization in Supabase**

Check that the test lead's phone was saved as `+5541999999999` (no spaces/dashes).

- [ ] **Step 9: Clean up test data**

```sql
DELETE FROM event_leads WHERE email = 'teste@exemplo.com';
```

- [ ] **Step 10: Send WEBHOOK_SECRET to Will**

Secret: `pfx_ade13ce9e7be4417303615d80862989f71ee30541534465b`
Endpoint: `https://zlwgtfdwnibaavlcqttu.supabase.co/functions/v1/ingest-lead`

---

## Chunk 2: N8N Cron Job — Proactive Outreach

### Task 3: Create N8N workflow `[ROBERTO] Cron — Proactive Outreach`

**Context:** This is a NEW N8N workflow (not a modification to the main one). It runs every 10 minutes, queries `event_leads` for leads that submitted the form 1h+ ago but haven't contacted Roberto and haven't received a proactive message. It sends a WhatsApp message and updates the record.

**Naming:** `[ROBERTO] Cron — Proactive Outreach` (follows project convention)

- [ ] **Step 1: Create new workflow in N8N**

Name: `[ROBERTO] Cron — Proactive Outreach`

- [ ] **Step 2: Add Schedule Trigger node**

Node name: `trigger_cron_10min`
- Type: Schedule Trigger
- Cron expression: `*/10 * * * *` (every 10 minutes)

- [ ] **Step 3: Add Supabase node — query pending leads**

Node name: `buscar_leads_pendentes`
- Type: Supabase (or HTTP Request to Supabase REST API)
- Operation: SELECT with filters
- Query logic:

```sql
SELECT id, product, full_name, phone, email, company_name, monthly_revenue, form_submitted_at
FROM event_leads
WHERE contacted_at IS NULL
  AND proactive_sent_at IS NULL
  AND status = 'new'
  AND form_submitted_at < NOW() - INTERVAL '1 hour'
  AND form_submitted_at > NOW() - INTERVAL '24 hours'
ORDER BY form_submitted_at ASC
LIMIT 20;
```

**Note:** Added `> NOW() - 24 hours` filter (Gap G5) — stops retrying leads older than 24h.

- [ ] **Step 4: Add IF node — leads found?**

Node name: `verificar_leads_encontrados`
- Condition: `{{ $json.length > 0 }}` (or check if items exist)
- True → continue to loop
- False → NoOp (nothing to do)

- [ ] **Step 5: Add Loop Over Items node**

Node name: `loop_leads`
- Type: Split In Batches
- Batch size: 1 (process one at a time to avoid WhatsApp rate limits)

- [ ] **Step 6: Add WhatsApp send node**

Node name: `enviar_proativa_whatsapp`
- Type: HTTP Request (WhatsApp Business API)
- Method: POST
- URL: `https://graph.facebook.com/v21.0/{{PHONE_NUMBER_ID}}/messages`
- Headers: `Authorization: Bearer {{META_ACCESS_TOKEN}}`
- Body:

```json
{
  "messaging_product": "whatsapp",
  "to": "{{ $json.phone }}",
  "type": "text",
  "text": {
    "body": "Oi, {{ $json.full_name.split(' ')[0] }}! 👋\n\nVi que você se inscreveu no {{ $json.product }}. Sou o Roberto, assistente comercial da Ecommerce Puro.\n\nPosso te ajudar com informações sobre o evento, valores e condições especiais. É só me chamar aqui! 😊"
  }
}
```

**Important:** Use the same Meta credentials (Phone Number ID + Access Token) already configured in the main Roberto workflow.

- [ ] **Step 7: Add IF node — send success?**

Node name: `verificar_envio_ok`
- Condition: HTTP status 200
- True → update lead
- False → log error

- [ ] **Step 8: Add Supabase UPDATE node (success path)**

Node name: `atualizar_lead_proativa`
- Type: Supabase
- Operation: UPDATE
- Table: `event_leads`
- Filter: `id = {{ $json.id }}`
- Set:
  - `proactive_sent_at`: `{{ $now.toISO() }}`
  - `status`: `proactive_sent`

- [ ] **Step 9: Add error logging node (failure path)**

Node name: `log_erro_envio`
- Type: Code (JavaScript) or NoOp with note
- Log the phone + error for debugging

- [ ] **Step 10: Connect all nodes and activate**

```
trigger_cron_10min
  → buscar_leads_pendentes
  → verificar_leads_encontrados
      → YES → loop_leads
                → enviar_proativa_whatsapp
                → verificar_envio_ok
                    → YES → atualizar_lead_proativa
                    → NO  → log_erro_envio
      → NO  → noop_sem_leads
```

Activate the workflow after testing.

- [ ] **Step 11: Test with a real record**

Insert a test lead with `form_submitted_at` = 2 hours ago:
```sql
INSERT INTO event_leads (product, email, full_name, phone, event_month, form_submitted_at, status)
VALUES ('Performance Shopee', 'teste-proativa@test.com', 'Lead Proativa', '+55XX9XXXXXXXX', '2026-04-01', NOW() - INTERVAL '2 hours', 'new');
```

Wait for cron or trigger manually. Verify:
- WhatsApp message received
- `proactive_sent_at` filled
- `status` = `proactive_sent`

Clean up: `DELETE FROM event_leads WHERE email = 'teste-proativa@test.com';`

---

## Chunk 3: Integration with Roberto's Main Workflow

### Task 4: Mark `contacted_at` when lead messages Roberto

**Context:** In the main Roberto workflow (`azwM3PgGtSbGTCsn`), BEFORE the AI agent processes the message, we need to check if the sender has a pending record in `event_leads` and mark it as contacted. This goes in the entry/pre-processing block, after phone normalization.

**Files:**
- Modify: Main Roberto workflow in N8N (ID: `azwM3PgGtSbGTCsn`)

- [ ] **Step 1: Add Supabase node after phone normalization**

Node name: `marcar_contacted_event_leads`
- Type: Supabase (or HTTP Request)
- Position: After `Verificação_numero` / `parametros` block, before `verificar_lead_supabase`
- Operation: UPDATE
- Table: `event_leads`
- Filter: `phone = {{ $json.phone }}` AND `contacted_at IS NULL`
- Set:
  - `contacted_at`: `{{ $now.toISO() }}`
  - `status`: `contacted`

**Important:** This UPDATE affects ALL pending records for that phone (if lead registered for multiple events). This is correct behavior per spec — lead is now in conversation.

- [ ] **Step 2: Ensure node doesn't block flow on zero matches**

The UPDATE should be fire-and-forget — if no matching record exists (lead came organically, not from form), the flow continues normally. Configure the node to "Always Output Data" or use "Continue On Fail".

- [ ] **Step 3: Test with existing lead**

1. Insert a test lead in `event_leads` with status `new`
2. Send a WhatsApp message to Roberto from that phone number
3. Verify `contacted_at` is filled and `status` = `contacted`

---

### Task 5: Enrich Roberto's context with form data

**Context:** When Roberto receives a message, if the contact has an `event_leads` record, include that data in the AI agent's context. This lets Roberto personalize: "Vi que você se inscreveu no Performance Shopee!" instead of asking "Qual evento te interessa?".

**Files:**
- Modify: Main Roberto workflow in N8N (ID: `azwM3PgGtSbGTCsn`)
- Modify: `build_system_prompt` node

- [ ] **Step 1: Add Supabase SELECT node**

Node name: `buscar_event_lead_dados`
- Type: Supabase
- Position: After `marcar_contacted_event_leads`, before `build_system_prompt`
- Operation: SELECT
- Table: `event_leads`
- Filter: `phone = {{ $json.phone }}`
- Order by: `created_at DESC`
- Limit: 1

- [ ] **Step 2: Update `build_system_prompt` to inject form data**

In the `build_system_prompt` Code node, add a section that checks if `event_lead` data exists and injects it:

```javascript
// After existing context building...
const eventLead = $input.item.json.event_lead; // from buscar_event_lead_dados
if (eventLead) {
  contextParts.push(`
## DADOS DO FORMULÁRIO DO LEAD
- Produto/Evento: ${eventLead.product}
- Empresa: ${eventLead.company_name || 'Não informado'}
- Cargo: ${eventLead.role || 'Não informado'}
- Faturamento: ${eventLead.monthly_revenue || 'Não informado'}
- Estado: ${eventLead.company_state || 'Não informado'}
- Regime tributário: ${eventLead.tax_regime || 'Não informado'}
- Investimento em conhecimento: ${eventLead.knowledge_investment || 'Não informado'}
- Origem: ${eventLead.utm_source || '?'} / ${eventLead.utm_medium || '?'} / ${eventLead.utm_campaign || '?'}
- Contato proativo enviado: ${eventLead.proactive_sent_at ? 'Sim' : 'Não'}
`);
}
```

This gives Roberto rich context to personalize the conversation from the first message.

- [ ] **Step 3: Test context enrichment**

1. Insert a test lead with company_name, monthly_revenue, etc.
2. Send a message to Roberto
3. Check Roberto's response — should reference the event/product without asking

---

## Chunk 4: Documentation & Cleanup

### Task 6: Update project documentation

- [ ] **Step 1: Update CHECKLIST-PENDENCIAS.md**

Add new section for Lead Ingestion under Phase 3 (or new section):

```markdown
## 🟡 INGESTÃO DE LEADS — Webhook + Proativa (spec Will 2026-04-14)

### Supabase
- [ ] Migration aplicada — tabela `event_leads` criada
- [ ] RLS habilitado
- [ ] Unique constraint funcionando
- [ ] Secret WEBHOOK_SECRET cadastrado
- [ ] Edge Function `ingest-lead` deployada
- [ ] Testes curl passaram (201, 401, 409, 400)

### N8N
- [ ] Cron job `[ROBERTO] Cron — Proactive Outreach` criado e ativo
- [ ] Query filtra corretamente leads pendentes (1h+, <24h)
- [ ] Mensagem proativa enviada via WhatsApp
- [ ] Lead atualizado após envio (proactive_sent_at + status)
- [ ] Error handling implementado

### Integração Roberto
- [ ] Workflow principal marca `contacted_at` ao receber mensagem
- [ ] Contexto do Roberto enriquecido com dados do formulário
- [ ] Leads que já contataram não recebem proativa

### Landing Page (depende do Will/time)
- [ ] Webhook configurado com URL + secret
- [ ] Payload no formato correto
- [ ] Teste end-to-end: form → Supabase → (1h) → WhatsApp
```

- [ ] **Step 2: Update `docs/supabase.md`**

Add `event_leads` table documentation with all columns, constraints, and purpose.

- [ ] **Step 3: Update memory with new context**

Save memory about the lead ingestion spec, decisions, and webhook secret location.

---

## Summary of Deliverables

| # | Deliverable | Type | Owner |
|---|---|---|---|
| 1 | `event_leads` table | Supabase migration | Kauan |
| 2 | `ingest-lead` Edge Function | Supabase deploy | Kauan |
| 3 | `[ROBERTO] Cron — Proactive Outreach` | N8N workflow | Kauan |
| 4 | `contacted_at` marking in main workflow | N8N modification | Kauan |
| 5 | Context enrichment in `build_system_prompt` | N8N modification | Kauan |
| 6 | WEBHOOK_SECRET + endpoint URL | Send to Will | Kauan |
| 7 | Landing page webhook config | Will/team | Will |

## Info to Send to Will

```
Endpoint: https://zlwgtfdwnibaavlcqttu.supabase.co/functions/v1/ingest-lead
Method:   POST
Header:   X-Webhook-Secret: pfx_ade13ce9e7be4417303615d80862989f71ee30541534465b
Content-Type: application/json
```

## Execution Order

```
Task 1 (table) → Task 2 (edge function) → Task 3 (cron) → Task 4 (contacted_at) → Task 5 (enrichment) → Task 6 (docs)
```

Tasks 1-2 are sequential (function needs table).
Task 3 is independent after Task 1.
Tasks 4-5 are independent after Task 1.
Task 6 runs last.
