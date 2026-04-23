import { cookies } from "next/headers";
import { Sidebar } from "@/components/sidebar";
import { RoleProvider } from "@/components/role-provider";
import type { Role } from "@/lib/roles";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const role = (cookieStore.get("x-user-role")?.value ?? "viewer") as Role;

  return (
    <RoleProvider role={role}>
      <div className="flex h-screen bg-[oklch(0.08_0.005_260)]">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <div className="relative min-h-full bg-gradient-to-br from-[oklch(0.1_0.005_260)] via-[oklch(0.09_0.005_260)] to-[oklch(0.08_0.01_280)]">
            {/* Subtle ambient glow */}
            <div className="pointer-events-none absolute top-0 left-1/4 h-96 w-96 rounded-full bg-[oklch(0.72_0.19_155)]/[0.03] blur-[120px]" />
            <div className="pointer-events-none absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-[oklch(0.65_0.18_250)]/[0.03] blur-[120px]" />
            <div className="relative p-8">{children}</div>
          </div>
        </main>
      </div>
    </RoleProvider>
  );
}
