import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ROLES, type Role } from "./roles";

/**
 * Verify that the current request has at least the specified role.
 * Returns null if authorized, or a 403 NextResponse if not.
 */
export async function requireRole(minRole: Role): Promise<{
  authorized: boolean;
  role: Role;
  response?: NextResponse;
}> {
  const cookieStore = await cookies();
  const userRole = (cookieStore.get("x-user-role")?.value ?? "viewer") as Role;
  const userLevel = ROLES[userRole] ?? 1;
  const requiredLevel = ROLES[minRole];

  if (userLevel < requiredLevel) {
    return {
      authorized: false,
      role: userRole,
      response: NextResponse.json(
        { error: "Permissão insuficiente" },
        { status: 403 }
      ),
    };
  }

  return { authorized: true, role: userRole };
}
