import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const ROLES: Record<string, number> = {
  super_admin: 4,
  admin: 3,
  operator: 2,
  viewer: 1,
};

// Pages that require a minimum role to access
const PAGE_RESTRICTIONS: Record<string, string> = {
  "/custos": "admin",
  "/usuarios": "admin",
};

// Public app routes (pages + auth callback) — no session check
const PUBLIC_ROUTES = ["/login", "/auth/callback"];

// Public API routes (externally-received webhooks) — no session check.
// Adicione paths aqui quando criar webhooks públicos recebidos de serviços
// externos (ex: "/api/webhooks/whatsapp"). NÃO adicione routes que devem
// exigir sessão — essas continuam sendo validadas.
const PUBLIC_API_ROUTES: string[] = [];

function getRoleLevel(role: string | undefined): number {
  return role && role in ROLES ? ROLES[role] : 1;
}

function isPublicPath(pathname: string): boolean {
  if (pathname.startsWith("/_next/")) return true;
  if (pathname === "/favicon.ico") return true;
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) return true;
  if (PUBLIC_API_ROUTES.some((route) => pathname.startsWith(route))) return true;
  return false;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip session validation for public paths and static assets.
  // All other paths (internal pages + internal API) flow through the
  // Supabase session check below — defense-in-depth against a future
  // route handler that forgets to call requireRole().
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Verify Supabase session
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
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // API routes get a structured 401 so fetch clients can handle auth
    // failure explicitly instead of receiving the /login HTML page.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Não autenticado" },
        { status: 401 }
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Check page-level role restrictions
  const userRole = request.cookies.get("x-user-role")?.value;
  const userLevel = getRoleLevel(userRole);

  for (const [page, minRole] of Object.entries(PAGE_RESTRICTIONS)) {
    if (pathname === page || pathname.startsWith(`${page}/`)) {
      const requiredLevel = ROLES[minRole];
      if (userLevel < requiredLevel) {
        const url = request.nextUrl.clone();
        url.pathname = "/";
        url.searchParams.set("error", "forbidden");
        return NextResponse.redirect(url);
      }
    }
  }

  // Pass role as header for server components
  if (userRole) {
    supabaseResponse.headers.set("x-user-role", userRole);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
