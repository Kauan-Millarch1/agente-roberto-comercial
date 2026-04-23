import { NextResponse, NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { requireRole } from "@/lib/api-auth";
import { ROLES, isValidRole, type Role } from "@/lib/roles";

export const dynamic = "force-dynamic";

export async function GET() {
  const { authorized, response } = await requireRole("admin");
  if (!authorized) return response;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("dashboard_users")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[api/users GET] list failed", { error });
    return NextResponse.json(
      { error: "Erro ao buscar usuários" },
      { status: 500 }
    );
  }

  return NextResponse.json(data ?? []);
}

export async function PATCH(request: NextRequest) {
  const { authorized, userId, role: actorRole, response } = await requireRole("admin");
  if (!authorized || !userId) return response;

  const body = await request.json();
  const { userId: targetUserId, role: newRole } = body;

  if (!targetUserId || !newRole) {
    return NextResponse.json(
      { error: "userId and role are required" },
      { status: 400 }
    );
  }

  if (!isValidRole(newRole)) {
    return NextResponse.json(
      { error: "Invalid role" },
      { status: 400 }
    );
  }

  // Cannot promote to a level equal or above your own
  if (ROLES[newRole as Role] >= ROLES[actorRole]) {
    return NextResponse.json(
      { error: "Não é possível atribuir um nível igual ou superior ao seu" },
      { status: 403 }
    );
  }

  const supabase = createServiceClient();

  // Check target user's current role
  const { data: target } = await supabase
    .from("dashboard_users")
    .select("role")
    .eq("id", targetUserId)
    .single();

  if (!target) {
    return NextResponse.json(
      { error: "User not found" },
      { status: 404 }
    );
  }

  // Cannot modify someone at the same level or above
  if (ROLES[target.role as Role] >= ROLES[actorRole]) {
    return NextResponse.json(
      { error: "Não é possível alterar um usuário com nível igual ou superior ao seu" },
      { status: 403 }
    );
  }

  const { data, error } = await supabase
    .from("dashboard_users")
    .update({ role: newRole })
    .eq("id", targetUserId)
    .select()
    .single();

  if (error) {
    console.error("[api/users PATCH] update failed", { error });
    return NextResponse.json(
      { error: "Erro ao atualizar usuário" },
      { status: 500 }
    );
  }

  const { error: auditError } = await supabase.from("roberto_audit_log").insert({
    user_id: userId,
    action: "update_user_role",
    metadata: {
      target_user_id: targetUserId,
      old_role: target.role,
      new_role: newRole,
    },
  });

  if (auditError) {
    console.error("[api/users PATCH] audit write failed", { error: auditError });
  }

  return NextResponse.json(data);
}
