"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Image from "next/image";
import { signInWithGoogle } from "@/lib/auth";

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const [phase, setPhase] = useState<"splash" | "transition" | "login">(
    "splash"
  );
  const [logoVisible, setLogoVisible] = useState(false);
  const [flareActive, setFlareActive] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setLogoVisible(true), 400);
    const t2 = setTimeout(() => setFlareActive(true), 1000);
    const t3 = setTimeout(() => setPhase("transition"), 4500);
    const t4 = setTimeout(() => setPhase("login"), 5200);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#030306]">
      {/* ═══ SPLASH SCREEN ═══ */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center z-20"
        style={{
          opacity: phase === "splash" ? 1 : 0,
          transform: phase !== "splash" ? "scale(1.1)" : "scale(1)",
          transition: "opacity 0.8s ease, transform 1.2s ease",
          pointerEvents: phase === "splash" ? "auto" : "none",
        }}
      >
        {/* Logo image */}
        <div
          className="relative z-10"
          style={{
            opacity: logoVisible ? 1 : 0,
            transform: logoVisible ? "translateY(0) scale(1)" : "translateY(15px) scale(0.95)",
            transition: "opacity 1.2s ease, transform 1.2s ease",
          }}
        >
          <Image
            src="/logo.png"
            alt="Ecommerce Puro"
            width={340}
            height={200}
            priority
            className="drop-shadow-2xl"
          />
        </div>

        {/* ─── Blue flare line (animated sweep) ─── */}
        <div
          className="absolute left-0 right-0 overflow-hidden"
          style={{
            top: "50%",
            height: "2px",
            opacity: flareActive ? 1 : 0,
            transition: "opacity 0.8s ease",
          }}
        >
          {/* Base glow line */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, transparent 5%, rgba(26,138,255,0.15) 20%, rgba(26,138,255,0.15) 80%, transparent 95%)",
            }}
          />
          {/* Sweeping bright spot */}
          <div
            style={{
              position: "absolute",
              top: 0,
              height: "100%",
              width: "300px",
              background:
                "linear-gradient(90deg, transparent, rgba(96,181,255,0.8) 30%, #8ac4ff 50%, rgba(96,181,255,0.8) 70%, transparent)",
              boxShadow:
                "0 0 30px 8px rgba(26,138,255,0.4), 0 0 60px 15px rgba(26,138,255,0.2), 0 0 100px 25px rgba(26,138,255,0.08)",
              animation: flareActive ? "flare-sweep 3s ease-in-out infinite" : "none",
            }}
          />
        </div>

        {/* Wide ambient glow behind flare */}
        <div
          className="absolute left-0 right-0"
          style={{
            top: "calc(50% - 60px)",
            height: "120px",
            opacity: flareActive ? 1 : 0,
            transition: "opacity 1.5s ease",
            background:
              "radial-gradient(ellipse 80% 100% at 50% 50%, rgba(26,138,255,0.06) 0%, transparent 100%)",
          }}
        />

        {/* Subtitle */}
        <p
          className="absolute bottom-[18%] text-[10px] font-semibold tracking-[0.5em] uppercase text-white/15"
          style={{
            opacity: logoVisible ? 1 : 0,
            transition: "opacity 1s ease 1.8s",
          }}
        >
          Dashboard de Agentes de IA
        </p>
      </div>

      {/* ═══ LOGIN SCREEN ═══ */}
      <div
        className="absolute inset-0 z-10"
        style={{
          opacity: phase === "login" ? 1 : 0,
          transition: "opacity 0.8s ease",
          pointerEvents: phase === "login" ? "auto" : "none",
        }}
      >
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#080810] via-[#0c0818] to-[#130a20]" />
        <div className="absolute bottom-0 left-1/4 w-[800px] h-[400px] rounded-full bg-purple-900/15 blur-[150px]" />
        <div className="absolute top-1/3 right-0 w-[500px] h-[500px] rounded-full bg-purple-800/8 blur-[130px]" />

        {/* Content */}
        <div className="relative flex min-h-screen items-center justify-center gap-24 px-8">
          {/* Left - Logo */}
          <div
            className="hidden lg:block"
            style={{
              opacity: phase === "login" ? 1 : 0,
              transform: phase === "login" ? "translateX(0)" : "translateX(-40px)",
              transition: "opacity 0.7s ease 0.2s, transform 0.7s ease 0.2s",
            }}
          >
            <Image
              src="/logo.png"
              alt="Ecommerce Puro"
              width={280}
              height={170}
              className="drop-shadow-2xl"
            />
          </div>

          {/* Right - Login card */}
          <div
            className="w-full max-w-sm"
            style={{
              opacity: phase === "login" ? 1 : 0,
              transform: phase === "login" ? "translateY(0)" : "translateY(25px)",
              transition: "opacity 0.7s ease 0.35s, transform 0.7s ease 0.35s",
            }}
          >
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-2xl p-8 shadow-2xl shadow-black/50">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-white mb-2">
                  Bem-vindo
                </h2>
                <p className="text-sm text-white/35">
                  Dashboard de Agentes de IA do Ecommerce Puro
                </p>
              </div>

              {error === "domain" && (
                <div className="mb-6 rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-center">
                  <p className="text-sm text-red-400">
                    Acesso restrito a colaboradores Ecommerce Puro
                  </p>
                </div>
              )}
              {error === "auth" && (
                <div className="mb-6 rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-center">
                  <p className="text-sm text-red-400">
                    Erro na autenticação. Tente novamente.
                  </p>
                </div>
              )}

              <button
                onClick={signInWithGoogle}
                className="group relative w-full flex items-center justify-center gap-3 rounded-xl bg-white hover:bg-gray-50 text-gray-800 font-medium py-3.5 px-6 transition-all duration-300 hover:shadow-lg hover:shadow-white/10 hover:-translate-y-0.5 active:translate-y-0"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Entrar com Google
              </button>

              <p className="mt-6 text-center text-[11px] text-white/20">
                Acesso restrito a @ecommercepuro.com.br
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Keyframe for flare sweep ═══ */}
      <style jsx>{`
        @keyframes flare-sweep {
          0% {
            left: -300px;
          }
          50% {
            left: calc(100% + 0px);
          }
          100% {
            left: -300px;
          }
        }
      `}</style>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
