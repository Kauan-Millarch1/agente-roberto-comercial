# Design: Paperclip Micro Agents — Roberto Monitoring & Approval System

**Date:** 2026-03-31
**Status:** Approved (revised after review — 3 critical fixes applied)
**Approach:** A — Paperclip as Central Orchestrator
**Implementation order:** Negociação Agent first (validates infra), then Erros → QA → Métricas

## Overview

Add a monitoring and real-time approval layer on top of Roberto (AI sales agent) using Paperclip as the orchestration dashboard. Four micro agents monitor negotiations, quality, technical errors, and sales metrics — giving the team full visibility and control over Roberto's operations via a visual dashboard.

## Review Fixes Applied

### Fix 1: New structured output field `preco_solicitado_lead`
The existing `preco_negociado` tracks the price Roberto offers. A new field `preco_solicitado_lead` captures what the lead requests. The Negociação Agent triggers on: `preco_solicitado_lead != null AND preco_solicitado_lead < table maximum`.

### Fix 2: Discount autonomy clarified
Roberto retains full autonomy for discounts **within the table**. External approval via Paperclip only activates when the lead requests a price **below the table maximum** — a scenario Roberto is already forbidden from accepting alone. This extends (not replaces) the existing model.

### Fix 3: Runtime discount table in Supabase
A new `roberto_descontos` table stores discount tiers at runtime so N8N can compare prices programmatically:
```sql
CREATE TABLE roberto_descontos (
  evento_nome TEXT PRIMARY KEY,
  preco_cheio NUMERIC,
  nivel_1 NUMERIC,
  nivel_2 NUMERIC,
  maximo_desconto NUMERIC,
  formas_pagamento TEXT[]
);
```

### Additional: Paperclip fallback
If Paperclip is unreachable during approval flow, N8N defaults to table maximum (same as timeout behavior). Roberto never blocks indefinitely.

## Architecture: Paperclip as Central Orchestrator

Paperclip runs as the dashboard and agent management layer. N8N remains the execution engine for all workflows. Communication is bidirectional via HTTP adapters (Paperclip → N8N webhooks) and REST API calls (N8N → Paperclip API).

```
┌─────────────────────────────────────────────────────────┐
│                    PAPERCLIP                            │
│              localhost:3000 (UI)                        │
│              localhost:3100 (API)                       │
│                                                         │
│  Company: [ROBERTO] Comercial Ecommerce Puro           │
│                                                         │
│  API REST:                                              │
│    POST /api/issues         → create issues             │
│    GET  /api/issues/:id     → check status              │
│    POST /api/agents/:id/tasks → assign task             │
│  Auth: Bearer token (API key per agent)                │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP (bidirectional)
┌──────────────────────┴──────────────────────────────────┐
│                      N8N                                │
│        ecommercepuro.app.n8n.cloud                     │
│                                                         │
│  Inbound webhooks (Paperclip → N8N):                   │
│    /webhook/roberto-negociacao  (realtime trigger)      │
│    /webhook/roberto-qa          (heartbeat trigger)     │
│    /webhook/roberto-erros       (heartbeat trigger)     │
│    /webhook/roberto-metricas    (heartbeat trigger)     │
│                                                         │
│  Outbound calls (N8N → Paperclip API):                 │
│    Create approval issues                               │
│    Check approval status (polling)                      │
│    Post results as comments                             │
└──────────────────────┬──────────────────────────────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
     ┌─────────┐ ┌─────────┐ ┌─────────┐
     │ClickUp  │ │Supabase │ │ Slack   │
     │  API    │ │   DB    │ │Webhook  │
     └─────────┘ └─────────┘ └─────────┘
```

## Org Chart

```
                    ┌──────────────────┐
                    │   Roberto CEO    │
                    │  (HTTP adapter)  │
                    └────────┬─────────┘
                             │
         ┌───────────────┬───┴────────────┬──────────────────┐
         ▼               ▼                ▼                  ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Negociação   │ │   Quality    │ │    Erros     │ │  Métricas    │
│   Agent      │ │  Assurance   │ │  Técnicos    │ │   Vendas     │
│              │ │   Agent      │ │   Agent      │ │   Agent      │
│ HTTP adapter │ │ HTTP adapter │ │ HTTP adapter │ │ HTTP adapter │
│ Realtime     │ │ Heartbeat 2h │ │ Heartbeat 30m│ │ Heartbeat 4h │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

## Data Sources

All micro agents read from ClickUp as primary source (cards have full conversation history as comments). Supabase is secondary for cost/error data.

| Agent | Primary Source | Secondary Source |
|---|---|---|
| Negociação Agent | ClickUp (lead card — messages, context) | Discount rules table |
| QA Agent | ClickUp (recent cards — conversation history) | — |
| Erros Técnicos Agent | Supabase (`roberto_custos`) | ClickUp (stale cards), N8N executions API |
| Métricas Vendas Agent | ClickUp (full pipeline) | Supabase (`roberto_metricas`, `roberto_perfis_stats`) |

## Micro Agent 1: Negociação Agent

**Trigger:** Realtime — called by N8N when `preco_solicitado_lead` != null AND `preco_solicitado_lead` < table maximum

### Decision Logic

| Situation | Action |
|---|---|
| Lead asks price **within** discount table | Auto-approved, no issue |
| Lead asks price **below** table maximum | Creates approval issue + Slack |
| Lead asks absurd price (e.g., R$500 for R$15.000 event) | Auto-reject, Roberto follows standard script |
| Lead says "I'll close now" with price below max | **Urgent** issue + immediate Slack |

### Approval Flow

```
1. Lead sends discount request
2. N8N (Roberto) processes → structured output has preco_solicitado_lead != null
3. N8N checks: preco_solicitado_lead BELOW table maximum?
   ├── NO → normal flow (discount within table, auto-approved)
   └── YES → approval flow:
       a. N8N POST /api/issues to Paperclip (urgent priority)
       b. N8N sends lead: "show, deixa eu ver com meu gestor"
       c. N8N polls every 30s for 10min: GET /api/issues/:id
       d. Approved → Roberto closes at approved price
          Rejected → Roberto offers table maximum
          Timeout (10min) → fallback: table maximum + "esse é o máximo que consigo"
```

### Issue Format

```
Title: 🔴 Aprovação Desconto — {lead_name} — {event_name}
Body:
  Lead: {name} ({phone})
  Evento: {event} (R$ {full_price})
  Máximo tabela: R$ {table_max}
  Lead pede: R$ {requested_price}
  Contexto: "{last_message_from_lead}"
  Card ClickUp: {clickup_url}

  ⏱️ Timeout: 10min → fallback R$ {table_max}
```

## Micro Agent 2: QA Agent (Quality Assurance)

**Trigger:** Heartbeat every 2h

### Validation Rules

| Rule | Source | Severity |
|---|---|---|
| Max 1 question per turn | System prompt absolute rule | High |
| Short messages (max ~80 chars per bubble) | System prompt | Medium |
| No discount offered before lead objects to price | Discount rules | High |
| Used "desconto" instead of "condição especial" | Discount rules language | Medium |
| Presented event via audio (Stage 3) | System prompt rule | Medium |
| Collected name + email before proceeding | System prompt | High |
| Did not fabricate data (speakers, prices) | System prompt absolute rule | Critical |

### Issue Format

```
Title: ⚠️ QA — {count} desvios encontrados (últimas 2h)
Body:
  Conversas analisadas: {total}
  Desvios:
  1. [{severity}] Lead {phone} — {description}
     Card: {clickup_url} | Mensagem: "{offending_message}"
  ...
```

## Micro Agent 3: Erros Técnicos Agent

**Trigger:** Heartbeat every 30min

### Monitoring Checks

| Check | Detection Method | Severity |
|---|---|---|
| WABA API down | 3+ consecutive errors in `roberto_custos` | Critical → Slack |
| ElevenLabs failed | TTS errors in last 30min | High |
| Supabase timeout | Write errors in `roberto_mensagens` | Critical → Slack |
| Message not delivered | WABA status != delivered | High |
| Lead without Roberto response | Card updated by lead but no response >5min | Critical → Slack |
| Cost above normal | Token spend >2x daily average | Medium |

### Issue Format

```
Title: 🔴 CRÍTICO — {service} com {count} erros nos últimos 30min
Body:
  Período: {start} - {end} ({date})
  Erros detectados: {count}
  Tipo: {error_type}
  Leads afetados: {count} ({phone_list})
  Último sucesso: {last_success_time}

  ⚡ Alerta Slack enviado (if critical)
```

## Micro Agent 4: Métricas Vendas Agent

**Trigger:** Heartbeat every 4h

### Report Format

```
Title: 📊 Relatório 4h — {start} às {end} ({date})
Body:
  FUNIL:
  ├── Novas conversas: {new}
  ├── EM CONTATO → INTERESSADO: {count} ({pct}%)
  ├── INTERESSADO → OFERTA_ENVIADA: {count} ({pct}%)
  ├── OFERTA_ENVIADA → COMPROU: {count} ({pct}%)
  ├── PERDIDO: {count}
  └── HANDOFF: {count}

  DESCONTOS:
  ├── Vendas no preço cheio: {count}
  ├── Vendas com desconto: {count} (média: -{pct}%)
  └── Aprovações pendentes: {count}

  PERFIL COMPORTAMENTAL:
  ├── Tubarão: {count} leads ({converted} converteu)
  ├── Águia: {count} leads ({converted} converteu)
  ├── Lobo: {count} leads ({converted} converteu)
  ├── Gato: {count} leads ({converted} converteu)
  └── Neutro: {count} leads ({converted} converteu)

  COMPARATIVO:
  ├── Conversão vs período anterior: {delta}%
  └── Tempo médio de conversa: {avg_min}min (vs {prev_avg}min)
```

**Slack alert:** Only if conversion drops >30% vs previous period.

## Slack Alert Rules

| Situation | Agent | Slack? |
|---|---|---|
| Lead wants price below table and says "close now" | Negociação | Yes |
| WABA API down (3+ consecutive errors) | Erros Técnicos | Yes |
| Conversion rate dropped >30% vs previous period | Métricas | Yes |
| Lead without Roberto response >5min | Erros Técnicos | Yes |
| Supabase write failures | Erros Técnicos | Yes |
| QA deviations (double questions, wrong language) | QA | No (Paperclip only) |
| Routine metrics report | Métricas | No (Paperclip only) |

## Infrastructure Requirements

| Component | Requirement |
|---|---|
| Paperclip | Running locally or on VPS (Node.js + PostgreSQL) |
| N8N | 4 new webhook endpoints + 4 new workflows (one per agent) |
| ClickUp API | Read access to cards and comments (existing token) |
| Supabase | Read access to existing tables (no schema changes) |
| Slack | Incoming webhook URL for `#roberto-alertas` channel |
| Paperclip API key | One per agent (4 total) + one for N8N outbound calls |

## Key Design Decisions

1. **Paperclip as orchestrator, N8N as executor** — clean separation of concerns
2. **ClickUp as primary data source** — conversations already logged there in real-time
3. **Only discount below table triggers approval** — everything else is auto or handoff
4. **10min timeout with fallback** — prevents lead cooling while still giving time to approve
5. **Slack only for high-urgency** — avoids alert fatigue
6. **GPT-4.1-mini for analysis agents** — saves cost vs using GPT-5.1 for monitoring
