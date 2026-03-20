---
type: reference
name: "Knowledge Base Flow — Agente Roberto"
project: "[[Agente Roberto (Comercial)]]"
created: 2026-03-20
last_updated: 2026-03-20
tags:
  - project/agente-roberto-comercial
---
# Fluxo de Knowledge Base — Agente Roberto

> Documento técnico que descreve como o [[Agente Roberto (Comercial)|Roberto]] carrega e utiliza bases de conhecimento de eventos para conduzir vendas no WhatsApp.

---

## Visão Geral

O [[Agente Roberto (Comercial)|Roberto]] usa o **painel admin** de [[Luiz André Mendes|André]] como fonte única de verdade. A arquitetura resolve o carregamento de contexto em **3 camadas de dados** via API, injetadas no system prompt + **1 tool sob demanda**:

| Camada | Fonte | O que traz | Quando |
|--------|-------|-----------|--------|
| **Listagem leve** | `GET /api/events` | Nome, data, status, vagas, resumo (~200-300 chars) | Sempre, no início |
| **Detalhe completo** | `GET /api/events/:id` | Campo `knowledge_base` (~10k chars markdown) + `product_id` | Quando há tag, ou quando lead demonstra interesse |
| **Ofertas e preços** | `GET /api/events/:id?include_offers=true` | Preços, parcelamentos, condições, links de pagamento | Junto ao detalhe completo |

> **Separação fundamental:** o campo `knowledge_base` contém apenas conteúdo qualitativo (argumentos, objeções, frases, provas). Dados dinâmicos — preços, datas, vagas, links — vêm dos campos estruturados da API, não do KB. O time comercial edita o KB diretamente no admin via editor markdown.

---

## Fontes de Dados

### `GET /api/events` — Listagem leve

Retorna todos os eventos ativos com campos leves. Usado para montar o catálogo resumido no system prompt.

Campos principais:
- `id` — identificador do evento (usado nas chamadas de detalhe)
- `nome` — nome legível
- `data` — data do evento
- `status` — `ativo` / `inativo`
- `vagas_restantes` — disponibilidade atual
- `resumo` — descrição curta (~200-300 caracteres), suficiente para recomendação no discovery

> **Não inclui `knowledge_base`** — campo omitido propositalmente para não sobrecarregar a listagem.

### `GET /api/events/:id` — Detalhe completo

Retorna todos os dados de um evento específico, incluindo o KB completo.

Campos adicionais além da listagem:
- `knowledge_base` — conteúdo qualitativo em markdown (~10k chars) — ver seção abaixo
- `product_id` — ID do produto no Guru (usado para buscar ofertas)

### Ofertas e preços

Dois endpoints possíveis (em definição com [[Luiz André Mendes|André]]):

- `GET /api/events/:id?include_offers=true` — retorna detalhe + ofertas em uma chamada
- `GET /products/{product_id}/offers` — endpoint direto do Guru API

[[Luiz André Mendes|André]] planeja um job de sincronização diário Guru → admin para que os agentes consultem apenas uma fonte. Até lá, o n8n pode chamar o endpoint do Guru diretamente usando o `product_id` retornado pelo detalhe.

---

## Separação de Dados — Estático vs. Dinâmico

| Tipo | Onde fica | Exemplos |
|------|-----------|---------|
| **Qualitativo (estático)** | Campo `knowledge_base` no admin | Argumentos de venda, objeções e respostas, frases-chave, módulos do conteúdo, provas sociais, público-alvo |
| **Dinâmico (estruturado)** | Campos da API (listagem + detalhe) | Data, vagas restantes, status |
| **Comercial (dinâmico)** | Endpoint de ofertas | Preços, lotes, parcelamentos, condições, links de pagamento |
| **Cupons** | Campo `knowledge_base` (exceção) | Cupons atrelados a argumentos de venda específicos — ex.: "Se o lead mencionar que é aluno do Plus: use cupom PLUS15" |

---

## Camada de Cache — Redis

Todas as consultas à API do admin passam por um **cache Redis com TTL de 1 hora**. O agente nunca chama a API diretamente — sempre consulta o Redis primeiro.

### Estratégia

| Chave Redis | Conteúdo | TTL |
|---|---|---|
| `roberto:events:list` | Resposta completa do `GET /api/events` (listagem leve) | 1 hora |
| `roberto:events:{id}:detail` | Resposta completa do `GET /api/events/:id?include_offers=true` (detalhe + KB + ofertas) | 1 hora |
| `roberto:conv:{lead_phone}:summary` | Resumo estruturado da conversa com o lead (gerado pelo agente) | 48 horas |

### Cache de eventos — Padrão cache-aside

```
1. Redis GET na chave correspondente
2. HIT  → usar dados do cache, continuar
3. MISS → HTTP Request à API do admin
         → Redis SET com TTL 3600s
         → usar dados retornados, continuar
```

### Cache de conversa — Memória persistente do agente

O resumo da conversa resolve um problema crítico: **sem ele, toda mensagem nova do lead exigiria reenviar o histórico completo de mensagens ao LLM**, sujando o contexto com centenas de mensagens e aumentando custo/latência. Com o resumo, o agente recebe apenas um parágrafo estruturado que o situa imediatamente.

**Fluxo:**
```
Lead envia mensagem
    │
    ▼
Redis GET roberto:conv:{phone}:summary
    │
   ┌┴──────────────┐
   HIT              MISS
   │                │
   Resumo injetado  Lead novo ou
   no prompt        sem histórico
   │                │
   ├────────────────┤
   ▼                ▼
   Agente processa mensagem
   (com contexto da conversa ou do zero)
    │
    ▼
   Agente gera resposta
    │
    ▼
   Agente atualiza resumo via tool "salvar_resumo"
    │
    ▼
   Redis SET roberto:conv:{phone}:summary (TTL 48h)
```

**Conteúdo do resumo (gerado pelo agente):**
```json
{
  "lead_name": "João Silva",
  "event_interest": "Imersão Tributária",
  "event_id": "evt_123",
  "stage": "objection_handling",
  "key_facts": "Fatura R$350k/mês, Simples Nacional, 2 funcionários, vende eletrônicos",
  "objections_raised": ["preço alto", "não tenho tempo"],
  "arguments_used": ["economia de R$9k/mês", "formato presencial único"],
  "interest_level": "medio",
  "next_action": "follow-up com comparativo de custo regime errado vs ingresso",
  "interaction_count": 4,
  "last_interaction": "2026-03-20T14:30:00"
}
```

**Por que 48 horas de TTL:**
- Leads ativos respondem em até 48h — após isso, o contexto provavelmente mudou
- Se o lead voltar depois de 48h, o agente começa com discovery leve ("Oi João, tudo bem? Da última vez conversamos sobre a Imersão Tributária, ainda tem interesse?") usando apenas o que vier no histórico de mensagens do WhatsApp
- 48h é agressivo o suficiente para manter o cache limpo mas conservador o suficiente para cobrir leads que respondem no dia seguinte

### TTL de eventos — Por que 1 hora

- KB e dados de eventos mudam no máximo algumas vezes por dia (novo lote, alteração de preço)
- 1 hora é rápido o suficiente para refletir mudanças sem sobrecarregar a API
- Se um evento for atualizado e precisar refletir imediatamente, um flush manual da chave resolve (`DEL roberto:events:{id}:detail`)

---

## Diagrama do Fluxo

```
Lead envia mensagem (WhatsApp webhook)
    │
    ▼
[1] Trigger + extrair dados do contato
    │
    ▼
[2] Redis GET conv:{phone}:summary
   ├─ HIT → resumo da conversa anterior
   └─ MISS → lead novo (sem histórico)
    │
    ▼
[3] Tem tag de evento?
    │
   ┌┴──────────────────────┐
   SIM                      NÃO
   │                        │
[4] Redis GET               │
   event:{id}:detail        │
   ├─ HIT → usar cache      │
   └─ MISS → API call       │
            → Redis SET      │
   │                        │
   ├────────────────────────┤
   ▼                        ▼
[5] Redis GET events:list (sempre)
   ├─ HIT → usar cache
   └─ MISS → API call → Redis SET
   │                        │
   ▼                        ▼
[6] Merge + Build           [6] Build
   System Prompt               System Prompt
   KB + ofertas + listagem     listagem apenas
   + resumo conversa           + resumo conversa
   modo: venda                 modo: discovery
   │                        │
   ▼                        ▼
[7] AI Agent Node           [7] AI Agent Node
   (Roberto)                   (Roberto)
   │                        │
   ▼                        ▼
   Tools do agente:
   ├─ buscar_evento (cache-aside)
   ├─ salvar_resumo → Redis SET conv:{phone}:summary (48h)
   └─ agendar_call_closer (usa resumo do cache)
```

---

## Workflow n8n — Nodes em Detalhe

### Fluxo principal (do trigger ao agent)

```
Node 1          Node 2           Node 3           Node 4
Trigger    →    Extract     →    Redis GET   →    IF: Tag?
(webhook)       Contact          conv summary     ↓ SIM / ↓ NÃO
                                                  │        │
                                    ┌─────────────┘        │
                                    ▼                      │
                               Node 6                      │
                               Redis GET                   │
                               event detail                │
                                    │                      │
                                    ▼                      │
                               Node 7                      │
                               IF: Cache Hit?              │
                               ├─ SIM → Node 8 (parse)    │
                               └─ NÃO → Node 9 (API)      │
                                        → Node 10 (SET)    │
                                    │                      │
                                    ├──────────────────────┤
                                    ▼                      ▼
                               Node 11                  Node 11
                               Redis GET events:list    (mesmo)
                                    │
                                    ▼
                               Node 12
                               IF: Cache Hit?
                               ├─ SIM → Node 13 (parse)
                               └─ NÃO → Node 14 (API)
                                        → Node 15 (SET)
                                    │
                                    ▼
                               Node 16
                               Merge dados
                                    │
                                    ▼
                               Node 17
                               Build System Prompt
                               (inclui resumo conversa)
                                    │
                                    ▼
                               Node 18
                               AI Agent (Roberto)
```

### Descrição de cada node

#### Node 1 — Trigger (WhatsApp Webhook)
- **Tipo:** Webhook / WhatsApp Trigger
- **Função:** Recebe mensagem do lead via WhatsApp API oficial
- **Output:** payload com `phone`, `message`, `contact_id`, `metadata`

#### Node 2 — Extract Contact Info
- **Tipo:** Set / Code
- **Função:** Extrai dados do contato — `phone`, `name`, `event_tag` (se houver). Resolve o mapeamento `tag → event_id` (via lookup table no n8n ou campo do contato)
- **Output:** `{ phone, name, event_tag, event_id, has_tag: true/false }`

#### Node 3 — Redis GET: Conversation Summary
- **Tipo:** Redis node (GET)
- **Chave:** `roberto:conv:{{ phone }}:summary`
- **Output:** string JSON com resumo da conversa anterior, ou `null` (lead novo)
- **Nota:** Roda **sempre**, antes de qualquer outra lógica. Se o lead já conversou com o Roberto antes, o resumo traz o contexto completo (evento de interesse, objeções, estágio, próxima ação) sem precisar reenviar todo o histórico de mensagens

#### Node 4 — Parse Conversation Summary
- **Tipo:** Code
- **Função:** Se Redis retornou dados, faz `JSON.parse()`. Se `null`, define `conversation_summary = null` (lead novo, primeira interação)
- **Output:** `{ conversation_summary }` ou `{ conversation_summary: null }`

#### Node 5 — IF: Has Event Tag?
- **Tipo:** IF
- **Condição:** `has_tag === true`
- **SIM:** segue para Node 6 (buscar detalhe do evento)
- **NÃO:** pula para Node 11 (buscar apenas listagem)
- **Nota:** Se o `conversation_summary` já contém `event_id` (lead retornando), pode usar esse ID em vez da tag

#### Node 6 — Redis GET: Event Detail
- **Tipo:** Redis node (GET)
- **Chave:** `roberto:events:{{ event_id }}:detail`
- **Output:** string JSON ou `null`

#### Node 7 — IF: Cache Hit? (Event Detail)
- **Tipo:** IF
- **Condição:** Redis retornou dados (não é `null` / vazio)
- **SIM:** segue para Node 8
- **NÃO:** segue para Node 9

#### Node 8 — Parse Cached Event Detail
- **Tipo:** Set / Code
- **Função:** Faz `JSON.parse()` do valor cached e estrutura como objeto
- **Output:** `{ event_detail, knowledge_base, offers }`

#### Node 9 — HTTP Request: GET Event Detail
- **Tipo:** HTTP Request
- **URL:** `GET /api/events/{{ event_id }}?include_offers=true`
- **Output:** resposta completa da API com KB + ofertas

#### Node 10 — Redis SET: Event Detail
- **Tipo:** Redis node (SET)
- **Chave:** `roberto:events:{{ event_id }}:detail`
- **Valor:** `JSON.stringify(resposta da API)`
- **TTL:** 3600 (1 hora)
- **Output:** passa os dados adiante (mesmo output do Node 9)

#### Node 11 — Redis GET: Events List
- **Tipo:** Redis node (GET)
- **Chave:** `roberto:events:list`
- **Output:** string JSON ou `null`
- **Nota:** Este node é alcançado por **ambos** os branches (com e sem tag)

#### Node 12 — IF: Cache Hit? (Events List)
- **Tipo:** IF
- **Condição:** Redis retornou dados (não é `null` / vazio)
- **SIM:** segue para Node 13
- **NÃO:** segue para Node 14

#### Node 13 — Parse Cached Events List
- **Tipo:** Set / Code
- **Função:** Faz `JSON.parse()` do valor cached
- **Output:** `{ events: [...] }`

#### Node 14 — HTTP Request: GET Events List
- **Tipo:** HTTP Request
- **URL:** `GET /api/events`
- **Output:** lista de eventos ativos com campos leves

#### Node 15 — Redis SET: Events List
- **Tipo:** Redis node (SET)
- **Chave:** `roberto:events:list`
- **Valor:** `JSON.stringify(resposta da API)`
- **TTL:** 3600 (1 hora)

#### Node 16 — Merge
- **Tipo:** Merge
- **Função:** Combina: resumo da conversa (se houver) + detalhe do evento (se houver) + listagem de eventos. Se o lead não tinha tag, `event_detail` será `null`. Se é lead novo, `conversation_summary` será `null`
- **Output:** `{ conversation_summary, event_detail, events_list, has_tag }`

#### Node 17 — Build System Prompt
- **Tipo:** Code
- **Função:** Monta o system prompt dinâmico baseado nos dados coletados. O resumo da conversa é injetado no início para situar o agente antes de qualquer ação
- **Lógica:**
  ```javascript
  let prompt = INSTRUCOES_BASE;

  // Contexto da conversa (se existir)
  if (conversation_summary) {
    prompt += `\n## Contexto da Conversa (seu resumo anterior)\n`;
    prompt += `Lead: ${conversation_summary.lead_name}\n`;
    prompt += `Evento de interesse: ${conversation_summary.event_interest}\n`;
    prompt += `Estágio: ${conversation_summary.stage}\n`;
    prompt += `Dados do lead: ${conversation_summary.key_facts}\n`;
    prompt += `Objeções já levantadas: ${conversation_summary.objections_raised.join(', ')}\n`;
    prompt += `Argumentos já usados: ${conversation_summary.arguments_used.join(', ')}\n`;
    prompt += `Nível de interesse: ${conversation_summary.interest_level}\n`;
    prompt += `Próxima ação planejada: ${conversation_summary.next_action}\n`;
    prompt += `Interações anteriores: ${conversation_summary.interaction_count}\n`;
    prompt += `\nIMPORTANTE: Retome a conversa de onde parou. NÃO repita argumentos já usados. NÃO peça informações que já tem.\n`;
  }

  // Modo de operação
  if (has_tag && event_detail) {
    prompt += `\n## Modo de operação\nSeu foco é vender o evento: ${event_detail.nome}.\n`;
    prompt += `\n## Evento Principal\n${event_detail.knowledge_base}\n`;
    prompt += `\n## Ofertas Disponíveis\n${formatOffers(event_detail.offers)}\n`;
  } else if (conversation_summary?.event_id) {
    // Lead retornando sem tag mas com evento identificado antes
    prompt += `\n## Modo de operação\nO lead já demonstrou interesse em ${conversation_summary.event_interest}. Retome a venda.\n`;
  } else {
    prompt += `\n## Modo de operação\nDescubra o interesse do lead antes de vender.\n`;
  }

  prompt += `\n## Eventos Ativos\n${formatEventsList(events_list)}\n`;
  return prompt;
  ```

#### Node 18 — AI Agent Node (Roberto)
- **Tipo:** AI Agent (LangChain / OpenAI)
- **System Prompt:** output do Node 17
- **Modelo:** OpenAI (modelo a definir)
- **Memory:** mensagem atual apenas (o resumo no Redis substitui o histórico completo)
- **Tools configuradas:**
  - `buscar_evento` — sub-workflow que carrega detalhe completo de um evento
  - `salvar_resumo` — atualiza o resumo da conversa no Redis (ver abaixo)
  - `agendar_call_closer` — agenda call com closer humano (ver Passo 7)
  - Outras tools do Roberto (CRM ClickUp, etc.)
- **Instrução no prompt sobre resumo:** "Ao final de CADA interação, use a tool `salvar_resumo` para atualizar seu resumo da conversa. Inclua: dados do lead descobertos, evento de interesse, objeções levantadas, argumentos usados, nível de interesse, e qual deve ser sua próxima ação."

### Sub-workflow: Tool `buscar_evento`

Chamada pelo agente quando precisa de KB completa de um evento que não está no contexto.

```
Node T1          Node T2             Node T3            Node T4
Recebe      →    Redis GET      →    IF: Hit?      →   [branch]
event_id         event detail        ├─ SIM → T5 (parse + return)
                                     └─ NÃO → T6 (API)
                                               → T7 (Redis SET)
                                               → T8 (return)
```

#### Node T1 — Input
- **Tipo:** Workflow Tool Input
- **Parâmetro:** `event_id` (string) — recebido do agente
- **Descrição para o agente:** "Busca informações completas sobre um evento específico, incluindo conteúdo detalhado, preços, ofertas e links de pagamento. Use quando o lead demonstrar interesse em um evento."

#### Node T2 — Redis GET: Event Detail
- **Tipo:** Redis node (GET)
- **Chave:** `roberto:events:{{ event_id }}:detail`

#### Node T3 — IF: Cache Hit?
- **Tipo:** IF
- **Condição:** Redis retornou dados

#### Node T5 — Parse + Return (cache hit)
- **Tipo:** Code → Workflow Tool Output
- **Função:** Parse JSON cached, formata e retorna ao agente

#### Node T6 — HTTP Request: GET Event Detail
- **Tipo:** HTTP Request
- **URL:** `GET /api/events/{{ event_id }}?include_offers=true`

#### Node T7 — Redis SET
- **Tipo:** Redis node (SET)
- **Chave:** `roberto:events:{{ event_id }}:detail`
- **TTL:** 3600

#### Node T8 — Return (cache miss)
- **Tipo:** Workflow Tool Output
- **Função:** Retorna dados da API ao agente

### Sub-workflow: Tool `salvar_resumo`

Chamada pelo agente **ao final de cada interação** para persistir o contexto da conversa.

```
Node S1          Node S2
Recebe      →    Redis SET
resumo JSON      conv:{phone}:summary (TTL 48h)
```

#### Node S1 — Input
- **Tipo:** Workflow Tool Input
- **Parâmetros recebidos do agente:**
  - `lead_phone` (string)
  - `lead_name` (string)
  - `event_interest` (string) — nome do evento de interesse, ou "indefinido"
  - `event_id` (string) — ID do evento, ou `null`
  - `stage` (string) — estágio da conversa: `discovery`, `presenting`, `objection_handling`, `closing`, `follow_up`, `escalated_to_closer`
  - `key_facts` (string) — dados do lead: faturamento, regime, segmento, nº funcionários, etc.
  - `objections_raised` (array de strings) — objeções já levantadas
  - `arguments_used` (array de strings) — argumentos já apresentados
  - `interest_level` (string) — `alto`, `medio`, `baixo`
  - `next_action` (string) — o que fazer na próxima interação
  - `interaction_count` (number) — incrementa a cada interação
  - `last_interaction` (string) — timestamp ISO
- **Descrição para o agente:** "Salva o resumo atualizado da conversa com o lead. OBRIGATÓRIO ao final de cada interação. Inclua todos os campos com as informações mais recentes."

#### Node S2 — Redis SET
- **Tipo:** Redis node (SET)
- **Chave:** `roberto:conv:{{ lead_phone }}:summary`
- **Valor:** `JSON.stringify(todos os campos recebidos)`
- **TTL:** 172800 (48 horas)

### Sub-workflow: Tool `agendar_call_closer`

Chamada pelo agente como última opção quando o lead está em cima do muro. **Usa o resumo da conversa do cache** para montar o briefing do closer automaticamente — o agente não precisa repassar manualmente todos os dados.

```
Node C1          Node C2            Node C3           Node C4
Recebe      →    Redis GET     →    Monta         →   Envia link
event_id +       conv summary       briefing           + retorna
lead_phone       (enriquece)        (descrição)        confirmação
```

#### Node C1 — Input
- **Tipo:** Workflow Tool Input
- **Parâmetros recebidos do agente:**
  - `lead_phone` (string) — telefone do lead
  - `lead_name` (string) — nome do lead
  - `event_name` (string) — evento de interesse
  - `closing_reason` (string) — por que está escalando ("lead hesitante após 3 tentativas de fechamento", etc.)
- **Descrição para o agente:** "Agenda uma call entre o lead e um especialista comercial. Use APENAS como última opção, quando você já esgotou argumentos e o lead está em cima do muro."
- **Nota:** Os demais dados (objeções, argumentos usados, resumo completo) são buscados automaticamente do cache no Node C2 — o agente passa apenas o mínimo necessário

#### Node C2 — Redis GET: Conversation Summary
- **Tipo:** Redis node (GET)
- **Chave:** `roberto:conv:{{ lead_phone }}:summary`
- **Função:** Busca o resumo completo da conversa para montar o briefing. Como o agente já salvou o resumo via `salvar_resumo`, todos os dados estarão aqui: objeções, argumentos, key_facts, interest_level, interaction_count

#### Node C3 — Build Briefing + Enviar Link
- **Tipo:** Code
- **Função:** Monta a descrição do evento do Google Calendar com o briefing completo e envia o link de agendamento para o lead via WhatsApp
- **Link de agendamento:** variável de ambiente `CLOSER_BOOKING_URL` (Google Calendar appointment schedule — disponibilidade já configurada no link)
- **Briefing gerado para a descrição do evento:**
  ```
  📋 BRIEFING PARA CLOSER — Agente Roberto

  Lead: {{ lead_name }}
  Telefone: {{ lead_phone }}
  Evento de interesse: {{ event_name }}
  Nível de interesse: {{ summary.interest_level }}
  Interações anteriores: {{ summary.interaction_count }}

  📊 Dados do lead:
  {{ summary.key_facts }}

  🔴 Objeções levantadas:
  {{ summary.objections_raised (lista) }}

  🟢 Argumentos já utilizados:
  {{ summary.arguments_used (lista) }}

  ⚠️ Motivo da escalação:
  {{ closing_reason }}

  💬 Próxima ação sugerida pelo agente:
  {{ summary.next_action }}
  ```

#### Node C4 — Return
- **Tipo:** Workflow Tool Output
- **Função:** Retorna confirmação ao agente de que o link foi enviado, para que o Roberto faça o handoff verbal

---

## Passo a Passo (resumo lógico)

### Passo 1 — Trigger e identificação da origem

Quando o lead envia mensagem, o n8n recebe via webhook do WhatsApp, extrai dados do contato e verifica se existe uma **tag de evento** associada (vinda do formulário de captação):

- **Com tag** → resolve `tag → event_id`, segue para o passo 2
- **Sem tag** → pula para o passo 3

### Passo 2 — Carregar detalhe do evento do lead (com cache)

1. Redis GET `roberto:events:{id}:detail`
2. **HIT** → usa dados do cache
3. **MISS** → chama `GET /api/events/:id?include_offers=true` → armazena no Redis (TTL 1h) → usa dados retornados

Retorna: `knowledge_base` + dados estruturados + ofertas/preços/links.

> A tag mapeia para um `event_id`. O mapeamento tag → ID pode ser mantido no próprio admin ou em variável de ambiente do n8n.

### Passo 3 — Carregar listagem de eventos (com cache, sempre)

1. Redis GET `roberto:events:list`
2. **HIT** → usa dados do cache
3. **MISS** → chama `GET /api/events` → armazena no Redis (TTL 1h) → usa dados retornados

Retorna: todos os eventos ativos com `nome`, `data`, `status`, `vagas_restantes`, `resumo`. Em leads com tag, este passo roda **em paralelo** ao passo 2.

### Passo 4 — Montagem do system prompt

O n8n monta o system prompt de acordo com a origem do lead:

**Com tag (veio do formulário):**

```
[Instruções base do Roberto — personalidade, regras, tom]

## Modo de operação
Você já sabe qual evento esse lead quer. Seu foco é vender o
evento principal. Apresente-se, confirme o interesse e conduza
a venda.

## Evento Principal (seu foco de venda)
[knowledge_base do evento + preços/links das ofertas]

## Outros Eventos Ativos
[listagem leve de todos os eventos — resumo por evento]
```

**Sem tag (contato direto):**

```
[Instruções base do Roberto — personalidade, regras, tom]

## Modo de operação
Você não sabe qual evento esse lead quer. Antes de vender,
faça discovery: entenda o perfil, o momento do negócio e o
que o lead busca. Com base nas respostas, recomende o evento
mais aderente. Só aprofunde na venda depois de identificar o
interesse — use a tool "buscar_evento" para carregar o
conhecimento completo do evento escolhido.

## Eventos Ativos
[listagem leve de todos os eventos — resumo por evento]
```

### Passo 5 — Conversa com o lead

**Com tag — venda direta:**

1. Roberto se apresenta e confirma interesse no evento
2. Conduz a venda usando o KB completo e preços que já estão no contexto
3. Responde objeções, apresenta preços, argumentos, condições

**Sem tag — discovery primeiro:**

1. Roberto se apresenta e faz perguntas para mapear o lead:
   - Qual o segmento e momento do negócio
   - Como conheceu a Ecommerce Puro
   - O que está buscando resolver
2. Cruza o perfil com a listagem resumida
3. Recomenda o evento mais aderente (ou mais de um)
4. Quando o lead demonstra interesse → chama a tool do passo 6
5. Com o KB carregado, conduz a venda com profundidade

### Passo 6 — Tool: buscar_evento (com cache)

Sub-workflow chamado pelo agente. Acionado em dois cenários:

- **Sem tag**: quando Roberto identifica qual evento o lead quer (obrigatório antes de vender)
- **Com tag**: quando o lead pede detalhes sobre um evento **diferente** do original

**Funcionamento:**

1. Recebe `event_id` do agente
2. Redis GET `roberto:events:{id}:detail`
3. **HIT** → retorna dados do cache ao agente
4. **MISS** → chama `GET /api/events/:id?include_offers=true` → Redis SET (TTL 1h) → retorna ao agente

---

## Passo 7 — Escalação para closer humano (última opção)

Quando o Roberto esgota seus recursos de venda e identifica que o lead está **em cima do muro** — interessado mas não converte — ele pode oferecer agendar uma call com um especialista do time comercial ([[Bruno Grando Allage|Allage]]).

### Quando acionar

Esta é **a última carta** do Roberto. Só deve ser acionada quando:

1. O lead demonstrou interesse claro em um evento (fez perguntas, pediu detalhes)
2. Roberto já apresentou argumentos, respondeu objeções e ofereceu condições
3. O lead não recusou — está hesitando ("vou pensar", "não sei", "preciso ver")
4. Não houve progresso após 2-3 tentativas de fechamento

**NÃO acionar quando:**
- Lead disse "não" claramente → respeitar
- Lead acabou de chegar → ainda em discovery
- Lead perguntou preço e não respondeu → tentar follow-up primeiro
- Roberto ainda tem argumentos/objeções não usados → esgotar antes

### Como funciona

Roberto usa a tool `agendar_call_closer` que:

1. Coleta do lead: **nome completo** e **melhor horário** (preferência de dia/turno)
2. Gera o link de agendamento do Google Calendar do time de closers para o lead clicar e escolher o horário disponível
3. Insere na **descrição do evento agendado** um briefing automático com:
   - Nome e telefone do lead
   - Evento de interesse
   - Objeções levantadas durante a conversa
   - Argumentos já utilizados pelo Roberto
   - Nível de interesse percebido (alto/médio)
   - Resumo da conversa (pontos-chave)

### Frases de transição (Roberto → closer)

- "Entendo que é uma decisão importante. Que tal conversar com um dos nossos especialistas? Ele pode te ajudar com as dúvidas mais específicas do seu negócio."
- "Olha, acho que o melhor caminho pra você é bater um papo rápido com um dos nossos consultores. Ele entende a fundo o conteúdo do evento e pode te mostrar como se aplica ao seu caso."
- "Vou te passar o link pra agendar uma conversa com nosso time. São 15-20 minutos, sem compromisso, e você tira todas as dúvidas."

### Sub-workflow: Tool `agendar_call_closer`

```
Node C1          Node C2            Node C3           Node C4
Recebe      →    Monta         →    Envia link   →    Retorna
dados do         briefing           de booking        confirmação
agente           (descrição)        ao lead           ao agente
```

#### Node C1 — Input
- **Tipo:** Workflow Tool Input
- **Parâmetros recebidos do agente:**
  - `lead_name` (string) — nome do lead
  - `lead_phone` (string) — telefone
  - `event_name` (string) — evento de interesse
  - `objections` (string) — objeções levantadas
  - `arguments_used` (string) — argumentos já apresentados
  - `conversation_summary` (string) — resumo da conversa
  - `interest_level` (string) — "alto" ou "médio"
- **Descrição para o agente:** "Agenda uma call entre o lead e um especialista comercial. Use APENAS como última opção, quando você já esgotou argumentos e o lead está em cima do muro. Preencha todos os campos com informações da conversa."

#### Node C2 — Build Briefing
- **Tipo:** Code
- **Função:** Monta a descrição do evento do Google Calendar com todas as informações do lead:
  ```
  📋 BRIEFING PARA CLOSER — Agente Roberto

  Lead: {{ lead_name }}
  Telefone: {{ lead_phone }}
  Evento de interesse: {{ event_name }}
  Nível de interesse: {{ interest_level }}

  🔴 Objeções levantadas:
  {{ objections }}

  🟢 Argumentos já utilizados:
  {{ arguments_used }}

  💬 Resumo da conversa:
  {{ conversation_summary }}
  ```

#### Node C3 — Envia link de agendamento
- **Tipo:** Code / Send Message
- **Função:** Envia o link de booking do Google Calendar para o lead via WhatsApp
- **Link:** URL de agendamento do time de closers (configurável como variável de ambiente no n8n)
- **Nota:** A disponibilidade já está configurada no próprio link de agendamento — o Roberto não precisa verificar horários

#### Node C4 — Return
- **Tipo:** Workflow Tool Output
- **Função:** Retorna confirmação ao agente de que o link foi enviado, para que o Roberto encerre a tentativa de venda direta e faça o handoff verbal

### Dados de referência — Decay de conversão por tempo parado

O tempo é inimigo da conversão. Essa tabela justifica por que a escalação deve ser rápida quando o lead empacou:

| Dias parado | Conversão vs lead fresco | Comportamento típico |
|---|---|---|
| **0-2 dias** | 100% (baseline) | Interesse ativo, responde rápido |
| **7 dias** | 25-35% | Interesse esfriando, já pesquisou alternativas |
| **14 dias** | 10-15% | Provavelmente esqueceu, precisa ser relembrado |
| **21 dias** | 5-8% | Lead praticamente frio, alto índice de não-resposta |
| **28 dias** | 2-4% | Lead morto na prática |

> Se o lead está empacado há mais de 7 dias e o Roberto não conseguiu converter, a escalação para closer é a melhor chance de recuperação antes que a conversão caia para <15%.

---

## O que vai no campo `knowledge_base`

O campo `knowledge_base` é editado pelo time comercial diretamente no admin. Deve conter **apenas conteúdo qualitativo** — o que a API não provê em campos estruturados:

1. **Público-alvo ideal** — perfil detalhado, momento do negócio, segmento, quem NÃO é o público
2. **Conteúdo por módulo** — o que o participante vai aprender, sessão por sessão
3. **Dores que resolve** — problemas concretos e situações que o evento endereça
4. **Argumentos de venda** — racionais (ROI, dados, cases) e emocionais (transformação, comunidade, urgência)
5. **Dados e provas sociais** — números de edições anteriores, depoimentos, resultados de alunos
6. **Objeções e respostas** — formato Q&A: `Objeção: "..." → Resposta: "..."`
7. **Frases-chave** — separadas por momento da conversa (abertura, aquecimento, fechamento, follow-up)
8. **Cupons condicionais** — apenas quando o cupom está atrelado a um argumento de venda específico: ex.: `Se o lead for aluno do Plus: "Tenho um benefício exclusivo pra você — cupom PLUS15"`

> **Não colocar no KB:** preços, datas, vagas, links de pagamento, condições de parcelamento. Esses dados vêm da API e são mantidos automaticamente.

---

## Resumo dos cenários

| | Com formulário | Sem formulário |
|---|---|---|
| **KB completa no início** | Sim — via `GET /api/events/:id` | Não |
| **Listagem leve** | Sim | Sim |
| **Preços e links** | Sim — via `include_offers` | Não (carregados na tool) |
| **Primeira ação** | Venda direta | Discovery |
| **Tool passo 6** | Só se pedir outro evento | Sempre (após identificar interesse) |
| **Instrução no prompt** | "Seu foco é o evento X" | "Descubra o interesse do lead antes de vender" |

---

## Manutenção

| Ação                                                        | Quem                            | Quando                              |                                   |
| ----------------------------------------------------------- | ------------------------------- | ----------------------------------- | --------------------------------- |
| Criar e preencher campo `knowledge_base` de um novo evento  | Time de inovação                | Ao criar evento no admin            |                                   |
| Atualizar KB com novos argumentos, objeções, provas sociais | Time de inovação                | Conforme estratégia de venda evolui |                                   |
| Gerenciar ofertas e preços                                  | Time comercial (via Guru/admin) | Ao criar/alterar lotes              |                                   |
| Configurar mapeamento tag → event_id no n8n                 | [[Kauan Millarch]]              | Ao ativar evento novo               |                                   |
| Configurar tool `buscar_evento` no agente                   | [[Kauan Millarch]]              | Uma vez (reuso por evento)          |                                   |
| Implementar job de sync Guru → admin                        | [[Luiz André Mendes\|André]]    |                                     | Planejado — elimina chamada dupla |

---
**See also:** [[Agente Roberto (Comercial)]] | [[Kauan Millarch]]
