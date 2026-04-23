# CHECKLIST — Pendências do Agente Roberto

> Workflow criado: `azwM3PgGtSbGTCsn`
> URL: https://ecommercepuro.app.n8n.cloud/workflow/azwM3PgGtSbGTCsn
> Última atualização: 2026-03-24

---

## 🔴 BLOQUEADORES (sem isso o agente não funciona)

### 1. WhatsApp Business API — Credenciais Meta
- [x] Número WhatsApp Business aprovado pela Meta ✅ (2026-03-24)
- [x] Meta Access Token fornecido — substituir `PLACEHOLDER_META_ACCESS_TOKEN` em 2 nodes ✅ (2026-03-24)
  - Node: `upload_audio_meta` — header Authorization
  - Node: `enviar_audio_waba` — header Authorization
- [x] Phone Number ID registrado no webhook do N8N ✅
- [ ] Webhook WABA apontando para: `https://ecommercepuro.app.n8n.cloud/webhook/roberto-waba`
- [ ] Verify Token configurado na Meta (qualquer string) + adicionar verificação no node `verificar_verificacao_waba`

**Responsável:** André (Tech Lead) + Bruno

---

### ~~2. Supabase — Criar Tabelas~~ ✅ RESOLVIDO (2026-03-20)
Projeto `agente-comercial-roberto` criado (sa-east-1). Migration `create_roberto_schema` aplicada:
- [x] `roberto_leads`
- [x] `roberto_mensagens`
- [x] `roberto_vacuo`
- [x] `roberto_metricas`
- [x] `roberto_custos`
- [x] `roberto_resumos`
- [x] `roberto_perfis_stats`
- [x] Triggers `updated_at`, indexes de performance, seed dos 5 perfis, RLS desabilitado

---

### ~~3. ElevenLabs — Voice ID do Roberto~~ ✅ RESOLVIDO (2026-03-20)
- [x] Criar/selecionar voz masculina no ElevenLabs
- [x] Substituir `PLACEHOLDER_VOICE_ID_ROBERTO` no node `converter_texto_audio`

---

## ⚠️ DIVERGÊNCIA DE DOCUMENTAÇÃO — Resolver com Kauan

- [x] ~~**Conflito captação CLAUDE.md vs PRD.md:**~~ ✅ Confirmado inbound. CLAUDE.md corrigido (2026-03-24)

- [x] ~~**`buscar_lead_crm` — fase conflitante:**~~ ✅ Alinhado para Fase 2. `docs/supabase.md` a corrigir.

- [x] ~~**`form_custom`/`execuções`:**~~ ✅ Tabela `roberto_execucoes` criada no Supabase (2026-03-24). Nodes apontam para essa tabela.

---

## ~~🟡 FASE 2 — ClickUp CRM~~ ✅ CONCLUÍDA (parcial — ver ajuste pendente)

- [x] Criar pipeline "Roberto Comercial" no ClickUp ✅ (2026-03-24)
  - Stages: BASE → EM CONTATO → INTERESSADO → OFERTA_ENVIADA → COMPROU / PERDIDO / SUPORTE
- [x] Criar workflow N8N: `[ROBERTO] Tool — ClickUp Agente` ✅ (2026-03-24)
- [x] Adicionar tool `crm_roberto` no AI_Roberto (sub-node tipo toolWorkflow) ✅ (2026-03-24)
- [ ] Mapear custom fields do ClickUp (nome, email, evento_interesse, status_crm)
- [ ] Verificar node `log_conversa_clickup` no pós-processamento (a confirmar)

---

## 🟡 FASE 3 — Método Vácuo (parcialmente concluída)

- [x] Copiar nodes do vácuo da Gabi e adaptar ao workflow `azwM3PgGtSbGTCsn` ✅ (2026-03-24)
  - Nodes: `buscar_vacuo`, `vacuo_existe`, `criar_vacuo`, `resetar_vacuo`, `espera_vacuo_1/2/3`, `ler_vacuo`, `vacuo_ainda_ativo`, `verificar_limite`, `enviar_followup`, `incrementar_vacuo`, `tempo_por_tentativa`, `marcar_esgotado`
- [ ] Adaptar mensagens de follow-up para contexto de vendas de eventos (tom: casual → urgência leve → direto) — **a verificar**
- [x] Adicionar node `verificar_horario_vacuo` no fluxo de `enviar_followup` ✅ (incluído no refactor)
- [x] Conectar classificador pós-agente (GPT-4.1-mini): `classificador_vacuo` → `switch_classificador` → `vacuo` ou `encerrar` ✅ (2026-03-24)
- [x] Implementar `atualizar_crm_perdido` → UPDATE ClickUp status PERDIDO + tag `perdido` ✅ (incluído no refactor)
- [ ] Testar escalação completa: 15min → 1h → 24h → esgotado
- [x] Verificar que `cancelar_vacuo` é chamado antes de qualquer processamento de mensagem inbound ✅ (presente no fluxo principal)

---

## ~~🟡 FASE 4 — API Eventos~~ ✅ PARCIALMENTE RESOLVIDA (2026-04-14)

> Admin Events API descoberta: `https://admin.ecommercepuro.com.br/api/events`
> Auth: Bearer token (armazenado no .env)

- [x] API de listagem de eventos (`GET /events`) — node `api_get_eventos_lista` já com URL + token reais ✅
- [x] API de detalhe de evento (`GET /events/{id}?include_coupons=true`) — retorna `richDescription` (KB markdown) + `tiers[].offers[]` (preços + checkoutUrls) ✅
- [x] `build_system_prompt` já trata `richDescription` e `tiers[].offers[]` ✅
- [x] Node `api_get_evento_detalhe` — placeholder corrigido para URL + token reais ✅ (2026-04-14)
- [ ] Verificar formato do preço: API retorna "15000" — é centavos (R$150) ou reais (R$15.000)?
- [ ] Criar workflow N8N: `[ROBERTO] Tool — Verificar Cupom` (regras de cuponagem pendentes do Allage)
  - Tool name no agent: `verificar_cupom`

---

## 🟡 INGESTÃO DE LEADS — Webhook + Proativa (spec Will 2026-04-14)

> **Spec:** `spec-lead-ingestion.md` | **Plano:** `docs/superpowers/plans/2026-04-14-lead-ingestion-webhook.md`
> **WEBHOOK_SECRET:** armazenado no Supabase Edge Function secrets — enviar para Will
> **Endpoint:** `https://zlwgtfdwnibaavlcqttu.supabase.co/functions/v1/ingest-lead`

### Supabase
- [x] Migration aplicada — tabela `event_leads` criada ✅ (2026-04-14)
- [x] RLS habilitado ✅ (2026-04-14)
- [x] Unique constraint funcionando (email + product + event_month) ✅ (2026-04-14)
- [x] Secret `WEBHOOK_SECRET` cadastrado no Supabase ✅ (2026-04-14 — Will)
- [x] Edge Function `ingest-lead` deployada (`--no-verify-jwt`) ✅ (2026-04-14)
- [x] Testes curl passaram (201, 401, 409, 400) ✅ (2026-04-14)
- [x] Phone normalizado corretamente (função `normalizePhone` na Edge Function) ✅ (2026-04-14)

### N8N
- [x] Workflow `[ROBERTO] Cron — Proactive Outreach` criado (`gtpqDeEz9FSQa7pg`) ✅ (2026-04-14)
- [ ] Cron ativo — **ativar após testes end-to-end**
- [x] Query filtra leads pendentes (Supabase node + Code node: 1h+ sem contato, <24h) ✅ (2026-04-14)
- [x] Mensagem proativa via WhatsApp Business API (credential criptografada) ✅ (2026-04-14)
- [x] Lead atualizado após envio (Supabase node: `proactive_sent_at` + `status = proactive_sent`) ✅ (2026-04-14)
- [x] Error handling implementado (log_erro_envio + loop continua) ✅ (2026-04-14)

### Integração Roberto (workflow `azwM3PgGtSbGTCsn`)
- [x] Node `marcar_contacted_event_leads` — marca `contacted_at` quando lead envia mensagem ✅ (2026-04-14)
- [x] Node `buscar_event_lead_dados` — busca dados do formulário ✅ (2026-04-14)
- [x] `build_system_prompt` enriquecido com dados do formulário (empresa, faturamento, evento) ✅ (2026-04-14)
- [x] Leads que já contataram não recebem proativa (filtro `contacted_at IS NULL` no cron) ✅ (2026-04-14)

### Landing Page (depende do Will/time)
- [ ] Webhook configurado com URL + secret
- [ ] Payload no formato correto
- [ ] Teste end-to-end: form → Supabase → (1h) → WhatsApp

---

## 🔵 FASE 5 — Pós-Venda [BACKLOG — em definição]

> ⚠️ Abordagem em revisão (2026-04-14): André confirmou que será via webhook do Guru → endpoint N8N.
> Workflow `[ROBERTO] Check_Purchase` criado com Webhook trigger (precisa trocar de GET para POST).
> Aguardando schema do payload do Guru para montar Edit Fields + Switch.

- [x] Definir fluxo pós-venda: webhook Guru → N8N ✅ (2026-04-14 — André confirmou)
- [x] Workflow `[ROBERTO] Check_Purchase` criado no N8N ✅ (2026-04-14)
- [ ] Aguardando schema do payload do Guru (André)
- [ ] Após schema: implementar Edit Fields + Switch + lógica de filtragem
- [ ] Atualizar `roberto_leads.status = 'COMPROU'`
- [ ] Conectar com ClickUp (marcar task como COMPROU)

---

## ~~🟡 FASE 6 — Base de Conhecimento~~ ✅ CONCLUÍDA (parcial)

- [x] Criar workflow N8N: `[ROBERTO] Tool — Base Roberto` ✅ (2026-03-24)
  - Tool name no agent: `base_roberto`
  - Conteúdo: speakers, diferenciais, FAQ, logística dos eventos
- [x] Finalizar e validar `kb-imersao-tributaria.md` com Allage ✅ (2026-03-24)
- [x] Finalizar e validar `kb-performance-meli.md` com Allage ✅ (2026-03-24)
- [x] Eventos ativos mapeados — foco em Imersão Tributária e Performance Meli por ora ✅
- [x] Popular base com dados reais (eventos, palestrantes, preços) ✅ (2026-03-24)
- [ ] Script de otimização de respostas (regras de cuponagem) — **pendente Allage**

**Responsável:** Allage

---

## 🔧 AJUSTES NO WORKFLOW PRINCIPAL

Coisas a ajustar no workflow `azwM3PgGtSbGTCsn` após resolver bloqueadores:

- [ ] Node `resposta_fora_horario`: verificar se a mensagem está sendo enviada via WABA (node existe no workflow, implementação a confirmar)
- [ ] Adicionar tratamento de erros global (error workflow `[ROBERTO] Error — Handler`) — **a verificar**
- [ ] Configurar `errorWorkflow` no settings do workflow principal — **a verificar**
- [x] GPT-5.1 disponível na conta OpenAI ✅ (2026-03-24)
- [ ] Testar node `openai_transcricao` — formato do áudio WABA (ogg/opus)
- [x] **Corrigir nomes de tabelas Supabase em 29 nodes** ✅ (2026-03-24)
- [x] ~~Credenciais Supabase~~ ✅ 31 nodes migraram de "Supabase account" (Gabi) para "Supabase Roberto" (2026-03-23)
- [x] ~~Adicionar node de salvar mensagem de ENTRADA no Supabase~~ ✅ (2026-03-20)
- [x] ~~Substituir NoOp handoff por notificação real~~ ✅ Handoff redesenhado com duas camadas (2026-03-20)
- [x] ~~Tool `resumo_lead` de Data Tables para Supabase~~ ✅ (2026-03-20)

---

## 🔧 DOCUMENTAÇÃO — Atualizar após implementação

- [x] ~~**PRD Seção 11 (Sub-workflows):** Adicionar 3 sub-workflows criados em 2026-03-20~~ ✅ (2026-03-24)
- [x] ~~**`docs/supabase.md`:** Corrigir fase da tabela `roberto_resumos` de "Fase 6" para "Fase 1"~~ ✅ (2026-03-24)
- [x] ~~**CHECKLIST:** Atualizar contagem de nodes (56 → 157)~~ ✅ (2026-03-24)

---

## 📋 INFORMAÇÕES PENDENTES DE STAKEHOLDERS

| Item | De quem | Status |
|---|---|---|
| ~~Guru API docs (eventos, ofertas)~~ | ~~André~~ | ✅ Resolvido — Admin Events API disponível |
| Guru webhook schema (pós-venda) | André | ⏳ Em definição — webhook confirmado, falta schema |
| Regras de cuponagem | Allage | ❌ Pendente |
| Prazo revisado com Allage | Allage | ❌ Pendente |

---

## ✅ CONCLUÍDO

- [x] PRD v1.1 aprovado
- [x] System prompt escrito (EN + PT-BR)
- [x] Schema Supabase documentado (`docs/supabase.md`)
- [x] Rebrand Roberta → Roberto em todos os arquivos
- [x] Workflow principal criado no N8N (`azwM3PgGtSbGTCsn`)
  - ~~56 nodes~~ → **157 nodes** (após refactor + KB flow + memória em 2026-03-20): webhook WABA, buffer dedup Redis, AI Agent GPT-5.1, loop de envio, áudio ElevenLabs, handoff, pós-processamento Supabase
- [x] Projeto Supabase `agente-comercial-roberto` criado (sa-east-1, ID: `zlwgtfdwnibaavlcqttu`)
  - 7 tabelas, triggers, indexes, seed perfis comportamentais
- [x] ElevenLabs Voice ID configurado no node `converter_texto_audio`
- [x] **Review + refactor completo do workflow** (2026-03-20)
  - 119 nodes renomeados para padrão snake_case PT-BR
  - 9 referências `Gabi-eContrate` → `Roberto-Comercial` corrigidas
  - 4 nodes Z-API substituídos por WhatsApp Business API oficial
  - Node `execução` (roberto_execucoes) removido
  - Webhook ajustado para POST (mensagens reais)
  - Phone Number ID dinâmico em todos os WABA sends
  - Handoff redesenhado em duas camadas:
    - Camada 1: classificador rápido (GPT-4.1-mini) ANTES do AI Agent — pega texto, áudio e imagem
    - Camada 2: `switch_handoff_pos` DEPOIS do AI Agent — pega casos sutis via `acionar_handoff`
  - Transcrição de áudio (Whisper) acontece ANTES do classificador de handoff
  - Novo node `salvar_mensagem_inbound` (Supabase)
  - Novo node `atualizar_lead_handoff` (Supabase status='HANDOFF')
  - `resumo_lead` migrado de N8N Data Tables para Supabase `roberto_resumos`
- [x] **Knowledge Base Flow implementado** (2026-03-20)
  - 14 nodes novos: cache Redis + API admin (3 camadas de dados)
  - `switch_tem_tag` → com tag: carrega KB + ofertas / sem tag: modo discovery
  - Cache Redis com TTL 1h para listagem e detalhe de eventos
  - `build_system_prompt` → system prompt dinâmico (base + KB + ofertas + listagem)
  - AI_Roberto agora recebe contexto do evento injetado no system prompt
  - Placeholders para API URL do admin (aguardando André)
  - Spec seguido: `knowledge-base-flow.md` nodes 3-16
  - Sub-workflow `[ROBERTO] Tool — Buscar Evento` (`vnbtZQMsUl76h5p1`) — 8 nodes
- [x] **Memória persistente + Closer** (2026-03-20)
  - `redis_get_conv_summary` + `parse_conv_summary`: busca resumo da conversa (TTL 48h) antes do KB flow
  - `build_system_prompt` atualizado: injeta resumo no topo (nome, evento, estágio, objeções, argumentos)
  - Regra no prompt: "Ao final de CADA interação, use `salvar_resumo`"
  - Sub-workflow `[ROBERTO] Tool — Salvar Resumo` (`tgS9ji09wpuIeoJw`) — 2 nodes (input → Redis SET 48h)
  - Sub-workflow `[ROBERTO] Tool — Agendar Call Closer` (`F4LDmaSDWxarb9AV`) — 4 nodes (input → Redis GET summary → Build Briefing → Return)
  - Ambas as tools conectadas ao AI_Roberto
