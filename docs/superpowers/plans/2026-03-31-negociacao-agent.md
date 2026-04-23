# Negociação Agent — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the first Paperclip micro agent that intercepts discount negotiations below the table maximum, pauses the conversation, creates an approval issue in Paperclip, alerts Slack for urgent cases, and resumes with the approved (or fallback) price.

**Architecture:** Paperclip runs as orchestrator (dashboard + agent management). N8N handles all execution via webhooks. The Negociação Agent is an HTTP adapter agent in Paperclip that triggers an N8N workflow. N8N also calls the Paperclip REST API to create approval issues and poll for results.

**Tech Stack:** Paperclip (Node.js + PostgreSQL), N8N (cloud), Supabase (PostgreSQL), ClickUp API, Slack incoming webhook.

**Spec:** `docs/superpowers/specs/2026-03-31-paperclip-micro-agents-design.md`

---

## Chunk 1: Infrastructure Setup

### Task 1: Install Paperclip locally

**Files:**
- None (system setup)

- [ ] **Step 1: Install Paperclip via npx**

Run in terminal:
```bash
npx paperclipai onboard --yes
```

This will:
- Install Paperclip
- Start embedded PostgreSQL
- Open dashboard at `http://localhost:3000`
- Start API at `http://localhost:3100`

- [ ] **Step 2: Create the company**

In the Paperclip onboarding UI:
- Company name: `Roberto Comercial`
- Mission: `AI sales agent for Ecommerce Puro presential events. Manage negotiations, monitor quality, track errors, and report sales metrics.`

- [ ] **Step 3: Create Roberto CEO agent**

In Paperclip dashboard → Agents → Add:
- Name: `Roberto CEO`
- Title: `CEO`
- Adapter: `http`
- URL: (leave empty for now — will be configured later)
- Model: (N/A — Roberto uses GPT-5.1 via N8N, not Paperclip's model)

- [ ] **Step 4: Create Negociação Agent**

In Paperclip dashboard → Agents → Add:
- Name: `Negociação Agent`
- Title: `Negotiation Compliance`
- Reports to: `Roberto CEO`
- Adapter: `http`
- URL: `https://ecommercepuro.app.n8n.cloud/webhook/roberto-negociacao`
- Heartbeat: Disabled (this agent is triggered on-demand, not on schedule)

- [ ] **Step 5: Note the Paperclip API key**

Go to Paperclip dashboard → Settings → API Keys.
Copy the API key — this will be stored in N8N credentials (NEVER in docs or code files per project rules).

- [ ] **Step 6: Verify Paperclip API is reachable**

```bash
curl -s http://localhost:3100/api/agents \
  -H "Authorization: Bearer <API_KEY>" | head -20
```

Expected: JSON array with Roberto CEO and Negociação Agent.

- [ ] **Step 7: Map actual Paperclip API endpoints (CRITICAL)**

The plan assumes specific API paths. After installation, verify the real endpoints:

```bash
# List available routes
curl -s http://localhost:3100/api/ -H "Authorization: Bearer <API_KEY>"

# Create a test issue and note the exact response shape
curl -s -X POST http://localhost:3100/api/issues \
  -H "Authorization: Bearer <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test issue","description":"Delete me"}' | python -m json.tool

# Check what status values an issue can have (approved? done? resolved?)
curl -s http://localhost:3100/api/issues/<TEST_ID> \
  -H "Authorization: Bearer <API_KEY>" | python -m json.tool
```

Document the actual:
- Issue creation endpoint and required fields
- Issue status field name and possible values (for polling loop)
- How approval is communicated (status change? comment? resolution field?)

**If any endpoint differs from what this plan assumes, update Task 7 accordingly before proceeding.**

- [ ] **Step 8: Note config**

No files to commit — Paperclip stores its data in its own PostgreSQL. API key goes into N8N credentials.

---

### Task 2: Create `roberto_descontos` table in Supabase

**Files:**
- Modify: `docs/supabase.md` (add table documentation)

- [ ] **Step 1: Run migration SQL in Supabase**

Go to Supabase dashboard → SQL Editor → Run:

```sql
-- Runtime discount table for Negociação Agent
CREATE TABLE roberto_descontos (
  evento_nome      TEXT PRIMARY KEY,
  preco_cheio      NUMERIC NOT NULL,
  nivel_1          NUMERIC,
  nivel_2          NUMERIC,
  maximo_desconto  NUMERIC NOT NULL,
  formas_pagamento TEXT[] NOT NULL DEFAULT ARRAY['PIX', '6x']
);

-- Seed with current discount tiers from docs/discount-rules.md
-- NOTE: 'Evento 6k', 'Evento 5k', 'Evento 3k' are placeholders for price tiers.
-- Replace with real event names when available. The ilike match in N8N depends on these names.
INSERT INTO roberto_descontos (evento_nome, preco_cheio, nivel_1, nivel_2, maximo_desconto) VALUES
  ('Imersão Tributária',    15000, NULL, NULL, 10000),
  ('Performance Meli',       7500, 7000, 6000,  5000),
  ('Evento 6k',              6000, NULL, NULL,  5000),
  ('Evento 5k',              5000, NULL, NULL,  4000),
  ('Evento 3k',              3000, NULL, NULL,  2000);

-- Grant read access to anon/service role
GRANT SELECT ON roberto_descontos TO anon, authenticated, service_role;
```

- [ ] **Step 2: Verify data was inserted**

Run in Supabase SQL Editor:
```sql
SELECT * FROM roberto_descontos ORDER BY preco_cheio DESC;
```

Expected: 5 rows matching the discount rules document.

- [ ] **Step 3: Update docs/supabase.md with new table**

Add the `roberto_descontos` table documentation to `docs/supabase.md`, following the same format as existing tables.

- [ ] **Step 4: Commit**

```bash
git add docs/supabase.md
git commit -m "feat: add roberto_descontos table documentation for Negociação Agent"
```

---

### Task 3: Create Slack incoming webhook

**Files:**
- None (external config)

- [ ] **Step 1: Create Slack channel `#roberto-alertas`**

In Slack workspace → Create channel → Name: `roberto-alertas`

- [ ] **Step 2: Create incoming webhook**

Go to Slack → Apps → Incoming Webhooks → Add to Slack:
- Channel: `#roberto-alertas`
- Copy the webhook URL

- [ ] **Step 3: Store webhook URL in N8N credentials**

In N8N → Credentials → Add → Slack Incoming Webhook:
- Store the webhook URL (NEVER in docs or code files)

---

## Chunk 2: System Prompt & Structured Output Changes

### Task 4: Add `preco_solicitado_lead` to system prompt

**Files:**
- Modify: `docs/system-prompt.md` (EN — authoritative)
- Modify: `docs/system-prompt-pt.md` (PT-BR — keep in sync)

- [ ] **Step 1: Add field to structured output schema in `docs/system-prompt.md`**

In the structured output JSON section, add after `preco_negociado`:

```json
"preco_solicitado_lead": "string or null"
```

Add to the field descriptions:
```
preco_solicitado_lead: price the LEAD explicitly requested or proposed.
  Set when lead says things like "faz por X?", "se fechar por X", "consigo por X?".
  Always extract the numeric value only (e.g., "3000" not "R$ 3.000").
  null if lead has not proposed a specific price.
  IMPORTANT: Reset to null after the approval flow completes (approved, rejected, or timeout)
  to avoid re-triggering on the next turn.
```

- [ ] **Step 2: Add negotiation pause instruction to Stage 5.1**

In Stage 5.1 (Negotiation), add after the existing discount approaches:

```
IMPORTANT — External approval flow:
When the lead requests a price BELOW the table maximum for their event:
1. Set preco_solicitado_lead to the requested value
2. Respond: "show, deixa eu ver com meu gestor o que consigo pra vc"
3. The system will pause and seek approval
4. If approved: close at approved price
5. If rejected or timeout: offer table maximum and say "cara, esse é o maximo que consigo chegar"

This ONLY triggers when preco_solicitado_lead < maximo_desconto from the discount table.
Discounts WITHIN the table remain fully autonomous — no pause needed.
```

- [ ] **Step 3: Apply same changes to `docs/system-prompt-pt.md`**

Translate and add the same field and instructions to the Portuguese version.

- [ ] **Step 4: Commit**

```bash
git add docs/system-prompt.md docs/system-prompt-pt.md
git commit -m "feat: add preco_solicitado_lead field and approval flow to system prompt"
```

---

### Task 5: Update N8N agent structured output parsing

**Files:**
- Modify: N8N workflow (manual — via N8N UI)

- [ ] **Step 1: Update the AI Agent output parser in N8N**

In N8N workflow `[ROBERTO] Agent — Comercial Ecommerce Puro`:
1. Find the Structured Output Parser node
2. Add new field `preco_solicitado_lead` (type: string, optional, default: null)
3. Save

- [ ] **Step 2: Test with a simulated message**

Send a test WhatsApp message to Roberto like: "se fechar por 3 mil eu fecho agora"

Verify in the N8N execution log that the structured output includes:
```json
"preco_solicitado_lead": "3000"
```

---

## Chunk 3: N8N Approval Workflow

### Task 6: Create the discount comparison node in main workflow

**Files:**
- Modify: N8N workflow (manual — via N8N UI)

This node runs AFTER the AI Agent produces structured output but BEFORE sending the message to WhatsApp.

- [ ] **Step 1: Add a Code node `verificar_desconto_aprovacao`**

Place it between the AI Agent output and the WABA send node.

Node name: `verificar_desconto_aprovacao`
Node type: Code (JavaScript)

```javascript
// verificar_desconto_aprovacao
// Checks if lead requested price needs Paperclip approval

const output = $input.first().json;
const precoSolicitado = output.preco_solicitado_lead;
const eventoInteresse = output.evento_interesse;

// No price requested by lead → pass through
if (!precoSolicitado) {
  return [{ json: { ...output, precisa_aprovacao: false } }];
}

const precoNum = parseFloat(precoSolicitado);

// Query Supabase for discount table
const supabaseUrl = $env.SUPABASE_URL;
const supabaseKey = $env.SUPABASE_SERVICE_KEY;

const response = await fetch(
  `${supabaseUrl}/rest/v1/roberto_descontos?evento_nome=ilike.*${encodeURIComponent(eventoInteresse)}*&select=*`,
  {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  }
);

const descontos = await response.json();

if (!descontos || descontos.length === 0) {
  // Event not found in discount table → pass through (no approval needed)
  return [{ json: { ...output, precisa_aprovacao: false } }];
}

const desconto = descontos[0];
const maximoDesconto = parseFloat(desconto.maximo_desconto);

if (precoNum >= maximoDesconto) {
  // Price is within table → auto-approved, no need for Paperclip
  return [{ json: { ...output, precisa_aprovacao: false } }];
}

// Price is BELOW table maximum → check if absurd
// Absurd = less than 50% of table maximum → auto-reject, no Paperclip issue
if (precoNum < maximoDesconto * 0.5) {
  return [{ json: { ...output, precisa_aprovacao: false, preco_absurdo: true } }];
}

// Price is BELOW table maximum → needs approval
return [{
  json: {
    ...output,
    precisa_aprovacao: true,
    preco_solicitado_num: precoNum,
    preco_cheio: parseFloat(desconto.preco_cheio),
    maximo_desconto: maximoDesconto,
    evento_desconto: desconto.evento_nome
  }
}];
```

- [ ] **Step 2: Add IF node `precisa_aprovacao?`**

After `verificar_desconto_aprovacao`:
- Condition: `{{ $json.precisa_aprovacao }}` equals `true`
- TRUE branch → goes to approval flow (Task 7)
- FALSE branch → goes to `preco_absurdo?` IF node (Step 2.1)

- [ ] **Step 2.1: Add IF node `preco_absurdo?`**

After the FALSE branch of `precisa_aprovacao?`:
- Condition: `{{ $json.preco_absurdo }}` equals `true`
- TRUE branch → Roberto handles with standard script (no Paperclip issue, no special action — the AI agent already responded with the regular negotiation flow since `preco_solicitado_lead` is set but the price is absurd)
- FALSE branch → existing WABA send flow (no change)

> **Why this matters:** Without this node, absurd price requests (< 50% of table max) would follow the same path as normal messages. The `preco_absurdo` flag lets you log/track these separately or add specific handling later.

- [ ] **Step 3: Test the comparison logic**

Trigger with test data:
- `preco_solicitado_lead: "3000"`, `evento_interesse: "Imersão Tributária"` → should route to TRUE (3000 < 10000)
- `preco_solicitado_lead: "12000"`, `evento_interesse: "Imersão Tributária"` → should route to FALSE (12000 >= 10000)
- `preco_solicitado_lead: null` → should route to FALSE

---

### Task 7: Create the Paperclip approval flow in N8N

**Files:**
- Modify: N8N workflow (manual — via N8N UI)

This is the TRUE branch of the `precisa_aprovacao?` IF node.

- [ ] **Step 0: Add concurrency guard (Redis lock)**

Before creating the Paperclip issue, check if this lead already has a pending approval.

> **N8N limitation:** Code nodes do NOT have `$redis` available. Use dedicated Redis nodes instead.

Add the following nodes at the start of the TRUE branch:

1. **Redis node** `redis_get_lock_aprovacao`:
   - Operation: Get
   - Key: `roberto:aprovacao:{{ $json.telefone }}`
   - This returns the lock value (or empty if no lock)

2. **IF node** `aprovacao_em_andamento?`:
   - Condition: `{{ $('redis_get_lock_aprovacao').item.json.result }}` is not empty
   - TRUE → send hold message via WABA: `"calma, ja to vendo aqui com meu gestor, te retorno ja ja"` → stop
   - FALSE → continue to Redis SET

3. **Redis node** `redis_set_lock_aprovacao`:
   - Operation: Set
   - Key: `roberto:aprovacao:{{ $json.telefone }}`
   - Value: `pending`
   - TTL: 900 (15 minutes)

4. **Code node** `preparar_dados_aprovacao` (after Redis SET):
   - Adds the approval start timestamp to the flow data for timeout calculation later

```javascript
// preparar_dados_aprovacao
// Saves the approval start time so the polling loop can calculate timeout accurately
return [{
  json: {
    ...$input.first().json,
    aprovacao_inicio_ts: Date.now()
  }
}];
```

- [ ] **Step 1: Add HTTP Request node `criar_issue_paperclip`**

Node name: `criar_issue_paperclip`
Method: POST
URL: `http://localhost:3100/api/issues`

**CRITICAL: Enable "Continue On Fail" on this node.** If Paperclip is unreachable, the workflow must NOT fail — it falls back to table maximum (same as timeout).

Add an IF node after this: if `{{ $json.error }}` exists → route to fallback (same as timeout/rejected path). If success → continue to wait message.
Headers:
- `Authorization`: `Bearer {{ $env.PAPERCLIP_API_KEY }}`
- `Content-Type`: `application/json`

Body (JSON):
```json
{
  "title": "🔴 Aprovação Desconto — {{ $json.dados_lead.nome || $json.telefone }} — {{ $json.evento_desconto }}",
  "description": "Lead: {{ $json.dados_lead.nome }} ({{ $json.telefone }})\nEvento: {{ $json.evento_desconto }} (R$ {{ $json.preco_cheio }})\nMáximo tabela: R$ {{ $json.maximo_desconto }}\nLead pede: R$ {{ $json.preco_solicitado_num }}\nContexto: última msg do lead\n\n⏱️ Timeout: 10min → fallback R$ {{ $json.maximo_desconto }}",
  "assignee": "negociacao-agent",
  "priority": "urgent"
}
```

- [ ] **Step 1.1: Extract issue_id from Paperclip response**

Add a **Code node** `extrair_issue_id` immediately after `criar_issue_paperclip` (before the error IF):

```javascript
// extrair_issue_id
// Merges the Paperclip issue ID into the flow data for the polling loop
const response = $input.first().json;
const previousData = $('preparar_dados_aprovacao').first().json;

return [{
  json: {
    ...previousData,
    issue_id: response.id || response._id,
    paperclip_error: !!response.error
  }
}];
```

The `issue_id` is now available for all downstream nodes (wait message, Slack alert, polling loop).

- [ ] **Step 2: Add HTTP Request node `enviar_msg_espera`**

Immediately after creating the issue, send the "wait" message to the lead via WABA.

Node name: `enviar_msg_espera`
This sends: `"show, deixa eu ver com meu gestor o que consigo pra vc"`

Use the same WABA send pattern already in the workflow — copy the existing text send node and change the message to the wait text.

- [ ] **Step 3: Add Slack alert node `alertar_slack_desconto`**

Node name: `alertar_slack_desconto`
Node type: HTTP Request
Method: POST
URL: `{{ $env.SLACK_WEBHOOK_ROBERTO_ALERTAS }}`
Body:
```json
{
  "text": "🔴 *Aprovação de Desconto Urgente*\n\n*Lead:* {{ $json.dados_lead.nome || 'Desconhecido' }} ({{ $json.telefone }})\n*Evento:* {{ $json.evento_desconto }} (R$ {{ $json.preco_cheio }})\n*Pede:* R$ {{ $json.preco_solicitado_num }}\n*Máximo tabela:* R$ {{ $json.maximo_desconto }}\n\n⏱️ Timeout em 10min — aprovar no Paperclip"
}
```

- [ ] **Step 4: Add polling loop `aguardar_aprovacao`**

Node name: `aguardar_aprovacao`
Pattern: Wait node (30 seconds) → HTTP Request (GET issue status) → IF (approved/rejected/timeout)

Implementation:
1. **Wait node** — 30 seconds delay
2. **HTTP Request node** `checar_status_issue`:
   - Method: GET
   - URL: `http://localhost:3100/api/issues/{{ $json.issue_id }}`
   - Headers: `Authorization: Bearer {{ $env.PAPERCLIP_API_KEY }}`
3. **Code node** `avaliar_resultado`:

```javascript
// avaliar_resultado
const issue = $input.first().json;

// Use the timestamp saved in preparar_dados_aprovacao (NOT $execution.startedAt,
// which reflects the entire workflow start and may be inaccurate for the approval window)
const aprovacaoInicio = $('extrair_issue_id').first().json.aprovacao_inicio_ts;
const elapsed = Date.now() - aprovacaoInicio;
const timeoutMs = 10 * 60 * 1000; // 10 minutes

// Preserve flow data for downstream nodes (phone, maximo_desconto, etc.)
const flowData = $('extrair_issue_id').first().json;

// NOTE: Verify actual Paperclip status values in Task 1 Step 7.
// The values below (approved/done/rejected) may differ — adjust accordingly.
if (issue.status === 'approved' || issue.status === 'done') {
  // Convention: approver adds comment "APROVADO <price>" (e.g., "APROVADO 4500")
  // Parse the approved price from the latest comment
  const comments = issue.comments || [];
  const approvalComment = comments.find(c => c.body && c.body.startsWith('APROVADO'));
  const precoAprovado = approvalComment
    ? approvalComment.body.replace('APROVADO', '').trim()
    : null;
  return [{ json: { ...flowData, resultado: 'aprovado', preco_aprovado: precoAprovado } }];
}

if (issue.status === 'rejected') {
  return [{ json: { ...flowData, resultado: 'rejeitado' } }];
}

if (elapsed >= timeoutMs) {
  return [{ json: { ...flowData, resultado: 'timeout' } }];
}

// Still pending → loop back to wait
return [{ json: { ...flowData, resultado: 'pendente' } }];
```

4. **IF node** `resultado_aprovacao`:
   - `resultado` = `aprovado` → send approved price to lead
   - `resultado` = `rejeitado` OR `timeout` → send fallback (table maximum)
   - `resultado` = `pendente` → loop back to Wait node

- [ ] **Step 5: Add response nodes for each outcome**

**Approved branch** — `responder_aprovado`:
Send via WABA: `"boa noticia! consigo fazer por R$ {{ $json.preco_aprovado }} pra vc, fechou?"`
Then: **Redis node** `redis_del_lock_aprovado` → Operation: Delete, Key: `roberto:aprovacao:{{ $json.telefone }}`

**Rejected/Timeout branch** — `responder_fallback`:
Send via WABA: `"cara, o maximo que consigo chegar é R$ {{ $json.maximo_desconto }}, esse é o limite mesmo. fechou?"`
Then: **Redis node** `redis_del_lock_fallback` → Operation: Delete, Key: `roberto:aprovacao:{{ $json.telefone }}`

Both should follow the existing WABA send pattern in the workflow. Both MUST clean up the Redis concurrency lock after responding.

> **Note:** Use dedicated Redis nodes (not Code node `$redis`) for all Redis operations. N8N Code nodes do not expose a Redis client.

- [ ] **Step 6: Connect all nodes**

```
AI Agent Output
  → verificar_desconto_aprovacao
    → IF precisa_aprovacao?
      FALSE → IF preco_absurdo?
        TRUE → Roberto handles with standard script (log/track, no special action)
        FALSE → existing WABA send flow (no change)
      TRUE → redis_get_lock_aprovacao
        → IF aprovacao_em_andamento? (lock exists?)
          TRUE → send "calma, ja to vendo" via WABA → stop
          FALSE → redis_set_lock_aprovacao (TTL 15min)
            → preparar_dados_aprovacao (save timestamp)
              → criar_issue_paperclip (Continue On Fail enabled)
                → extrair_issue_id (merge issue_id + detect error)
                  → IF paperclip_error?
                    TRUE → responder_fallback + redis_del_lock_fallback
                    FALSE → enviar_msg_espera + alertar_slack_desconto (parallel)
                      → Wait 30s → checar_status_issue → avaliar_resultado
                        → IF resultado_aprovacao
                          aprovado → responder_aprovado + redis_del_lock_aprovado → continue
                          rejeitado/timeout → responder_fallback + redis_del_lock_fallback → continue
                          pendente → loop back to Wait 30s
```

- [ ] **Step 7: Test full approval flow**

1. Send test message: "se fechar por 3 mil eu fecho agora" (for Imersão Tributária)
2. Verify:
   - Lead receives "show, deixa eu ver com meu gestor"
   - Issue appears in Paperclip dashboard inbox
   - Slack alert fires in `#roberto-alertas`
3. Approve in Paperclip (add comment: `APROVADO 3000`)
4. Verify lead receives approved price message
5. Verify Redis lock `roberto:aprovacao:{phone}` was deleted

- [ ] **Step 8: Test timeout fallback**

1. Send test message with price below table
2. Wait 10 minutes WITHOUT approving
3. Verify lead receives fallback message with table maximum
4. Verify Redis lock was cleaned up

- [ ] **Step 9: Test auto-pass (price within table)**

1. Send test message: "consigo por 6 mil?" (for Imersão Tributária, max = 10000)
2. Verify: no Paperclip issue created, Roberto continues normally

- [ ] **Step 10: Test concurrency guard**

1. Trigger approval flow with a test lead
2. While waiting, send another message from the same lead
3. Verify: second message gets "calma, ja to vendo" response, NOT a second Paperclip issue

- [ ] **Step 11: Test Paperclip unreachable fallback**

1. Stop Paperclip server
2. Trigger approval flow
3. Verify: lead receives fallback (table maximum), NOT an error

- [ ] **Step 12: Test absurd price auto-reject**

1. Send: "faz por 500 reais?" (for Imersão Tributária, max = 10000, 50% = 5000)
2. Verify: no Paperclip issue created, Roberto handles with standard script

---

## Chunk 4: Documentation & Cleanup

### Task 8: Update project documentation

**Files:**
- Modify: `CLAUDE.md` (add Paperclip section)
- Modify: `CHECKLIST-PENDENCIAS.md` (update progress)
- Modify: `docs/discount-rules.md` (add approval flow note)

- [ ] **Step 1: Add Paperclip section to CLAUDE.md**

Add after the "N8N Naming Convention" section:

```markdown
## Paperclip Agent Monitoring

- **Dashboard:** `http://localhost:3000` (local) — will migrate to VPS
- **API:** `http://localhost:3100/api`
- **Company:** Roberto Comercial
- **Agents:** Roberto CEO, Negociação Agent (more to come: QA, Erros Técnicos, Métricas Vendas)
- **Approval flow:** Discounts below table maximum → 10min timeout → fallback to table max
- **Slack alerts:** `#roberto-alertas` — only high-urgency (discount + closing now)
- **Design spec:** `docs/superpowers/specs/2026-03-31-paperclip-micro-agents-design.md`
```

- [ ] **Step 2: Update CHECKLIST-PENDENCIAS.md**

Add a new section for Paperclip agents and mark completed items.

- [ ] **Step 3: Add approval flow note to docs/discount-rules.md**

Add at the end of the document:

```markdown
## External Approval (Paperclip Integration)

When a lead requests a price BELOW the table maximum:
- Roberto pauses and says "vou ver com meu gestor"
- Issue created in Paperclip for human approval
- Slack alert sent to #roberto-alertas
- Timeout: 10min → fallback to table maximum
- Discounts WITHIN the table remain fully autonomous (no approval needed)

See: `docs/superpowers/specs/2026-03-31-paperclip-micro-agents-design.md`
```

- [ ] **Step 4: Commit all documentation**

```bash
git add CLAUDE.md CHECKLIST-PENDENCIAS.md docs/discount-rules.md
git commit -m "docs: add Paperclip Negociação Agent integration docs"
```
