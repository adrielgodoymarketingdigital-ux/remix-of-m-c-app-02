import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Clock, CreditCard } from "lucide-react";
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

    // Plano ativo - mostrar data de vencimento
    if (status === "active" || status === "trialing") {
      // Admin sempre vê o banner para fins de teste
      if (planoTipo !== "admin" && diasRestantes > 15) return null;

      // Cartão ativo = renovação automática. Só mostra banner se já venceu
      // (cobrança automática falhou e precisa de ação do usuário).
      if (isCartaoAutomatico && planoTipo !== "admin" && diasRestantes > 0) {
        return null;
      }

      const dataFormatada = format(dataVencimento, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

      // Carência de 1 dia após o vencimento (Ticto não libera renovação no mesmo dia)
      if (diasRestantes <= -1) {
        return {
          tipo: "vencido" as const,
          mensagem: isCartaoAutomatico
            ? `Não conseguimos renovar sua assinatura automaticamente em ${dataFormatada}. Atualize seu pagamento para continuar.`
            : `Sua assinatura venceu em ${dataFormatada}. Renove agora para continuar usando todas as funcionalidades.`,
          cor: "bg-red-600",
          botao: isCartaoAutomatico ? "Atualizar pagamento" : "Renovar plano",
        };
      }

      if (diasRestantes <= 0) {
        return {
          tipo: "urgente" as const,
          mensagem: isCartaoAutomatico
            ? `Falha na cobrança automática em ${dataFormatada}. Você tem 1 dia de carência.`
            : `Sua assinatura venceu em ${dataFormatada}. Você tem 1 dia de carência para renovar.`,
          cor: "bg-amber-600",
          botao: isCartaoAutomatico ? "Atualizar pagamento" : "Renovar plano",
        };
      }

      if (diasRestantes <= 3) {
        return {
          tipo: "urgente" as const,
          mensagem: `Sua assinatura expira em ${diasRestantes} dia${diasRestantes > 1 ? "s" : ""} (${dataFormatada})`,
          cor: "bg-amber-600",
          botao: "Upgrade de plano",
        };
      }

      return {
        tipo: "aviso" as const,
        mensagem: `Sua assinatura expira em ${dataFormatada}`,
        cor: "bg-blue-600",
        botao: "Ver plano atual",
      };
    }

    return null;
  }, [assinatura, isFuncionario]);

  if (!bannerInfo) return null;

  const Icon = bannerInfo.tipo === "vencido" ? AlertTriangle : bannerInfo.tipo === "urgente" ? Clock : CreditCard;

  return (
    <div
      className={`${bannerInfo.cor} text-white px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium cursor-pointer hover:opacity-90 transition-opacity z-50`}
      onClick={() => navigate("/plano")}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{bannerInfo.mensagem}</span>
      <span className="underline font-semibold ml-1 whitespace-nowrap">{bannerInfo.botao}</span>
    </div>
  );
}
