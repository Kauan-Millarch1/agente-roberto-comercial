# Call Closer — Inline Link Design

> Status: approved | Date: 2026-04-06

## Context

Previously, scheduling a call with a human closer was handled by a sub-workflow (`[ROBERTO] Tool — Agendar Call Closer`, ID `F4LDmaSDWxarb9AV`) that generated a briefing and sent a booking link. This introduced a problem: the tool fired immediately when called, with no way for Roberto to ask the lead first and wait for confirmation.

## Decision

Give Roberto the booking link directly in the system prompt. Remove the sub-workflow entirely. Roberto controls the timing: he proposes the call, waits for the lead to accept, then sends the link.

## Booking Link

`https://calendar.app.google/Ve8bLVHWBF61nQwr7`

## Behavioral Rules

### When to PROPOSE a call (Roberto asks the lead)

- Max discount offered and lead still hesitating
- Lead has complex doubts that text/audio can't resolve
- Lead says "vou pensar" after receiving a complete offer (Stage 4+)
- Roberto frames it as: "quer marcar uma conversa rapida com um dos nossos vendedores? sao 15-20 min, sem compromisso"

### When NOT to propose

- Conversation is still in discovery/sounding (Stages 1-3)
- Lead is engaged and advancing through the funnel
- Lead hasn't received the full offer yet
- Lead explicitly doesn't want to talk to anyone

### When the lead ACCEPTS

- Roberto sends the link in a message: the link as plain text so it's clickable
- Roberto explains: "escolhe o melhor horario pra voce, sem compromisso nenhum"
- Roberto calls `salvar_resumo` logging the escalation

### When the lead asks "posso falar com alguém?"

This is ambiguous. Roberto should clarify:
- If the lead wants to talk about the EVENT (doubts, details) → propose the call closer
- If the lead wants SUPPORT (refund, technical, complaint) → `handoff_humano`

### Call closer vs Handoff — clear distinction

| Scenario | Action |
|---|---|
| Lead hesitating after full offer | Propose call closer (booking link) |
| Lead with complex doubts post-offer | Propose call closer |
| Lead explicitly asks "quero falar com uma pessoa" about the event | Propose call closer |
| Lead asks for refund, invoice, technical support | `handoff_humano` (transfer) |
| Lead says "quero falar com suporte" | `handoff_humano` (transfer) |

## What changes

### Remove
- Tool `agendar_call_closer` from AI_Roberto node (workflow principal)
- Sub-workflow `[ROBERTO] Tool — Agendar Call Closer` (`F4LDmaSDWxarb9AV`)

### Add to system prompt
- Booking link in Section 3 (Tools) as a resource, not a tool
- Call closer rules in Section 5.1 (Negotiation) — when to propose, 2-step flow
- Clarification rules in Section 9 (Special Scenarios) — disambiguate "falar com alguém"

### Update
- Section 9: handoff rules to explicitly exclude call closer scenarios
- Structured output: no new field needed — Roberto just sends the link as a message when appropriate
