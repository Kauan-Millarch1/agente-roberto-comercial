"use client";

import { Lock } from "lucide-react";
import { useRouter } from "next/navigation";

export function ForbiddenPage({ pageName }: { pageName?: string }) {
  const router = useRouter();

  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/[0.04] border border-white/[0.06]">
        <Lock className="h-10 w-10 text-muted-foreground/50" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-foreground">
          Acesso restrito
        </h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          Você não tem permissão para acessar
          {pageName ? ` a página ${pageName}` : " esta página"}.
          Entre em contato com um administrador.
        </p>
      </div>
      <button
        onClick={() => router.push("/")}
        className="mt-2 rounded-xl bg-white/[0.06] px-4 py-2 text-sm font-medium text-foreground hover:bg-white/[0.1] transition-colors"
      >
        Voltar ao início
      </button>
    </div>
  );
}
