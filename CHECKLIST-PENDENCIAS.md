# CHECKLIST — Pendências do Agente Roberto

> Workflow criado: `azwM3PgGtSbGTCsn`
> URL: https://ecommercepuro.app.n8n.cloud/workflow/azwM3PgGtSbGTCsn
> Última atualização: 2026-03-20

---

## 🔴 BLOQUEADORES (sem isso o agente não funciona)

### 1. WhatsApp Business API — Credenciais Meta
- [ ] Número WhatsApp Business aprovado pela Meta
- [ ] Meta Access Token (`PLACEHOLDER_META_ACCESS_TOKEN` em 2 nodes)
  - Node: `upload_audio_meta` — header Authorization
  - Node: `enviar_audio_waba` — header Authorization
- [ x ] Phone Number ID registrado no webhook do N8N
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

- [ ] Node `resposta_fora_horario`: implementar verificação de horário (07h-23h GMT-3) + mensagem via WABA
- [ ] Adicionar tratamento de erros global (error workflow `[ROBERTO] Error — Handler`)
- [ ] Configurar `errorWorkflow` no settings do workflow principal
- [ ] Verificar se gpt-5.1 já está disponível na conta OpenAI (pode precisar de gpt-4.1 como fallback)
- [ ] Testar node `openai_transcricao` — formato do áudio WABA (ogg/opus)
- [x] ~~Adicionar node de salvar mensagem de ENTRADA no Supabase~~ ✅ (2026-03-20)
- [x] ~~Substituir NoOp handoff por notificação real~~ ✅ Handoff redesenhado com duas camadas (2026-03-20)
- [x] ~~Tool `resumo_lead` de Data Tables para Supabase~~ ✅ (2026-03-20)

---

## 📋 INFORMAÇÕES PENDENTES DE STAKEHOLDERS

| Item | De quem | Status |
|---|---|---|
| Guru API docs (eventos, ofertas) | André | ❌ Pendente |
| Guru webhook schema (pós-venda) | André | ❌ Pendente |
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
