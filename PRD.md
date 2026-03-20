# PRD — Agente Roberto (Comercial) v1.1

> **Versão:** 1.1 — atualizado em 2026-03-18
> **Status:** Aprovado — aguardando início de implementação

**Objetivo:** Construir o Agente Roberto — IA de vendas no WhatsApp para eventos presenciais da Ecommerce Puro, derivada da arquitetura da Gabi (eContrate), adaptada para o contexto comercial de eventos low ticket.

**Arquitetura:** Workflow N8N com WhatsApp Business API oficial, agente LangChain (GPT-5.1), memória Redis, persistência Supabase, CRM ClickUp, áudio via ElevenLabs TTS. Padrões de envio (buffer, typing delay, método vácuo) reusados integralmente da Gabi.

**Stack:** N8N · OpenAI GPT-5.1 (LangChain) · WhatsApp Business API Oficial (Meta) · ElevenLabs TTS · Supabase · Redis · ClickUp · Guru API (pagamentos/eventos) · Typeform (captação)

**Stakeholders:** Bruno Allage (Head Comercial) · Gabriel Bollico (CEO) · Luiz André Mendes (Tech Lead — APIs) · Willian Pagane (supervisor)

---

## Contexto

A Ecommerce Puro realiza eventos presenciais e precisa automatizar a venda via WhatsApp. O time Comercial (liderado por Bruno Allage) solicitou um agente que converta leads interessados em compradores. O lead chega de forma **inbound**: preenche um Typeform do evento, recebe o link do WhatsApp da Roberto e envia a primeira mensagem. A partir daí, a Roberto assume a conversa com objetivo de fechar a venda.

**Base de referência:** Workflow da Gabi — `Agente eContrate` (ID N8N: `9dGEJcYa7LxTAwAs`) — todos os padrões de infraestrutura devem ser reutilizados.

---

## 1. Fluxo de Captação

```
Lead preenche Typeform do evento
         │
         ▼
Typeform exibe link do WhatsApp da Roberto
         │
         ▼
Lead envia mensagem para Roberto (inbound)
         │
         ▼
Webhook WhatsApp Business API → N8N
         │
         ▼
Roberto inicia conversa de vendas
```

> **Importante:** O lead é totalmente inbound. A Roberto NÃO faz outreach ativo. O primeiro contato parte sempre do lead.

---

## 2. Arquitetura Geral do Workflow N8N

### 2.1 Fluxo Principal

```
[Webhook WA Business API]
         │
         ▼
verificar_horario (07h–23h GMT-3?)
  ├── fora do horário → resposta_fora_horario → fim
  └── dentro do horário →
         │
         ▼
parametros (phone, nome, mensagem, tipo_midia)
         │
         ▼
cancelar_vacuo (Supabase UPDATE — segurança contra race condition)
         │
         ▼
filtragem_grupo → verificacao_numero → buscar_lead_crm
         │
         ▼
switch_tipo_midia:
  ├── Texto  → direto
  ├── Áudio  → openai_transcricao (Whisper)
  └── Imagem → openai_imagem (GPT-4O OCR)
         │
         ▼
merge_tipo_midia → redis_get_ts / redis_set_ts (buffer dedup)
         │
         ▼
AI_Roberto (GPT-5.1, temp=0.7, memória Redis, structured output)
         │
         ▼
structured_output_parser (JSON) → extrair_tokens
         │
         ▼
switch_audio_texto (acionar_audio?)
  ├── false → [MÉTODO TEXTO] loop messages[]
  └── true  → [MÉTODO ÁUDIO] ElevenLabs
         │
         ▼
[ambos os caminhos convertem em pós-processamento]
  ├── log_conversa_clickup
  ├── salvar_mensagem_supabase
  └── atualizar_status_lead
         │
         ▼
atualizar_metricas + atualizar_custos
         │
         ▼
switch_handoff (acionar_handoff?)
  ├── true  → [FLUXO HANDOFF]
  └── false →
         │
         ▼
classificador_vacuo (GPT-4.1-mini: "vacuo" ou "encerrar")
  ├── encerrar → fim
  └── vacuo   → [MÉTODO VÁCUO]
```

### 2.2 Padrões Reutilizados da Gabi

| Padrão | Nodes da Gabi para reusar | Adaptação necessária |
|---|---|---|
| Método de envio com typing delay | `total_mensagens`, `selecionar_mensagem`, `enviar_mensagem_whatsapp1`, `Merge1`, `incrementar_indice`, `If1`, `Tempo de mensagem1` | Trocar Z-API por WA Business API; remover `delayTyping` → Wait node 1–4s |
| Método Vácuo v2.1 | `cancelar_vacuo`, `buscar_vacuo`, `vacuo_existe`, `criar_vacuo`, `resetar_vacuo`, `espera_vacuo_1/2/3`, `ler_vacuo`, `vacuo_ainda_ativo`, `verificar_limite`, `enviar_followup`, `incrementar_vacuo`, `tempo_por_tentativa`, `marcar_esgotado` | Trocar Z-API; adaptar msgs para vendas; adicionar verificação de horário no `enviar_followup` |
| Buffer Redis (dedup) | `Redis_SET_ts`, `Redis_GET_ts` | Nenhuma |
| Memória Redis Chat | `Memória1` (memoryRedisChat) | Prefix `memoria:` → `roberto:memoria:` |
| Transcrição áudio entrada | `openAI_audio`, `Edit Fields1` | Nenhuma |
| OCR imagem | Nodes análise GPT-4O | Nenhuma |
| Dual-agent (humanização voz) | `AI Agent` (secondary) | Renomear para `AI_Roberto_Humanizacao` |
| ElevenLabs TTS | `Convert text to speech` | Voice ID diferente para Roberto |
| Métricas + custos | `agente_metricas`, `agente_custos`, `Code in JavaScript11`, `custo_elevenlabs` | Trocar agent_id → `"Roberto-Comercial"` |

---

## 3. Integração WhatsApp Business API Oficial (Meta)

> ⚠️ **Diferença crítica da Gabi:** A Gabi usa Z-API (instância local). A Roberto usa a API oficial da Meta.

| Aspecto | Detalhe |
|---|---|
| **Webhook de entrada** | Endpoint configurado no Meta Business — formato de payload diferente de Z-API |
| **Envio de texto** | `POST https://graph.facebook.com/v18.0/{phone_number_id}/messages` |
| **Autenticação** | `Authorization: Bearer {access_token}` |
| **Typing indicator** | Sem suporte nativo (Z-API tinha `delayTyping`) → Wait node (1–4s) entre mensagens |
| **Envio de áudio** | Upload binário → Meta Media API → obter `media_id` → enviar com `{type: "audio", audio: {id: media_id}}` |

**Formato de envio de texto:**
```json
{
  "messaging_product": "whatsapp",
  "to": "{phone}",
  "type": "text",
  "text": { "body": "{mensagem}" }
}
```

**Formato de envio de áudio:**
```json
{
  "messaging_product": "whatsapp",
  "to": "{phone}",
  "type": "audio",
  "audio": { "id": "{media_id}" }
}
```

> ⚠️ **Pendência bloqueante:** Número WhatsApp Business dedicado + Access Token Meta (André/Bruno).

---

## 4. AI Agent — Persona Roberto

### 4.1 Configuração

| Parâmetro | Valor |
|---|---|
| **Modelo** | GPT-5.1 (LangChain `lmChatOpenAi`) |
| **Temperatura** | 0.7 |
| **Max Retries** | 2 |
| **Memória** | Redis Chat Memory — key: `roberto:memoria:{phone}`, janela 10k tokens |
| **Output** | Structured Output Parser (JSON — ver seção 6) |

### 4.2 Tools do Agente

| Tool | Tipo N8N | Propósito |
|---|---|---|
| `think` | toolThink | THINK-PLAN-ACT — chamado em TODA resposta |
| `consultar_eventos` | toolWorkflow / HTTP | Buscar eventos ativos + descrições via API Guru |
| `consultar_ofertas` | toolWorkflow / HTTP | Buscar links de pagamento multi-oferta |
| `verificar_cupom` | toolWorkflow / HTTP | Validar e aplicar cupom de desconto |
| `base_roberto` | googleDocsTool | FAQ, objeções, argumentos de venda |
| `crm_roberto` | toolWorkflow | Ler/atualizar campos no ClickUp |
| `resumo_lead` | supabase | Resumos de conversas anteriores |

> ⚠️ `consultar_eventos`, `consultar_ofertas` e `verificar_cupom` ficam como placeholders HTTP Request (URL + auth em branco) até APIs da Guru serem fornecidas pelo André.

### 4.3 Regras do System Prompt (a implementar)

| Regra | Descrição |
|---|---|
| **THINK-PLAN-ACT** | Chamar `think` antes de TODA resposta — pensar, planejar, agir |
| **1 pergunta por turno** | INVIOLÁVEL — nunca fazer mais de uma pergunta por resposta |
| **Anti-alucinação** | NUNCA inventar preços, datas, locais, vagas — sempre buscar nas tools |
| **Brevidade** | Máx 1–2 frases por bubble (~80 chars) — igual Gabi v9.0 |
| **Frases proibidas** | Lista de frases robóticas/corporativas banidas (definir no prompt) |
| **Salvar dados imediatamente** | Qualquer dado coletado (nome, email) → chamar `crm_roberto` na hora |
| **Perfil comportamental** | Detectar e adaptar: Tubarão / Águia / Lobo / Gato / Neutro |

### 4.4 Perfil da Persona

**Roberto** é consultora comercial da Ecommerce Puro. Entusiasmada, orientada a resultados, linguagem acessível e calorosa. Não é vendedora agressiva — é consultora que ajuda o lead a tomar a melhor decisão.

**Tom:** confiante · empática · objetiva · sem pressão excessiva

### 4.5 Script de Vendas (PLACEHOLDER)

> Script detalhado será definido com Bruno Allage.

```
[1] Abertura      — cumprimentar, identificar evento e contexto do lead
[2] Sondagem      — entender urgência, expectativa, situação atual
[3] Apresentação  — apresentar evento com dados reais (API Guru + base)  ← acionar_audio
[4] Oferta        — apresentar links de pagamento multi-oferta            ← acionar_audio
[5] Objeções      — contornar objeções com argumentos preparados          ← acionar_audio (objeção forte)
[6] Fechamento    — confirmar intenção / próximo passo                    ← acionar_audio
[7] Pós-venda     — confirmar compra via webhook Guru (fluxo separado)
```

---

## 5. Método de Áudio — ElevenLabs TTS

### 5.1 Arquitetura (Dual-Agent — reutilizar padrão da Gabi)

A Roberto usa o mesmo padrão dual-agent da Gabi: um agente secundário "humaniza" o texto para formato de fala natural antes de passar ao ElevenLabs.

**Gatilho:** Campo `acionar_audio: true` no output da `AI_Roberto`.

**Momentos proativos para áudio:**
- Apresentação do evento (estágio 3)
- Envio da oferta principal (estágio 4)
- Contorno de objeção forte (estágio 5)
- Mensagem de fechamento (estágio 6)
- Follow-up do vácuo (mais humano)

### 5.2 Fluxo Completo de Áudio

```
AI_Roberto output (acionar_audio = true)
         │
         ▼
switch_audio_texto
  ├── false → [MÉTODO TEXTO]
  └── true  →
         │
         ▼
AI_Roberto_Humanizacao
  — modelo: GPT-4.1-mini, temp=0.9, stateless
  — input: messages[] do AI_Roberto (join "\n\n")
  — converte para linguagem oral natural (sem markdown, fluida)
         │
         ▼
converter_texto_audio (ElevenLabs TTS)
  — tipo: @elevenlabs/n8n-nodes-elevenlabs.elevenLabs
  — voice_id: [PENDENTE — voz da Roberto]
  — output: binary audio (mp3)
         │
         ▼
upload_audio_meta (HTTP POST — Meta Media API)
  — POST https://graph.facebook.com/v18.0/{phone_number_id}/media
  — Content-Type: multipart/form-data
  — body: { file: <binary>, type: "audio/mpeg", messaging_product: "whatsapp" }
  — retorna: { id: "media_id" }
         │
         ▼
enviar_audio_waba (HTTP POST — WA Business API)
  — { to: phone, type: "audio", audio: { id: media_id } }
         │
         ▼
custo_elevenlabs (INSERT roberto_custos.elevenlabs_tokens)
```

### 5.3 Nodes de Áudio

```
switch_audio_texto         — IF acionar_audio = true?
AI_Roberto_Humanizacao     — Agente secundário: text → fala natural
converter_texto_audio      — ElevenLabs TTS (binary output)
upload_audio_meta          — HTTP POST Meta Media API → media_id
enviar_audio_waba          — HTTP POST WA Business API (audio)
custo_elevenlabs           — INSERT roberto_custos (character-cost)
```

> ⚠️ **Pendência:** Voice ID ElevenLabs para a Roberto — definir com Allage/Bruno. Usar voz temporária da biblioteca no MVP.

---

## 6. Filtro de Horário de Atendimento

**Janela:** 07h00 – 23h00 horário de Brasília (GMT-3). Sem resposta na madrugada (23h01–06h59).

### 6.1 Fluxo

```
[Webhook entra]
         │
         ▼
verificar_horario (Code JS)
  ├── 07h–23h → continua fluxo normal
  └── 23h–07h → resposta_fora_horario → fim
```

### 6.2 Node `verificar_horario` (Code JS)

```javascript
const now = new Date();
const brasiliaOffset = -3 * 60;
const brasiliaTime = new Date(
  now.getTime() + (brasiliaOffset + now.getTimezoneOffset()) * 60000
);
const hour = brasiliaTime.getHours();
return [{ json: { dentro_horario: hour >= 7 && hour < 23, hora_brasilia: hour } }];
```

### 6.3 Mensagem fora do horário

> *"Oi! Tô fora do ar agora, mas te respondo assim que o dia começar. Até já!"*

**Nodes:**
```
verificar_horario          — Code JS: hora atual GMT-3
switch_horario             — IF dentro_horario = true?
resposta_fora_horario      — enviar_mensagem_waba (msg automática)
```

> **Regra no método vácuo:** `enviar_followup` também verifica horário antes de disparar — não enviar follow-ups entre 23h e 07h.

---

## 7. Handoff — Suporte Técnico e Pós-Venda

**Gatilho:** Campo `acionar_handoff: true` no output da `AI_Roberto`.

**Situações que acionam handoff:**
- Questões sobre nota fiscal, reembolso, cancelamento
- Problemas de acesso ao evento (plataforma, link, senha)
- Reclamações pós-venda
- Situações técnicas que a Roberto não consegue resolver

### 7.1 Fluxo Handoff

```
acionar_handoff = true
         │
         ▼
switch_handoff
         │
         ▼
notificar_equipe_handoff
  — UPDATE ClickUp: status → SUPORTE, tag → "handoff"
         │
         ▼
mensagem_handoff_lead
  — "Vou te conectar com nossa equipe agora!"
         │
         ▼
atualizar_lead_handoff
  — UPDATE roberto_leads: status = 'HANDOFF'
```

**Nodes:**
```
switch_handoff             — IF acionar_handoff = true?
notificar_equipe_handoff   — UPDATE ClickUp (status SUPORTE + tag handoff)
mensagem_handoff_lead      — enviar_mensagem_waba
atualizar_lead_handoff     — UPDATE roberto_leads status='HANDOFF'
```

---

## 8. Structured Output Schema

```json
{
  "messages": ["string"],
  "intencao_detectada": "string",
  "evento_interesse": "string",
  "lead_qualificado": "boolean",
  "oferta_enviada": "boolean",
  "acionar_audio": "boolean",
  "acionar_handoff": "boolean",
  "objecao_detectada": "string",
  "status_crm": "string",
  "dados_lead": {
    "nome": "string",
    "email": "string"
  }
}
```

| Campo | Valores possíveis |
|---|---|
| `intencao_detectada` | `interesse_alto` · `interesse_medio` · `objecao` · `comprou` · `desistiu` · `duvida` |
| `status_crm` | `EM CONTATO` · `INTERESSADO` · `OFERTA_ENVIADA` · `COMPROU` · `PERDIDO` · `HANDOFF` |
| `objecao_detectada` | `preco` · `tempo` · `relevancia` · `concorrencia` · `nenhuma` · `outra` |

---

## 9. Supabase — Schema

> Todas as tabelas com prefixo `roberto_` para isolamento total.

### `roberto_leads`

| Coluna | Tipo | Propósito |
|---|---|---|
| `telefone` | TEXT (PK) | Identificador principal |
| `nome` | TEXT | Nome do lead |
| `email` | TEXT | Email coletado durante conversa |
| `evento_interesse` | TEXT | Evento demonstrado interesse |
| `origem_typeform` | TEXT | Identificador do Typeform de origem |
| `status` | TEXT | `BASE` → `EM CONTATO` → `INTERESSADO` → `OFERTA_ENVIADA` → `COMPROU` / `PERDIDO` / `HANDOFF` |
| `perfil_comportamental` | TEXT | `tubarao` / `aguia` / `lobo` / `gato` / `neutro` |
| `created_at` | TIMESTAMPTZ | — |
| `updated_at` | TIMESTAMPTZ | — |

### `roberto_mensagens`

| Coluna | Tipo | Propósito |
|---|---|---|
| `id` | UUID (PK) | — |
| `telefone` | TEXT | FK → roberto_leads |
| `direcao` | TEXT | `inbound` / `outbound` |
| `conteudo` | TEXT | Conteúdo da mensagem |
| `tipo_midia` | TEXT | `texto` / `audio_entrada` / `audio_saida` / `imagem` |
| `created_at` | TIMESTAMPTZ | — |

### `roberto_vacuo`

| Coluna | Tipo | Propósito |
|---|---|---|
| `telefone` | TEXT (PK) | — |
| `tentativa` | INTEGER (default 0) | Contador 0–3 |
| `nome_lead` | TEXT | Personalização do follow-up |
| `clickup_task_id` | TEXT | ID da task ClickUp |
| `evento_interesse` | TEXT | Evento em negociação |
| `status` | TEXT | `ativo` / `cancelado` / `esgotado` |
| `created_at` | TIMESTAMPTZ | — |
| `updated_at` | TIMESTAMPTZ | — |

### `roberto_metricas`
- `agent_id`: `"Roberto-Comercial"` · mensagens · conversas · conversões (compras)

### `roberto_custos`

| Coluna | Tipo | Propósito |
|---|---|---|
| `id` | UUID (PK) | — |
| `prompt_tokens` | INTEGER | Tokens de entrada (OpenAI) |
| `completion_tokens` | INTEGER | Tokens de saída (OpenAI) |
| `elevenlabs_tokens` | INTEGER | Caracteres cobrados (ElevenLabs) |
| `created_at` | TIMESTAMPTZ | — |

---

## 10. CRM ClickUp

### Pipeline

- **List:** `Operações & Projetos > Agentes > Pipeline - Roberto Comercial` *(criar nova list)*
- **Task = Lead:** Uma task por lead. Título = nome do lead. Lookup por telefone.

### Status Flow

```
BASE → EM CONTATO → INTERESSADO → OFERTA_ENVIADA → COMPROU
                                                  ↘ PERDIDO
                                                  ↘ SUPORTE  (handoff técnico/pós-venda)
```

### Custom Fields

| Campo | Tipo | Obrigatório |
|---|---|---|
| `telefone` | Text | Sim |
| `email` | Email | Não |
| `evento_interesse` | Text | Sim |
| `origem_typeform` | Text | Não |
| `oferta_enviada` | Text | Não (URL do link de pagamento) |
| `cupom_usado` | Text | Não |
| `objecao_principal` | Dropdown | Não |
| `perfil_comportamental` | Dropdown | Não |

### Tags

| Tag | Aplicada por | Significado |
|---|---|---|
| `em contato` | Roberto | Lead respondeu pela primeira vez |
| `oferta enviada` | Roberto | Link de pagamento foi apresentado |
| `comprou` | Roberto (webhook Guru) | Venda confirmada |
| `handoff` | Roberto | Transferido para suporte humano |
| `perdido` | Roberto (vácuo) | 3 tentativas sem resposta |

### Conversation Logging

```
👤: [mensagem do lead]
🤖: [resposta da Roberto]
```

---

## 11. Sub-workflows

| Workflow | Nome no N8N | Propósito |
|---|---|---|
| CRM tool | `[ROBERTO] Tool — ClickUp Agente` | Atualizar custom fields (copiar `d6j0bzfZwVJeCnMF`) |
| Guru API | `[ROBERTO] Tool — Consultar Guru` | Buscar eventos ativos + ofertas |
| Pós-venda | `[ROBERTO] Webhook — Confirmação Venda Guru` | Receber confirmação de venda |

---

## 12. Redis — Key Patterns

| Chave | Propósito |
|---|---|
| `roberto:memoria:{phone}` | Histórico conversacional (10k tokens) |
| `roberto:ts:{phone}` | Timestamp buffer/dedup de mensagens |
| `roberto:vacuo_pendente:{phone}` | Estado de follow-up pendente |
| `roberto:temperamento:{phone}` | Perfil comportamental (cache) |
| `roberto:temperamento:chamado:{phone}` | Flag de análise comportamental executada (TTL 30d) |

---

## 13. Nomenclatura Completa de Nodes

> Padrão: `snake_case` em português.

### Pré-processamento
```
webhook_roberto            — Webhook entrada WA Business API
verificar_horario          — Code JS: hora atual GMT-3 (07h–23h)
switch_horario             — IF dentro_horario?
resposta_fora_horario      — Mensagem automática madrugada
parametros                 — Extrair: phone, nome, mensagem, tipo_midia
cancelar_vacuo             — Supabase UPDATE (safety)
filtragem_grupo            — Ignorar mensagens de grupo
verificacao_numero         — Normalizar telefone
buscar_lead_crm            — ClickUp lookup por telefone
switch_tipo_midia          — Rotear por tipo de mídia
openai_transcricao         — Whisper: audio → texto
openai_imagem              — GPT-4O: imagem → texto
merge_tipo_midia           — Unificar todos os tipos
redis_get_ts               — Buscar timestamp (dedup)
redis_set_ts               — Salvar timestamp (dedup)
```

### Agente Principal
```
AI_Roberto                 — Agente LangChain (GPT-5.1)
structured_output_parser   — Parser JSON output
extrair_tokens             — Extrair contagem de tokens
```

### Método de Envio Texto
```
switch_audio_texto         — IF acionar_audio?
total_mensagens            — Contar bubbles do array messages[]
selecionar_mensagem        — Selecionar bubble atual + calcular delay
enviar_mensagem_waba       — HTTP POST WA Business API (texto)
merge_envio                — Merge para loop
incrementar_indice         — Avançar índice
verificar_fim_envio        — IF: ainda tem mensagens?
tempo_entre_mensagens      — Wait 1–4s (humanização)
```

### Método de Envio Áudio
```
AI_Roberto_Humanizacao     — Agente secundário: texto → fala natural
converter_texto_audio      — ElevenLabs TTS (binary audio)
upload_audio_meta          — HTTP POST Meta Media API → media_id
enviar_audio_waba          — HTTP POST WA Business API (audio)
custo_elevenlabs           — INSERT roberto_custos.elevenlabs_tokens
```

### Pós-processamento
```
log_conversa_clickup       — Comentário na task ClickUp
salvar_mensagem_supabase   — INSERT roberto_mensagens
atualizar_status_lead      — UPDATE roberto_leads.status
atualizar_metricas         — UPDATE roberto_metricas
atualizar_custos           — INSERT roberto_custos (tokens OpenAI)
```

### Handoff
```
switch_handoff             — IF acionar_handoff = true?
notificar_equipe_handoff   — UPDATE ClickUp (status SUPORTE + tag)
mensagem_handoff_lead      — enviar_mensagem_waba (aviso ao lead)
atualizar_lead_handoff     — UPDATE roberto_leads status='HANDOFF'
```

### Método Vácuo
```
classificador_vacuo        — GPT-4.1-mini: "vacuo" ou "encerrar"
switch_classificador       — Roteamento por resultado
buscar_vacuo               — SELECT roberto_vacuo por telefone
vacuo_existe               — IF: registro existe?
criar_vacuo                — INSERT roberto_vacuo
resetar_vacuo              — UPDATE tentativa=0, status='ativo'
espera_vacuo_1             — Wait 15min
espera_vacuo_2             — Wait 1h
espera_vacuo_3             — Wait 24h
ler_vacuo                  — SELECT estado atual
vacuo_ainda_ativo          — IF: status='ativo'?
verificar_horario_vacuo    — IF: dentro do horário 07h–23h?
verificar_limite           — IF: tentativa < 3?
enviar_followup            — POST WA Business API (follow-up)
incrementar_vacuo          — UPDATE tentativa+1
tempo_por_tentativa        — Switch: 15min → 1h → 24h
marcar_esgotado            — UPDATE status='esgotado'
atualizar_lead_perdido     — UPDATE roberto_leads status='PERDIDO'
atualizar_crm_perdido      — UPDATE ClickUp (PERDIDO)
```

### Webhook Pós-Venda
```
webhook_confirmacao_venda  — Receber webhook da Guru
confirmar_compra_lead      — UPDATE roberto_leads status='COMPROU'
confirmar_compra_crm       — UPDATE ClickUp (COMPROU)
enviar_confirmacao_waba    — Mensagem de confirmação ao lead
```

---

## 14. Método Vácuo — Escalação

| Tentativa | Espera antes | Comportamento |
|---|---|---|
| 0 → 1ª msg | 15 min | Follow-up leve, casual |
| 1 → 2ª msg | 1 hora | Follow-up com leve urgência |
| 2 → 3ª msg | 24 horas | Último contato, tom mais direto |
| 3 → esgotado | — | Status `PERDIDO` no Supabase + ClickUp |

> **Regra:** `enviar_followup` só dispara entre 07h e 23h GMT-3. Se a janela de espera expirar durante a madrugada, aguardar até 07h do dia seguinte.

> **Cancelamento automático:** Toda mensagem do lead dispara `cancelar_vacuo` antes de qualquer processamento — garante que follow-up não seja enviado após resposta.

---

## 15. Plano de Implementação por Fases

### Fase 1 — Core do Agente (MVP funcional)
**Objetivo:** Roberto recebe → responde (texto + áudio) → salva → filtros de horário e handoff ativos

- [ ] Criar workflow `[ROBERTO] Agent — Comercial Ecommerce Puro`
- [ ] Webhook WA Business API (entrada)
- [ ] `verificar_horario` (Code JS GMT-3) + `resposta_fora_horario`
- [ ] Pré-processamento: `parametros`, `filtragem_grupo`, `verificacao_numero`
- [ ] Buffer dedup Redis (`redis_get_ts` / `redis_set_ts`)
- [ ] Transcrição áudio entrada (Whisper) + OCR imagem (GPT-4O)
- [ ] `AI_Roberto` (GPT-5.1, temp=0.7, Redis memory, structured output)
- [ ] System prompt v1.0: persona + THINK-PLAN-ACT + anti-alucinação + frases proibidas + script placeholder
- [ ] Structured output: todos os campos (seção 8)
- [ ] **Método texto:** loop com Wait node humanizado
- [ ] **Método áudio:** `AI_Roberto_Humanizacao` → ElevenLabs → `upload_audio_meta` → `enviar_audio_waba`
- [ ] **Handoff:** `switch_handoff` → `notificar_equipe_handoff` → `mensagem_handoff_lead`
- [ ] Pós-processamento: `salvar_mensagem_supabase`, `atualizar_status_lead`, `atualizar_metricas`, `atualizar_custos`, `custo_elevenlabs`
- [ ] Criar tabelas Supabase: `roberto_leads`, `roberto_mensagens`, `roberto_custos`

> ⚠️ **Bloqueantes:** Número WA Business + Access Token Meta (André/Bruno) · Voice ID ElevenLabs (Allage/Bruno)

---

### Fase 2 — CRM ClickUp
**Objetivo:** Task por lead no ClickUp com histórico completo

- [ ] Criar Pipeline Roberto Comercial no ClickUp (list + statuses + custom fields + tags)
- [ ] Sub-workflow `[ROBERTO] Tool — ClickUp Agente`
- [ ] `buscar_lead_crm` no fluxo principal
- [ ] Tool `crm_roberto` no AI Agent
- [ ] `log_conversa_clickup` no pós-processamento
- [ ] Criar tabela Supabase `roberto_vacuo`

---

### Fase 3 — Método Vácuo
**Objetivo:** Follow-up automático com respeito ao horário

- [ ] Copiar e adaptar todos os nodes do vácuo da Gabi
- [ ] Adaptar mensagens para contexto de vendas de eventos
- [ ] Adicionar `verificar_horario_vacuo` no fluxo do `enviar_followup`
- [ ] Classificador pós-agente (GPT-4.1-mini)
- [ ] Testar escalação completa: 15min → 1h → 24h

---

### Fase 4 — Integração Guru (Eventos + Pagamentos)
**Objetivo:** Roberto consulta eventos e ofertas reais

- [ ] Sub-workflow `[ROBERTO] Tool — Consultar Guru`
- [ ] Tools no AI Agent: `consultar_eventos`, `consultar_ofertas`, `verificar_cupom`
- [ ] Atualizar system prompt v2.0 com dados reais

> ⚠️ **Bloqueantes:** APIs da Guru (André) · Regras de cupom (Allage)

---

### Fase 5 — Webhook Pós-Venda
**Objetivo:** Confirmação de venda da Guru → notifica lead → atualiza CRM

- [ ] Sub-workflow `[ROBERTO] Webhook — Confirmação Venda Guru`
- [ ] Webhook de confirmação configurado na Guru
- [ ] Mensagem de confirmação + `COMPROU` em Supabase e ClickUp

> ⚠️ **Bloqueante:** Webhook da Guru (André)

---

### Fase 6 — Base de Conhecimento
**Objetivo:** FAQ, objeções e argumentos de venda acessíveis pelo agente

- [ ] Google Docs com FAQ de eventos, objeções, argumentos de venda
- [ ] Tool `base_roberto` (googleDocsTool) no AI Agent
- [ ] Tool `resumo_lead` (Supabase) no AI Agent

---

## 16. Pendências & Bloqueantes

| # | Pendência | Responsável | Impacto |
|---|---|---|---|
| 1 | Número WhatsApp Business + Access Token Meta | André / Bruno | **BLOQUEANTE Fase 1** |
| 2 | Voice ID ElevenLabs para voz da Roberto | Allage / Bruno | **BLOQUEANTE áudio (Fase 1)** |
| 3 | APIs da Guru (endpoint, auth, campos disponíveis) | André | **BLOQUEANTE Fase 4** |
| 4 | Webhook pós-venda Guru (formato, autenticação) | André | Bloqueante Fase 5 |
| 5 | Script de vendas detalhado (objeções, argumentos) | Allage / Bruno | Bloqueante system prompt v2+ |
| 6 | Regras de cupom de desconto | Allage | Bloqueante tool `verificar_cupom` |
| 7 | Criar Pipeline Roberto no ClickUp (list + campos) | Kauan | Bloqueante Fase 2 |
| 8 | Eventos ativos + descrições para base de conhecimento | Equipe de Eventos | Bloqueante Fase 6 |

---

## 17. Decisões em Aberto

| Decisão | Recomendação | Racional |
|---|---|---|
| A/B test Roberto vs Roberto (persona masculina) | Depois | Testar após Roberto estabilizar em produção |
| Base de conhecimento de eventos | Guru API | Fonte única de verdade — equipe já preenche lá |
| Resumos de conversa | Supabase | Evitar anti-pattern da Gabi (N8N Data Tables) |
| Voice ID ElevenLabs | Voz nova dedicada | Personalidade única da Roberto — não usar voz da Gabi |

---

## 18. N8N Workflow Naming

| Workflow | Nome no N8N |
|---|---|
| Principal | `[ROBERTO] Agent — Comercial Ecommerce Puro` |
| CRM tool | `[ROBERTO] Tool — ClickUp Agente` |
| Guru tool | `[ROBERTO] Tool — Consultar Guru` |
| Pós-venda | `[ROBERTO] Webhook — Confirmação Venda Guru` |
| Error handler | `[ROBERTO] Error — Handler` |

---

## 19. Verificação — Definition of Done por Fase

| Fase | Como testar |
|---|---|
| **Fase 1 — Texto** | Enviar mensagem → receber resposta em texto → verificar `roberto_leads` + `roberto_mensagens` no Supabase |
| **Fase 1 — Áudio** | Acionar estágio de apresentação → Roberto deve responder em áudio via WA Business API |
| **Fase 1 — Horário** | Enviar mensagem às 02h → receber mensagem de fora do horário e não processar |
| **Fase 1 — Handoff** | Perguntar sobre nota fiscal → acionar_handoff=true → task ClickUp atualizada para SUPORTE |
| **Fase 2** | Verificar task criada no ClickUp com campos e histórico após interação |
| **Fase 3** | Parar de responder → follow-ups nos intervalos 15min / 1h / 24h → responder → confirmar cancelamento |
| **Fase 4** | Perguntar sobre evento disponível → Roberto cita detalhes reais + link de pagamento correto |
| **Fase 5** | Simular webhook da Guru → notificação WA + status `COMPROU` no ClickUp e Supabase |
| **Fase 6** | Perguntar sobre FAQ → Roberto responde usando base de conhecimento |
