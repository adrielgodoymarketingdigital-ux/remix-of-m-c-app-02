import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Smartphone,
  Share,
  MoreVertical,
  PlusSquare,
  Download,
  ChevronRight,
  ArrowRight,
  Check,
  Loader2,
  Monitor,
  MessageCircle,
} from "lucide-react";
import logoMec from "@/assets/logo-mec-auth.png";

type SO = "ios" | "android" | "desktop" | null;

function detectOS(): SO {
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

const passosAndroid = [
  {
    numero: 1,
    icon: MoreVertical,
    titulo: "Abra o menu do Chrome",
    descricao: 'Toque nos três pontinhos (⋮) no canto superior direito do navegador.',
  },
  {
    numero: 2,
    icon: Download,
    titulo: "Instalar aplicativo",
    descricao: 'Toque em "Instalar aplicativo" ou "Adicionar à tela inicial".',
  },
  {
    numero: 3,
    icon: Check,
    titulo: "Confirme a instalação",
    descricao: 'Toque em "Instalar". O ícone do Méc aparecerá na sua tela inicial!',
  },
];

const passosIOS = [
  {
    numero: 1,
    icon: Share,
    titulo: "Toque em Compartilhar",
    descricao: "Toque no ícone de compartilhar (↑) na barra inferior do Safari.",
  },
  {
    numero: 2,
    icon: PlusSquare,
    titulo: "Adicionar à Tela de Início",
    descricao: 'Role as opções e toque em "Adicionar à Tela de Início".',
  },
  {
    numero: 3,
    icon: Check,
    titulo: "Confirme",
    descricao: 'Toque em "Adicionar". O ícone do Méc aparecerá como um app!',
  },
];

const passosDesktop = [
  {
    numero: 1,
    icon: Monitor,
    titulo: "Acesse o site pelo Chrome",
    descricao: "Abra o Google Chrome no seu computador e acesse o site do Méc.",
  },
  {
    numero: 2,
    icon: Download,
    titulo: "Clique no ícone de instalar",
    descricao: 'Na barra de endereço (URL), clique no ícone de computador com uma seta (⬇) que aparece do lado direito.',
  },
  {
    numero: 3,
    icon: Check,
    titulo: "Confirme a instalação",
    descricao: 'Clique em "Instalar". O Méc abrirá como um app independente no seu computador!',
  },
];

export default function InstalarApp() {
  const navigate = useNavigate();
  const [dispositivo] = useState<"mobile" | "desktop">(() => {
    const ua = navigator.userAgent || "";
    if (/iPhone|iPad|iPod|Android/i.test(ua)) return "mobile";
    return "desktop";
  });
  const [so, setSo] = useState<"ios" | "android" | "desktop" | null>(null);
  const [carregando, setCarregando] = useState(true);

  // Verificar sessão — se não autenticado, redirecionar
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        navigate("/auth", { replace: true });
      } else {
        setCarregando(false);
      }
    });
  }, [navigate]);

  const continuar = () => {
    navigate("/dashboard");
  };

  if (carregando) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const passos = so === "ios" ? passosIOS : so === "android" ? passosAndroid : so === "desktop" ? passosDesktop : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 relative overflow-hidden">
      {/* Background effects — same as Auth */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />

      <Card className="relative w-full max-w-md p-6 sm:p-8 space-y-6 bg-slate-900/80 border border-white/10 backdrop-blur-xl shadow-[0_0_60px_-15px_rgba(59,130,246,0.3)]">
        <div className="absolute -inset-0.5 bg-gradient-to-b from-blue-500/20 via-transparent to-violet-500/10 rounded-lg blur-sm -z-10" />

        {/* Header */}
        <div className="flex flex-col items-center space-y-3 text-center">
          <img src={logoMec} alt="Méc" className="h-16" />
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-blue-400" />
            <h1 className="text-lg font-semibold text-white">Instale o app no celular</h1>
          </div>
          <p className="text-sm text-slate-400 max-w-xs">
            Use o Méc como um aplicativo no seu celular. É rápido e prático!
          </p>
        </div>

        {/* SO Toggle */}
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm text-slate-300">
            {dispositivo === "mobile" ? "Qual o sistema operacional do seu celular?" : "Qual dispositivo você está usando?"}
          </p>
          <div className="inline-flex items-center gap-1 bg-slate-800/80 rounded-full px-1.5 py-1.5 border border-white/10">
            <button
              onClick={() => setSo("ios")}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                so === "ios"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                  : "text-slate-400 hover:text-white hover:bg-slate-700/60"
              }`}
            >
              iPhone
            </button>
            <button
              onClick={() => setSo("android")}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                so === "android"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                  : "text-slate-400 hover:text-white hover:bg-slate-700/60"
              }`}
            >
              Android
            </button>
            {dispositivo === "desktop" && (
              <button
                onClick={() => setSo("desktop")}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                  so === "desktop"
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                    : "text-slate-400 hover:text-white hover:bg-slate-700/60"
                }`}
              >
                Computador
              </button>
            )}
          </div>
        </div>


        {/* Passos */}
        {passos && (
          <div className="space-y-4">
            {passos.map((passo) => {
              const Icon = passo.icon;
              return (
                <div key={passo.numero} className="flex gap-4 items-start">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-blue-400" />
                  </div>
                  <div className="flex-1 pt-0.5">
                    <p className="text-sm font-medium text-white">
                      <span className="text-blue-400 mr-1.5">{passo.numero}.</span>
                      {passo.titulo}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                      {passo.descricao}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Botões */}
        <div className="space-y-3 pt-2">
          <Button
            onClick={continuar}
            className="w-full h-11 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white border-0 shadow-[0_0_20px_-5px_rgba(59,130,246,0.5)] hover:shadow-[0_0_30px_-5px_rgba(59,130,246,0.7)] transition-all duration-300 gap-2"
          >
            Já instalei, continuar
            <ArrowRight className="h-4 w-4" />
          </Button>
          <button
            onClick={continuar}
            className="w-full text-center text-xs text-slate-500 hover:text-slate-300 transition-colors py-1"
          >
            Pular, instalar depois
          </button>
        </div>

        {/* Banner suporte */}
        <div className="rounded-lg bg-slate-800/60 border border-white/10 p-4 text-center space-y-2">
          <p className="text-xs text-slate-300">
            Caso não consiga instalar, nos chame no WhatsApp de suporte
          </p>
          <a
            href="https://wa.me/5519971454829"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-600 hover:bg-green-500 text-white text-sm font-medium transition-colors"
          >
            <MessageCircle className="h-4 w-4" />
            Chamar no WhatsApp
          </a>
        </div>
      </Card>
    </div>
  );
}
