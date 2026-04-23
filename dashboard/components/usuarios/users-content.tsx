"use client";

import { useEffect, useState, useCallback } from "react";
import { UserCog, Shield, ShieldCheck, Eye, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRole } from "@/components/role-provider";
import { ROLES, ROLE_LABELS, canManageRole, type Role } from "@/lib/roles";

interface DashboardUser {
  id: string;
  email: string;
  display_name: string | null;
  role: Role;
  created_at: string;
  updated_at: string;
}

const ROLE_ICONS: Record<Role, React.ComponentType<{ className?: string }>> = {
  super_admin: Crown,
  admin: ShieldCheck,
  operator: Shield,
  viewer: Eye,
};

const ROLE_COLORS: Record<Role, { bg: string; text: string }> = {
  super_admin: { bg: "bg-amber-500/20 border-amber-500/20", text: "text-amber-400" },
  admin: { bg: "bg-purple-500/20 border-purple-500/20", text: "text-purple-400" },
  operator: { bg: "bg-blue-500/20 border-blue-500/20", text: "text-blue-400" },
  viewer: { bg: "bg-zinc-500/20 border-zinc-500/20", text: "text-zinc-400" },
};

export function UsersContent() {
  const { role: myRole } = useRole();
  const [users, setUsers] = useState<DashboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Falha ao carregar usuários");
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error("Failed to load users:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  async function handleRoleChange(userId: string, newRole: Role) {
    setUpdating(userId);
    setError(null);

    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Falha ao atualizar");
        return;
      }

      // Update local state
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
    } catch {
      setError("Erro de conexão");
    } finally {
      setUpdating(null);
    }
  }

  // Roles the current user can assign (only below their own level)
  const assignableRoles = (Object.keys(ROLES) as Role[]).filter(
    (r) => ROLES[r] < ROLES[myRole]
  );

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-8 w-48 rounded-xl animate-shimmer" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-2xl animate-shimmer" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="animate-fade-in-up">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Usuários
          </h1>
          <span className="text-xs font-medium text-muted-foreground rounded-full bg-white/[0.06] border border-white/[0.06] px-2.5 py-1">
            {users.length}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Gerencie os acessos e permissões do dashboard
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400 animate-fade-in">
          {error}
        </div>
      )}

      {/* Users table */}
      <div className="rounded-2xl border border-white/[0.06] bg-[oklch(0.12_0.005_260)] overflow-hidden animate-fade-in-up stagger-1">
        <div className="grid grid-cols-[1fr_1fr_150px_150px] gap-4 px-6 py-3 border-b border-white/[0.06] text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
          <span>Usuário</span>
          <span>Email</span>
          <span>Nível</span>
          <span>Desde</span>
        </div>

        {users.map((user) => {
          const RoleIcon = ROLE_ICONS[user.role];
          const colors = ROLE_COLORS[user.role];
          const canEdit = canManageRole(myRole, user.role);
          const isSuperAdmin = user.role === "super_admin";

          return (
            <div
              key={user.id}
              className="grid grid-cols-[1fr_1fr_150px_150px] gap-4 px-6 py-4 border-b border-white/[0.04] last:border-b-0 items-center hover:bg-white/[0.02] transition-colors"
            >
              {/* Name + avatar */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[oklch(0.65_0.18_250)]/20 text-xs font-bold text-[oklch(0.75_0.18_250)]">
                  {user.display_name?.[0]?.toUpperCase() ?? user.email[0].toUpperCase()}
                </div>
                <span className="text-sm font-medium text-foreground truncate">
                  {user.display_name ?? user.email.split("@")[0]}
                </span>
              </div>

              {/* Email */}
              <span className="text-sm text-muted-foreground truncate">
                {user.email}
              </span>

              {/* Role badge / selector */}
              <div>
                {isSuperAdmin || !canEdit ? (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium",
                      colors.bg,
                      colors.text
                    )}
                  >
                    <RoleIcon className="h-3 w-3" />
                    {ROLE_LABELS[user.role]}
                  </span>
                ) : (
                  <select
                    value={user.role}
                    onChange={(e) => handleRoleChange(user.id, e.target.value as Role)}
                    disabled={updating === user.id}
                    className={cn(
                      "rounded-lg border bg-transparent px-2.5 py-1 text-xs font-medium outline-none cursor-pointer transition-colors",
                      colors.bg,
                      colors.text,
                      updating === user.id && "opacity-50 cursor-wait"
                    )}
                  >
                    {assignableRoles.map((r) => (
                      <option key={r} value={r} className="bg-[oklch(0.12_0.005_260)] text-foreground">
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Created date */}
              <span className="text-xs text-muted-foreground">
                {new Date(user.created_at).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
          );
        })}

        {users.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <UserCog className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              Nenhum usuário encontrado
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
