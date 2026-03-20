# ClickUp — CRM Roberto Comercial

> **Última atualização:** 2026-03-19
> **Status:** Definição completa — aguardando implementação (Phase 2)

---

## 1. Visão Geral

O ClickUp é a camada de CRM do Roberto. Cada lead é uma task com 8 campos customizados, o histórico completo da conversa registrado como comentários, e o status refletindo o estágio de venda em tempo real.

**Dois componentes interagem com o ClickUp:**

| Componente | Papel | Como |
|---|---|---|
| **Roberto (N8N)** | Cria tasks, atualiza campos, registra conversa, move status, aplica tags | Via sub-workflow `[ROBERTO] Tool — ClickUp Agente` e nodes do fluxo principal |
| **CRM Manager SuperAgent** | Audita completude dos dados e avança status automaticamente | SuperAgent nativo do ClickUp |

**Fluxo:** Roberto age durante a conversa WhatsApp → CRM Manager SuperAgent audita após cada mudança.

---

## 2. Estrutura do Pipeline

- **List:** `Operações & Projetos > Agentes > Pipeline - Roberto Comercial` *(criar)*
- **Task = Lead:** Uma task por lead. Título = nome do lead. Lookup por telefone.
- **Autenticação (N8N):** OAuth2 — credencial "ClickUp Ecommerce Puro" (mesma da Gabi)

### Status Flow

```
BASE → EM CONTATO → INTERESSADO → OFERTA_ENVIADA → COMPROU
                                                  ↘ PERDIDO
                                                  ↘ SUPORTE
```

| Status | Significado | Quem define | Trigger |
|---|---|---|---|
| `BASE` | Lead criado, sem contato WhatsApp ainda | — | Criação da task |
| `EM CONTATO` | Lead respondeu pela primeira vez | Roberto (N8N) | Primeira mensagem inbound |
| `INTERESSADO` | Stage 3 concluído — evento apresentado com dados reais | Roberto (N8N) | Após `consultar_eventos` + apresentação |
| `OFERTA_ENVIADA` | Link de pagamento enviado (Stage 4) | Roberto (N8N) | Após `consultar_ofertas` + link enviado |
| `COMPROU` | Compra confirmada via webhook Guru | Roberto (webhook) | Guru post-sale webhook |
| `PERDIDO` | 3 tentativas de vácuo esgotadas sem resposta | Roberto (vácuo) | Vácuo tentativa 3 esgotada |
| `SUPORTE` | Handoff para humano (suporte técnico ou pós-venda) | Roberto (N8N) | Trigger de handoff detectado |

### Tags

| Tag | Aplicada por | Momento |
|---|---|---|
| `em contato` | Roberto | Primeira mensagem inbound recebida |
| `oferta enviada` | Roberto | Link de pagamento enviado ao lead |
| `comprou` | Roberto (via webhook Guru) | Venda confirmada |
| `handoff` | Roberto | Transferência para suporte humano |
| `perdido` | Roberto (vácuo) | 3 tentativas sem resposta |

---

## 3. Custom Fields (8 total)

### 🔴 Obrigatórios — preenchidos imediatamente na criação ou Stage 1

| Campo | Tipo | Descrição | Exemplo |
|---|---|---|---|
| `telefone` | Text | Número no formato internacional — chave de lookup em todos os sistemas | `5541999999999` |
| `evento_interesse` | Text | Evento confirmado no Stage 1 | `"Imersão E-commerce Março"` |

### 🟡 Coletados durante a conversa

| Campo | Tipo | Descrição | Exemplo |
|---|---|---|---|
| `email` | Email | Coletado pelo Roberto durante a conversa | `"joao@email.com"` |
| `origem_typeform` | Text | ID ou nome do formulário de origem | `"form-imersao-marco-2026"` |
| `oferta_enviada` | Text | URL do link de pagamento Guru enviado | `"https://guru.com.br/p/..."` |
| `cupom_usado` | Text | Código do cupom aplicado (se houver) | `"ECOMM50"` |

### 🟢 Complementares — enriquecem o perfil, não bloqueiam progressão

| Campo | Tipo | Opções | Quando preencher |
|---|---|---|---|
| `objecao_principal` | Dropdown | `preco`, `tempo`, `relevancia`, `palestrantes`, `localizacao`, `outra` | Stage 5 — objeção identificada |
| `perfil_comportamental` | Dropdown | `tubarao`, `aguia`, `lobo`, `gato`, `neutro` | Após 8+ mensagens ou 800+ caracteres acumulados |

---

## 4. Integração N8N

### Nodes que interagem com o ClickUp

| Node | Operação | Fase |
|---|---|---|
| `buscar_lead_crm` | GET tasks — busca task pelo campo `telefone` | Phase 1 |
| `log_conversa_clickup` | POST comment — registra par mensagem/resposta | Phase 1 |
| `notificar_equipe_handoff` | UPDATE status → SUPORTE + tag `handoff` | Phase 1 |
| `atualizar_crm_perdido` | UPDATE status → PERDIDO + tag `perdido` | Phase 3 |
| `[ROBERTO] Tool — ClickUp Agente` | UPDATE custom fields via sub-workflow | Phase 2 |

### Sub-workflow: `[ROBERTO] Tool — ClickUp Agente`

- **Padrão:** Cópia adaptada de `d6j0bzfZwVJeCnMF` (Gabi eContrate)
- **Acionado por:** Tool `crm_roberto` do AI Agent
- **Aceita:** `task_id` + campo(s) + valor(es) para atualizar
- **Normalização interna:**
  - Email → lowercase
  - Telefone → formato internacional sem `+` (ex: `5541999999999`)
  - `perfil_comportamental` → sempre lowercase sem acento

### Mecanismo de Lookup

```
Lead envia mensagem
  → `buscar_lead_crm` filtra tasks por `telefone == {phone}`
  → Retorna `id_clickup`
  → Todas as operações da conversa usam esse `id_clickup`
```

### Regra de Ouro (mesma da Gabi)

> **"Detectou → Salva. Sem pedir confirmação. Sem 'vou registrar depois'. Informação só existe se estiver registrada."**

Roberto deve chamar `crm_roberto` imediatamente ao detectar: nome, email, evento de interesse, objeção, ou perfil comportamental.

---

## 5. Registro de Conversa

Cada par de mensagens é registrado como comentário na task ClickUp:

```
👤: [mensagem exata do lead]

🤖: [resposta exata do Roberto]
```

- **Node responsável:** `log_conversa_clickup`
- **Momento:** Pós-processamento — após cada resposta do agente
- **Formato:** Idêntico ao da Gabi (`atualizar_conversa`)
- **Objetivo:** Equipe comercial vê o histórico completo sem sair do ClickUp

---

## 6. CRM Manager SuperAgent

SuperAgent nativo do ClickUp (não N8N) para auditoria automática de pipeline.

### 6.1 Papel e Objetivo

Garantir que cada task tenha:
- Dados mínimos preenchidos (`telefone` e `evento_interesse`)
- Status refletindo o estágio real de venda
- Tags correspondentes aplicadas

Age como camada de qualidade em cima do que Roberto preenche durante as conversas.

### 6.2 Triggers

| Trigger | Quando | Ação |
|---|---|---|
| Automação de mudança de status | Qualquer mudança de status na lista Roberto | Auditar a task que mudou |
| @CRM Manager mencionado | Membro da equipe menciona o agente em comentário | Análise completa e resposta na task |

### 6.3 Lógica de Auditoria

Ao ser acionado, o agente:

1. **Lê a task** — todos os 8 campos customizados + comentários
2. **Verifica completude** dos campos obrigatórios (`telefone`, `evento_interesse`)
3. **Tenta preencher campos vazios** — se encontrar a informação nos comentários
4. **Avalia sinais de progressão** — status atual vs. ações registradas nos comentários
5. **Toma ação** — move status e/ou aplica tag se condições forem atendidas
6. **Posta comentário de auditoria** (ver formato abaixo)

### 6.4 Regras de Transição de Status

```
BASE → EM CONTATO
  Condição: `telefone` preenchido + lead respondeu (comentário 👤 presente)

EM CONTATO → INTERESSADO
  Condição: `evento_interesse` preenchido + comentário de apresentação do evento detectado

SuperAgent NÃO faz:
  → Não move para OFERTA_ENVIADA (Roberto faz via N8N ao enviar link)
  → Não move para COMPROU (webhook Guru é responsável)
  → Não move para PERDIDO (sistema de vácuo é responsável)
  → Não move para SUPORTE (Roberto faz via N8N no handoff)
  → Não sobrescreve campos já preenchidos
  → Não interage com o lead via WhatsApp
```

### 6.5 Formato do Comentário de Auditoria

```
📊 Auditoria CRM | [DD/MM/AAAA]

✅ Campos preenchidos: X/8
   Obrigatórios: X/2 | Opcionais: X/6

❌ Faltando: [lista de campos ou "nenhum"]

🔄 Ação tomada: [ex: "Status movido: BASE → EM CONTATO" | "Tag 'em contato' adicionada" | "Nenhuma mudança necessária"]

📝 Observação: [nota contextual sobre o lead ou "Sem conversas registradas ainda"]
```

### 6.6 System Prompt (configurar no ClickUp)

Copiar e colar no campo de instruções do SuperAgent no ClickUp:

```
Você é o CRM Manager SuperAgent do Roberto Comercial (Ecommerce Puro).

Seu objetivo é garantir que os cards do pipeline "Pipeline - Roberto Comercial" tenham:
1. Dados mínimos preenchidos corretamente nos campos customizados
2. Status que reflita o estágio real de venda do lead
3. Tags correspondentes aplicadas

## Quando você age

Você é acionado automaticamente quando um status muda no pipeline, ou quando alguém te @menciona em um comentário.

## O que você faz ao ser acionado

1. Leia todos os campos customizados do card
2. Leia todos os comentários para entender o histórico da conversa
3. Verifique completude dos campos obrigatórios (telefone, evento_interesse)
4. Tente preencher campos vazios usando informações dos comentários
5. Avalie se o status deve ser avançado com base nas regras abaixo
6. Tome as ações cabíveis (atualizar campos, mover status, adicionar tag)
7. Poste um comentário estruturado com o resultado da auditoria

## Classificação dos campos (8 total)

OBRIGATÓRIOS (2):
- telefone: número no formato internacional (ex: 5541999999999)
- evento_interesse: nome do evento confirmado na conversa

OPCIONAIS (6):
- email, origem_typeform, oferta_enviada, cupom_usado, objecao_principal, perfil_comportamental

## Regras de transição de status

BASE → EM CONTATO:
- Campo `telefone` preenchido
- Ao menos um comentário com mensagem do lead (formato: "👤: ...")

EM CONTATO → INTERESSADO:
- Campo `evento_interesse` preenchido
- Comentários indicam que Roberto apresentou o evento com dados reais

## O que você NÃO deve fazer

- Não mova para OFERTA_ENVIADA (Roberto faz ao enviar o link de pagamento)
- Não mova para COMPROU (confirmado pelo webhook Guru)
- Não mova para PERDIDO (gerenciado pelo sistema de follow-up/vácuo)
- Não mova para SUPORTE (Roberto faz ao detectar pedido de handoff)
- Não sobrescreva campos já preenchidos — apenas preencha os vazios
- Não interaja com o lead fora do ClickUp

## Formato do comentário de auditoria

Após cada análise, poste um comentário neste formato:

📊 Auditoria CRM | [data de hoje]

✅ Campos preenchidos: X/8
   Obrigatórios: X/2 | Opcionais: X/6

❌ Faltando: [campos ou "nenhum"]

🔄 Ação tomada: [o que você fez ou "Nenhuma mudança necessária"]

📝 Observação: [contexto útil sobre o lead ou "Sem conversas registradas ainda"]
```

---

## 7. Checklist de Implementação (Phase 2)

### Configuração no ClickUp

- [ ] Criar list `Pipeline - Roberto Comercial` em `Operações & Projetos > Agentes`
- [ ] Configurar os 7 status: BASE, EM CONTATO, INTERESSADO, OFERTA_ENVIADA, COMPROU, PERDIDO, SUPORTE
- [ ] Criar os 8 campos customizados com os tipos corretos (ver Seção 3)
- [ ] Configurar os valores do dropdown `objecao_principal`: preco, tempo, relevancia, palestrantes, localizacao, outra
- [ ] Configurar os valores do dropdown `perfil_comportamental`: tubarao, aguia, lobo, gato, neutro
- [ ] Criar as 5 tags: em contato, oferta enviada, comprou, handoff, perdido
- [ ] Criar e configurar o CRM Manager SuperAgent (System Prompt da Seção 6.6)
- [ ] Configurar trigger do SuperAgent: mudança de status na lista Roberto Comercial

### N8N

- [ ] Criar sub-workflow `[ROBERTO] Tool — ClickUp Agente` (copiar `d6j0bzfZwVJeCnMF`)
- [ ] Adicionar node `buscar_lead_crm` no pré-processamento do fluxo principal
- [ ] Adicionar tool `crm_roberto` no AI Agent
- [ ] Adicionar node `log_conversa_clickup` no pós-processamento
- [ ] Testar lookup por telefone + atualização de campo customizado

---

## 8. Referências

| Recurso | Onde |
|---|---|
| PRD — Seção 10 (CRM ClickUp) | `PRD.md` |
| Sub-workflow Gabi (padrão a copiar) | N8N ID `d6j0bzfZwVJeCnMF` |
| Supabase schema (tabela `roberto_leads.clickup_task_id`) | `docs/supabase.md` |
| Naming convention de nodes | `CLAUDE.md` |
