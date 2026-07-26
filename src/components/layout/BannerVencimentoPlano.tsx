import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Calendar, ChevronRight } from "lucide-react";
import { useAssinatura } from "@/hooks/useAssinatura";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function BannerVencimentoPlano() {
  const { assinatura } = useAssinatura();
  const { isFuncionario } = useFuncionarioPermissoes();
  const navigate = useNavigate();

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
        };
      }

      // Carência de 1 dia após o vencimento (Ticto não libera renovação no mesmo dia)
      if (diasRestantes <= -1) {
        return {
          tipo: "vencido" as const,
          texto: isCartaoAutomatico ? "Não conseguimos renovar sua assinatura automaticamente" : "Sua assinatura venceu",
          destaque: dataFormatada,
          botao: isCartaoAutomatico ? "Atualizar pagamento" : "Renovar plano",
        };
      }

      if (diasRestantes <= 0) {
        return {
          tipo: "urgente" as const,
          texto: isCartaoAutomatico ? "Falha na cobrança automática — 1 dia de carência" : "Sua assinatura venceu — 1 dia de carência",
          destaque: dataFormatada,
          botao: isCartaoAutomatico ? "Atualizar pagamento" : "Renovar plano",
        };
      }

      if (diasRestantes <= 3) {
        return {
          tipo: "urgente" as const,
          texto: `Sua assinatura expira em ${diasRestantes} dia${diasRestantes > 1 ? "s" : ""}`,
          destaque: dataFormatada,
          botao: "Upgrade de plano",
        };
      }

      return {
        tipo: "aviso" as const,
        texto: "Sua assinatura expira em",
        destaque: dataFormatada,
        botao: "Ver plano atual",
      };
    }

    return null;
  }, [assinatura, isFuncionario]);

  if (!bannerInfo) return null;

  const isVencido = bannerInfo.tipo === "vencido";
  const isUrgente = bannerInfo.tipo === "urgente";

  const accentText = isVencido ? "text-red-600" : isUrgente ? "text-amber-600" : "text-primary";
  const iconBg = isVencido ? "bg-red-600" : isUrgente ? "bg-amber-500" : "bg-primary";
  const Icon = isVencido || isUrgente ? AlertTriangle : Calendar;

  return (
    <div className="px-4 pt-2">
      <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-card px-4 py-3 shadow-sm">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${iconBg}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>

        <div className="min-w-0 flex-1">
          <p className={`text-[11px] font-semibold tracking-wide ${accentText}`}>PLANO</p>
          <p className="text-sm text-foreground leading-tight">{bannerInfo.texto}</p>
          <p className={`text-base font-bold leading-tight ${accentText}`}>{bannerInfo.destaque}</p>
        </div>

        <button
          onClick={() => navigate("/plano")}
          className="flex shrink-0 items-center gap-1 rounded-full border border-border/50 bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-accent transition-colors"
        >
          {bannerInfo.botao}
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
