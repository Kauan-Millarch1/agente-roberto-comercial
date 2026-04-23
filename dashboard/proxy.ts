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

const PUBLIC_ROUTES = ["/login", "/auth/callback"];

function getRoleLevel(role: string | undefined): number {
  return role && role in ROLES ? ROLES[role] : 1;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip auth for public routes, static assets, and API routes
  if (
    PUBLIC_ROUTES.some((route) => pathname.startsWith(route)) ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/") ||
    pathname === "/favicon.ico"
  ) {
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
