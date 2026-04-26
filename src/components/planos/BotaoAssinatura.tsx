import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ModalVideoAlterarPlano } from "./ModalVideoAlterarPlano";
import { cn } from "@/lib/utils";
import { PLANOS } from "@/types/plano";
import { getCheckoutUrl, type PlanoTipoPago } from "@/config/ticto-catalogo";
import { supabase } from "@/integrations/supabase/client";

const CHECKOUT_STORAGE_KEY = "mec_pending_checkout";
const TICTO_SUBSCRIPTION_MANAGER_URL = "https://dash.ticto.com.br/subscription-verification";

interface BotaoAssinaturaProps {
  planoKey: string;
  onSubscribe: (planoKey: string) => Promise<void>;
  disabled?: boolean;
  planoAtual?: boolean;
  planoAtualTipo?: string;
  planoAtualProvider?: string | null;
  planoAtualOrderId?: string | null;
  popular?: boolean;
}

export function BotaoAssinatura({
  planoKey,
  onSubscribe,
  disabled,
  planoAtual,
  planoAtualTipo,
  planoAtualProvider,
  planoAtualOrderId,
  popular,
}: BotaoAssinaturaProps) {
  const [carregando, setCarregando] = useState(false);
  const [mostrarModalVideo, setMostrarModalVideo] = useState(false);
  const navigate = useNavigate();

  const isPlanoPago = planoKey !== "free";
  const planoAtualProviderNormalizado = planoAtualProvider?.trim().toLowerCase() ?? null;
  const possuiPedidoTicto = !!planoAtualOrderId?.trim();
  const possuiPlanoPagoAtual =
    !!planoAtualTipo &&
    planoAtualTipo !== "free" &&
    planoAtualTipo !== "demonstracao" &&
    planoAtualTipo !== "trial" &&
    planoAtualTipo !== "admin";
  const isUsuarioTictoPago =
    possuiPlanoPagoAtual &&
    (planoAtualProviderNormalizado === "ticto" || possuiPedidoTicto);

  console.log("🔍 BotaoAssinatura debug:", {
    planoKey,
    planoAtualTipo,
    planoAtualProvider,
    planoAtualOrderId,
    planoAtualProviderNormalizado,
    possuiPedidoTicto,
    possuiPlanoPagoAtual,
    isUsuarioTictoPago,
    planoAtual,
  });

  const abrirUrlExterna = (url: string) => {
    const newWindow = window.open(url, "_blank");
    if (!newWindow) {
      window.location.href = url;
    }
  };

  const handleGerenciarAssinatura = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const userEmail = session?.user?.email;

    const params = new URLSearchParams();
    if (planoAtualOrderId) {
      params.set("code", planoAtualOrderId);
    }
    if (userEmail) {
      params.set("email", userEmail);
    }

    const qs = params.toString();
    const tictoUrl = qs
      ? `${TICTO_SUBSCRIPTION_MANAGER_URL}?${qs}`
      : TICTO_SUBSCRIPTION_MANAGER_URL;

    abrirUrlExterna(tictoUrl);
  };

  const handleClick = async () => {
    if (isUsuarioTictoPago && !planoAtual) {
      setMostrarModalVideo(true);
      return;
    }

    setCarregando(true);
    try {

      const { data: { session } } = await supabase.auth.getSession();
      const userEmail = session?.user?.email;
      const checkoutUrl = getCheckoutUrl(planoKey as PlanoTipoPago, userEmail || undefined);

      localStorage.setItem(CHECKOUT_STORAGE_KEY, JSON.stringify({
        plan: planoKey,
        startedAt: Date.now(),
      }));

      const newWindow = window.open(checkoutUrl, "_blank");
      if (!newWindow) {
        window.location.href = checkoutUrl;
      } else {
        navigate(`/obrigado?plan=${planoKey}`);
      }
    } catch (error) {
      console.error("Erro ao redirecionar:", error);
      await onSubscribe(planoKey);
    } finally {
      setTimeout(() => setCarregando(false), 3000);
    }
  };

  const determinarTipoMudanca = () => {
    if (planoAtual) return "atual";
    if (!planoAtualTipo || planoAtualTipo === "demonstracao" || planoAtualTipo === "trial") return "upgrade";

    const hierarquia = [
      "demonstracao",
      "trial",
      "basico_mensal", "basico_anual",
      "intermediario_mensal", "intermediario_anual",
      "profissional_mensal", "profissional_anual"
    ];

    const nivelAtual = hierarquia.indexOf(planoAtualTipo);
    const nivelNovo = hierarquia.indexOf(planoKey);

    return nivelNovo > nivelAtual ? "upgrade" : "downgrade";
  };

  const tipoMudanca = determinarTipoMudanca();

  if (planoAtual) {
    const handleRenovar = async () => {
      // Usuários Ticto: redirecionar ao portal de gerenciamento da Ticto
      // (o checkout direto bloqueia com "já possui assinatura ativa")
      if (isUsuarioTictoPago) {
        setCarregando(true);
        try {
          await handleGerenciarAssinatura();
        } catch (error) {
          console.error("Erro ao abrir gerenciador da Ticto:", error);
          abrirUrlExterna(TICTO_SUBSCRIPTION_MANAGER_URL);
        } finally {
          setTimeout(() => setCarregando(false), 3000);
        }
        return;
      }

      setCarregando(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const userEmail = session?.user?.email;
        const checkoutUrl = getCheckoutUrl(planoKey as PlanoTipoPago, userEmail || undefined);

        localStorage.setItem(CHECKOUT_STORAGE_KEY, JSON.stringify({
          plan: planoKey,
          startedAt: Date.now(),
        }));

        const newWindow = window.open(checkoutUrl, '_blank');
        if (!newWindow) {
          window.location.href = checkoutUrl;
        } else {
          navigate(`/obrigado?plan=${planoKey}`);
        }
      } catch (error) {
        console.error("Erro ao redirecionar:", error);
      } finally {
        setTimeout(() => setCarregando(false), 3000);
      }
    };

    return (
      <div className="space-y-2">
        <Button disabled className="w-full h-12 text-base">
          Plano Atual
        </Button>
        {isPlanoPago && (
          <Button
            onClick={handleRenovar}
            disabled={carregando}
            variant="outline"
            className="w-full h-10 text-sm border-primary/30 text-primary hover:bg-primary/10"
          >
            {carregando ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Redirecionando...
              </>
            ) : (
              <>
                <ExternalLink className="mr-2 h-4 w-4" />
                Renovar Plano
              </>
            )}
          </Button>
        )}
      </div>
    );
  }

  if (!isPlanoPago) {
    return null;
  }

  const labelBotao = isUsuarioTictoPago
    ? (tipoMudanca === "upgrade" ? "Fazer Upgrade" : "Alterar Plano")
    : "Assinar Agora";

  const handleProsseguirGerenciamento = async () => {
    setMostrarModalVideo(false);
    setCarregando(true);
    try {
      await handleGerenciarAssinatura();
    } catch (error) {
      console.error("Erro ao abrir gerenciador da Ticto:", error);
      abrirUrlExterna(TICTO_SUBSCRIPTION_MANAGER_URL);
    } finally {
      setTimeout(() => setCarregando(false), 3000);
    }
  };

  return (
    <>
      <Button
        onClick={handleClick}
        disabled={disabled || carregando}
        className={cn(
          "w-full h-12 text-base transition-all duration-300",
          popular && "shadow-lg hover:shadow-xl"
        )}
        variant={tipoMudanca === "downgrade" ? "outline" : "default"}
      >
        {carregando ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Redirecionando...
          </>
        ) : (
          <>
            {isUsuarioTictoPago ? (
              <RefreshCw className="mr-2 h-4 w-4" />
            ) : (
              <ExternalLink className="mr-2 h-4 w-4" />
            )}
            {labelBotao}
          </>
        )}
      </Button>

      <ModalVideoAlterarPlano
        open={mostrarModalVideo}
        onClose={() => setMostrarModalVideo(false)}
        onProsseguir={handleProsseguirGerenciamento}
      />
    </>
  );
}
