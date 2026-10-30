import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  Smartphone,
  Share,
  EllipsisVertical,
  SquarePlus,
  Download,
  Check,
  Monitor,
  MessageCircle,
  Apple,
  House,
  ChevronLeft,
  ChevronRight,
  Copy,
  TriangleAlert,
  ArrowUpRight,
  Phone,
  Calendar,
  Camera,
  Mail,
  Clock,
  Map as MapIcon,
  Music,
  Settings,
  Wallet,
  Cloud,
  Globe,
} from "lucide-react";

type SO = "ios" | "android" | "desktop";

interface Passo {
  icon: React.ElementType;
  titulo: string;
  descricao: string;
}

interface Guia {
  titulo: string;
  descricao: string;
  dica: ReactNode;
  passos: Passo[];
}

const passosIOS: Passo[] = [
  {
    icon: Share,
    titulo: "Toque em Compartilhar",
    descricao: "No Safari, toque no ícone de compartilhar na barra inferior da tela.",
  },
  {
    icon: SquarePlus,
    titulo: "Adicionar à Tela de Início",
    descricao: 'Role as opções e toque em "Adicionar à Tela de Início".',
  },
  {
    icon: Check,
    titulo: "Confirme",
    descricao: 'Toque em "Adicionar". O ícone do Méc aparecerá como um app na sua tela!',
  },
];

const passosAndroid: Passo[] = [
  {
    icon: EllipsisVertical,
    titulo: "Abra o menu do Chrome",
    descricao: "Acesse o Méc e toque nos três pontinhos no canto superior direito.",
  },
  {
    icon: Download,
    titulo: "Instalar aplicativo",
    descricao: 'Selecione "Instalar aplicativo" ou "Adicionar à tela inicial".',
  },
  {
    icon: Check,
    titulo: "Confirme a instalação",
    descricao: 'Toque em "Instalar". O Méc aparecerá na sua tela inicial.',
  },
];

const passosDesktop: Passo[] = [
  {
    icon: Monitor,
    titulo: "Abra o Méc no navegador",
    descricao: "Acesse o sistema pelo Chrome ou Edge.",
  },
  {
    icon: Download,
    titulo: "Localize a opção de instalação",
    descricao: "Clique no ícone de instalar na barra de endereços ou abra o menu do navegador.",
  },
  {
    icon: Check,
    titulo: "Conclua a instalação",
    descricao: "Confirme a instalação para abrir o Méc em uma janela própria.",
  },
];

const guias: Record<SO, Guia> = {
  ios: {
    titulo: "Instalar no iPhone / iPad",
    descricao: "Siga os passos abaixo para adicionar o Méc à tela de início do seu iPhone ou iPad.",
    dica: (
      <>
        <b>Atenção:</b> No iPhone, a instalação só funciona pelo navegador <b>Safari</b>. Se estiver usando
        Chrome ou outro navegador, abra o site no <b>Safari</b> primeiro.
      </>
    ),
    passos: passosIOS,
  },
  android: {
    titulo: "Instalar no Android",
    descricao: "Adicione o Méc à tela inicial do seu Android pelo Google Chrome.",
    dica: (
      <>
        <b>Dica:</b> No Chrome, a opção pode aparecer como "Instalar aplicativo" ou "Adicionar à tela
        inicial", dependendo do aparelho e navegador.
      </>
    ),
    passos: passosAndroid,
  },
  desktop: {
    titulo: "Instalar no Computador",
    descricao: "Use o Méc como aplicativo no seu computador sem precisar abrir uma aba toda vez.",
    dica: (
      <>
        <b>Dica:</b> As opções de instalação podem variar conforme o navegador utilizado. Prefira um
        navegador compatível com aplicativos web.
      </>
    ),
    passos: passosDesktop,
  },
};

const abas: { id: SO; label: string; icon: React.ElementType }[] = [
  { id: "ios", label: "iPhone (iOS)", icon: Apple },
  { id: "android", label: "Android", icon: Smartphone },
  { id: "desktop", label: "Computador", icon: Monitor },
];

// Miniaturas da tela do iPhone ao lado de cada passo — fixas, como no design.
const previews: ReactNode[] = [
  <div key="barra" className="flex w-full items-center justify-around rounded-lg bg-card p-3 text-muted-foreground">
    <ChevronLeft className="h-4 w-4" />
    <span className="grid h-10 w-10 place-items-center rounded-full border-2 border-blue-400 text-blue-600 dark:text-blue-400">
      <Share className="h-4 w-4" />
    </span>
    <Copy className="h-4 w-4" />
  </div>,
  <div key="acao" className="flex w-full items-center justify-center gap-2 rounded-lg bg-card p-3 text-[11px] text-foreground">
    <SquarePlus className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
    Adicionar à Tela de Início
  </div>,
  <div key="confirmar" className="flex gap-2 text-[11px]">
    <span className="rounded-lg bg-card p-3 text-foreground">Cancelar</span>
    <span className="rounded-lg bg-blue-600 p-3 text-white">Adicionar</span>
  </div>,
];

const appsTelaInicio: { icon: React.ElementType; nome: string }[] = [
  { icon: Phone, nome: "Telefone" },
  { icon: Calendar, nome: "Agenda" },
  { icon: Camera, nome: "Fotos" },
  { icon: Mail, nome: "Email" },
  { icon: Clock, nome: "Relógio" },
  { icon: MapIcon, nome: "Mapas" },
  { icon: Music, nome: "Música" },
  { icon: Settings, nome: "Ajustes" },
  { icon: Wallet, nome: "Carteira" },
  { icon: Cloud, nome: "Nuvem" },
  { icon: Globe, nome: "Safari" },
];

const opcoesCompartilhar = [
  "Copiar",
  "Adicionar à Lista de Leitura",
  "Adicionar aos Favoritos",
  "Adicionar à Tela de Início",
  "Imprimir",
  "Buscar na Página",
];

// Ilustração do iPhone: as cores representam a tela do aparelho, por isso não seguem o tema do app.
function CelularesIlustrados() {
  return (
    <div
      aria-hidden="true"
      className="flex h-[400px] items-center justify-center overflow-hidden min-[480px]:h-[480px] min-[760px]:h-[530px]"
    >
      {/* Desenhado em 470×530 e reduzido inteiro quando a coluna é estreita, para os aparelhos não se cortarem. */}
      <div className="relative h-[530px] w-[470px] shrink-0 scale-[0.72] min-[480px]:scale-90 lg:scale-100 min-[1440px]:scale-[0.85] min-[1680px]:scale-100">
        <div className="absolute left-1/2 top-1/2 aspect-square w-[95%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-100/70 blur-sm dark:bg-blue-500/10" />

        <div className="absolute left-[10px] top-[60px] z-[2] h-[450px] w-[228px] -rotate-[11deg] overflow-hidden rounded-[35px] border-[9px] border-slate-900 bg-slate-900 shadow-2xl shadow-blue-900/20">
          <div className="relative h-full bg-gradient-to-br from-sky-400 via-indigo-500 to-pink-400 px-3 pb-3 pt-9 text-white">
            <span className="absolute left-1/2 top-2 h-4 w-[70px] -translate-x-1/2 rounded-full bg-black" />
            <span className="absolute left-3.5 top-3 text-[11px] font-extrabold">9:41</span>
            <div className="mt-6 grid grid-cols-4 gap-x-1.5 gap-y-4">
              {appsTelaInicio.map(({ icon: Icon, nome }) => (
                <div key={nome}>
                  <div className="mx-auto grid h-[35px] w-[35px] place-items-center rounded-[10px] bg-white/80 text-blue-600 shadow">
                    <Icon className="h-[17px] w-[17px]" />
                  </div>
                  <div className="mt-1 text-center text-[8px]">{nome}</div>
                </div>
              ))}
              <div>
                <img
                  src="/apple-touch-icon-180x180-v2.png"
                  alt=""
                  className="mx-auto h-[35px] w-[35px] rounded-[10px] shadow"
                />
                <div className="mt-1 text-center text-[8px]">Méc</div>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute right-[10px] top-[20px] z-[1] h-[450px] w-[228px] rotate-[9deg] overflow-hidden rounded-[35px] border-[9px] border-slate-900 bg-slate-900 shadow-2xl shadow-blue-900/20">
          <div className="relative h-full bg-slate-100 px-3 pb-3 pt-9 text-slate-800">
            <span className="absolute left-1/2 top-2 h-4 w-[70px] -translate-x-1/2 rounded-full bg-black" />
            <span className="absolute left-3.5 top-3 text-[11px] font-extrabold">9:41</span>
            <div className="absolute inset-x-[3px] bottom-1 h-[76%] rounded-[20px] bg-white px-2.5 py-3.5">
              <div className="rounded-[10px] bg-slate-100 px-2 py-3 text-xs font-bold">📱 Méc — appmec.in</div>
              {opcoesCompartilhar.map((opcao) => (
                <div
                  key={opcao}
                  className={
                    opcao === "Adicionar à Tela de Início"
                      ? "flex items-center gap-1 border-b border-slate-200 bg-blue-100 px-1.5 py-3 text-[11px] font-bold text-blue-600"
                      : "border-b border-slate-200 px-1.5 py-3 text-[11px]"
                  }
                >
                  {opcao === "Adicionar à Tela de Início" && <SquarePlus className="h-3.5 w-3.5" />}
                  {opcao}
                </div>
              ))}
            </div>
          </div>
        </div>

        <ArrowUpRight
          className="absolute bottom-[40px] left-1/2 z-[3] h-16 w-16 translate-x-2 -rotate-[26deg] text-blue-600 dark:text-blue-400"
          strokeWidth={2.5}
        />
      </div>
    </div>
  );
}

export default function BaixarApp() {
  const [so, setSo] = useState<SO>("ios");

  const guia = guias[so];

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-[1420px] overflow-x-hidden p-4 sm:p-6 min-[760px]:px-8">
        {/* Breadcrumb */}
        <nav
          aria-label="Navegação"
          className="mb-6 flex items-center gap-3 text-[13px] text-muted-foreground min-[760px]:mb-9"
        >
          <Link to="/dashboard" aria-label="Início" className="transition-colors hover:text-foreground">
            <House className="h-4 w-4" />
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link to="/tutoriais" className="transition-colors hover:text-foreground">
            Tutoriais
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-semibold text-foreground">Baixar App</span>
        </nav>

        {/* Header */}
        <header className="mb-7 flex items-center gap-3 min-[760px]:gap-5">
          <div className="grid h-[54px] w-[54px] shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-blue-700 to-blue-500 text-white shadow-lg shadow-blue-500/20 min-[760px]:h-[68px] min-[760px]:w-[68px]">
            <Smartphone className="h-7 w-7 min-[760px]:h-8 min-[760px]:w-8" />
          </div>
          <div className="min-w-0">
            <h1 className="mb-1 text-[25px] font-bold tracking-tight text-foreground min-[760px]:mb-2 min-[760px]:text-[34px]">
              Baixar App
            </h1>
            <p className="text-xs text-muted-foreground min-[760px]:text-[15px]">
              Instale o Méc como aplicativo no seu celular ou computador — sem precisar de loja de apps.
            </p>
          </div>
        </header>

        {/* Abas de SO */}
        <div className="mb-5 flex flex-wrap gap-2 min-[760px]:gap-3">
          {abas.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setSo(id)}
              aria-pressed={so === id}
              className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border px-1.5 py-3 text-xs font-semibold transition-all min-[760px]:gap-3 min-[760px]:rounded-2xl lg:flex-none lg:px-7 min-[760px]:py-3.5 min-[760px]:text-base ${
                so === id
                  ? "border-transparent bg-gradient-to-r from-blue-700 to-blue-500 text-white shadow-lg shadow-blue-500/20"
                  : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0 min-[760px]:h-5 min-[760px]:w-5" />
              {label}
            </button>
          ))}
        </div>

        {/* Duas colunas só a partir de 1440px: a sidebar do app ocupa 16rem da janela. */}
        <div className="grid items-center gap-6 min-[1440px]:grid-cols-[minmax(0,1.2fr)_minmax(330px,0.75fr)]">
          {/* Card de passos */}
          <section className="min-w-0 rounded-[22px] border border-border bg-card p-4 shadow-sm min-[760px]:p-7">
            <span className="inline-flex rounded-full bg-blue-500/10 px-3 py-1.5 text-[11px] font-extrabold text-blue-600 dark:text-blue-400">
              PASSO A PASSO
            </span>
            <h2 className="mb-2 mt-3.5 text-xl font-bold tracking-tight text-foreground min-[760px]:text-[25px]">
              {guia.titulo}
            </h2>
            <p className="mb-5 text-sm leading-relaxed text-muted-foreground">{guia.descricao}</p>

            <div className="space-y-3">
              {guia.passos.map((passo, index) => {
                const Icon = passo.icon;
                return (
                  <div
                    key={index}
                    className="grid grid-cols-[32px_42px_minmax(0,1fr)] items-center gap-2.5 rounded-2xl border border-border p-3 lg:grid-cols-[42px_58px_minmax(0,1fr)_180px] min-[760px]:gap-4 min-[760px]:p-4"
                  >
                    <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-blue-500/15 text-[15px] font-extrabold text-blue-600 dark:text-blue-400 min-[760px]:h-[38px] min-[760px]:w-[38px] min-[760px]:text-xl">
                      {index + 1}
                    </span>
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 min-[760px]:h-[55px] min-[760px]:w-[55px] min-[760px]:rounded-2xl">
                      <Icon className="h-5 w-5 min-[760px]:h-7 min-[760px]:w-7" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="mb-1 text-sm font-semibold text-foreground">{passo.titulo}</h3>
                      <p className="text-xs leading-relaxed text-muted-foreground">{passo.descricao}</p>
                    </div>
                    <div className="col-span-full flex min-h-[65px] items-center justify-center rounded-xl bg-muted p-3 lg:col-span-1">
                      {previews[index]}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Dica da plataforma */}
            <div className="mt-5 flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
              <TriangleAlert className="h-5 w-5 shrink-0 text-amber-500" />
              <p>{guia.dica}</p>
            </div>
          </section>

          <CelularesIlustrados />
        </div>

        {/* Suporte */}
        <div className="mt-5 flex flex-wrap items-center gap-4 rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-sky-50 px-5 py-4 dark:border-blue-500/20 dark:from-blue-500/10 dark:to-sky-500/5 lg:flex-nowrap">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-green-500/15 text-green-600 dark:text-green-400">
            <MessageCircle className="h-7 w-7" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Precisando de ajuda?</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Chame nosso time no WhatsApp e te ajudamos a instalar.
            </p>
          </div>
          <a
            href="https://wa.me/5519971454829"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-2.5 whitespace-nowrap rounded-xl bg-gradient-to-r from-green-600 to-teal-600 px-5 py-3 text-sm font-bold text-white shadow-md transition-colors hover:from-green-500 hover:to-teal-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 lg:ml-auto lg:w-auto"
          >
            <MessageCircle className="h-4 w-4" />
            Falar no WhatsApp
            <ChevronRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </AppLayout>
  );
}
