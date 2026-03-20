# Supabase — Agente Roberto (Comercial)

> Todas as tabelas usam o prefixo `roberto_` para isolamento total no projeto Ecommerce Puro.
> A instância Supabase é a mesma usada pela Gabi — apenas as tabelas são separadas.

---

## Visão Geral

| Tabela | Propósito | Fase de criação |
|---|---|---|
| `roberto_leads` | Registro central de leads | Fase 1 |
| `roberto_mensagens` | Log completo de conversas | Fase 1 |
| `roberto_custos` | Custo por execução (OpenAI + ElevenLabs) | Fase 1 |
| `roberto_metricas` | Métricas diárias do agente | Fase 1 |
| `roberto_perfis_stats` | Analytics de perfis comportamentais | Fase 1 |
| `roberto_vacuo` | Estado do método de follow-up automático | Fase 2 |
| `roberto_resumos` | Resumos de conversa (tool `resumo_lead`) | Fase 6 |

---

## Tabelas

### `roberto_leads`

Registro principal de cada lead que interagiu com a Roberto. Uma linha por telefone.

```sql
CREATE TABLE roberto_leads (
  telefone              TEXT PRIMARY KEY,
  nome                  TEXT,
  email                 TEXT,
  evento_interesse      TEXT,
  origem_typeform       TEXT,
  status                TEXT NOT NULL DEFAULT 'BASE'
                        CHECK (status IN (
                          'BASE', 'EM CONTATO', 'INTERESSADO',
                          'OFERTA_ENVIADA', 'COMPROU', 'PERDIDO', 'HANDOFF'
                        )),
  perfil_comportamental TEXT
                        CHECK (perfil_comportamental IN (
                          'tubarao', 'aguia', 'lobo', 'gato', 'neutro'
                        )),
  clickup_task_id       TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

| Coluna | Tipo | Descrição |
|---|---|---|
| `telefone` | TEXT PK | Número no formato internacional (ex: `5541999999999`) — chave Redis e Supabase |
| `nome` | TEXT | Nome coletado pela Roberto durante a conversa |
| `email` | TEXT | Email coletado — obrigatório para envio de confirmação pelo Guru |
| `evento_interesse` | TEXT | Nome do evento que o lead demonstrou interesse |
| `origem_typeform` | TEXT | Identificador do Typeform de origem (para rastrear qual campanha) |
| `status` | TEXT | Estágio atual no funil de vendas |
| `perfil_comportamental` | TEXT | Perfil detectado após 8+ msgs ou 800+ chars da conversa |
| `clickup_task_id` | TEXT | ID da task no ClickUp — linkado na Fase 2 |
| `created_at` | TIMESTAMPTZ | Primeiro contato do lead |
| `updated_at` | TIMESTAMPTZ | Última atualização (auto-trigger) |

**Nodes N8N que usam essa tabela:**
- `buscar_lead_crm` — SELECT WHERE telefone
- `atualizar_status_lead` — UPDATE status
- `atualizar_lead_handoff` — UPDATE status='HANDOFF'
- `atualizar_lead_perdido` — UPDATE status='PERDIDO'
- `confirmar_compra_lead` — UPDATE status='COMPROU'

---

### `roberto_mensagens`

Log completo de todas as mensagens trocadas — inbound (do lead) e outbound (da Roberto).

```sql
CREATE TABLE roberto_mensagens (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone   TEXT    NOT NULL REFERENCES roberto_leads(telefone),
  direcao    TEXT    NOT NULL CHECK (direcao IN ('inbound', 'outbound')),
  conteudo   TEXT,
  tipo_midia TEXT    NOT NULL CHECK (tipo_midia IN (
                       'texto', 'audio_entrada', 'audio_saida', 'imagem'
                     )),
  wamid      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | Identificador único da mensagem |
| `telefone` | TEXT FK | FK para `roberto_leads.telefone` |
| `direcao` | TEXT | `inbound` = lead enviou · `outbound` = Roberto enviou |
| `conteudo` | TEXT | Texto da mensagem (ou transcrição do áudio / descrição da imagem) |
| `tipo_midia` | TEXT | Tipo de mídia da mensagem |
| `wamid` | TEXT | WhatsApp Message ID — útil para rastreabilidade e dedup de eventos duplicados |
| `created_at` | TIMESTAMPTZ | Timestamp da mensagem |

**Nodes N8N que usam essa tabela:**
- `salvar_mensagem_supabase` — INSERT após cada interação

---

### `roberto_custos`

Rastreamento de custo de API por execução do agente. Permite calcular custo por lead e por período.

```sql
CREATE TABLE roberto_custos (
  id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone          TEXT    REFERENCES roberto_leads(telefone),
  agent_id          TEXT    NOT NULL DEFAULT 'Roberto-Comercial',
  modelo            TEXT,
  prompt_tokens     INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  elevenlabs_tokens INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | — |
| `telefone` | TEXT FK | Lead que gerou o custo |
| `agent_id` | TEXT | Sempre `'Roberto-Comercial'` — facilita queries multi-agente |
| `modelo` | TEXT | Modelo OpenAI usado (ex: `gpt-5.1`, `gpt-4.1-mini`, `whisper-1`) |
| `prompt_tokens` | INTEGER | Tokens de entrada OpenAI |
| `completion_tokens` | INTEGER | Tokens de saída OpenAI |
| `elevenlabs_tokens` | INTEGER | Caracteres cobrados pelo ElevenLabs TTS |
| `created_at` | TIMESTAMPTZ | Momento da execução |

**Nodes N8N que usam essa tabela:**
- `atualizar_custos` — INSERT após resposta do agente (tokens OpenAI)
- `custo_elevenlabs` — INSERT após geração de áudio (caracteres ElevenLabs)

---

### `roberto_metricas`

Métricas agregadas por dia. Uma linha por dia — permite UPSERT ao longo do dia.

```sql
CREATE TABLE roberto_metricas (
  id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id          TEXT    NOT NULL DEFAULT 'Roberto-Comercial',
  data              DATE    NOT NULL DEFAULT CURRENT_DATE,
  total_mensagens   INTEGER NOT NULL DEFAULT 0,
  total_conversas   INTEGER NOT NULL DEFAULT 0,
  total_conversoes  INTEGER NOT NULL DEFAULT 0,
  total_handoffs    INTEGER NOT NULL DEFAULT 0,
  total_perdidos    INTEGER NOT NULL DEFAULT 0,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agent_id, data)
);
```

| Coluna | Tipo | Descrição |
|---|---|---|
| `agent_id` | TEXT | `'Roberto-Comercial'` |
| `data` | DATE | Data da métrica (CURRENT_DATE no horário GMT-3) |
| `total_mensagens` | INTEGER | Total de mensagens processadas no dia |
| `total_conversas` | INTEGER | Total de leads únicos que interagiram no dia |
| `total_conversoes` | INTEGER | Vendas confirmadas (webhook Guru) |
| `total_handoffs` | INTEGER | Handoffs para suporte humano |
| `total_perdidos` | INTEGER | Leads com vácuo esgotado |

> **UNIQUE (agent_id, data)** permite usar `INSERT ... ON CONFLICT DO UPDATE` (UPSERT) sem precisar fazer SELECT antes.

**Nodes N8N que usam essa tabela:**
- `atualizar_metricas` — UPSERT diário após cada interação

---

### `roberto_perfis_stats`

Analytics de perfis comportamentais — quantos leads de cada tipo foram identificados,
quantos converteram, quantos foram perdidos. Orienta ajustes no script de vendas.

```sql
CREATE TABLE roberto_perfis_stats (
  perfil      TEXT    PRIMARY KEY
              CHECK (perfil IN ('tubarao', 'aguia', 'lobo', 'gato', 'neutro')),
  total       INTEGER NOT NULL DEFAULT 0,
  convertidos INTEGER NOT NULL DEFAULT 0,
  perdidos    INTEGER NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed inicial: garantir que todas as 5 linhas existam desde o início
INSERT INTO roberto_perfis_stats (perfil) VALUES
  ('tubarao'), ('aguia'), ('lobo'), ('gato'), ('neutro')
ON CONFLICT DO NOTHING;
```

| Coluna | Tipo | Descrição |
|---|---|---|
| `perfil` | TEXT PK | Identificador do perfil comportamental |
| `total` | INTEGER | Total de leads identificados como esse perfil |
| `convertidos` | INTEGER | Desse total, quantos compraram |
| `perdidos` | INTEGER | Desse total, quantos foram perdidos (vácuo esgotado) |
| `updated_at` | TIMESTAMPTZ | Auto-trigger |

**Perfis e referência:**
| Perfil | Nome comercial | Características |
|---|---|---|
| `tubarao` | Tubarão | Decidido, direto, impaciência com rodeios |
| `aguia` | Águia | Analítico, quer dados e argumentos racionais |
| `lobo` | Lobo | Influenciável por social proof, histórias de outros |
| `gato` | Gato | Indeciso, precisa de segurança e tempo |
| `neutro` | Neutro | Perfil não detectado ainda / indefinido |

**Nodes N8N que usam essa tabela:**
- Node de detecção de perfil — `UPDATE total = total + 1 WHERE perfil = $perfil`
- Webhook confirmação de venda — `UPDATE convertidos = convertidos + 1 WHERE perfil = $perfil`
- `marcar_esgotado` — `UPDATE perdidos = perdidos + 1 WHERE perfil = $perfil`

---

### `roberto_vacuo`

Estado do método de follow-up (vácuo) por lead. Uma linha por telefone — sobrescrita a cada ciclo.

```sql
CREATE TABLE roberto_vacuo (
  telefone         TEXT    PRIMARY KEY,
  tentativa        INTEGER NOT NULL DEFAULT 0,
  nome_lead        TEXT,
  clickup_task_id  TEXT,
  evento_interesse TEXT,
  status           TEXT    NOT NULL DEFAULT 'ativo'
                   CHECK (status IN ('ativo', 'cancelado', 'esgotado')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

| Coluna | Tipo | Descrição |
|---|---|---|
| `telefone` | TEXT PK | Telefone do lead em follow-up |
| `tentativa` | INTEGER | Contador de tentativas: 0 = não enviado, 1/2/3 = enviados |
| `nome_lead` | TEXT | Usado para personalizar a mensagem de follow-up |
| `clickup_task_id` | TEXT | ID da task ClickUp para atualizar status ao final |
| `evento_interesse` | TEXT | Evento em negociação — contexto para a mensagem de follow-up |
| `status` | TEXT | `ativo` = aguardando · `cancelado` = lead respondeu · `esgotado` = 3 tentativas sem resposta |

**Escalação do vácuo:**
| `tentativa` | Espera antes do envio | Tom |
|---|---|---|
| 0 → envia 1ª | 15 minutos | Casual, leve |
| 1 → envia 2ª | 1 hora | Leve urgência |
| 2 → envia 3ª | 24 horas | Direto, último contato |
| 3 → esgotado | — | Status `PERDIDO` no Supabase + ClickUp |

**Nodes N8N que usam essa tabela:**
- `cancelar_vacuo` — UPDATE status='cancelado' (executado em toda mensagem recebida)
- `buscar_vacuo` — SELECT WHERE telefone
- `criar_vacuo` — INSERT
- `resetar_vacuo` — UPDATE tentativa=0, status='ativo'
- `ler_vacuo` — SELECT estado atual antes de enviar follow-up
- `incrementar_vacuo` — UPDATE tentativa=tentativa+1
- `marcar_esgotado` — UPDATE status='esgotado'

---

### `roberto_resumos`

Resumos de sessões de conversa por lead. Substitui o anti-pattern de N8N Data Tables
usado na Gabi (`estudo_lead`), que causava fragmentação de dados.

A tool `resumo_lead` do agente consulta essa tabela para ter contexto de conversas anteriores
quando o lead retoma o contato (ex: entrou em contato dias atrás, saiu, voltou agora).

```sql
CREATE TABLE roberto_resumos (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone   TEXT    NOT NULL REFERENCES roberto_leads(telefone),
  resumo     TEXT    NOT NULL,
  estagio    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | — |
| `telefone` | TEXT FK | FK para `roberto_leads.telefone` |
| `resumo` | TEXT | Texto do resumo gerado pelo agente ao final da sessão |
| `estagio` | TEXT | Estágio do script onde a conversa parou (ex: `oferta_enviada`, `sondagem`) |
| `created_at` | TIMESTAMPTZ | Quando o resumo foi gerado |

**Nodes N8N que usam essa tabela:**
- Tool `resumo_lead` — SELECT WHERE telefone ORDER BY created_at DESC LIMIT 3
- Node pós-sessão — INSERT ao final de cada sessão de conversa

---

## Triggers — `updated_at` Automático

O Supabase não atualiza `updated_at` automaticamente. É necessário criar uma função e triggers.

```sql
-- Função reutilizável
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar nas tabelas com coluna updated_at
CREATE TRIGGER trg_roberto_leads_updated_at
  BEFORE UPDATE ON roberto_leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_roberto_vacuo_updated_at
  BEFORE UPDATE ON roberto_vacuo
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_roberto_metricas_updated_at
  BEFORE UPDATE ON roberto_metricas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_roberto_perfis_stats_updated_at
  BEFORE UPDATE ON roberto_perfis_stats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

## Indexes de Performance

```sql
-- roberto_mensagens: queries por lead + ordenação temporal
CREATE INDEX idx_roberto_mensagens_telefone   ON roberto_mensagens(telefone);
CREATE INDEX idx_roberto_mensagens_created_at ON roberto_mensagens(created_at DESC);

-- roberto_leads: filtros por funil e evento
CREATE INDEX idx_roberto_leads_status  ON roberto_leads(status);
CREATE INDEX idx_roberto_leads_evento  ON roberto_leads(evento_interesse);

-- roberto_custos: queries de custo por período
CREATE INDEX idx_roberto_custos_created_at ON roberto_custos(created_at DESC);
CREATE INDEX idx_roberto_custos_telefone   ON roberto_custos(telefone);

-- roberto_resumos: busca por lead
CREATE INDEX idx_roberto_resumos_telefone ON roberto_resumos(telefone);
```

---

## RLS (Row Level Security)

O N8N acessa o Supabase via **service role key** — que bypassa RLS por padrão.
Manter RLS desabilitado em todas as tabelas do agente para simplicidade.

```sql
ALTER TABLE roberto_leads         DISABLE ROW LEVEL SECURITY;
ALTER TABLE roberto_mensagens     DISABLE ROW LEVEL SECURITY;
ALTER TABLE roberto_custos        DISABLE ROW LEVEL SECURITY;
ALTER TABLE roberto_metricas      DISABLE ROW LEVEL SECURITY;
ALTER TABLE roberto_vacuo         DISABLE ROW LEVEL SECURITY;
ALTER TABLE roberto_resumos       DISABLE ROW LEVEL SECURITY;
ALTER TABLE roberto_perfis_stats  DISABLE ROW LEVEL SECURITY;
```

---

## Mapa Completo: Node N8N → Supabase

| Node N8N | Operação SQL | Tabela |
|---|---|---|
| `buscar_lead_crm` | `SELECT * WHERE telefone = $phone` | `roberto_leads` |
| `atualizar_status_lead` | `UPDATE SET status = $status WHERE telefone = $phone` | `roberto_leads` |
| `atualizar_lead_handoff` | `UPDATE SET status = 'HANDOFF' WHERE telefone = $phone` | `roberto_leads` |
| `atualizar_lead_perdido` | `UPDATE SET status = 'PERDIDO' WHERE telefone = $phone` | `roberto_leads` |
| `confirmar_compra_lead` | `UPDATE SET status = 'COMPROU' WHERE telefone = $phone` | `roberto_leads` |
| `salvar_mensagem_supabase` | `INSERT (telefone, direcao, conteudo, tipo_midia, wamid)` | `roberto_mensagens` |
| `atualizar_custos` | `INSERT (telefone, modelo, prompt_tokens, completion_tokens)` | `roberto_custos` |
| `custo_elevenlabs` | `INSERT (telefone, elevenlabs_tokens)` | `roberto_custos` |
| `atualizar_metricas` | `INSERT ... ON CONFLICT (agent_id, data) DO UPDATE SET total_mensagens = total_mensagens + 1` | `roberto_metricas` |
| detecção de perfil | `UPDATE SET total = total + 1, updated_at = NOW() WHERE perfil = $perfil` | `roberto_perfis_stats` |
| confirmação de venda | `UPDATE SET convertidos = convertidos + 1 WHERE perfil = $perfil` | `roberto_perfis_stats` |
| `marcar_esgotado` (perdido) | `UPDATE SET perdidos = perdidos + 1 WHERE perfil = $perfil` | `roberto_perfis_stats` |
| `cancelar_vacuo` | `UPDATE SET status = 'cancelado' WHERE telefone = $phone` | `roberto_vacuo` |
| `buscar_vacuo` | `SELECT * WHERE telefone = $phone` | `roberto_vacuo` |
| `criar_vacuo` | `INSERT (telefone, nome_lead, evento_interesse, clickup_task_id)` | `roberto_vacuo` |
| `resetar_vacuo` | `UPDATE SET tentativa = 0, status = 'ativo' WHERE telefone = $phone` | `roberto_vacuo` |
| `ler_vacuo` | `SELECT * WHERE telefone = $phone` | `roberto_vacuo` |
| `incrementar_vacuo` | `UPDATE SET tentativa = tentativa + 1 WHERE telefone = $phone` | `roberto_vacuo` |
| `marcar_esgotado` | `UPDATE SET status = 'esgotado' WHERE telefone = $phone` | `roberto_vacuo` |
| tool `resumo_lead` | `SELECT resumo, estagio, created_at WHERE telefone = $phone ORDER BY created_at DESC LIMIT 3` | `roberto_resumos` |
| pós-sessão resumo | `INSERT (telefone, resumo, estagio)` | `roberto_resumos` |

---

## Script de Criação Completo

Execute no SQL Editor do Supabase na ordem abaixo:

```sql
-- 1. Função updated_at (executar primeiro)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Tabelas (ordem respeitando FKs)
-- roberto_leads (sem dependências)
CREATE TABLE roberto_leads ( ... );  -- ver SQL completo acima

-- roberto_mensagens (depende de roberto_leads)
CREATE TABLE roberto_mensagens ( ... );

-- roberto_custos (depende de roberto_leads)
CREATE TABLE roberto_custos ( ... );

-- roberto_metricas (sem dependências)
CREATE TABLE roberto_metricas ( ... );

-- roberto_vacuo (sem dependências)
CREATE TABLE roberto_vacuo ( ... );

-- roberto_resumos (depende de roberto_leads)
CREATE TABLE roberto_resumos ( ... );

-- roberto_perfis_stats (sem dependências)
CREATE TABLE roberto_perfis_stats ( ... );

-- 3. Seed roberto_perfis_stats
INSERT INTO roberto_perfis_stats (perfil) VALUES
  ('tubarao'), ('aguia'), ('lobo'), ('gato'), ('neutro')
ON CONFLICT DO NOTHING;

-- 4. Triggers
CREATE TRIGGER trg_roberto_leads_updated_at ... ;
CREATE TRIGGER trg_roberto_vacuo_updated_at ... ;
CREATE TRIGGER trg_roberto_metricas_updated_at ... ;
CREATE TRIGGER trg_roberto_perfis_stats_updated_at ... ;

-- 5. Indexes
CREATE INDEX idx_roberto_mensagens_telefone ON roberto_mensagens(telefone);
-- ... demais indexes

-- 6. Verificação
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'roberto_%'
ORDER BY table_name;
-- Esperado: 7 linhas

SELECT * FROM roberto_perfis_stats;
-- Esperado: 5 linhas (tubarao, aguia, lobo, gato, neutro)
```
