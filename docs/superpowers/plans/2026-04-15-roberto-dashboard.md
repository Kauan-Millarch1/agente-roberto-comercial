# Roberto Dashboard Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real-time conversation monitoring dashboard for managers to track Roberto's WhatsApp interactions with leads.

**Architecture:** Next.js 15 app with Supabase for data and realtime. Shadcn/ui for components, dark theme. Google OAuth restricted to @ecommercepuro.com.br. Read-only — no message sending.

**Tech Stack:** Next.js 15, React 19, Shadcn/ui, Tailwind CSS 4, Supabase JS SDK, Google OAuth via Supabase Auth

**Spec:** `docs/superpowers/specs/2026-04-15-roberto-dashboard-design.md`

---

## Chunk 1: Project Setup + Auth + Layout

### Task 1: Scaffold Next.js Project

**Files:**
- Create: `dashboard/` (entire project directory)

- [ ] **Step 1: Create Next.js project**

```bash
cd "c:/Users/kauan.millarch_ecomm/Desktop/Projects/Agente Roberta"
npx create-next-app@latest dashboard --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --use-npm
```

- [ ] **Step 2: Verify project runs**

```bash
cd dashboard && npm run dev
```

Expected: Dev server on http://localhost:3000

- [ ] **Step 3: Commit**

```bash
git add dashboard/
git commit -m "feat(dashboard): scaffold Next.js 15 project"
```

---

### Task 2: Install Shadcn/ui + Configure Dark Theme

**Files:**
- Modify: `dashboard/tailwind.config.ts`
- Modify: `dashboard/app/globals.css`

- [ ] **Step 1: Initialize Shadcn/ui**

```bash
cd dashboard && npx shadcn@latest init
```

Select: New York style, Zinc color, CSS variables: yes

- [ ] **Step 2: Install base components we'll need**

```bash
npx shadcn@latest add button card badge input table scroll-area avatar separator tooltip
```

- [ ] **Step 3: Override CSS variables for dark theme**

In `dashboard/app/globals.css`, set the `:root` / `.dark` CSS variables:

```css
:root {
  --background: 0 0% 3.9%;        /* #0A0A0B */
  --foreground: 0 0% 98%;          /* #FAFAFA */
  --card: 0 0% 9.4%;              /* #18181B */
  --card-foreground: 0 0% 98%;
  --primary: 142 71% 45%;          /* #22C55E green */
  --primary-foreground: 0 0% 98%;
  --destructive: 0 84% 60%;        /* #EF4444 red */
  --accent: 217 91% 60%;           /* #3B82F6 blue */
}
```

Force dark mode in `dashboard/app/layout.tsx`:
```tsx
<html lang="pt-BR" className="dark">
```

- [ ] **Step 4: Verify dark theme renders**

Run dev server, confirm dark background renders at localhost:3000.

- [ ] **Step 5: Commit**

```bash
git add dashboard/
git commit -m "feat(dashboard): configure shadcn/ui with dark theme"
```

---

### Task 3: Supabase Client + TypeScript Types

**Files:**
- Create: `dashboard/lib/supabase.ts`
- Create: `dashboard/lib/types.ts`
- Create: `dashboard/.env.local`

- [ ] **Step 1: Install Supabase SDK**

```bash
cd dashboard && npm install @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 2: Create environment file**

Create `dashboard/.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=<from supabase project>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase project>
```

Note: Get values from Supabase dashboard → Settings → API. Never commit this file.

- [ ] **Step 3: Create Supabase browser client**

Create `dashboard/lib/supabase.ts`:

```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 4: Create TypeScript types matching Supabase schema**

Create `dashboard/lib/types.ts`:

```typescript
export type LeadStatus =
  | "BASE"
  | "EM CONTATO"
  | "INTERESSADO"
  | "OFERTA_ENVIADA"
  | "COMPROU"
  | "PERDIDO"
  | "HANDOFF";

export type BehavioralProfile =
  | "tubarao"
  | "aguia"
  | "lobo"
  | "gato"
  | "neutro";

export type MediaType = "texto" | "audio_entrada" | "audio_saida" | "imagem";

export interface Lead {
  phone: string;
  name: string | null;
  email: string | null;
  event_interest: string | null;
  status: LeadStatus;
  behavioral_profile: BehavioralProfile | null;
  clickup_task_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  phone: string;
  direction: "inbound" | "outbound";
  content: string | null;
  media_type: MediaType;
  wamid: string | null;
  created_at: string;
}

export interface EventLead {
  id: string;
  product: string;
  email: string;
  full_name: string;
  company_name: string | null;
  role: string | null;
  phone: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  company_state: string | null;
  monthly_revenue: string | null;
  form_submitted_at: string | null;
  status: string;
}

export interface Cost {
  id: string;
  phone: string | null;
  model: string | null;
  prompt_tokens: number;
  completion_tokens: number;
  elevenlabs_tokens: number;
  created_at: string;
}

export interface Metric {
  id: string;
  agent_id: string;
  data: string;
  total_mensagens: number;
  total_conversas: number;
  total_conversoes: number;
  total_handoffs: number;
  total_perdidos: number;
  updated_at: string;
}

export interface ProfileStat {
  profile: BehavioralProfile;
  total: number;
  converted: number;
  lost: number;
}

export interface Vacuum {
  phone: string;
  attempt: number;
  lead_name: string | null;
  status: "ativo" | "cancelado" | "esgotado";
  last_context: string | null;
  updated_at: string;
}
```

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/
git commit -m "feat(dashboard): add supabase client and typescript types"
```

---

### Task 4: Google OAuth Authentication

**Files:**
- Create: `dashboard/lib/auth.ts`
- Create: `dashboard/app/login/page.tsx`
- Create: `dashboard/app/auth/callback/route.ts`
- Create: `dashboard/middleware.ts`

**Prerequisites:** Enable Google OAuth provider in Supabase dashboard → Authentication → Providers → Google. Set redirect URL to `http://localhost:3000/auth/callback`.

- [ ] **Step 1: Create auth helpers**

Create `dashboard/lib/auth.ts`:

```typescript
import { createClient } from "./supabase";

const ALLOWED_DOMAIN = "ecommercepuro.com.br";

export async function signInWithGoogle() {
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  if (error) throw error;
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
}

export function isAllowedEmail(email: string): boolean {
  return email.endsWith(`@${ALLOWED_DOMAIN}`);
}
```

- [ ] **Step 2: Create OAuth callback route**

Create `dashboard/app/auth/callback/route.ts`:

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();

      if (user?.email?.endsWith("@ecommercepuro.com.br")) {
        return NextResponse.redirect(`${origin}/`);
      }

      // Email not allowed — sign out and redirect to login with error
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/login?error=domain`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
```

- [ ] **Step 3: Create login page**

Create `dashboard/app/login/page.tsx`:

```tsx
"use client";

import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { signInWithGoogle } from "@/lib/auth";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Roberto Dashboard</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Painel de acompanhamento do Agente Roberto
          </p>
        </div>

        {error === "domain" && (
          <p className="text-sm text-destructive">
            Acesso restrito a colaboradores Ecommerce Puro
          </p>
        )}
        {error === "auth" && (
          <p className="text-sm text-destructive">
            Erro na autenticação. Tente novamente.
          </p>
        )}

        <Button onClick={signInWithGoogle} className="w-full" size="lg">
          Entrar com Google
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create middleware for route protection**

Create `dashboard/middleware.ts`:

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user && !request.nextUrl.pathname.startsWith("/login") && !request.nextUrl.pathname.startsWith("/auth")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 5: Verify auth flow**

1. Run dev server
2. Access localhost:3000 → should redirect to /login
3. Click "Entrar com Google" → Google OAuth flow
4. Non-@ecommercepuro.com.br email → error message
5. Valid email → redirects to dashboard

- [ ] **Step 6: Commit**

```bash
git add dashboard/
git commit -m "feat(dashboard): add google oauth with domain restriction"
```

---

### Task 5: Dashboard Layout + Sidebar

**Files:**
- Create: `dashboard/components/sidebar.tsx`
- Create: `dashboard/app/(dashboard)/layout.tsx`
- Modify: `dashboard/app/page.tsx` → move to `dashboard/app/(dashboard)/page.tsx`

- [ ] **Step 1: Install Lucide icons**

```bash
cd dashboard && npm install lucide-react
```

- [ ] **Step 2: Create sidebar component**

Create `dashboard/components/sidebar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, MessageSquare, Users, TrendingUp, DollarSign, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "@/lib/auth";

const navItems = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/mensagens", label: "Mensagens", icon: MessageSquare },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/performance", label: "Performance", icon: TrendingUp },
  { href: "/custos", label: "Custos", icon: DollarSign },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-border bg-card">
      <div className="flex h-14 items-center border-b border-border px-4">
        <h2 className="text-lg font-semibold text-foreground">Roberto</h2>
      </div>

      <nav className="flex-1 space-y-1 p-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-accent/10 text-accent"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-2">
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 3: Create dashboard layout**

Create `dashboard/app/(dashboard)/layout.tsx`:

```tsx
import { Sidebar } from "@/components/sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6">
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Create placeholder Home page**

Create `dashboard/app/(dashboard)/page.tsx`:

```tsx
export default function HomePage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
      <p className="mt-2 text-muted-foreground">Em construção...</p>
    </div>
  );
}
```

- [ ] **Step 5: Create placeholder pages for other routes**

Create these files with same pattern (just title + "Em construção..."):
- `dashboard/app/(dashboard)/mensagens/page.tsx` → "Mensagens"
- `dashboard/app/(dashboard)/leads/page.tsx` → "Leads"
- `dashboard/app/(dashboard)/performance/page.tsx` → "Performance"
- `dashboard/app/(dashboard)/custos/page.tsx` → "Custos"

- [ ] **Step 6: Verify layout**

Run dev server. Confirm:
- Sidebar renders on left with dark theme
- Navigation links work
- Active link highlights correctly
- Content area shows placeholder text

- [ ] **Step 7: Commit**

```bash
git add dashboard/
git commit -m "feat(dashboard): add sidebar navigation and dashboard layout"
```

---

## Chunk 2: Home Dashboard

### Task 6: KPI Cards Component

**Files:**
- Create: `dashboard/components/dashboard/kpi-card.tsx`
- Create: `dashboard/lib/queries.ts`

- [ ] **Step 1: Create reusable KPI card component**

Create `dashboard/components/dashboard/kpi-card.tsx`:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: string | number;
  delta?: string;
  icon: LucideIcon;
  trend?: "up" | "down" | "neutral";
}

export function KpiCard({ title, value, delta, icon: Icon, trend }: KpiCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {delta && (
          <p className={cn(
            "text-xs mt-1",
            trend === "up" && "text-primary",
            trend === "down" && "text-destructive",
            trend === "neutral" && "text-muted-foreground"
          )}>
            {delta}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Create Supabase query helpers**

Create `dashboard/lib/queries.ts`:

```typescript
import { createClient } from "./supabase";
import type { Lead, Message, Cost, Metric, ProfileStat } from "./types";

export async function getActiveLeadsCount(): Promise<{ total: number; today: number }> {
  const supabase = createClient();
  const { count: total } = await supabase
    .from("roberto_leads")
    .select("*", { count: "exact", head: true })
    .in("status", ["EM CONTATO", "INTERESSADO", "OFERTA_ENVIADA"]);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { count: today } = await supabase
    .from("roberto_leads")
    .select("*", { count: "exact", head: true })
    .gte("created_at", todayStart.toISOString());

  return { total: total ?? 0, today: today ?? 0 };
}

export async function getPurchasedLeadsCount(): Promise<number> {
  const supabase = createClient();
  const { count } = await supabase
    .from("roberto_leads")
    .select("*", { count: "exact", head: true })
    .eq("status", "COMPROU");
  return count ?? 0;
}

export async function getTotalCosts(): Promise<{ prompt: number; completion: number; elevenlabs: number }> {
  const supabase = createClient();
  const { data } = await supabase
    .from("roberto_costs")
    .select("prompt_tokens, completion_tokens, elevenlabs_tokens");

  if (!data) return { prompt: 0, completion: 0, elevenlabs: 0 };

  return data.reduce(
    (acc, row) => ({
      prompt: acc.prompt + row.prompt_tokens,
      completion: acc.completion + row.completion_tokens,
      elevenlabs: acc.elevenlabs + row.elevenlabs_tokens,
    }),
    { prompt: 0, completion: 0, elevenlabs: 0 }
  );
}

export async function getLatestMetrics(): Promise<Metric | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("roberto_metrics")
    .select("*")
    .order("data", { ascending: false })
    .limit(1)
    .single();
  return data;
}

export async function getRecentMessages(limit = 20): Promise<(Message & { lead_name: string | null })[]> {
  const supabase = createClient();
  const { data: messages } = await supabase
    .from("roberto_messages")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!messages) return [];

  // Get lead names for these messages
  const phones = [...new Set(messages.map((m) => m.phone))];
  const { data: leads } = await supabase
    .from("roberto_leads")
    .select("phone, name")
    .in("phone", phones);

  const leadMap = new Map(leads?.map((l) => [l.phone, l.name]) ?? []);

  return messages.map((m) => ({
    ...m,
    lead_name: leadMap.get(m.phone) ?? null,
  }));
}

export async function getProfileStats(): Promise<ProfileStat[]> {
  const supabase = createClient();
  const { data } = await supabase.from("roberto_profile_stats").select("*");
  return data ?? [];
}
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/
git commit -m "feat(dashboard): add KPI card component and supabase queries"
```

---

### Task 7: Animated Message Feed

**Files:**
- Create: `dashboard/components/dashboard/message-feed.tsx`

- [ ] **Step 1: Create animated feed component**

Create `dashboard/components/dashboard/message-feed.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Message } from "@/lib/types";

interface FeedMessage extends Message {
  lead_name: string | null;
}

interface MessageFeedProps {
  messages: FeedMessage[];
}

export function MessageFeed({ messages }: MessageFeedProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (messages.length === 0) return;

    const interval = setInterval(() => {
      setIsVisible(false);

      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % messages.length);
        setIsVisible(true);
      }, 500); // fade-out duration
    }, 4500); // display duration

    return () => clearInterval(interval);
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <Card className="p-6 text-center text-muted-foreground">
        Nenhuma mensagem recente
      </Card>
    );
  }

  const msg = messages[currentIndex];

  return (
    <Card className="overflow-hidden p-6">
      <h3 className="mb-4 text-sm font-medium text-muted-foreground">
        Últimas mensagens
      </h3>
      <div
        className={cn(
          "transition-all duration-500",
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
        )}
      >
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground">
                {msg.lead_name ?? msg.phone}
              </span>
              <Badge variant={msg.direction === "inbound" ? "secondary" : "outline"}>
                {msg.direction === "inbound" ? "Lead" : "Roberto"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
              {msg.media_type === "audio_entrada" || msg.media_type === "audio_saida" ? "🎤 " : ""}
              {msg.content ?? "—"}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/components/dashboard/message-feed.tsx
git commit -m "feat(dashboard): add animated message feed component"
```

---

### Task 8: Wire Up Home Page

**Files:**
- Modify: `dashboard/app/(dashboard)/page.tsx`
- Create: `dashboard/components/dashboard/home-content.tsx`

- [ ] **Step 1: Create home content client component**

Create `dashboard/components/dashboard/home-content.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Users, DollarSign, TrendingUp, Clock, ShoppingCart } from "lucide-react";
import { KpiCard } from "./kpi-card";
import { MessageFeed } from "./message-feed";
import { getActiveLeadsCount, getPurchasedLeadsCount, getTotalCosts, getLatestMetrics, getRecentMessages } from "@/lib/queries";
import { createClient } from "@/lib/supabase";
import type { Message } from "@/lib/types";

interface FeedMessage extends Message {
  lead_name: string | null;
}

export function HomeContent() {
  const [activeLeads, setActiveLeads] = useState({ total: 0, today: 0 });
  const [purchased, setPurchased] = useState(0);
  const [costs, setCosts] = useState({ prompt: 0, completion: 0, elevenlabs: 0 });
  const [metrics, setMetrics] = useState<{ total_conversoes: number; total_conversas: number } | null>(null);
  const [messages, setMessages] = useState<FeedMessage[]>([]);

  async function loadData() {
    const [leads, bought, totalCosts, latestMetrics, recentMsgs] = await Promise.all([
      getActiveLeadsCount(),
      getPurchasedLeadsCount(),
      getTotalCosts(),
      getLatestMetrics(),
      getRecentMessages(15),
    ]);
    setActiveLeads(leads);
    setPurchased(bought);
    setCosts(totalCosts);
    setMetrics(latestMetrics);
    setMessages(recentMsgs);
  }

  useEffect(() => {
    loadData();

    // Realtime subscriptions
    const supabase = createClient();

    const channel = supabase
      .channel("home-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "roberto_messages" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "roberto_leads" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "roberto_costs" }, () => loadData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const conversionRate = metrics && metrics.total_conversas > 0
    ? ((metrics.total_conversoes / metrics.total_conversas) * 100).toFixed(1)
    : "0";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Leads em Contato"
          value={activeLeads.total}
          delta={`+${activeLeads.today} hoje`}
          icon={Users}
          trend="up"
        />
        <KpiCard
          title="Leads Convertidos"
          value={purchased}
          icon={ShoppingCart}
          trend="up"
        />
        <KpiCard
          title="Taxa de Conversão"
          value={`${conversionRate}%`}
          icon={TrendingUp}
          trend="neutral"
        />
        <KpiCard
          title="Custo Total (tokens)"
          value={(costs.prompt + costs.completion + costs.elevenlabs).toLocaleString("pt-BR")}
          icon={DollarSign}
          trend="neutral"
        />
      </div>

      <MessageFeed messages={messages} />
    </div>
  );
}
```

- [ ] **Step 2: Update Home page to use HomeContent**

Modify `dashboard/app/(dashboard)/page.tsx`:

```tsx
import { HomeContent } from "@/components/dashboard/home-content";

export default function HomePage() {
  return <HomeContent />;
}
```

- [ ] **Step 3: Verify Home page**

Run dev server. Confirm:
- KPI cards render with data from Supabase
- Animated feed cycles through recent messages
- Dark theme applied correctly

- [ ] **Step 4: Commit**

```bash
git add dashboard/
git commit -m "feat(dashboard): wire up home page with KPIs and realtime feed"
```

---

## Chunk 3: Chat Viewer (Core Feature)

### Task 9: Lead List Component

**Files:**
- Create: `dashboard/lib/queries-messages.ts`
- Create: `dashboard/components/chat/lead-list.tsx`

- [ ] **Step 1: Create message-specific queries**

Create `dashboard/lib/queries-messages.ts`:

```typescript
import { createClient } from "./supabase";
import type { Lead } from "./types";

export interface LeadWithPreview extends Lead {
  last_message_content: string | null;
  last_message_at: string | null;
  last_message_direction: string | null;
  unresponded_since: string | null; // timestamp of last inbound without outbound after it
}

export async function getLeadsWithPreviews(): Promise<LeadWithPreview[]> {
  const supabase = createClient();

  // Get all leads
  const { data: leads } = await supabase
    .from("roberto_leads")
    .select("*")
    .order("updated_at", { ascending: false });

  if (!leads || leads.length === 0) return [];

  // Get latest message per phone
  const phones = leads.map((l) => l.phone);
  const { data: messages } = await supabase
    .from("roberto_messages")
    .select("phone, content, created_at, direction")
    .in("phone", phones)
    .order("created_at", { ascending: false });

  // Build maps: last message per phone + unresponded check
  const lastMsgMap = new Map<string, { content: string | null; created_at: string; direction: string }>();
  const unrespondedMap = new Map<string, string | null>();

  if (messages) {
    for (const msg of messages) {
      if (!lastMsgMap.has(msg.phone)) {
        lastMsgMap.set(msg.phone, { content: msg.content, created_at: msg.created_at, direction: msg.direction });
        // If last message is inbound, lead is waiting for response
        unrespondedMap.set(msg.phone, msg.direction === "inbound" ? msg.created_at : null);
      }
    }
  }

  return leads.map((lead) => {
    const lastMsg = lastMsgMap.get(lead.phone);
    return {
      ...lead,
      last_message_content: lastMsg?.content ?? null,
      last_message_at: lastMsg?.created_at ?? null,
      last_message_direction: lastMsg?.direction ?? null,
      unresponded_since: unrespondedMap.get(lead.phone) ?? null,
    };
  });
}

export async function getMessagesForLead(phone: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("roberto_messages")
    .select("*")
    .eq("phone", phone)
    .order("created_at", { ascending: true });
  return data ?? [];
}

export async function getEventLeadByPhone(phone: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("event_leads")
    .select("*")
    .eq("phone", phone)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  return data;
}
```

- [ ] **Step 2: Create lead list component**

Create `dashboard/components/chat/lead-list.tsx`:

```tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useState } from "react";
import type { LeadWithPreview } from "@/lib/queries-messages";

const STATUS_COLORS: Record<string, string> = {
  BASE: "bg-zinc-500",
  "EM CONTATO": "bg-blue-500",
  INTERESSADO: "bg-yellow-500",
  OFERTA_ENVIADA: "bg-purple-500",
  COMPROU: "bg-green-500",
  PERDIDO: "bg-red-500",
  HANDOFF: "bg-orange-500",
};

const PROFILE_EMOJI: Record<string, string> = {
  tubarao: "🦈",
  aguia: "🦅",
  lobo: "🐺",
  gato: "🐱",
  neutro: "⚪",
};

interface LeadListProps {
  leads: LeadWithPreview[];
  selectedPhone: string | null;
  onSelectLead: (phone: string) => void;
}

export function LeadList({ leads, selectedPhone, onSelectLead }: LeadListProps) {
  const [search, setSearch] = useState("");

  const filtered = leads.filter((lead) => {
    const term = search.toLowerCase();
    return (
      lead.name?.toLowerCase().includes(term) ||
      lead.phone.includes(term)
    );
  });

  function getTimeSince(timestamp: string): string {
    const diff = Date.now() - new Date(timestamp).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  }

  return (
    <div className="flex h-full w-80 flex-col border-r border-border">
      <div className="border-b border-border p-3">
        <Input
          placeholder="Buscar lead..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9"
        />
      </div>

      <ScrollArea className="flex-1">
        {filtered.map((lead) => (
          <button
            key={lead.phone}
            onClick={() => onSelectLead(lead.phone)}
            className={cn(
              "flex w-full flex-col gap-1 border-b border-border p-3 text-left transition-colors hover:bg-muted",
              selectedPhone === lead.phone && "bg-muted"
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  {lead.name ?? lead.phone}
                </span>
                {lead.behavioral_profile && (
                  <span className="text-xs">{PROFILE_EMOJI[lead.behavioral_profile]}</span>
                )}
              </div>
              {lead.last_message_at && (
                <span className="text-xs text-muted-foreground">
                  {getTimeSince(lead.last_message_at)}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0", STATUS_COLORS[lead.status])}>
                {lead.status}
              </Badge>
              {lead.event_interest && (
                <span className="text-[10px] text-muted-foreground truncate">{lead.event_interest}</span>
              )}
            </div>

            {lead.last_message_content && (
              <p className="text-xs text-muted-foreground truncate">
                {lead.last_message_direction === "outbound" ? "Roberto: " : ""}
                {lead.last_message_content}
              </p>
            )}

            {lead.unresponded_since && (
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                <span className="text-[10px] text-destructive">
                  Aguardando há {getTimeSince(lead.unresponded_since)}
                </span>
              </div>
            )}
          </button>
        ))}
      </ScrollArea>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/
git commit -m "feat(dashboard): add lead list component with search and urgency indicator"
```

---

### Task 10: Chat Bubbles Component

**Files:**
- Create: `dashboard/components/chat/chat-bubble.tsx`
- Create: `dashboard/components/chat/chat-area.tsx`

- [ ] **Step 1: Create chat bubble component**

Create `dashboard/components/chat/chat-bubble.tsx`:

```tsx
import { cn } from "@/lib/utils";
import { Mic } from "lucide-react";
import type { Message } from "@/lib/types";

interface ChatBubbleProps {
  message: Message;
}

export function ChatBubble({ message }: ChatBubbleProps) {
  const isOutbound = message.direction === "outbound";
  const isAudio = message.media_type === "audio_entrada" || message.media_type === "audio_saida";

  return (
    <div className={cn("flex", isOutbound ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[70%] rounded-lg px-3 py-2",
          isOutbound
            ? "bg-accent/20 text-foreground"
            : "bg-muted text-foreground"
        )}
      >
        {isAudio && (
          <div className="flex items-center gap-1 mb-1">
            <Mic className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">Áudio transcrito</span>
          </div>
        )}

        <p className="text-sm whitespace-pre-wrap">{message.content ?? "—"}</p>

        <span className="mt-1 block text-right text-[10px] text-muted-foreground">
          {new Date(message.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create chat area component**

Create `dashboard/components/chat/chat-area.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatBubble } from "./chat-bubble";
import type { Message } from "@/lib/types";

interface ChatAreaProps {
  messages: Message[];
}

export function ChatArea({ messages }: ChatAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        Nenhuma mensagem
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 p-4">
      <div className="space-y-3">
        {messages.map((msg) => (
          <ChatBubble key={msg.id} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/components/chat/
git commit -m "feat(dashboard): add chat bubble and chat area components"
```

---

### Task 11: Lead Context Card

**Files:**
- Create: `dashboard/components/chat/lead-context-card.tsx`

- [ ] **Step 1: Create lead context card**

Create `dashboard/components/chat/lead-context-card.tsx`:

```tsx
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { Lead, EventLead } from "@/lib/types";

const PROFILE_LABELS: Record<string, string> = {
  tubarao: "🦈 Tubarão",
  aguia: "🦅 Águia",
  lobo: "🐺 Lobo",
  gato: "🐱 Gato",
  neutro: "⚪ Neutro",
};

interface LeadContextCardProps {
  lead: Lead;
  eventLead: EventLead | null;
}

export function LeadContextCard({ lead, eventLead }: LeadContextCardProps) {
  return (
    <div className="border-b border-border bg-card px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            {lead.name ?? lead.phone}
          </h2>
          <Badge variant="secondary">{lead.status}</Badge>
          {lead.behavioral_profile && (
            <span className="text-sm">{PROFILE_LABELS[lead.behavioral_profile]}</span>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span>📱 {lead.phone}</span>
        {(eventLead?.email || lead.email) && <span>📧 {eventLead?.email ?? lead.email}</span>}
        {eventLead?.monthly_revenue && <span>💰 {eventLead.monthly_revenue}</span>}
        {eventLead?.company_state && <span>📍 {eventLead.company_state}</span>}
        {lead.event_interest && <span>🎯 {lead.event_interest}</span>}
        {eventLead?.role && <span>💼 {eventLead.role}</span>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/components/chat/lead-context-card.tsx
git commit -m "feat(dashboard): add lead context card component"
```

---

### Task 12: Wire Up Mensagens Page

**Files:**
- Modify: `dashboard/app/(dashboard)/mensagens/page.tsx`
- Create: `dashboard/components/chat/messages-content.tsx`

- [ ] **Step 1: Create messages content client component**

Create `dashboard/components/chat/messages-content.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { LeadList } from "./lead-list";
import { ChatArea } from "./chat-area";
import { LeadContextCard } from "./lead-context-card";
import { getLeadsWithPreviews, getMessagesForLead, getEventLeadByPhone } from "@/lib/queries-messages";
import type { LeadWithPreview } from "@/lib/queries-messages";
import type { Message, Lead, EventLead } from "@/lib/types";
import { createClient } from "@/lib/supabase";

export function MessagesContent() {
  const [leads, setLeads] = useState<LeadWithPreview[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [eventLead, setEventLead] = useState<EventLead | null>(null);

  async function loadLeads() {
    const data = await getLeadsWithPreviews();
    setLeads(data);
  }

  async function selectLead(phone: string) {
    setSelectedPhone(phone);
    const [msgs, evLead] = await Promise.all([
      getMessagesForLead(phone),
      getEventLeadByPhone(phone),
    ]);
    setMessages(msgs);
    setEventLead(evLead);
    setSelectedLead(leads.find((l) => l.phone === phone) ?? null);
  }

  useEffect(() => {
    loadLeads();

    const supabase = createClient();
    const channel = supabase
      .channel("messages-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "roberto_messages" }, (payload) => {
        const newMsg = payload.new as Message;
        // Update lead list
        loadLeads();
        // If viewing this conversation, add message
        if (newMsg.phone === selectedPhone) {
          setMessages((prev) => [...prev, newMsg]);
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "roberto_leads" }, () => loadLeads())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedPhone]);

  return (
    <div className="flex h-[calc(100vh-3rem)] -m-6">
      <LeadList
        leads={leads}
        selectedPhone={selectedPhone}
        onSelectLead={selectLead}
      />

      <div className="flex flex-1 flex-col">
        {selectedLead ? (
          <>
            <LeadContextCard lead={selectedLead} eventLead={eventLead} />
            <ChatArea messages={messages} />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            Selecione um lead para ver a conversa
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update mensagens page**

Modify `dashboard/app/(dashboard)/mensagens/page.tsx`:

```tsx
import { MessagesContent } from "@/components/chat/messages-content";

export default function MensagensPage() {
  return <MessagesContent />;
}
```

- [ ] **Step 3: Verify chat viewer**

Run dev server. Confirm:
- Lead list renders on left with search
- Clicking a lead shows context card + messages
- Messages appear as WhatsApp-style bubbles
- Audio messages show microphone icon
- Urgency indicator shows for unresponded leads

- [ ] **Step 4: Commit**

```bash
git add dashboard/
git commit -m "feat(dashboard): wire up mensagens page with realtime chat viewer"
```

---

## Chunk 4: Leads Table + Remaining Pages

### Task 13: Leads Table Page

**Files:**
- Modify: `dashboard/app/(dashboard)/leads/page.tsx`
- Create: `dashboard/components/leads/leads-content.tsx`

- [ ] **Step 1: Create leads content component**

Create `dashboard/components/leads/leads-content.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createClient } from "@/lib/supabase";
import type { Lead } from "@/lib/types";

const STATUS_COLORS: Record<string, string> = {
  BASE: "bg-zinc-500",
  "EM CONTATO": "bg-blue-500",
  INTERESSADO: "bg-yellow-500",
  OFERTA_ENVIADA: "bg-purple-500",
  COMPROU: "bg-green-500",
  PERDIDO: "bg-red-500",
  HANDOFF: "bg-orange-500",
};

const PROFILE_EMOJI: Record<string, string> = {
  tubarao: "🦈",
  aguia: "🦅",
  lobo: "🐺",
  gato: "🐱",
  neutro: "⚪",
};

export function LeadsContent() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  async function loadLeads() {
    const supabase = createClient();
    const { data } = await supabase
      .from("roberto_leads")
      .select("*")
      .order("created_at", { ascending: false });
    setLeads(data ?? []);
  }

  useEffect(() => {
    loadLeads();
  }, []);

  const filtered = leads.filter((lead) => {
    const matchesSearch = !search || lead.name?.toLowerCase().includes(search.toLowerCase()) || lead.phone.includes(search);
    const matchesStatus = !statusFilter || lead.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground">Leads</h1>

      <div className="flex gap-3">
        <Input
          placeholder="Buscar por nome ou telefone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
        >
          <option value="">Todos os status</option>
          {Object.keys(STATUS_COLORS).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Telefone</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Perfil</TableHead>
            <TableHead>Evento</TableHead>
            <TableHead>Entrada</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((lead) => (
            <TableRow
              key={lead.phone}
              className="cursor-pointer hover:bg-muted"
              onClick={() => router.push(`/mensagens?phone=${lead.phone}`)}
            >
              <TableCell className="font-medium">{lead.name ?? "—"}</TableCell>
              <TableCell>{lead.phone}</TableCell>
              <TableCell>
                <Badge variant="secondary" className={STATUS_COLORS[lead.status]}>
                  {lead.status}
                </Badge>
              </TableCell>
              <TableCell>{lead.behavioral_profile ? PROFILE_EMOJI[lead.behavioral_profile] : "—"}</TableCell>
              <TableCell>{lead.event_interest ?? "—"}</TableCell>
              <TableCell>{new Date(lead.created_at).toLocaleDateString("pt-BR")}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 2: Update leads page**

Modify `dashboard/app/(dashboard)/leads/page.tsx`:

```tsx
import { LeadsContent } from "@/components/leads/leads-content";

export default function LeadsPage() {
  return <LeadsContent />;
}
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/
git commit -m "feat(dashboard): add leads table with filters and navigation to chat"
```

---

### Task 14: Performance Page (Basic)

**Files:**
- Modify: `dashboard/app/(dashboard)/performance/page.tsx`
- Create: `dashboard/components/performance/performance-content.tsx`

- [ ] **Step 1: Create performance content**

Create `dashboard/components/performance/performance-content.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLatestMetrics, getProfileStats } from "@/lib/queries";
import type { Metric, ProfileStat } from "@/lib/types";

export function PerformanceContent() {
  const [metrics, setMetrics] = useState<Metric | null>(null);
  const [profiles, setProfiles] = useState<ProfileStat[]>([]);

  useEffect(() => {
    getLatestMetrics().then(setMetrics);
    getProfileStats().then(setProfiles);
  }, []);

  const totalLeads = profiles.reduce((sum, p) => sum + p.total, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Performance</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Conversas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.total_conversas ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Conversões</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.total_conversoes ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Handoffs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.total_handoffs ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Perdidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.total_perdidos ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">Distribuição de Perfis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {profiles.map((p) => {
              const pct = totalLeads > 0 ? ((p.total / totalLeads) * 100).toFixed(0) : "0";
              return (
                <div key={p.profile} className="flex items-center gap-3">
                  <span className="w-20 text-sm capitalize">{p.profile}</span>
                  <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground w-16 text-right">
                    {p.total} ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Update performance page**

```tsx
import { PerformanceContent } from "@/components/performance/performance-content";

export default function PerformancePage() {
  return <PerformanceContent />;
}
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/
git commit -m "feat(dashboard): add basic performance page with metrics and profile distribution"
```

---

### Task 15: Custos Page (Basic)

**Files:**
- Modify: `dashboard/app/(dashboard)/custos/page.tsx`
- Create: `dashboard/components/custos/custos-content.tsx`

- [ ] **Step 1: Create custos content**

Create `dashboard/components/custos/custos-content.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase";
import type { Cost } from "@/lib/types";

export function CustosContent() {
  const [costs, setCosts] = useState<Cost[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("roberto_costs")
        .select("*")
        .order("created_at", { ascending: false });
      setCosts(data ?? []);
    }
    load();
  }, []);

  const totals = costs.reduce(
    (acc, c) => ({
      prompt: acc.prompt + c.prompt_tokens,
      completion: acc.completion + c.completion_tokens,
      elevenlabs: acc.elevenlabs + c.elevenlabs_tokens,
      count: acc.count + 1,
    }),
    { prompt: 0, completion: 0, elevenlabs: 0, count: 0 }
  );

  const uniquePhones = new Set(costs.filter((c) => c.phone).map((c) => c.phone)).size;
  const costPerLead = uniquePhones > 0 ? (totals.prompt + totals.completion) / uniquePhones : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Custos</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Tokens GPT (Prompt)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.prompt.toLocaleString("pt-BR")}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Tokens GPT (Completion)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.completion.toLocaleString("pt-BR")}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Tokens ElevenLabs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.elevenlabs.toLocaleString("pt-BR")}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Tokens/Lead (média)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(costPerLead).toLocaleString("pt-BR")}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">Total de Interações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totals.count}</div>
          <p className="text-sm text-muted-foreground mt-1">{uniquePhones} leads únicos</p>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Update custos page**

```tsx
import { CustosContent } from "@/components/custos/custos-content";

export default function CustosPage() {
  return <CustosContent />;
}
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/
git commit -m "feat(dashboard): add basic custos page with token breakdown"
```

---

### Task 16: Final Verification

- [ ] **Step 1: Run dev server and test all pages**

```bash
cd dashboard && npm run dev
```

Verify:
- Login page renders with Google button
- Sidebar navigation works across all 5 pages
- Home shows KPI cards + animated feed
- Mensagens shows lead list + chat viewer
- Leads table with filters + click-to-chat
- Performance shows metrics + profile bars
- Custos shows token breakdown
- Dark theme consistent across all pages

- [ ] **Step 2: Run build to verify no TypeScript errors**

```bash
cd dashboard && npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 3: Final commit**

```bash
git add dashboard/
git commit -m "feat(dashboard): complete MVP with all 5 pages"
```
