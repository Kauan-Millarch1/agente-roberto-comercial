export const ROLES = {
  super_admin: 4,
  admin: 3,
  operator: 2,
  viewer: 1,
} as const;

export type Role = keyof typeof ROLES;

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  operator: "Operador",
  viewer: "Visualizador",
};

export function hasMinRole(userRole: Role, minRole: Role): boolean {
  return ROLES[userRole] >= ROLES[minRole];
}

export function canManageRole(actorRole: Role, targetRole: Role): boolean {
  return ROLES[actorRole] > ROLES[targetRole];
}

export function isValidRole(role: string): role is Role {
  return role in ROLES;
}
