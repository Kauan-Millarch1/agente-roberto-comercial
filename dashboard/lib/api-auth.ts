import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { cache } from "react";
import { ROLES, isValidRole, type Role } from "./roles";
import { createServiceClient } from "./supabase-server";

type ResolvedAuth =
  | { userId: string; email: string; role: Role }
  | { userId: string; email: string; role: null };

/**
 * Resolves the authenticated user and their role from the database.
 *
 * Security: role is read from `dashboard_users` via the service client,
 * keyed by the Supabase-validated `user.id` (JWT-verified). The
 * `x-user-role` cookie is NEVER consulted here — it's UI-only.
 *
 * Memoized per-request via React `cache` so multiple `requireRole` calls
 * within the same request (e.g. route handler + server component) share
 * a single DB lookup.
 */
const resolveAuthenticatedRole = cache(
  async (): Promise<ResolvedAuth | null> => {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {
            // Route handlers cannot mutate cookies mid-response; proxy.ts
            // handles session refresh on every request.
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !user.email) return null;

    const service = createServiceClient();
    const { data } = await service
      .from("dashboard_users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!data || !isValidRole(data.role)) {
      return { userId: user.id, email: user.email, role: null };
    }

    return { userId: user.id, email: user.email, role: data.role };
  }
);

/**
 * Verify that the current request has at least the specified role.
 *
 * - 401 if unauthenticated
 * - 403 if authenticated but role < minRole
 * - Role is always sourced from the DB, never from client-controllable cookies.
 *
 * Edge case: authenticated user with no `dashboard_users` row is auto-
 * provisioned as `viewer` (consistent with /auth/callback's first-login
 * fallback). Viewer is the minimum privilege — this does not grant
 * elevated access. A warning is logged so ops can investigate recurring
 * cases (likely indicates a broken trigger or deleted row).
 */
export async function requireRole(minRole: Role): Promise<{
  authorized: boolean;
  role: Role;
  userId?: string;
  response?: NextResponse;
}> {
  let auth = await resolveAuthenticatedRole();

  if (!auth) {
    return {
      authorized: false,
      role: "viewer",
      response: NextResponse.json(
        { error: "Não autenticado" },
        { status: 401 }
      ),
    };
  }

  if (auth.role === null) {
    console.warn(
      `[requireRole] Auto-provisioning viewer for user ${auth.userId} (${auth.email}) — no dashboard_users row found`
    );

    const { error } = await createServiceClient()
      .from("dashboard_users")
      .upsert(
        { id: auth.userId, email: auth.email, role: "viewer" },
        { onConflict: "id" }
      );

    if (error) {
      console.error("[requireRole] Auto-provision failed:", error.message);
      return {
        authorized: false,
        role: "viewer",
        response: NextResponse.json(
          { error: "Não autenticado" },
          { status: 401 }
        ),
      };
    }

    auth = { userId: auth.userId, email: auth.email, role: "viewer" };
  }

  const userLevel = ROLES[auth.role];
  const requiredLevel = ROLES[minRole];

  if (userLevel < requiredLevel) {
    return {
      authorized: false,
      role: auth.role,
      response: NextResponse.json(
        { error: "Permissão insuficiente" },
        { status: 403 }
      ),
    };
  }

  return { authorized: true, role: auth.role, userId: auth.userId };
}
