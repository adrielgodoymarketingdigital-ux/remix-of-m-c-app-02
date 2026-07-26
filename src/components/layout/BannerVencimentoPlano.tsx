import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle, Calendar, ChevronRight,
  ShieldCheck, RefreshCw, Headphones, Sparkles, UserCheck,
} from "lucide-react";
import { useAssinatura } from "@/hooks/useAssinatura";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SELOS_INSTITUCIONAIS = [
  { icone: ShieldCheck, titulo: "Segurança", subtitulo: "100% Protegido" },
  { icone: RefreshCw, titulo: "Renovação", subtitulo: "Automática" },
  { icone: Headphones, titulo: "Suporte", subtitulo: "Sempre disponível" },
  { icone: Sparkles, titulo: "Atualizações", subtitulo: "Em dia" },
  { icone: UserCheck, titulo: "Satisfação", subtitulo: "98% de aprovação" },
];

export function BannerVencimentoPlano() {
  const { assinatura } = useAssinatura();
  const { isFuncionario } = useFuncionarioPermissoes();
  const navigate = useNavigate();
  const [detalhesAbertos, setDetalhesAbertos] = useState(false);

  const bannerInfo = useMemo(() => {
    if (!assinatura || isFuncionario) return null;

    const planoTipo = assinatura.plano_tipo;
    const status = assinatura.status;

    // Não mostrar para admin, free, trial, demonstracao
    if (["free", "trial", "demonstracao"].includes(planoTipo)) return null;

    const assinaturaAny = assinatura as any;
    const dataFim = assinaturaAny.data_fim || assinaturaAny.data_proxima_cobranca;

    if (!dataFim) return null;

    // Cartão renova automaticamente via Pagar.me — não exibir banner de vencimento
    // enquanto a assinatura estiver ativa. Só Pix (ou status problemático) precisa de aviso manual.
    const paymentMethod = assinaturaAny.payment_method as string | null | undefined;
    const isCartaoAutomatico =
      paymentMethod === "credit_card" ||
      paymentMethod === "cartao" ||
      !!assinaturaAny.pagarme_subscription_id;

    const dataVencimento = new Date(dataFim);
    const agora = new Date();
    const diffMs = dataVencimento.getTime() - agora.getTime();
    const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    // % do período já decorrido, com base no início real da assinatura —
    // mesma janela de datas usada para diasRestantes, sem cálculo paralelo.
    const dataInicio = assinaturaAny.data_inicio ? new Date(assinaturaAny.data_inicio) : null;
    let percentualDecorrido: number | null = null;
    if (dataInicio && dataVencimento.getTime() > dataInicio.getTime()) {
      const duracaoTotalMs = dataVencimento.getTime() - dataInicio.getTime();
      const decorridoMs = agora.getTime() - dataInicio.getTime();
      percentualDecorrido = Math.min(100, Math.max(0, Math.round((decorridoMs / duracaoTotalMs) * 100)));
    }

    // Plano ativo ou com cobrança problemática - mostrar data de vencimento
    if (status === "active" || status === "trialing" || status === "past_due" || status === "unpaid") {
      const isProblem = status === "past_due" || status === "unpaid";

      // past_due/unpaid: sempre mostrar banner urgente, independente de dias restantes
      if (!isProblem) {
        // Cartão ativo = renovação automática. Só mostra banner se já venceu
        // (cobrança automática falhou e precisa de ação do usuário).
        if (isCartaoAutomatico && planoTipo !== "admin" && diasRestantes > 0) {
          return null;
        }
      }

      const dataFormatada = format(dataVencimento, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

      // Cobrança falhou (past_due/unpaid): sempre urgente, pede atualização imediata
      if (isProblem) {
        return {
          tipo: "vencido" as const,
          texto: "Falha no pagamento da sua assinatura",
          destaque: "Atualize seu método de pagamento",
          botao: "Atualizar pagamento",
          diasRestantes,
          percentualDecorrido,
        };
      }

      // Carência de 1 dia após o vencimento (Ticto não libera renovação no mesmo dia)
      if (diasRestantes <= -1) {
        return {
          tipo: "vencido" as const,
          texto: isCartaoAutomatico ? "Não conseguimos renovar sua assinatura automaticamente" : "Sua assinatura venceu",
          destaque: dataFormatada,
          botao: isCartaoAutomatico ? "Atualizar pagamento" : "Renovar plano",
          diasRestantes,
          percentualDecorrido,
        };
      }

      if (diasRestantes <= 0) {
        return {
          tipo: "urgente" as const,
          texto: isCartaoAutomatico ? "Falha na cobrança automática — 1 dia de carência" : "Sua assinatura venceu — 1 dia de carência",
          destaque: dataFormatada,
          botao: isCartaoAutomatico ? "Atualizar pagamento" : "Renovar plano",
          diasRestantes,
          percentualDecorrido,
        };
      }

      if (diasRestantes <= 3) {
        return {
          tipo: "urgente" as const,
          texto: `Sua assinatura expira em ${diasRestantes} dia${diasRestantes > 1 ? "s" : ""}`,
          destaque: dataFormatada,
          botao: "Upgrade de plano",
          diasRestantes,
          percentualDecorrido,
        };
      }

      return {
        tipo: "aviso" as const,
        texto: "Sua assinatura expira em",
        destaque: dataFormatada,
        botao: "Ver plano atual",
        diasRestantes,
        percentualDecorrido,
      };
    }

    return null;
  }, [assinatura, isFuncionario]);

  if (!bannerInfo) return null;

  const isVencido = bannerInfo.tipo === "vencido";
  const isUrgente = bannerInfo.tipo === "urgente";

  // Banner agora é um cartão cheio de gradiente vibrante (não mais um card
  // neutro com glow sutil) — a cor domina o bloco inteiro, texto em branco,
  // para ficar visualmente impactante em vez de discreto.
  const gradient = isVencido
    ? "from-red-600 via-rose-600 to-red-700"
    : isUrgente
    ? "from-amber-500 via-orange-500 to-rose-500"
    : "from-blue-600 via-primary to-indigo-600";
  const glowShadow = isVencido
    ? "shadow-[0_8px_30px_-8px_rgba(225,29,72,0.65)]"
    : isUrgente
    ? "shadow-[0_8px_30px_-8px_rgba(249,115,22,0.65)]"
    : "shadow-[0_8px_30px_-8px_hsl(var(--primary)/0.55)]";
  const dotColor = "bg-white";
  const Icon = isVencido || isUrgente ? AlertTriangle : Calendar;

  const { diasRestantes, percentualDecorrido } = bannerInfo;
  const diasLabel = Math.max(0, diasRestantes ?? 0);

  return (
    <>
      <div className="px-4 pt-2">
        <button
          type="button"
          onClick={() => setDetalhesAbertos(true)}
          className={`group relative w-full overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} ${glowShadow} transition-transform active:scale-[0.99]`}
        >
          {/* Textura decorativa: blobs translúcidos + malha diagonal sutil,
              para o gradiente não ficar chapado mesmo ocupando o cartão inteiro. */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_120%,rgba(255,255,255,0.25),transparent_55%)]" />
          <div className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-white/15 blur-2xl" />
          <div className="pointer-events-none absolute -left-8 -bottom-14 h-24 w-24 rounded-full bg-black/10 blur-2xl" />

          {/* Barra de progresso fina colada na borda superior, com brilho percorrendo */}
          {percentualDecorrido !== null && (
            <div className="absolute inset-x-0 top-0 h-[3px] bg-black/20 overflow-hidden">
              <div
                className="relative h-full bg-white/90 transition-all duration-700"
                style={{ width: `${percentualDecorrido}%` }}
              >
                <span className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/70 to-transparent [background-size:200%_100%]" />
              </div>
            </div>
          )}

          <div className="relative flex flex-col gap-3 px-4 py-3.5">
            <div className="flex items-center gap-3">
              {/* Indicador "ao vivo" + ícone, estilo ping usado em AcompanharOS */}
              <div className="relative shrink-0">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 ring-1 ring-white/40 backdrop-blur-sm">
                  <Icon className="h-4.5 w-4.5 text-white" />
                </span>
                <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
                  <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${dotColor} opacity-75`} />
                  <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${dotColor} ring-2 ring-white/30`} />
                </span>
              </div>

              {/* Texto principal — rótulo + data por extenso, sem truncar. Usa a
                  largura toda disponível na primeira linha (ícone + selo de dias). */}
              <div className="min-w-0 flex-1 leading-none">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-white/80">
                  {isVencido ? "Plano vencido" : "Plano ativo"}
                </p>
                <p className="mt-1 text-[13px] font-bold leading-snug text-white">
                  {bannerInfo.destaque}
                </p>
              </div>

              {/* Dias restantes em destaque numérico — só faz sentido quando ainda há
                  contagem regressiva ativa (aviso/urgente). Em "vencido" o problema já
                  é a cobrança em si, então o número de dias é irrelevante e some daqui
                  (o dado segue intacto em bannerInfo, só não é exibido nesta linha). */}
              {!isVencido && diasRestantes !== null && diasRestantes !== undefined && (
                <div className="flex shrink-0 items-baseline gap-0.5 rounded-full bg-white/15 px-2 py-1 ring-1 ring-white/25">
                  <span className="text-lg font-black tabular-nums leading-none text-white">{diasLabel}</span>
                  <span className="text-[10px] font-medium uppercase tracking-wide text-white/75">d</span>
                </div>
              )}
            </div>

            {/* CTA em linha própria, largura total — o texto completo do botão
                (bannerInfo.botao) sempre cabe sem truncar, em vez de disputar
                espaço com data e selo de dias na mesma linha. */}
            <span
              role="button"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                navigate("/plano");
              }}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition-transform group-active:scale-[0.98]"
            >
              {bannerInfo.botao}
              <ChevronRight className="h-4 w-4 shrink-0" />
            </span>
          </div>
        </button>
      </div>

      {/* Detalhes expandidos: progresso detalhado + selos institucionais.
          Não cabiam na linha única do banner sem poluir o layout compacto pedido —
          viram um dialog acessível ao toque, preservando o conteúdo (nada foi removido). */}
      <Dialog open={detalhesAbertos} onOpenChange={setDetalhesAbertos}>
        <DialogContent className="overflow-hidden p-0 sm:max-w-md">
          {/* Cabeçalho em gradiente cheio, ecoando o cartão do banner, em vez de
              um dialog neutro com um badge de ícone pequeno. */}
          <div className={`relative overflow-hidden bg-gradient-to-br ${gradient} px-6 pb-6 pt-6`}>
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_120%,rgba(255,255,255,0.25),transparent_55%)]" />
            <div className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-white/15 blur-2xl" />

            <DialogHeader className="relative">
              <DialogTitle className="flex items-center gap-2.5 text-white">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 ring-1 ring-white/40 backdrop-blur-sm">
                  <Icon className="h-4.5 w-4.5 text-white" />
                </span>
                Status do seu plano
              </DialogTitle>
            </DialogHeader>

            <div className="relative mt-4">
              <p className="text-sm text-white/80">{bannerInfo.texto}</p>
              <p className="text-xl font-bold text-white">{bannerInfo.destaque}</p>
            </div>
          </div>

          <div className="space-y-4 px-6 pb-6 pt-5">
            {percentualDecorrido !== null && (
              <div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${gradient} transition-all`}
                    style={{ width: `${percentualDecorrido}%` }}
                  />
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Contrato ativo</span>
                  <span className="text-xs text-muted-foreground">{percentualDecorrido}% do período</span>
                </div>
              </div>
            )}

            {diasRestantes !== null && diasRestantes !== undefined && (
              <div className="rounded-xl border border-border/50 bg-muted/40 px-3 py-2.5 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Dias restantes</p>
                <p className="bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-2xl font-black leading-tight text-transparent">
                  {diasLabel}
                </p>
              </div>
            )}

            <button
              onClick={() => {
                setDetalhesAbertos(false);
                navigate("/plano");
              }}
              className={`flex w-full items-center justify-center gap-1 rounded-xl bg-gradient-to-r ${gradient} px-3 py-2.5 text-sm font-semibold text-white shadow-md transition-transform active:scale-[0.98]`}
            >
              {bannerInfo.botao}
              <ChevronRight className="h-4 w-4" />
            </button>

            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border/50 border border-border/50 sm:grid-cols-3">
              {SELOS_INSTITUCIONAIS.map(({ icone: IconeSelo, titulo, subtitulo }) => (
                <div key={titulo} className="flex items-center gap-2 bg-card px-3 py-3">
                  <IconeSelo className="h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold leading-tight text-foreground">{titulo}</p>
                    <p className="truncate text-[11px] leading-tight text-muted-foreground">{subtitulo}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
