import { ReactNode, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Loader2, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVerificacaoAcesso } from "@/hooks/useVerificacaoAcesso";

interface VerificacaoFluxoTrialProps {
  children: ReactNode;
}

/**
 * Este componente verifica se o usuário completou o fluxo obrigatório:
 * 1. Onboarding obrigatório (/onboarding-inicial)
 * 2. Cadastro de cartão para trial (/ativar-trial)
 * 
 * ROBUSTO:
 * - Nunca redireciona durante carregamento
 * - Tenta sincronizar com Stripe se dados parecem inconsistentes
 * - Mostra tela de retry em caso de erro (não manda pro trial por engano)
 * - Usuários ativos SEMPRE são liberados
 */
export function VerificacaoFluxoTrial({ children }: VerificacaoFluxoTrialProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { status, error, tentarNovamente, isVerificando } = useVerificacaoAcesso();

  // Redirecionar baseado no status (apenas quando status é definitivo)
  useEffect(() => {
    // Evitar loop: se já está na rota de destino, não redirecionar
    const rotasDoFunil = ["/onboarding-inicial", "/auth", "/cadastro-trial", "/instalar-app", "/video-boas-vindas"];
    const jaEstaNaRotaDoFunil = rotasDoFunil.some(rota => location.pathname.startsWith(rota));

    if (status === "trial_expirado") {
      // Permitir seguir apenas para a tela de plano
      if (!location.pathname.startsWith("/plano")) {
        console.log("⛔ [VerificacaoFluxoTrial] Trial expirado - redirecionando para /plano");
        navigate("/plano?expired=1", { replace: true });
      }
      return;
    }

    if (status === "nao_autenticado") {
      console.log("🔐 [VerificacaoFluxoTrial] Não autenticado - redirecionando para login");
      navigate("/auth", { replace: true });
      return;
    }

    if (status === "onboarding_pendente" && !jaEstaNaRotaDoFunil) {
      console.log("⏳ [VerificacaoFluxoTrial] Onboarding pendente - redirecionando");
      const planParam = new URLSearchParams(location.search).get("plan") || "intermediario_mensal";
      navigate(`/onboarding-inicial?plan=${planParam}`, { replace: true });
      return;
    }

  }, [status, navigate, location.pathname, location.search]);

  // Tela de carregamento
  if (isVerificando) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Verificando acesso...</p>
        </div>
      </div>
    );
  }

  // Tela de erro com retry
  if (status === "erro") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4 max-w-sm text-center p-6">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <WifiOff className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-lg font-semibold">Erro de conexão</h2>
          <p className="text-sm text-muted-foreground">
            {error || "Não foi possível verificar seu acesso. Verifique sua conexão com a internet."}
          </p>
          <Button onClick={tentarNovamente} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  // Tela de redirecionamento (para transições suaves)
  if (status === "nao_autenticado" || status === "onboarding_pendente" || status === "trial_expirado") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Redirecionando...</p>
        </div>
      </div>
    );
  }

  // Status "liberado" - renderizar conteúdo
  return <>{children}</>;
}
