import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  MessageCircle,
  Mail,
  HelpCircle,
  Crown,
  GraduationCap,
  House,
  ChevronRight,
  Headset,
  Lightbulb,
  Check,
  X,
  CirclePlay,
  Clock,
  Calendar,
  BookOpen,
  ArrowRight,
} from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { useAssinatura } from "@/hooks/useAssinatura";
import { Link, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { JanelaChat } from "@/components/chat/JanelaChat";
import { useTutorial } from "@/components/tutorial/TutorialContext";
import { getEstiloDaCor } from "@/components/tutoriais/CardCategoriaTutorial";
import { useIsDesktop } from "@/hooks/use-mobile";

// Acento fixo de cada canal; fundo, borda e texto do card seguem o tema
const COR_CHAT = "#076aff";
const COR_WHATSAPP = "#00a76a";
const COR_EMAIL = "#7033ff";
const COR_TUTORIAL = "#f26d07";

// Sobreposto de ~6% da cor do canal por cima do bg-card
const estiloCanal = (cor: string) =>
  ({ ...getEstiloDaCor(cor), "--acento-fundo": `${cor}0f` }) as CSSProperties;

const ACENTO_SUAVE =
  "bg-[var(--acento-suave)] text-[color:var(--acento)] dark:bg-[var(--acento-suave-escuro)] dark:text-[color:var(--acento-escuro)]";

const BOTAO =
  "mt-auto flex w-full items-center justify-center gap-2.5 rounded-xl px-3 text-[13px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const BOTAO_CHEIO = "py-3.5 text-white hover:opacity-90";

// 1px a menos de padding: a borda compensa e os botões dos cards ficam da mesma altura
const BOTAO_CONTORNO =
  "border py-[13px] border-[color:var(--acento)] text-[color:var(--acento)] hover:bg-[var(--acento-suave)] dark:border-[color:var(--acento-escuro)] dark:text-[color:var(--acento-escuro)] dark:hover:bg-[var(--acento-suave-escuro)]";

interface CardCanalProps {
  cor: string;
  icone: ReactNode;
  titulo: string;
  descricao: string;
  selo?: string;
  itens?: string[];
  bloqueado?: boolean;
  destacado?: boolean;
  aviso?: ReactNode;
  children: ReactNode;
}

function CardCanal({ cor, icone, titulo, descricao, selo, itens, bloqueado, destacado, aviso, children }: CardCanalProps) {
  return (
    <article
      style={estiloCanal(cor)}
      className={`flex flex-col rounded-2xl border bg-card p-5 shadow-sm ${
        bloqueado ? "" : "bg-gradient-to-br from-transparent to-[var(--acento-fundo)]"
      } ${destacado ? "border-[color:var(--acento-borda)]" : "border-border"}`}
    >
      {/* Em 4 colunas o card fica estreito: ícone em cima do título até caber lado a lado */}
      <div className="flex items-center gap-4 min-[1360px]:flex-col min-[1360px]:items-start min-[1520px]:flex-row min-[1520px]:items-center">
        <div
          className={`grid h-[60px] w-[60px] shrink-0 place-items-center rounded-2xl ${
            bloqueado ? "bg-muted text-muted-foreground" : ACENTO_SUAVE
          }`}
        >
          {icone}
        </div>
        <div className="min-w-0">
          <h2 className="mb-1 text-[18px] font-bold leading-tight tracking-tight text-foreground">{titulo}</h2>
          {/* Reserva 2 linhas em 4 colunas para os selos e listas alinharem entre os cards */}
          <p className="text-[13px] leading-snug text-muted-foreground min-[1360px]:min-h-[36px]">{descricao}</p>
        </div>
      </div>

      {selo && (
        <span className={`mt-4 inline-flex items-center gap-2 self-start rounded-full px-3 py-1.5 text-xs font-semibold ${ACENTO_SUAVE}`}>
          <span className="h-2 w-2 rounded-full bg-current" />
          {selo}
        </span>
      )}

      {aviso}

      {itens && (
        <ul className="mb-5 mt-4 space-y-2.5">
          {itens.map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-[13px] leading-snug text-muted-foreground">
              <Check className="mt-px h-4 w-4 shrink-0 text-[color:var(--acento)] dark:text-[color:var(--acento-escuro)]" />
              {item}
            </li>
          ))}
        </ul>
      )}

      {children}
    </article>
  );
}

interface CartaoHorarioProps {
  cor: string;
  icone: ReactNode;
  nome: string;
  etiqueta: string;
  linhas: [string, string];
}

function CartaoHorario({ cor, icone, nome, etiqueta, linhas }: CartaoHorarioProps) {
  return (
    <div style={getEstiloDaCor(cor)} className="rounded-xl border border-border bg-muted/40 p-4">
      <div className="mb-3.5 flex items-center gap-2.5">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${ACENTO_SUAVE}`}>{icone}</span>
        <h3 className="text-sm font-semibold text-foreground">{nome}</h3>
        <span className={`ml-auto whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${ACENTO_SUAVE}`}>
          {etiqueta}
        </span>
      </div>
      <p className="mb-2.5 flex items-start gap-2.5 text-[13px] leading-snug text-muted-foreground">
        <Calendar className="mt-px h-4 w-4 shrink-0" />
        {linhas[0]}
      </p>
      <p className="flex items-start gap-2.5 text-[13px] leading-snug text-muted-foreground">
        <Clock className="mt-px h-4 w-4 shrink-0" />
        {linhas[1]}
      </p>
    </div>
  );
}

function SuporteContent() {
  const { assinatura } = useAssinatura();
  const navigate = useNavigate();
  const [chatAberto, setChatAberto] = useState(false);
  const { startTutorial, isActive: tutorialAtivo } = useTutorial();
  const isDesktop = useIsDesktop();
  const chatRef = useRef<HTMLDivElement>(null);
  const [pedidoRolagem, setPedidoRolagem] = useState(0);

  useEffect(() => {
    if (pedidoRolagem > 0) chatRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [pedidoRolagem]);

  const abrirChatERolar = () => {
    setChatAberto(true);
    setPedidoRolagem((n) => n + 1);
  };

  const temAcessoWhatsApp = assinatura?.plano_tipo &&
    (assinatura.plano_tipo.includes('intermediario') ||
     assinatura.plano_tipo.includes('profissional') ||
     assinatura.plano_tipo === 'admin');

  const handleWhatsApp = () => {
    const phoneNumber = "5519971454829";
    const message = "Olá! Preciso de suporte com o Méc.";
    window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`, "_blank");
  };

  const handleEmail = () => {
    const email = "suporte@zak360.com";
    const subject = "Solicitação de Suporte - Méc";
    const body = "Olá,\n\nPreciso de ajuda com o seguinte:\n\n";
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  // Computador (a partir de 1024px): layout novo. Abaixo disso segue o layout de sempre.
  if (isDesktop) {
    return (
      <div className="mx-auto w-full max-w-[1500px] overflow-x-hidden px-8 py-6">
        <nav aria-label="Navegação" className="mb-6 flex items-center gap-3 text-[13px] text-muted-foreground">
          <Link to="/dashboard" aria-label="Início" className="transition-colors hover:text-foreground">
            <House className="h-4 w-4" />
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-semibold text-foreground">Suporte</span>
        </nav>

        <header className="mb-5 flex flex-wrap items-center justify-between gap-5">
          <div className="flex min-w-0 items-center gap-5">
            <div className="grid h-[66px] w-[66px] shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-blue-700 to-blue-500 text-white shadow-lg shadow-blue-500/20">
              <Headset className="h-8 w-8" />
            </div>
            <div className="min-w-0">
              <h1 className="mb-1.5 text-[30px] font-bold tracking-tight text-foreground">Suporte</h1>
              <p className="text-[15px] text-muted-foreground">Entre em contato conosco. Estamos aqui para ajudar!</p>
            </div>
          </div>

          <Link
            to="/ajuda"
            style={getEstiloDaCor(COR_CHAT)}
            className="flex w-full items-center gap-4 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm min-[1200px]:w-auto transition-all hover:border-[color:var(--acento-borda)] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${ACENTO_SUAVE}`}>
              <Lightbulb className="h-6 w-6" />
            </span>
            <span className="min-w-0">
              <strong className="mb-1 block text-[13px] font-semibold text-foreground">Precisa de ajuda rápida?</strong>
              <small className="block text-xs text-muted-foreground">Confira os guias e aprenda a usar cada módulo.</small>
            </span>
            <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        </header>

        <section className="mb-5 grid grid-cols-2 gap-3 min-[1360px]:grid-cols-4">
          <CardCanal
            cor={COR_CHAT}
            icone={<MessageCircle className="h-[30px] w-[30px]" />}
            titulo="Chat de Suporte"
            descricao="Converse com nossa equipe em tempo real."
            selo="Dentro do sistema"
            itens={["Tire suas dúvidas rapidamente", "Fale com nossa equipe", "Resposta de um atendente real"]}
            destacado={chatAberto}
          >
            <button
              onClick={() => setChatAberto(!chatAberto)}
              aria-expanded={chatAberto}
              className={`${BOTAO} ${
                chatAberto
                  ? BOTAO_CONTORNO
                  : `${BOTAO_CHEIO} bg-gradient-to-r from-[#2165f7] to-[#0389ad]`
              }`}
            >
              {chatAberto ? <X className="h-[18px] w-[18px]" /> : <MessageCircle className="h-[18px] w-[18px]" />}
              {chatAberto ? "Fechar Chat" : "Abrir Chat"}
            </button>
          </CardCanal>

          {temAcessoWhatsApp ? (
            <CardCanal
              cor={COR_WHATSAPP}
              icone={<FaWhatsapp className="h-[30px] w-[30px]" />}
              titulo="WhatsApp"
              descricao="Atendimento rápido e direto pelo WhatsApp."
              selo="Resposta rápida"
              itens={["Fale com nossa equipe", "Receba suporte em tempo real", "Envie fotos e vídeos se necessário"]}
            >
              <button
                onClick={handleWhatsApp}
                className={`${BOTAO} ${BOTAO_CHEIO} bg-gradient-to-r from-[#049a57] to-[#00877a]`}
              >
                <FaWhatsapp className="h-[18px] w-[18px]" />
                Abrir WhatsApp
              </button>
            </CardCanal>
          ) : (
            <CardCanal
              cor={COR_WHATSAPP}
              icone={<FaWhatsapp className="h-[30px] w-[30px]" />}
              titulo="WhatsApp"
              descricao="Atendimento rápido e direto pelo WhatsApp."
              bloqueado
              aviso={
                <div className="mb-5 mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3.5 dark:border-amber-800 dark:bg-amber-950/20">
                  <div className="flex items-start gap-2.5">
                    <Crown className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                    <div>
                      <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">Recurso Premium</p>
                      <p className="mt-1 text-xs leading-snug text-amber-700 dark:text-amber-300">
                        Suporte pelo WhatsApp disponível apenas nos planos Intermediário e Profissional
                      </p>
                    </div>
                  </div>
                </div>
              }
            >
              <button
                onClick={() => navigate("/plano")}
                className={`${BOTAO} border border-amber-500 py-[13px] text-amber-700 hover:bg-amber-500/10 dark:text-amber-300`}
              >
                <Crown className="h-[18px] w-[18px]" />
                Ver Planos
              </button>
            </CardCanal>
          )}

          <CardCanal
            cor={COR_EMAIL}
            icone={<Mail className="h-[30px] w-[30px]" />}
            titulo="Email"
            descricao="Envie sua mensagem detalhada."
            selo="Resposta em até 24 horas"
            itens={["Descreva sua dúvida ou problema", "Envie arquivos e prints", "Receba um retorno por email"]}
          >
            <button onClick={handleEmail} className={`${BOTAO} ${BOTAO_CONTORNO}`}>
              <Mail className="h-[18px] w-[18px]" />
              Enviar Email
            </button>
          </CardCanal>

          <CardCanal
            cor={COR_TUTORIAL}
            icone={<GraduationCap className="h-[30px] w-[30px]" />}
            titulo="Tutorial do Sistema"
            descricao="Conheça o Méc em um tour guiado."
            selo="Tour guiado"
            itens={["Começa no Dashboard e segue pelo menu", "Apresenta as principais áreas do sistema", "Ideal para novos usuários"]}
          >
            <button
              onClick={startTutorial}
              disabled={tutorialAtivo}
              className={`${BOTAO} ${BOTAO_CONTORNO} bg-[var(--acento-suave)] dark:bg-[var(--acento-suave-escuro)] disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <CirclePlay className="h-[18px] w-[18px]" />
              {tutorialAtivo ? "Tutorial em andamento..." : "Iniciar Tutorial"}
            </button>
          </CardCanal>
        </section>

        {chatAberto && (
          <Card ref={chatRef} className="mb-5 flex h-[500px] flex-col overflow-hidden">
            <JanelaChat onClose={() => setChatAberto(false)} />
          </Card>
        )}

        <section className="mb-5 grid grid-cols-1 gap-3 min-[1280px]:grid-cols-[1.5fr_1fr]">
          <div style={getEstiloDaCor(COR_CHAT)} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-4">
              <span className={`grid h-[52px] w-[52px] shrink-0 place-items-center rounded-xl ${ACENTO_SUAVE}`}>
                <Clock className="h-7 w-7" />
              </span>
              <div className="min-w-0">
                <h2 className="mb-1 text-[18px] font-bold tracking-tight text-foreground">Horário de Atendimento</h2>
                <p className="text-[13px] text-muted-foreground">
                  Nossos canais de suporte estão disponíveis nos seguintes horários:
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <CartaoHorario
                cor={COR_WHATSAPP}
                icone={<FaWhatsapp className="h-6 w-6" />}
                nome="WhatsApp"
                etiqueta="Atendimento"
                linhas={["Segunda a Sexta: 8h às 18h", "Sábado: 8h às 12h"]}
              />
              <CartaoHorario
                cor={COR_EMAIL}
                icone={<Mail className="h-6 w-6" />}
                nome="Email"
                etiqueta="24h para envio"
                linhas={["24 horas por dia, 7 dias por semana", "Resposta em até 24 horas úteis"]}
              />
            </div>
          </div>

          <div style={getEstiloDaCor(COR_CHAT)} className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-4">
              <span className={`grid h-[52px] w-[52px] shrink-0 place-items-center rounded-xl ${ACENTO_SUAVE}`}>
                <BookOpen className="h-7 w-7" />
              </span>
              <div className="min-w-0">
                <h2 className="mb-1 text-[18px] font-bold tracking-tight text-foreground">Guias por módulo</h2>
                <p className="text-[13px] text-muted-foreground">
                  Veja como usar cada módulo do sistema, passo a passo.
                </p>
              </div>
            </div>
            <p className="mb-5 text-[13px] leading-relaxed text-muted-foreground">
              Cada guia explica para que serve a tela e mostra o caminho para usá-la no dia a dia.
            </p>
            <Link to="/ajuda" className={`${BOTAO} ${BOTAO_CONTORNO}`}>
              Ver guias de ajuda
              <ArrowRight className="h-[18px] w-[18px]" />
            </Link>
          </div>
        </section>

        <section
          style={getEstiloDaCor(COR_CHAT)}
          className="relative flex items-center gap-5 overflow-hidden rounded-2xl border border-[color:var(--acento-borda)] bg-[var(--acento-suave)] px-7 py-5 dark:bg-[var(--acento-suave-escuro)]"
        >
          <span aria-hidden className="absolute -bottom-28 -right-5 h-[150px] w-[150px] rounded-full bg-[var(--acento-borda)] opacity-50" />
          <span className="grid h-[60px] w-[60px] shrink-0 place-items-center rounded-2xl bg-[var(--acento-suave)] text-[color:var(--acento)] dark:bg-[var(--acento-suave-escuro)] dark:text-[color:var(--acento-escuro)]">
            <Headset className="h-[30px] w-[30px]" />
          </span>
          <div className="min-w-0">
            <h2 className="mb-1 text-[18px] font-bold tracking-tight text-foreground">Ainda precisa de ajuda?</h2>
            <p className="text-[13px] text-muted-foreground">
              Nossa equipe está pronta para te atender e resolver qualquer dúvida.
            </p>
          </div>
          <button
            onClick={abrirChatERolar}
            className="relative z-[1] ml-auto flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-xl bg-gradient-to-r from-blue-700 to-blue-500 px-7 py-3.5 text-[13px] font-semibold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <MessageCircle className="h-[18px] w-[18px]" />
            Falar com o Suporte
          </button>
        </section>
      </div>
    );
  }

  return (
    <main className="flex-1 p-6 overflow-auto">
      <div className="max-w-4xl lg:max-w-none mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Suporte</h1>
          <p className="text-muted-foreground">
            Entre em contato conosco. Estamos aqui para ajudar!
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <MessageCircle className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle>Chat de Suporte</CardTitle>
                  <CardDescription>Converse com nossa equipe</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Abra o chat e fale diretamente com nosso time de suporte dentro do sistema.
              </p>
              <Button onClick={() => setChatAberto(!chatAberto)} className="w-full">
                <MessageCircle className="mr-2 h-4 w-4" />
                {chatAberto ? "Fechar Chat" : "Abrir Chat"}
              </Button>
            </CardContent>
          </Card>

          <Card className={`hover:shadow-lg transition-shadow ${!temAcessoWhatsApp ? 'opacity-60' : ''}`}>
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-green-500/10 rounded-lg">
                  <MessageCircle className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <CardTitle>WhatsApp</CardTitle>
                  <CardDescription>Atendimento rápido e direto</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!temAcessoWhatsApp && (
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4">
                  <div className="flex items-start gap-2">
                    <Crown className="h-5 w-5 text-amber-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                        Recurso Premium
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                        Suporte pelo WhatsApp disponível apenas nos planos Intermediário e Profissional
                      </p>
                    </div>
                  </div>
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                Fale conosco pelo WhatsApp e receba atendimento em tempo real.
              </p>
              {temAcessoWhatsApp ? (
                <Button
                  onClick={handleWhatsApp}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Abrir WhatsApp
                </Button>
              ) : (
                <Button
                  onClick={() => navigate('/plano')}
                  variant="outline"
                  className="w-full"
                >
                  <Crown className="mr-2 h-4 w-4" />
                  Ver Planos
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <Mail className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <CardTitle>Email</CardTitle>
                  <CardDescription>Envie sua mensagem detalhada</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Prefere enviar um email? Descreva sua dúvida ou problema com detalhes.
              </p>
              <ul className="text-sm space-y-2 text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-blue-600" />
                  Resposta em até 24 horas
                </li>
                <li className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-blue-600" />
                  Anexe arquivos e prints
                </li>
              </ul>
              <Button
                onClick={handleEmail}
                variant="outline"
                className="w-full border-blue-600 text-blue-600 hover:bg-blue-50"
              >
                <Mail className="mr-2 h-4 w-4" />
                Enviar Email
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-blue-600/10 rounded-lg">
                  <GraduationCap className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <CardTitle>Tutorial do Sistema</CardTitle>
                  <CardDescription>Aprenda a usar o MÉC</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Inicie o tour guiado para conhecer todas as funcionalidades do sistema passo a passo.
              </p>
              <Button
                onClick={startTutorial}
                disabled={tutorialAtivo}
                variant="outline"
                className="w-full border-blue-600 text-blue-600 hover:bg-blue-50"
              >
                <GraduationCap className="mr-2 h-4 w-4" />
                {tutorialAtivo ? "Tutorial em andamento..." : "Iniciar Tutorial"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {chatAberto && (
          <Card className="h-[500px] flex flex-col overflow-hidden">
            <JanelaChat onClose={() => setChatAberto(false)} />
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Horário de Atendimento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h4 className="font-medium mb-2">WhatsApp</h4>
                <p className="text-sm text-muted-foreground">
                  Segunda a Sexta: 8h às 18h<br />
                  Sábado: 8h às 12h
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-2">Email</h4>
                <p className="text-sm text-muted-foreground">
                  24 horas por dia, 7 dias por semana<br />
                  Resposta em até 24 horas úteis
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default function Suporte() {
  return (
    <AppLayout>
      <SuporteContent />
    </AppLayout>
  );
}
