import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CreditCard } from "lucide-react";
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

  const isUrgente = bannerInfo.tipo === "urgente" || bannerInfo.tipo === "vencido";

  return (
    <div className="w-full">
      <div className={`relative overflow-hidden border-b ${isUrgente ? "bg-gradient-to-r from-red-950 via-red-900 to-red-950 border-red-700/40" : "bg-gradient-to-r from-blue-950 via-blue-900 to-blue-950 border-blue-700/40"}`}>

        {/* Linha decorativa superior */}
        <div className={`absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent ${isUrgente ? "via-red-400/60" : "via-blue-400/60"} to-transparent`} />

        {/* Scanline animada sutil */}
        <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.03)_50%)] bg-[length:100%_4px] pointer-events-none opacity-30" />

        <div className="flex items-center justify-between px-3 py-1.5 max-w-screen-xl mx-auto">

          <div className="flex items-center gap-2">
            {/* Ponto pulsante */}
            <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isUrgente ? "bg-red-300" : "bg-blue-300"} opacity-60`} />
              <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${isUrgente ? "bg-red-400" : "bg-blue-400"}`} />
            </span>

            {/* Ícone */}
            {isUrgente
              ? <AlertTriangle className="h-3 w-3 text-red-300/70 flex-shrink-0" />
              : <CreditCard className="h-3 w-3 text-blue-300/70 flex-shrink-0" />
            }

            {/* Texto */}
            <span className={`text-[11px] font-mono tracking-wide ${isUrgente ? "text-red-200/80" : "text-blue-200/80"}`}>
              <span className={`${isUrgente ? "text-red-400/60" : "text-blue-400/60"} mr-1`}>PLANO</span>
              {bannerInfo.mensagem}
            </span>
          </div>

          {/* Botão */}
          <button
            onClick={() => navigate("/plano")}
            className={`flex-shrink-0 text-[10px] font-mono font-semibold tracking-wider transition-colors px-2 py-0.5 rounded-sm ${
              isUrgente
                ? "text-red-300 hover:text-red-100 border border-red-600/50 hover:border-red-400/70 bg-red-900/40 hover:bg-red-800/40"
                : "text-blue-300 hover:text-blue-100 border border-blue-600/50 hover:border-blue-400/70 bg-blue-900/40 hover:bg-blue-800/40"
            }`}
          >
            {bannerInfo.botao.toUpperCase()}
          </button>

        </div>

        {/* Linha decorativa inferior */}
        <div className={`absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent ${isUrgente ? "via-red-500/30" : "via-blue-500/30"} to-transparent`} />
      </div>
    </div>
  );
}
