import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { Role } from "@/lib/roles";

const ALLOWED_DOMAIN = "ecommercepuro.com.br";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

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

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  // Validate email domain
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email?.endsWith(`@${ALLOWED_DOMAIN}`)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=domain`);
  }

  // Fetch or create dashboard_users record and get role
  const role = await getUserRole(user.id, user.email!, user.user_metadata);

  // Set role cookie for client-side access
  cookieStore.set("x-user-role", role, {
    path: "/",
    httpOnly: false, // Readable by client JS for RoleGate
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  return NextResponse.redirect(`${origin}/`);
}

async function getUserRole(
  userId: string,
  email: string,
  metadata: Record<string, unknown>
): Promise<Role> {
  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Try to fetch existing record
  const { data: existing } = await serviceClient
    .from("dashboard_users")
    .select("role")
    .eq("id", userId)
    .single();

  if (existing) {
    return existing.role as Role;
  }

  // Fallback: create record if trigger missed
  const displayName =
    (metadata?.full_name as string) ||
    (metadata?.name as string) ||
    email.split("@")[0];

  const { data: created } = await serviceClient
    .from("dashboard_users")
    .upsert(
      { id: userId, email, display_name: displayName, role: "viewer" },
      { onConflict: "id" }
    )
    .select("role")
    .single();

  return (created?.role as Role) ?? "viewer";
}
