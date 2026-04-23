# Paperclip — Brief Operacional

## O que e o Paperclip no contexto do Roberto?

Paperclip e a **camada de supervisao e controle** sobre o Roberto (agente de vendas WhatsApp). Ele funciona como um "centro de comando" onde micro agentes monitoram em tempo real as negociacoes, qualidade, erros tecnicos e metricas de vendas — dando visibilidade total para a equipe humana.

**Analogia simples:** Roberto e o vendedor. Paperclip e o gerente da loja que observa, aprova descontos especiais, e avisa a diretoria quando algo da errado.

## Onde roda

- **URL local:** http://127.0.0.1:3100 (dashboard + API)
- **Dashboard:** http://127.0.0.1:3100/PURAA/org
- **Company:** Puro Agents (slug: PURAA)
- **Database:** PostgreSQL embarcado (porta 54329)
- **Futuro:** Migrar para VPS em producao

## Arquitetura

```
Paperclip (supervisao/dashboard)
    |
    |-- HTTP bidirectional --
    |
N8N (execucao dos workflows do Roberto)
    |
    |-- Le dados de --
    |
ClickUp (CRM) + Supabase (DB) + Redis (cache)
```

- **Paperclip = orquestrador** — gerencia agentes, issues, aprovacoes
- **N8N = executor** — roda workflows, chama APIs, processa mensagens
- **Comunicacao:** Paperclip dispara webhooks no N8N; N8N chama a API REST do Paperclip

## Os 5 Agentes

### 1. CEO Agent
- **Funcao:** Supervisiona todos os micro agentes, revisa aprovacoes de desconto, escalona para equipe humana
- **Tipo:** Heartbeat (on-demand)
- **Status atual:** Pausado, instrucoes escritas (AGENTS.md, SOUL.md, HEARTBEAT.md, TOOLS.md)

### 2. Negociacao Agent
- **Funcao:** Monitora negociacoes de desconto em tempo real. Quando o lead pede preco abaixo do maximo da tabela, cria issue de aprovacao
- **Tipo:** Realtime (webhook trigger)
- **Webhook N8N:** `https://ecommercepuro.app.n8n.cloud/webhook/roberto-negociacao`
- **Status atual:** Pausado, sem instrucoes proprias

### 3. QA Agent (Quality Assurance)
- **Funcao:** Revisa qualidade das conversas do Roberto a cada 2h — multiplas perguntas por turno, linguagem errada, dados fabricados, etc.
- **Tipo:** Heartbeat (2h)
- **Webhook N8N:** `https://ecommercepuro.app.n8n.cloud/webhook/roberto-qa`
- **Status atual:** Pausado, sem instrucoes proprias

### 4. Erros Tecnicos Agent
- **Funcao:** Monitora erros de API (WABA, ElevenLabs, Supabase) a cada 30min. Alerta Slack para criticos
- **Tipo:** Heartbeat (30min)
- **Webhook N8N:** `https://ecommercepuro.app.n8n.cloud/webhook/roberto-erros`
- **Status atual:** Pausado, sem instrucoes proprias

### 5. Metricas Vendas Agent
- **Funcao:** Relatorio de funil de vendas a cada 4h — conversao, descontos, perfil comportamental, comparativos
- **Tipo:** Heartbeat (4h)
- **Webhook N8N:** `https://ecommercepuro.app.n8n.cloud/webhook/roberto-metricas`
- **Status atual:** Pausado, sem instrucoes proprias

## O que o Paperclip precisa fazer

### Prioridade 1 — Fluxo de Aprovacao de Desconto (Negociacao Agent)
O caso de uso mais critico e urgente:

1. Lead pede preco abaixo do maximo da tabela de descontos
2. N8N detecta via structured output (`preco_solicitado_lead`)
3. N8N cria issue no Paperclip (`POST /api/issues`) com prioridade urgente
4. Roberto responde ao lead: "show, deixa eu ver com meu gestor"
5. CEO Agent (ou humano no dashboard) aprova/rejeita
6. N8N faz polling a cada 30s por 10min (`GET /api/issues/:id`)
7. **Aprovado** → Roberto fecha no preco aprovado
8. **Rejeitado** → Roberto oferece maximo da tabela
9. **Timeout 10min** → Fallback: maximo da tabela + "esse e o maximo que consigo"

### Prioridade 2 — Monitoramento de Erros (Erros Tecnicos Agent)
- WABA API down (3+ erros consecutivos) → Alerta Slack
- ElevenLabs falhas → Issue no Paperclip
- Supabase timeout → Alerta Slack
- Lead sem resposta >5min → Alerta Slack critico

### Prioridade 3 — Qualidade (QA Agent)
- Validar regras do system prompt: 1 pergunta por turno, mensagens curtas, nao fabricar dados
- Verificar regras de desconto: nao oferecer antes de objecao, usar "condicao especial" em vez de "desconto"
- Relatorio a cada 2h com desvios encontrados

### Prioridade 4 — Metricas (Metricas Vendas Agent)
- Funil de conversao (BASE → COMPROU)
- Descontos aplicados (media, percentual)
- Perfil comportamental (Tubarao/Aguia/Lobo/Gato)
- Comparativo com periodo anterior
- Alerta Slack se conversao cair >30%

## Tabela de Descontos (referencia)

| Evento (Preco Cheio) | Maximo Desconto |
|---|---|
| R$ 15.000 | R$ 10.000 |
| R$ 7.500 | R$ 5.000 |
| R$ 6.000 | R$ 5.000 |
| R$ 5.000 | R$ 4.000 |
| R$ 3.000 | R$ 2.000 |

## Alertas Slack

Apenas high-urgency para evitar alert fatigue:

| Situacao | Agente | Slack? |
|---|---|---|
| Lead quer preco abaixo da tabela + "fecho agora" | Negociacao | Sim |
| WABA API down (3+ erros) | Erros Tecnicos | Sim |
| Lead sem resposta >5min | Erros Tecnicos | Sim |
| Supabase write failures | Erros Tecnicos | Sim |
| Conversao caiu >30% | Metricas | Sim |
| Desvios de qualidade | QA | Nao (so Paperclip) |
| Relatorio de metricas rotineiro | Metricas | Nao (so Paperclip) |

## Estado Atual vs Necessario

| Item | Estado | Proximo Passo |
|---|---|---|
| Company "Puro Agents" | Criada | OK |
| CEO Agent | Pausado, com instrucoes | Ativar quando workflows estiverem prontos |
| Negociacao Agent | Pausado, com instrucoes | Criar workflow N8N |
| QA Agent | Pausado, com instrucoes | Criar workflow N8N |
| Erros Tecnicos Agent | Pausado, com instrucoes | Criar workflow N8N |
| Metricas Vendas Agent | Pausado, com instrucoes | Criar workflow N8N |
| Workflows N8N | Nenhum criado | Criar 4 workflows (1 por agente) |
| Supabase `roberto_descontos` | Criada | OK |
| Slack webhook | Nao configurado | Criar canal #roberto-alertas + webhook |
| Redis lock `roberto:aprovacao:{phone}` | Definido no spec | Implementar no workflow de negociacao |

## Endpoints da API Paperclip (referencia rapida)

```
POST   /api/companies/{id}/issues          → Criar issue (aprovacao, erro, relatorio)
GET    /api/issues/{id}                     → Consultar status de uma issue
PATCH  /api/issues/{id}                     → Atualizar status (done, cancelled)
POST   /api/issues/{id}/comments            → Adicionar comentario (APROVADO R$ X)
GET    /api/issues/{id}/comments            → Ler comentarios
GET    /api/companies/{id}/agents           → Listar agentes
GET    /api/companies/{id}/issues           → Listar todas as issues
```

## Convencao de Issues

- **Status `todo`** = Pendente de aprovacao
- **Status `done`** = Aprovado (comentario: `APROVADO R$ {preco}`)
- **Status `cancelled`** = Rejeitado
- **Timeout** = Fallback automatico para maximo da tabela

## Documentos Relacionados

- Spec completo: `docs/superpowers/specs/2026-03-31-paperclip-micro-agents-design.md`
- PRD do Roberto: `PRD.md`
- System prompt: `docs/system-prompt.md`
- Regras de desconto: `docs/discount-rules.md`
