# Roberto Dashboard — Conversation Viewer Design

## Context

Managers at Ecommerce Puro need a way to monitor Roberto's (AI sales agent) conversations with leads in real-time. All conversation data already exists in Supabase — this project builds a frontend to consume and display it.

## Tech Stack

- **Framework:** Next.js 15 + React 19
- **UI:** Shadcn/ui + Tailwind CSS 4
- **Data:** Supabase JS SDK with Realtime subscriptions (WebSocket)
- **Auth:** Google OAuth (restricted to `@ecommercepuro.com.br`)
- **Theme:** Dark mode
- **Deploy:** Vercel (free tier)

## Project Structure

Standalone app inside the repo: `dashboard/` at the project root.

```
dashboard/
├── app/
│   ├── login/          # Google OAuth login page
│   ├── (dashboard)/    # Layout with sidebar
│   │   ├── page.tsx            # Home (KPIs + feed)
│   │   ├── mensagens/page.tsx  # Chat viewer
│   │   ├── leads/page.tsx      # Leads table
│   │   ├── performance/page.tsx
│   │   └── custos/page.tsx
├── components/
│   ├── sidebar.tsx
│   ├── chat/           # Chat bubble, chat list, lead card
│   ├── dashboard/      # KPI cards, animated feed
│   └── ui/             # Shadcn components
├── lib/
│   ├── supabase.ts     # Client + realtime setup
│   ├── auth.ts         # Google OAuth helpers
│   └── types.ts        # TypeScript types from Supabase
```

## Authentication

1. User accesses the app → login page with "Sign in with Google" button
2. Google OAuth validates the user
3. Check: email must end with `@ecommercepuro.com.br`
4. If valid → redirect to dashboard
5. If invalid → error message "Acesso restrito a colaboradores Ecommerce Puro"
6. Role-based access (passes/tags) → Phase 2 (for now, all authenticated users see everything)

## Data Sources

All data already exists — no schema changes needed.

| Table | Purpose in Dashboard |
|---|---|
| `roberto_mensagens` | Chat messages (id, telefone, direcao, conteudo, tipo_midia, wamid, created_at) |
| `roberto_leads` | Lead info (telefone PK, nome, email, status, perfil_comportamental, evento_interesse) |
| `event_leads` | Enriched lead data (faturamento, cargo, estado, email, utm_*, company_state) |
| `roberto_metrics` | Conversation metrics (response time, conversion tracking) |
| `roberto_costs` | API cost tracking (GPT, ElevenLabs) |
| `roberto_vacuum` | Follow-up state per lead |
| `roberto_profile_stats` | Behavioral profile analytics |
| `roberto_summaries` | Conversation summaries |

## Screens

### 1. Home (Dashboard)

**KPI Cards (top row):**
- Leads em Contato — count from `roberto_leads` with active status + daily delta
- Receita Estimada — leads with COMPROU status x event price
- Custo do Roberto — sum from `roberto_costs`
- Taxa de Conversao — COMPROU / total leads from `roberto_metrics`
- Tempo Medio de Resposta — average from `roberto_metrics`

**Animated Feed (below KPIs):**
- Pulls latest messages from `roberto_mensagens`
- Cards appear with fade-in, stay 4-5 seconds, exit with fade-out
- Shows: lead name + message preview + timestamp
- Updates in realtime — new messages enter the cycle

### 2. Mensagens (Chat Viewer)

**Three-column layout:**

**Left column — Lead list:**
- Search by name or phone
- Filters: status, behavioral profile, event
- Sort: most recent message first
- Each card: name, status badge, profile emoji, message preview, timestamp
- Urgency indicator: red dot + wait time when lead sent message without response

**Top of chat — Lead context card:**
- From `roberto_leads`: name, phone, status, behavioral profile
- From `event_leads`: email, monthly revenue, state, event interest, role
- Compact strip — must not take too much space from chat

**Right column — Chat area:**
- WhatsApp-style bubbles — lead on left (gray), Roberto on right (colored)
- Chronological order by `created_at`
- Audio messages: transcription text with microphone icon
- Timestamp on each message
- Infinite scroll up for older messages
- New messages arrive at bottom in realtime
- **Read-only** — no sending messages, monitoring only

### 3. Leads (Table)

- Columns: name, phone, status (colored badge), behavioral profile, event, monthly revenue, entry date
- Filters: status, profile, event
- Click lead → navigates to their conversation in Mensagens

### 4. Performance

- Conversion rate by pipeline stage (funnel chart)
- Average response time
- Behavioral profile distribution (donut chart)
- Vacuum effectiveness (% of leads that returned after follow-up)

### 5. Custos (Costs)

- Total cost (GPT + ElevenLabs breakdown)
- Cost per lead, per conversation, per sale
- ROI: cost vs revenue generated

## Navigation

Fixed sidebar on the left:
- Home (dashboard icon)
- Mensagens (chat icon)
- Leads (users icon)
- Performance (chart icon)
- Custos (dollar icon)

## Realtime Strategy

Supabase Realtime on all screens via WebSocket subscriptions:
- `roberto_mensagens` → new messages appear instantly in chat and home feed
- `roberto_leads` → status changes update KPIs and lead list
- `roberto_costs` → cost KPIs update automatically

## Visual Theme

Dark mode only (Phase 1):
- Background: `#0A0A0B`
- Cards/surfaces: `#18181B`
- Text: `#FAFAFA`
- Accents: green (`#22C55E`) positive, red (`#EF4444`) negative, blue (`#3B82F6`) neutral
- References: Discord, Linear, Vercel Dashboard

## Phase 2 (Future)

- Role-based access with passes/tags per user role
- Light mode toggle
- Screen refinements based on real usage feedback

## Implementation Priority

1. Project setup (Next.js + Shadcn + Supabase + Auth)
2. Sidebar + layout shell
3. Home dashboard (KPIs + animated feed)
4. Mensagens (chat viewer — core feature)
5. Leads table
6. Performance + Custos (can iterate later)
