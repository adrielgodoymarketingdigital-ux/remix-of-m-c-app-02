import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Share,
  PlusSquare,
  Check,
  ArrowRight,
  Loader2,
  MessageCircle,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import logoMec from "@/assets/logo-mec-auth.png";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Plataforma = "android-chrome" | "ios-safari" | "outro";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// ─── Detecção ─────────────────────────────────────────────────────────────────

function detectarPlataforma(): Plataforma {
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const isChrome = /Chrome/i.test(ua) && !/Edg|OPR/i.test(ua);
  if (isAndroid && isChrome) return "android-chrome";
  if (isIOS) return "ios-safari";
  return "outro";
}

function jaNoPWA(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.navigator as any).standalone === true
  );
}

// ─── Passos iOS ───────────────────────────────────────────────────────────────

const passosIOS = [
  {
    emoji: "⬆️",
    titulo: "Toque em Compartilhar",
    descricao: "No Safari, toque no ícone de compartilhar na barra inferior da tela.",
  },
  {
    emoji: "➕",
    titulo: "Adicionar à Tela de Início",
    descricao: 'Role as opções e toque em "Adicionar à Tela de Início".',
  },
  {
    emoji: "✅",
    titulo: 'Toque em "Adicionar"',
    descricao: "O ícone do Méc aparecerá na sua tela inicial como um app.",
  },
];

// ─── Componente principal ─────────────────────────────────────────────────────

export default function InstalarApp() {
  const navigate = useNavigate();
  const [carregando, setCarregando] = useState(true);
  const [plataforma, setPlataforma] = useState<Plataforma>("outro");
  const [instalando, setInstalando] = useState(false);
  const [recusou, setRecusou] = useState(false);
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);

  // Verifica sessão
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        navigate("/auth", { replace: true });
        return;
      }
      // Se já está no modo standalone (PWA instalado), vai direto para onboarding
      if (jaNoPWA()) {
        navigate("/team-onboarding", { replace: true });
        return;
      }
      setPlataforma(detectarPlataforma());
      setCarregando(false);
    });
  }, [navigate]);

  // Captura o evento beforeinstallprompt do Android/Chrome
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Detecta instalação concluída via appinstalled
  useEffect(() => {
    const handler = () => {
      setTimeout(() => navigate("/team-onboarding", { replace: true }), 1000);
    };
    window.addEventListener("appinstalled", handler);
    return () => window.removeEventListener("appinstalled", handler);
  }, [navigate]);

  const instalarAndroid = async () => {
    if (!deferredPrompt.current) {
      // prompt não disponível — fallback para link
      navigate("/team-onboarding", { replace: true });
      return;
    }
    setInstalando(true);
    try {
      await deferredPrompt.current.prompt();
      const { outcome } = await deferredPrompt.current.userChoice;
      deferredPrompt.current = null;
      if (outcome === "accepted") {
        // appinstalled event vai redirecionar; aguardar
        setTimeout(() => navigate("/team-onboarding", { replace: true }), 1500);
      } else {
        setRecusou(true);
        setInstalando(false);
      }
    } catch {
      setInstalando(false);
      setRecusou(true);
    }
  };

  const continuar = () => navigate("/team-onboarding", { replace: true });

  if (carregando) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 relative overflow-hidden">
      {/* Background decorativo */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-[420px] rounded-2xl bg-slate-900/80 border border-white/10 backdrop-blur-xl shadow-[0_0_60px_-15px_rgba(59,130,246,0.3)] p-6 sm:p-8 space-y-6">
        {/* Glow de borda */}
        <div className="absolute -inset-0.5 bg-gradient-to-b from-blue-500/20 via-transparent to-violet-500/10 rounded-2xl blur-sm -z-10 pointer-events-none" />

        {/* Header */}
        <div className="flex flex-col items-center gap-3 text-center">
          <img src={logoMec} alt="Méc" className="h-14" />
          <div>
            <h1 className="text-xl font-bold text-white leading-tight">
              Instale o app para começar
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              É rápido e não ocupa espaço como um app normal
            </p>
          </div>
        </div>

        {/* ── Fluxo Android ────────────────────────────────────────────── */}
        {plataforma === "android-chrome" && (
          <div className="space-y-4">
            <div className="rounded-xl bg-blue-600/10 border border-blue-500/20 p-4 text-center">
              <p className="text-sm text-blue-300">
                Detectamos que você está no <strong>Android com Chrome</strong>. Instale com um toque!
              </p>
            </div>

            {!recusou ? (
              <Button
                onClick={instalarAndroid}
                disabled={instalando}
                className="w-full h-12 bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 text-white border-0 font-semibold rounded-xl shadow-[0_0_24px_-6px_rgba(16,185,129,0.5)] hover:shadow-[0_0_32px_-6px_rgba(16,185,129,0.7)] transition-all duration-300 gap-2 text-base"
              >
                {instalando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Instalando…
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Instalar o AppMec agora
                  </>
                )}
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3">
                  <p className="text-xs text-amber-300 text-center">
                    Sem problemas! Você pode instalar depois pelas configurações do Chrome.
                  </p>
                </div>
                <Button
                  onClick={continuar}
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white border-0 font-semibold rounded-xl gap-2 text-base"
                >
                  Continuar sem instalar
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {!recusou && (
              <button
                onClick={continuar}
                className="w-full text-center text-xs text-slate-500 hover:text-slate-300 transition-colors py-1"
              >
                Continuar sem instalar →
              </button>
            )}
          </div>
        )}

        {/* ── Fluxo iOS ────────────────────────────────────────────────── */}
        {plataforma === "ios-safari" && (
          <div className="space-y-4">
            <div className="rounded-xl bg-blue-600/10 border border-blue-500/20 p-4 text-center">
              <p className="text-sm text-blue-300">
                No iPhone, a instalação é feita pelo <strong>Safari</strong>. Siga os passos:
              </p>
            </div>

            <div className="space-y-3">
              {passosIOS.map((passo, i) => (
                <div
                  key={i}
                  className="flex items-start gap-4 rounded-xl bg-slate-800/60 border border-white/10 p-4"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-700/80 border border-white/10 flex items-center justify-center text-xl">
                    {passo.emoji}
                  </div>
                  <div className="flex-1 pt-0.5">
                    <p className="text-sm font-semibold text-white">
                      <span className="text-blue-400 mr-1">{i + 1}.</span>
                      {passo.titulo}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                      {passo.descricao}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Indicador animado share iOS */}
            <div className="flex items-center justify-center gap-2 py-2">
              <div className="flex items-center gap-1.5 bg-slate-800/80 border border-white/10 rounded-full px-4 py-2">
                <Share className="h-4 w-4 text-blue-400 animate-bounce" />
                <span className="text-xs text-slate-300">Toque em compartilhar na barra do Safari</span>
              </div>
            </div>

            <Button
              onClick={continuar}
              className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white border-0 font-semibold rounded-xl gap-2 text-base"
            >
              Já adicionei, continuar
              <ArrowRight className="h-4 w-4" />
            </Button>
            <button
              onClick={continuar}
              className="w-full text-center text-xs text-slate-500 hover:text-slate-300 transition-colors py-1"
            >
              Pular, instalar depois →
            </button>
          </div>
        )}

        {/* ── Fallback (desktop ou outros browsers) ────────────────────── */}
        {plataforma === "outro" && (
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-4 rounded-xl bg-slate-800/60 border border-white/10 p-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-700/80 border border-white/10 flex items-center justify-center">
                  <PlusSquare className="h-5 w-5 text-blue-400" />
                </div>
                <div className="flex-1 pt-0.5">
                  <p className="text-sm font-semibold text-white">Instale pelo Chrome</p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                    Para instalar, acesse este site pelo <strong className="text-white">Google Chrome</strong> no celular e siga as instruções de instalação do navegador.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 rounded-xl bg-slate-800/60 border border-white/10 p-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-700/80 border border-white/10 flex items-center justify-center">
                  <Check className="h-5 w-5 text-emerald-400" />
                </div>
                <div className="flex-1 pt-0.5">
                  <p className="text-sm font-semibold text-white">Ou continue no navegador</p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                    Você pode usar o AppMec normalmente pelo navegador agora e instalar depois.
                  </p>
                </div>
              </div>
            </div>

            <Button
              onClick={continuar}
              className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white border-0 font-semibold rounded-xl gap-2 text-base"
            >
              Acessar o AppMec
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Banner de suporte */}
        <div className="rounded-xl bg-slate-800/50 border border-white/10 p-4 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-400 leading-relaxed">
            Precisando de ajuda para instalar?
          </p>
          <a
            href="https://wa.me/5519971454829"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-600 hover:bg-green-500 text-white text-xs font-medium transition-colors"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
