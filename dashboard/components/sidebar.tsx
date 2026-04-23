"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  TrendingUp,
  DollarSign,
  LogOut,
  Bot,
  Lock,
  UserCog,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "@/lib/auth";
import { useRole } from "@/components/role-provider";
import { ROLE_LABELS, type Role } from "@/lib/roles";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  minRole?: Role;
}

const navItems: NavItem[] = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/mensagens", label: "Mensagens", icon: MessageSquare },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/performance", label: "Performance", icon: TrendingUp },
  { href: "/custos", label: "Custos", icon: DollarSign, minRole: "admin" },
  { href: "/usuarios", label: "Usuários", icon: UserCog, minRole: "admin" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { role, hasMin } = useRole();

  // Filter nav items: hide items the user can't access at all
  const visibleItems = navItems.filter((item) => {
    if (!item.minRole) return true;
    return hasMin(item.minRole);
  });

  return (
    <aside className="flex h-screen w-64 flex-col bg-[oklch(0.11_0.005_260)] animate-slide-in-left">
      {/* Logo area */}
      <div className="flex h-16 items-center gap-3 px-5 border-b border-white/[0.06]">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[oklch(0.72_0.19_155)] to-[oklch(0.55_0.19_155)] shadow-lg shadow-[oklch(0.72_0.19_155)]/20">
          <Bot className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-foreground tracking-tight">Roberto</h2>
          <p className="text-[10px] text-muted-foreground">Agente Comercial</p>
        </div>
        <div className="ml-auto flex h-2 w-2 rounded-full bg-[oklch(0.72_0.19_155)] animate-pulse shadow-sm shadow-[oklch(0.72_0.19_155)]/50" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-3 pt-4">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
          Menu
        </p>
        {visibleItems.map((item, i) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          const isLocked = item.minRole && !hasMin(item.minRole);
          return (
            <Link
              key={item.href}
              href={isLocked ? "#" : item.href}
              onClick={isLocked ? (e) => e.preventDefault() : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-300",
                `stagger-${i + 1} animate-fade-in-up`,
                isLocked
                  ? "text-muted-foreground/30 cursor-not-allowed"
                  : isActive
                    ? "bg-[oklch(0.72_0.19_155)]/10 text-[oklch(0.72_0.19_155)]"
                    : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground hover:translate-x-1"
              )}
            >
              {/* Active indicator bar */}
              {isActive && !isLocked && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full bg-[oklch(0.72_0.19_155)] shadow-sm shadow-[oklch(0.72_0.19_155)]/50" />
              )}

              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-300",
                  isLocked
                    ? "bg-white/[0.02]"
                    : isActive
                      ? "bg-[oklch(0.72_0.19_155)]/15 shadow-sm shadow-[oklch(0.72_0.19_155)]/10"
                      : "bg-white/[0.04] group-hover:bg-white/[0.08]"
                )}
              >
                {isLocked ? (
                  <Lock className="h-3.5 w-3.5 text-muted-foreground/30" />
                ) : (
                  <item.icon
                    className={cn(
                      "h-4 w-4 transition-all duration-300",
                      isActive && "drop-shadow-[0_0_4px_oklch(0.72_0.19_155)]"
                    )}
                  />
                )}
              </div>
              {item.label}

              {/* Hover glow */}
              {!isActive && !isLocked && (
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Status card */}
      <div className="mx-3 mb-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-2 w-2 rounded-full bg-[oklch(0.72_0.19_155)] animate-pulse" />
          <span className="text-xs font-medium text-foreground">Online</span>
        </div>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Roberto está ativo e respondendo leads em tempo real
        </p>
      </div>

      {/* User role badge + Logout */}
      <div className="border-t border-white/[0.06] p-3 space-y-2">
        <div className="flex items-center gap-2 px-3">
          <div className="h-2 w-2 rounded-full bg-[oklch(0.65_0.18_250)]" />
          <span className="text-[10px] font-medium text-muted-foreground">
            {ROLE_LABELS[role]}
          </span>
        </div>
        <button
          onClick={signOut}
          className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-all duration-300"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] group-hover:bg-red-500/10 transition-all duration-300">
            <LogOut className="h-4 w-4" />
          </div>
          Sair
        </button>
      </div>
    </aside>
  );
}
