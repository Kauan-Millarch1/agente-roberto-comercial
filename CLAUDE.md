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
Lead fills Typeform → receives WhatsApp link on confirmation page
→ Lead sends first message to Roberto (inbound)
→ Roberto takes over the conversation
```

> ⚠️ Roberto is 100% inbound. Roberto NEVER sends the first message. Contact always starts from the lead.

## Supabase Tables

> **Convention:** All Supabase schema (tables, columns, indexes, triggers) must be in **English**. Never use Portuguese for database schema elements.

| Table | Purpose |
|---|---|
| `roberto_leads` | Lead registry (phone, name, email, status) |
| `roberto_messages` | Full conversation log |
| `roberto_vacuum` | Vacuum follow-up state per lead |
| `roberto_metrics` | Conversation metrics per interaction |
| `roberto_costs` | API cost tracking |
| `roberto_discounts` | Discount tiers per event (runtime, for Negociação Agent) |
| `roberto_profile_stats` | Behavioral profile analytics |
| `roberto_summaries` | Conversation summaries per lead |

## Redis Key Patterns

| Key | TTL | Content |
|---|---|---|
| `roberto:memoria:{phone}` | 30d | Chat history (10k tokens) |
| `roberto:ts:{phone}` | 30d | Last message timestamp (buffer dedup) |
| `roberto:temperamento:{phone}` | 30d | Behavioral profile |
| `roberto:aprovacao:{phone}` | 15min | Concurrency lock — prevents duplicate approval flows |

## ClickUp Pipeline

`BASE → EM CONTATO → INTERESSADO → OFERTA_ENVIADA → COMPROU / PERDIDO / SUPORTE`

## N8N Naming Convention

All workflow and node names follow the pattern: `[ROBERTO] Type — Description`

Examples:
- `[ROBERTO] Agent — Comercial Ecommerce Puro`
- `[ROBERTO] Tool — ClickUp Agente`
- `[ROBERTO] Tool — Vácuo Follow-up`

Nodes: `snake_case`, Portuguese BR, `[action]_[target]_[qualifier]` (e.g., `verificar_horario_comercial`, `salvar_lead_supabase`)

## Paperclip Agent Monitoring

- **Dashboard:** `http://localhost:3000` (local) — will migrate to VPS
- **API:** `http://localhost:3100/api`
- **Company:** Puro Agents (ID: `c5b2cfde-c669-48ac-a9bd-8c23752850c0`)
- **Agents:** CEO, Negociação Agent (future: QA, Erros Técnicos, Métricas Vendas)
- **Approval flow:** Discounts below table maximum → 10min timeout → fallback to table max
- **Issue status convention:** `todo` = pending approval, `done` = approved (comment: `APROVADO <price>`), `cancelled` = rejected
- **API endpoints used:**
  - `POST /api/companies/{id}/issues` — create approval issue
  - `GET /api/issues/{id}` — poll status
  - `PATCH /api/issues/{id}` — update status
  - `POST /api/issues/{id}/comments` — add approval comment
  - `GET /api/issues/{id}/comments` — read comments
- **Design spec:** `docs/superpowers/specs/2026-03-31-paperclip-micro-agents-design.md`
- **Implementation plan:** `docs/superpowers/plans/2026-03-31-negociacao-agent.md`

## Stakeholders

| Person | Role |
|---|---|
| Kauan Millarch | Developer |
| Willian Pagane | Supervisor/mentor |
| Bruno Allage | Commercial Head (stakeholder) |
| Gabriel Bollico | CEO (stakeholder) |
| Luiz André Mendes | Tech Lead — Guru APIs, WhatsApp, webhooks |

## Current Blockers (2026-04-14)

- Webhook WABA apontando para N8N → Kauan
- Verify Token configurado na Meta → Kauan
- ~~Guru API docs (eventos, ofertas) → André~~ ✅ Resolvido — Admin Events API disponível (`admin.ecommercepuro.com.br/api/events`), listagem + detalhe + offers + checkoutUrls
- Guru webhook schema (pós-venda) → André (webhooks confirmados, falta schema/config)
- Regras de cuponagem → Allage
- Alinhar com Bail sobre recuperação de abandono de carrinho — conflito com automações existentes (Clint + e-mails) → Kauan/Willian
- ~~WhatsApp Business API number + Meta access token~~ ✅ Resolvido
- ~~ElevenLabs voice ID for Roberto persona~~ ✅ Resolvido
- ⚠️ Verificar formato do preço na API (centavos vs reais) — "15000" = R$150 ou R$15.000?
- ~~ElevenLabs voice ID for Roberto persona~~ ✅ Resolvido

## Rules for Claude

1. **Never modify Gabi's workflow** (`9dGEJcYa7LxTAwAs`) — it's in production with real leads
2. **PRD.md is the authoritative spec** — always reference it before suggesting architectural changes
3. **System prompt edits** go to `docs/system-prompt.md` (EN) first, then sync `docs/system-prompt-pt.md`
4. **N8N mutations require explicit user approval** per global CLAUDE.md rules — explain what/why/impact before any change
5. **Before implementing any phase**, confirm its blockers are resolved
6. **Reuse Gabi patterns** — buffer dedup, dual-agent audio, vacuum method, structured output schema — adapt don't reinvent
7. **Update blockers section above** when resolved
8. **Supabase schema in English only** — all table names, column names, indexes, and triggers must use English. Never create schema elements in Portuguese

# Ralph Loop — Autonomous Coding Guide

## What You Are Doing
You are helping me use the **Ralph Loop plugin** for Claude Code. I am a beginner and need full guidance at each step. Your job is to:
1. Help me install and configure the plugin correctly
2. Help me write effective loop prompts
3. Execute tasks inside the loop with quality and precision
4. Explain what is happening at each step in simple terms

---

## Ralph Loop — Core Concepts You Must Know

### How the loop works
- I run ONE command: `/ralph-loop "task description" --completion-promise "DONE" --max-iterations N`
- Claude Code works on the task, tries to exit, and a **Stop Hook** blocks the exit and feeds the same prompt back
- This repeats until Claude outputs the exact completion promise string OR hits the max iterations
- Each iteration happens **inside the same session** (context accumulates — be aware of this)

### Key parameters
| Parameter | Purpose | Recommended |
|---|---|---|
| `--completion-promise "TEXT"` | Exact string Claude must output to finish | Always use |
| `--max-iterations N` | Safety cap to prevent infinite loops | Always set (10–30) |

### The completion promise rule
- It uses **exact string matching** — the text must appear literally in the output
- Use only ONE completion condition (not "SUCCESS" or "BLOCKED")
- Always rely on `--max-iterations` as the primary safety net

---

## Installation Checklist

When I ask for help installing the plugin, walk me through these steps one at a time and confirm each one before proceeding:

1. Verify that Claude Code is installed and running (`claude --version`)
2. Install the Ralph Wiggum plugin from the official Anthropic repository:
   ```
   git clone https://github.com/anthropics/claude-code
   cd claude-code/plugins/ralph-wiggum
   ```
3. Follow the plugin's own README to register the Stop Hook
4. Confirm the `/ralph-loop` slash command is available in Claude Code
5. Run a simple smoke test: `/ralph-loop "Print hello world and output <promise>DONE</promise>" --completion-promise "DONE" --max-iterations 3`

---

## How to Help Me Write Good Loop Prompts

When I describe a task, always structure the prompt for me in this format:

```
/ralph-loop "
[TASK DESCRIPTION]

Requirements:
- [Requirement 1]
- [Requirement 2]
- [Requirement 3]

Steps:
1. [Step 1]
2. [Step 2]
3. [Step 3]

If stuck after [N-2] iterations:
- Document what is blocking progress
- List what was attempted
- Suggest alternative approaches

Output <promise>COMPLETE</promise> when all requirements are met.
" --completion-promise "COMPLETE" --max-iterations [N]
```

### Prompt quality rules you must follow
- Be specific and explicit — vague prompts produce vague loops
- Always include a "stuck handling" section for failed iterations
- Set `--max-iterations` relative to task complexity (simple = 10, medium = 20, complex = 30)
- One task per loop — do not combine unrelated features in the same prompt

---

## During Loop Execution

While the loop is running, if I ask what is happening, explain:
- Which iteration we are on
- What Claude did in the last iteration
- Whether context window is getting full (warn me after ~5+ iterations)
- Whether we are likely approaching the "dumb zone" (context >40% full)

If the loop stalls or produces degrading results, recommend stopping and restarting with a fresh session.

---

## Common Patterns to Offer Me

Always proactively suggest the right pattern based on my task:

### Bug Fix
```
/ralph-loop "Fix bug: [DESCRIPTION]
Steps: 1. Reproduce 2. Identify root cause 3. Implement fix 4. Write regression test 5. Verify no regressions
After 15 iterations if not fixed: document blocking issues and suggest alternatives.
Output <promise>FIXED</promise> when resolved." --max-iterations 20 --completion-promise "FIXED"
```

### New Feature
```
/ralph-loop "Implement [FEATURE].
Requirements: [LIST]
Success criteria: all requirements implemented, tests passing, no linter errors, documentation updated.
Output <promise>COMPLETE</promise> when done." --max-iterations 30 --completion-promise "COMPLETE"
```

### TDD (Test-Driven Development)
```
/ralph-loop "Implement [FEATURE] using TDD.
Process: 1. Write failing test 2. Implement minimal code to pass 3. Run tests 4. Fix if failing 5. Refactor 6. Repeat for all requirements.
Output <promise>DONE</promise> when all tests are green." --max-iterations 25 --completion-promise "DONE"
```

### Refactor
```
/ralph-loop "Refactor [MODULE/FILE].
Goals: [LIST]. Constraints: no behavior change, all existing tests must still pass.
Output <promise>REFACTORED</promise> when complete." --max-iterations 15 --completion-promise "REFACTORED"
```

---

## Important Limitations to Always Remind Me About

- **Context accumulates** — the plugin runs in one session, unlike bash-loop Ralph. For large tasks (5+ iterations), the context fills up and quality degrades.
- **Not ideal for very long tasks** — if the task needs 10+ iterations of complex work, consider using a bash loop instead (external Ralph pattern).
- **Exact string matching** — if Claude outputs the promise string in the middle of a sentence, the loop will stop. Tell Claude to output it on its own line at the very end.

---

## My Skill Level
I am a **beginner** with this plugin. Always:
- Explain what each flag does before running
- Confirm my understanding before executing
- Warn me about costs (each iteration = API tokens)
- Suggest the safest configuration when in doubt
- Tell me when something could break my project before doing it