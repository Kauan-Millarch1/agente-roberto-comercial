# CHECKLIST — Pendências do Agente Roberto

> Workflow criado: `azwM3PgGtSbGTCsn`
> URL: https://ecommercepuro.app.n8n.cloud/workflow/azwM3PgGtSbGTCsn
> Última atualização: 2026-03-19

---

## 🔴 BLOQUEADORES (sem isso o agente não funciona)

### 1. WhatsApp Business API — Credenciais Meta
- [ ] Número WhatsApp Business aprovado pela Meta
- [ ] Meta Access Token (`PLACEHOLDER_META_ACCESS_TOKEN` em 2 nodes)
  - Node: `upload_audio_meta` — header Authorization
  - Node: `enviar_audio_waba` — header Authorization
- [ ] Phone Number ID registrado no webhook do N8N
- [ ] Webhook WABA apontando para: `https://ecommercepuro.app.n8n.cloud/webhook/roberto-waba`
- [ ] Verify Token configurado na Meta (qualquer string) + adicionar verificação no node `verificar_verificacao_waba`

**Responsável:** André (Tech Lead) + Bruno

---

### 2. Supabase — Criar Tabelas
Executar os scripts em `docs/supabase.md`:
- [ ] `roberto_leads`
- [ ] `roberto_mensagens`
- [ ] `roberto_vacuo`
- [ ] `roberto_metricas`
- [ ] `roberto_custos`
- [ ] `roberto_resumos` (Fase 6)
- [ ] `roberto_perfis_stats` (Fase 6)

---

### 3. ElevenLabs — Voice ID do Roberto
- [ ] Criar/selecionar voz masculina no ElevenLabs
- [ ] Substituir `PLACEHOLDER_VOICE_ID_ROBERTO` no node `converter_texto_audio`

**Responsável:** Allage / Bruno

---

## 🟡 FASE 2 — ClickUp CRM (pode construir agora)

- [ ] Criar pipeline "Roberto Comercial" no ClickUp
  - Stages: BASE → EM CONTATO → INTERESSADO → OFERTA_ENVIADA → COMPROU / PERDIDO / SUPORTE
- [ ] Criar workflow N8N: `[ROBERTO] Tool — ClickUp Agente`
- [ ] Adicionar tool `crm_roberto` no AI_Roberto (sub-node tipo toolWorkflow)
- [ ] Mapear custom fields do ClickUp (nome, email, evento_interesse, status_crm)

---

## 🟡 FASE 3 — Método Vácuo (pode construir agora)

- [ ] Criar workflow N8N: `[ROBERTO] Tool — Vácuo Follow-up`
  - Tentativa 1: 15 min após silêncio
  - Tentativa 2: 1h
  - Tentativa 3: 24h → marcar como PERDIDO
- [ ] Conectar com node `cancelar_vacuo` (já existe no workflow principal — deleta chave Redis)
- [ ] Redis key: `roberto:vacuo_pendente:{phone}`

---

## 🟡 FASE 4 — Guru API (aguarda André)

- [ ] Receber documentação da Guru API com André
- [ ] Criar workflow N8N: `[ROBERTO] Tool — Consultar Eventos`
  - Tool name no agent: `consultar_eventos`
- [ ] Criar workflow N8N: `[ROBERTO] Tool — Consultar Ofertas`
  - Tool name no agent: `consultar_ofertas`
- [ ] Criar workflow N8N: `[ROBERTO] Tool — Verificar Cupom`
  - Tool name no agent: `verificar_cupom`
- [ ] Criar workflow N8N: `[ROBERTO] Tool — Resumo Lead`
  - Tool name no agent: `resumo_lead`

---

## 🟡 FASE 5 — Webhook Pós-Venda (aguarda André)

- [ ] Receber schema do webhook da Guru com André
- [ ] Criar workflow N8N: `[ROBERTO] Webhook — Guru Pós-Venda`
  - Recebe evento de compra
  - Atualiza `roberto_leads.status_crm = 'COMPROU'`
  - Envia mensagem de confirmação ao lead via WABA
- [ ] Conectar com ClickUp (marcar task como COMPROU)

---

## 🟡 FASE 6 — Base de Conhecimento

- [ ] Criar workflow N8N: `[ROBERTO] Tool — Base Roberto`
  - Tool name no agent: `base_roberto`
  - Conteúdo: speakers, diferenciais, FAQ, logística dos eventos
- [ ] Popular base com dados reais (eventos, palestrantes, preços)
- [ ] Script de otimização de respostas (regras de cuponagem)

**Responsável:** Allage

---

## 🔧 AJUSTES NO WORKFLOW PRINCIPAL

Coisas a ajustar no workflow `azwM3PgGtSbGTCsn` após resolver bloqueadores:

- [ ] Node `notificar_equipe_handoff`: substituir NoOp por notificação real (Slack/ClickUp)
- [ ] Node `resposta_fora_horario`: implementar mensagem de fora de horário via WABA
- [ ] Adicionar tool `resumo_lead` no AI_Roberto (busca contexto anterior no Supabase/Redis)
- [ ] Adicionar tratamento de erros global (error workflow)
- [ ] Configurar `errorWorkflow` no settings do workflow principal
- [ ] Verificar se gpt-5.1 já está disponível na conta OpenAI (pode precisar de gpt-4.1 como fallback)
- [ ] Testar node `openai_transcricao` — formato do áudio WABA (ogg/opus)
- [ ] Adicionar node de salvar mensagem de ENTRADA no Supabase (atualmente só salva saída)

---

## 📋 INFORMAÇÕES PENDENTES DE STAKEHOLDERS

| Item | De quem | Status |
|---|---|---|
| Meta Access Token | André | ❌ Pendente |
| WA Business Number | André / Bruno | ❌ Pendente |
| Guru API docs (eventos, ofertas) | André | ❌ Pendente |
| Guru webhook schema (pós-venda) | André | ❌ Pendente |
| ElevenLabs Voice ID | Allage / Bruno | ❌ Pendente |
| Regras de cuponagem | Allage | ❌ Pendente |
| Script de vendas revisado | Allage | ❌ Pendente |
| Prazo revisado com Allage | Allage | ❌ Pendente |

---

## ✅ CONCLUÍDO

- [x] PRD v1.1 aprovado
- [x] System prompt escrito (EN + PT-BR)
- [x] Schema Supabase documentado (`docs/supabase.md`)
- [x] Rebrand Roberta → Roberto em todos os arquivos
- [x] Workflow principal criado no N8N (`azwM3PgGtSbGTCsn`)
  - 56 nodes: webhook WABA, buffer dedup Redis, AI Agent GPT-5.1, loop de envio, áudio ElevenLabs, handoff, pós-processamento Supabase
