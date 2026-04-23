"use client";

import { createContext, useContext, useMemo } from "react";
import type { Role } from "@/lib/roles";
import { hasMinRole } from "@/lib/roles";

interface RoleContextValue {
  role: Role;
  hasMin: (minRole: Role) => boolean;
}

const RoleContext = createContext<RoleContextValue>({
  role: "viewer",
  hasMin: () => false,
});

export function RoleProvider({
  role,
  children,
}: {
  role: Role;
  children: React.ReactNode;
}) {
  const value = useMemo<RoleContextValue>(
    () => ({
      role,
      hasMin: (minRole: Role) => hasMinRole(role, minRole),
    }),
    [role]
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  return useContext(RoleContext);
}
