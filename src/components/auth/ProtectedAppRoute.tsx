import { ReactNode, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Loader2, RefreshCw, WifiOff, ShieldX, CreditCard, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVerificacaoAcesso } from "@/hooks/useVerificacaoAcesso";
import { useNotificationTracking } from "@/hooks/useNotificationTracking";

interface ProtectedAppRouteProps {
  children: ReactNode;
  showProgressBar?: boolean;
}

/**
 * Componente de rota protegida que:
 * 1. Verifica se o usuário está autenticado
 * 2. Verifica se completou o onboarding obrigatório
 * 3. Verifica se cadastrou cartão para trial (se aplicável)
 * 4. Verifica se o usuário foi bloqueado pelo admin
 * 5. Renderiza o AppLayout com a sidebar
 * 
 * ROBUSTO:
 * - Nunca redireciona durante carregamento
 * - Tenta sincronizar com Stripe se dados parecem inconsistentes
 * - Mostra tela de retry em caso de erro
 * - Usuários ativos SEMPRE são liberados (exceto se bloqueados por admin)
 * - FUNCIONÁRIOS herdam acesso do dono e ignoram fluxo de trial/onboarding
 */
export function ProtectedAppRoute({ children }: ProtectedAppRouteProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { status, assinatura, error, tentarNovamente, isVerificando, bloqueioAdmin, isFuncionario } = useVerificacaoAcesso();
  
  // Rastrear abertura de notificações via URL param
  useNotificationTracking();

  // Redirecionar baseado no status
  useEffect(() => {
    // PRIORIDADE MÁXIMA: Funcionários NUNCA são redirecionados para trial/onboarding
    if (isFuncionario && status === "liberado") {
      console.log("👷 [ProtectedAppRoute] Funcionário liberado - acesso garantido");
      return;
    }

    // Trial expirado: permitir apenas a tela de plano; qualquer outra rota redireciona
    // EXCETO funcionários - eles NUNCA vão para /plano (é responsabilidade do dono)
    if (status === "trial_expirado" && !isFuncionario) {
      const allowedWhenExpired = ["/plano", "/cadastro-plano", "/auth", "/reset-password", "/suporte"];
      const isAllowed = allowedWhenExpired.some((p) => location.pathname.startsWith(p));

      if (!isAllowed) {
        // Detectar se é um assinante pago que expirou (migração de conta Stripe)
        const planosPagos = ["basico_mensal", "basico_anual", "intermediario_mensal", "intermediario_anual", "profissional_mensal", "profissional_anual"];
        const isMigracao = assinatura?.plano_tipo && planosPagos.includes(assinatura.plano_tipo) && 
          (assinatura.status === "canceled" || assinatura.status === "past_due");
        
        const params = isMigracao ? "?expired=1&migration=1" : "?expired=1";
        console.log(isMigracao 
          ? "⛔ [ProtectedAppRoute] Assinante pago expirado (migração) - redirecionando para /plano" 
          : "⛔ [ProtectedAppRoute] Trial expirado - redirecionando para /plano");
        navigate(`/plano${params}`, { replace: true });
      }
      // IMPORTANTE: Se já está em rota permitida, NÃO fazer nada (evita loop)
      return;
    }

    if (status === "nao_autenticado") {
      console.log("🔐 [ProtectedAppRoute] Não autenticado - redirecionando para login");
      navigate("/auth", { replace: true });
      return;
    }

    // FUNCIONÁRIOS NUNCA são redirecionados para onboarding
    if (status === "onboarding_pendente" && !isFuncionario) {
      // FALLBACK DE SEGURANÇA: Verificar se realmente não é usuário ativo
      // EXCEÇÃO: Plano Free com onboarding pendente DEVE ser redirecionado (o hook já validou isso)
      const isFreeWithPendingOnboarding = assinatura?.plano_tipo === 'free';
      
      if (!isFreeWithPendingOnboarding) {
        const isActiveStatus = assinatura?.status === 'active' || assinatura?.status === 'trialing';
        const hasRealStripeSubscription = assinatura?.stripe_subscription_id && 
          assinatura.stripe_subscription_id.startsWith('sub_') &&
          !assinatura.stripe_subscription_id.startsWith('sub_trial_') &&
          !assinatura.stripe_subscription_id.startsWith('sub_demo_') &&
          !assinatura.stripe_subscription_id.startsWith('sub_pending_');
        
        if (isActiveStatus || hasRealStripeSubscription) {
          console.log("⚠️ [ProtectedAppRoute] FALLBACK: Usuário ativo detectado - NÃO redirecionando para onboarding", {
            status: assinatura?.status,
            subscription_id: assinatura?.stripe_subscription_id
          });
          return; // Não redireciona - deixa o usuário acessar
        }
      }
      
      console.log("⏳ [ProtectedAppRoute] Onboarding pendente - redirecionando");
      const planParam = new URLSearchParams(location.search).get("plan") || assinatura?.plano_tipo || "intermediario_mensal";
      navigate(`/onboarding-inicial?plan=${planParam}`, { replace: true });
      return;
    }

  }, [status, assinatura, navigate, location.search, isFuncionario]);

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

  // Tela de bloqueio por admin
  if (status === "bloqueado_admin") {
    const isBloqueioAteAssinar = bloqueioAdmin?.tipo === "ate_assinar";
    
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-6 max-w-md text-center p-8">
          <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
            {isBloqueioAteAssinar ? (
              <CreditCard className="h-10 w-10 text-destructive" />
            ) : (
              <Lock className="h-10 w-10 text-destructive" />
            )}
          </div>
          
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-destructive">
              {isBloqueioAteAssinar ? "Acesso Bloqueado" : "Conta Suspensa"}
            </h2>
            <p className="text-muted-foreground">
              {isBloqueioAteAssinar 
                ? "Seu período de teste expirou. Assine um plano para continuar usando o MecApp e desbloquear todas as funcionalidades!"
                : "Sua conta foi suspensa pelo administrador. Entre em contato com o suporte para mais informações."
              }
            </p>
            {bloqueioAdmin?.motivo && (
              <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg mt-4">
                <strong>Motivo:</strong> {bloqueioAdmin.motivo}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3 w-full">
            {isBloqueioAteAssinar && (
              <Button 
                onClick={() => navigate("/cadastro-plano")} 
                className="w-full gap-2"
                size="lg"
              >
                <CreditCard className="h-4 w-4" />
                Assinar Agora
              </Button>
            )}
            <Button 
              variant="outline"
              onClick={() => {
                const phoneNumber = "5519971454829";
                const message = "Olá! Preciso de ajuda com o MecApp. Minha conta está bloqueada.";
                window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`, "_blank");
              }} 
              className="w-full"
            >
              Falar com Suporte
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Tela de redirecionamento (mas NÃO para trial_expirado se está em rota permitida)
  if (status === "nao_autenticado" || status === "onboarding_pendente") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Redirecionando...</p>
        </div>
      </div>
    );
  }

  // Trial expirado em rota permitida - renderizar conteúdo
  if (status === "trial_expirado") {
    const allowedWhenExpired = ["/plano", "/cadastro-plano", "/auth", "/reset-password", "/suporte"];
    const isAllowed = allowedWhenExpired.some((p) => location.pathname.startsWith(p));
    
    if (isAllowed) {
      return children;
    }
    
    // Não permitido - mostrar loading enquanto redireciona
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
  // NOTE: O layout (sidebar/header) deve ser responsabilidade das páginas.
  // Isso evita duplicação quando uma página também usa AppLayout.
  return children;
}
