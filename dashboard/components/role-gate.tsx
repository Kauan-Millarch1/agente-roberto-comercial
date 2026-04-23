"use client";

import type { Role } from "@/lib/roles";
import { useRole } from "./role-provider";

interface RoleGateProps {
  minRole: Role;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RoleGate({ minRole, children, fallback = null }: RoleGateProps) {
  const { hasMin } = useRole();

  if (!hasMin(minRole)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
