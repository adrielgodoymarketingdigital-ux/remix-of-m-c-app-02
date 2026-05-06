import { useState } from "react";
import {
  Smartphone,
  Share,
  MoreVertical,
  PlusSquare,
  Download,
  Check,
  Monitor,
  MessageCircle,
  Apple,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type SO = "ios" | "android" | "desktop";

const passosAndroid = [
  {
    icon: MoreVertical,
    titulo: "Abra o menu do Chrome",
    descricao: 'Toque nos três pontinhos (⋮) no canto superior direito do navegador Chrome.',
  },
  {
    icon: Download,
    titulo: "Instalar aplicativo",
    descricao: 'Toque em "Instalar aplicativo" ou "Adicionar à tela inicial".',
  },
  {
    icon: Check,
    titulo: "Confirme a instalação",
    descricao: 'Toque em "Instalar". O ícone do Méc aparecerá na sua tela inicial!',
  },
];

const passosIOS = [
  {
    icon: Share,
    titulo: "Toque em Compartilhar",
    descricao: "No Safari, toque no ícone de compartilhar (↑) na barra inferior da tela.",
  },
  {
    icon: PlusSquare,
    titulo: "Adicionar à Tela de Início",
    descricao: 'Role as opções e toque em "Adicionar à Tela de Início".',
  },
  {
    icon: Check,
    titulo: "Confirme",
    descricao: 'Toque em "Adicionar". O ícone do Méc aparecerá como um app na sua tela!',
  },
];

const passosDesktop = [
  {
    icon: Monitor,
    titulo: "Acesse pelo Google Chrome",
    descricao: "Abra o Google Chrome no seu computador e acesse o sistema normalmente.",
  },
  {
    icon: Download,
    titulo: "Clique no ícone de instalar",
    descricao: 'Na barra de endereço, clique no ícone de computador com seta (⬇) que aparece do lado direito.',
  },
  {
    icon: Check,
    titulo: "Confirme a instalação",
    descricao: 'Clique em "Instalar". O Méc abrirá como um app independente no seu computador!',
  },
];

const abas: { id: SO; label: string; icon: React.ElementType }[] = [
  { id: "ios", label: "iPhone (iOS)", icon: Apple },
  { id: "android", label: "Android", icon: Smartphone },
  { id: "desktop", label: "Computador", icon: Monitor },
];

export default function BaixarApp() {
  const [so, setSo] = useState<SO>("ios");

  const passos = so === "ios" ? passosIOS : so === "android" ? passosAndroid : passosDesktop;

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-white flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-blue-400" />
          Baixar App
        </h1>
        <p className="text-sm text-slate-400">
          Instale o Méc como aplicativo no seu celular ou computador — sem precisar de loja de apps.
        </p>
      </div>

      {/* Abas de SO */}
      <div className="flex gap-2 flex-wrap">
        {abas.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setSo(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-all ${
              so === id
                ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20"
                : "bg-slate-800/60 border-white/10 text-slate-400 hover:text-white hover:bg-slate-700/60"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Card de passos */}
      <div className="rounded-xl bg-slate-900/60 border border-white/10 p-5 space-y-5">
        <p className="text-xs text-slate-500 uppercase tracking-wider font-mono">
          Passo a passo —{" "}
          {so === "ios" ? "iPhone / iPad" : so === "android" ? "Android (Chrome)" : "Computador (Chrome)"}
        </p>

        <div className="space-y-5">
          {passos.map((passo, index) => {
            const Icon = passo.icon;
            return (
              <div key={index} className="flex gap-4 items-start">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-blue-400" />
                </div>
                <div className="flex-1 pt-0.5">
                  <p className="text-sm font-medium text-white">
                    <span className="text-blue-400 mr-1.5">{index + 1}.</span>
                    {passo.titulo}
                  </p>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    {passo.descricao}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dica iOS Safari */}
      {so === "ios" && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3">
          <p className="text-xs text-amber-300">
            <span className="font-semibold">Atenção:</span> No iPhone, a instalação só funciona pelo navegador <span className="font-semibold">Safari</span>. Se estiver usando Chrome ou outro browser, abra o site no Safari primeiro.
          </p>
        </div>
      )}

      {/* Dica Android */}
      {so === "android" && (
        <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 px-4 py-3">
          <p className="text-xs text-blue-300">
            <span className="font-semibold">Dica:</span> A opção de instalar só aparece no <span className="font-semibold">Google Chrome</span>. Se não aparecer, tente acessar pelo Chrome e recarregue a página.
          </p>
        </div>
      )}

      {/* Suporte */}
      <div className="rounded-xl bg-slate-800/40 border border-white/10 p-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-white">Precisando de ajuda?</p>
          <p className="text-xs text-slate-400 mt-0.5">Chame no WhatsApp e te ajudamos a instalar.</p>
        </div>
        <a
          href="https://wa.me/5519971454829"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button size="sm" className="bg-green-600 hover:bg-green-500 text-white border-0 gap-2 whitespace-nowrap">
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </Button>
        </a>
      </div>
    </div>
  );
}
