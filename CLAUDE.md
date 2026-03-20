# CLAUDE.md — Agente Roberto (Comercial)

## Project Overview

WhatsApp AI sales agent for Ecommerce Puro low-ticket presential events. Roberto autonomously converts leads via WhatsApp after they fill a Typeform, following a 6-stage sales script.

- **Derived from:** Gabi agent (eContrate) — reuse patterns, never fork/modify production
- **Gabi workflow ID (READ ONLY):** `9dGEJcYa7LxTAwAs` — NEVER modify
- **N8N instance:** `https://ecommercepuro.app.n8n.cloud`
- **Status:** PRD approved, system prompt written — not yet implemented

## Key Documents

| File | Description |
|---|---|
| `PRD.md` | Authoritative technical spec (v1.1) — 6 implementation phases, all architectural decisions |
| `docs/system-prompt.md` | System prompt (English — authoritative source) |
| `docs/system-prompt-pt.md` | System prompt (Portuguese translation — keep in sync) |

External vision doc: `Chief of Staff/projects/agente-roberto-comercial/Agente Roberto (Comercial).md`

## Tech Stack

- **Orchestration:** N8N
- **AI:** GPT-5.1 via LangChain (temp=0.7, structured JSON output)
- **WhatsApp:** WhatsApp Business API (Meta Official) — NOT Z-API
- **Audio:** ElevenLabs TTS (dual-agent pattern, same as Gabi)
- **Database:** Supabase
- **Cache/Memory:** Redis (10k token chat memory)
- **CRM:** ClickUp
- **Events/Payments:** Guru API
- **Behavioral profiling:** Shark / Eagle / Wolf / Cat / Neutral (triggers at 8+ msgs or 800+ chars)

## Implementation Phases

| Phase | Scope | Blocker |
|---|---|---|
| 1 | Core Agent MVP: text + audio, time filter (07–23h GMT-3), handoff | WA Business API number + Meta token |
| 2 | ClickUp CRM integration | — |
| 3 | Vacuum method: 15min → 1h → 24h follow-up | — |
| 4 | Guru API: events, offers, payment links | André API details |
| 5 | Post-sale webhook | André webhook schema |
| 6 | Knowledge base | — |

## Captation Flow

```
Typeform submission → formula adds tag → 1h timeout → Roberto sends first WhatsApp
→ Lead replies → inbound-only from that point
```

## Supabase Tables

| Table | Purpose |
|---|---|
| `roberto_leads` | Lead registry (phone, name, email, status) |
| `roberto_mensagens` | Full conversation log |
| `roberto_vacuo` | Vacuum follow-up state per lead |
| `roberto_metricas` | Conversion funnel metrics |
| `roberto_custos` | API cost tracking |

## Redis Key Patterns

| Key | TTL | Content |
|---|---|---|
| `roberto:memoria:{phone}` | 30d | Chat history (10k tokens) |
| `roberto:ts:{phone}` | 30d | Last message timestamp (buffer dedup) |
| `roberto:temperamento:{phone}` | 30d | Behavioral profile |

## ClickUp Pipeline

`BASE → EM CONTATO → INTERESSADO → OFERTA_ENVIADA → COMPROU / PERDIDO / SUPORTE`

## N8N Naming Convention

All workflow and node names follow the pattern: `[ROBERTO] Type — Description`

Examples:
- `[ROBERTO] Agent — Comercial Ecommerce Puro`
- `[ROBERTO] Tool — ClickUp Agente`
- `[ROBERTO] Tool — Vácuo Follow-up`

Nodes: `snake_case`, Portuguese BR, `[action]_[target]_[qualifier]` (e.g., `verificar_horario_comercial`, `salvar_lead_supabase`)

## Stakeholders

| Person | Role |
|---|---|
| Kauan Millarch | Developer |
| Willian Pagane | Supervisor/mentor |
| Bruno Allage | Commercial Head (stakeholder) |
| Gabriel Bollico | CEO (stakeholder) |
| Luiz André Mendes | Tech Lead — Guru APIs, WhatsApp, webhooks |

## Current Blockers (2026-03-19)

- **HIGH:** WhatsApp Business API number + Meta access token → André / Bruno
- **HIGH:** Deadline recalibration with Allage (won't finish March)
- ElevenLabs voice ID for Roberto persona → Allage / Bruno
- Coupon rules → Allage

## Rules for Claude

1. **Never modify Gabi's workflow** (`9dGEJcYa7LxTAwAs`) — it's in production with real leads
2. **PRD.md is the authoritative spec** — always reference it before suggesting architectural changes
3. **System prompt edits** go to `docs/system-prompt.md` (EN) first, then sync `docs/system-prompt-pt.md`
4. **N8N mutations require explicit user approval** per global CLAUDE.md rules — explain what/why/impact before any change
5. **Before implementing any phase**, confirm its blockers are resolved
6. **Reuse Gabi patterns** — buffer dedup, dual-agent audio, vacuum method, structured output schema — adapt don't reinvent
7. **Update blockers section above** when resolved
