import { ReactNode, useEffect, useState, useCallback } from "react";
import { useAssinatura } from "@/hooks/useAssinatura";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Crown, RefreshCw, LogOut, AlertCircle, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import { LIMITES_POR_PLANO } from "@/types/assinatura";
import { supabase } from "@/integrations/supabase/client";

interface ComVerificacaoPlanoProps {
  children: ReactNode;
  modulo: keyof typeof LIMITES_POR_PLANO.trial.modulos;
}

// Rotas permitidas durante o onboarding para cada passo
const ROTAS_ONBOARDING: Record<string, string[]> = {
  clientes: ['/clientes'],
  dispositivos: ['/dispositivos'],
  servicos: ['/servicos'],
  ordem_servico: ['/os', '/ordens-servico'],
  financeiro: ['/financeiro'],
  produtos_pecas: ['/produtos'],
};

export function ComVerificacaoPlano({
  children,
  modulo,
}: ComVerificacaoPlanoProps) {
  // =============== TODOS OS HOOKS PRIMEIRO (antes de qualquer return) ===============
  const { temAcessoModulo, assinatura, carregando, recarregar, trialExpirado, migracaoNecessaria } = useAssinatura();
  const { progress, loading: onboardingLoading } = useOnboarding();
  const { isFuncionario, carregando: carregandoFuncionario, temAcessoModulo: temAcessoModuloFuncionario } = useFuncionarioPermissoes();
  const navigate = useNavigate();
  const location = useLocation();
  const [tentativasRecarga, setTentativasRecarga] = useState(0);
  const [recarregando, setRecarregando] = useState(false);
  const [sessaoExpirada, setSessaoExpirada] = useState(false);
  const [verificandoSessao, setVerificandoSessao] = useState(false);

  // Verificar se a sessão está válida - com múltiplas tentativas de recuperação
  const verificarSessao = useCallback(async () => {
    try {
      setVerificandoSessao(true);
      
      // Tentar até 3 vezes com delays progressivos
      for (let tentativa = 0; tentativa < 3; tentativa++) {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          console.log("✅ Sessão válida encontrada");
          return true;
        }
        
        // Tentar refresh do token
        console.log(`🔄 Tentativa ${tentativa + 1} de recuperar sessão...`);
        const { data: refreshData } = await supabase.auth.refreshSession();
        
        if (refreshData?.session) {
          console.log("✅ Token renovado com sucesso");
          await recarregar();
          return true;
        }
        
        // Aguardar antes da próxima tentativa
        if (tentativa < 2) {
          await new Promise(r => setTimeout(r, 1000 * (tentativa + 1)));
        }
      }
      
      console.log("❌ Não foi possível recuperar sessão após 3 tentativas");
      setSessaoExpirada(true);
      return false;
    } catch (e) {
      console.error("Erro ao verificar sessão:", e);
      setSessaoExpirada(true);
      return false;
    } finally {
      setVerificandoSessao(false);
    }
  }, [recarregar]);

  // Se assinatura é null, tentar recarregar algumas vezes antes de bloquear
  useEffect(() => {
    // Funcionários não precisam verificar assinatura própria
    if (isFuncionario) return;
    
    if (!carregando && !assinatura && tentativasRecarga < 3 && !sessaoExpirada) {
      const timer = setTimeout(async () => {
        console.log(`🔄 Tentativa ${tentativasRecarga + 1} de recarregar assinatura...`);
        setRecarregando(true);
        try {
          // Verificar sessão antes de tentar recarregar
          const sessaoValida = await verificarSessao();
          if (sessaoValida) {
            await recarregar();
          }
        } finally {
          setRecarregando(false);
        }
        setTentativasRecarga(prev => prev + 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [carregando, assinatura, tentativasRecarga, recarregar, sessaoExpirada, verificarSessao, isFuncionario]);

  // Após todas as tentativas, verificar se é problema de sessão
  useEffect(() => {
    // Funcionários não precisam verificar assinatura própria
    if (isFuncionario) return;
    
    if (!carregando && !assinatura && tentativasRecarga >= 3 && !sessaoExpirada && !verificandoSessao) {
      verificarSessao();
    }
  }, [carregando, assinatura, tentativasRecarga, sessaoExpirada, verificandoSessao, verificarSessao, isFuncionario]);

  // Verificar se a rota atual está permitida durante o onboarding
  // IMPORTANTE: NÃO permitir durante onboarding se o trial expirou!
  const isOnboardingRoute = () => {
    // Se trial expirou, NÃO permitir acesso via onboarding - forçar upgrade
    if (trialExpirado) return false;

    if (onboardingLoading) return false; // Não bloquear enquanto carrega; ProtectedAppRoute já verificou acesso
    
    // Verificar se onboarding principal está completo baseado no tipo
    if (progress.tipoNegocio === 'assistencia' && progress.stepOsCriada) return false;
    if (progress.tipoNegocio === 'vendas' && progress.stepDispositivoCadastrado) return false;
    
    // Se não selecionou tipo ainda, permitir todas as rotas de onboarding
    if (!progress.tipoNegocio) return true;
    
    const rotasPermitidas = ROTAS_ONBOARDING[modulo] || [];
    return rotasPermitidas.some(rota => location.pathname.startsWith(rota));
  };

  // Função para fazer logout e redirecionar
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  // =============== AGORA OS RETURNS CONDICIONAIS ===============

  // Carregando permissões de funcionário
  if (carregandoFuncionario) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          <p className="text-sm text-muted-foreground">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  // FUNCIONÁRIOS: Herdam acesso do dono - LIBERAR IMEDIATAMENTE
  // Se é funcionário e tem permissão no módulo, não precisa verificar plano
  if (isFuncionario) {
    // Verificar se funcionário tem permissão para este módulo
    const moduloParaPermissao = modulo as any;
    if (temAcessoModuloFuncionario(moduloParaPermissao)) {
      return <>{children}</>;
    }
    // Se não tem permissão, mostrar mensagem
    return (
      <div className="container mx-auto py-12 px-4">
        <Alert className="max-w-2xl mx-auto">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle>Acesso Restrito</AlertTitle>
          <AlertDescription>
            <p>Você não tem permissão para acessar este módulo.</p>
            <p className="text-sm text-muted-foreground mt-2">
              Entre em contato com o administrador da loja para solicitar acesso.
            </p>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // =============== LÓGICA PARA DONOS DE LOJA ===============

  // Estado de carregamento inicial ou durante tentativas de recarga
  // onboardingLoading é excluído: ProtectedAppRoute já garantiu onboarding completo antes de entrar no app
  if (carregando || recarregando || verificandoSessao || (!assinatura && tentativasRecarga < 3 && !sessaoExpirada)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          <p className="text-sm text-muted-foreground">Carregando informações...</p>
        </div>
      </div>
    );
  }

  // Se sessão expirou, mostrar opção de login
  if (sessaoExpirada) {
    return (
      <div className="container mx-auto py-12 px-4">
        <Alert className="max-w-2xl mx-auto border-destructive">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <AlertTitle className="text-xl font-bold mb-2">
            Sessão Expirada
          </AlertTitle>
          <AlertDescription className="space-y-4">
            <p>
              Sua sessão expirou por inatividade. Por favor, faça login novamente para continuar.
            </p>
            <Button 
              onClick={handleLogout}
              className="w-full sm:w-auto"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Fazer Login Novamente
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Se ainda não tem assinatura após todas as tentativas, mostrar erro com opção de atualizar ou login
  if (!assinatura) {
    return (
      <div className="container mx-auto py-12 px-4">
        <Alert className="max-w-2xl mx-auto">
          <RefreshCw className="h-5 w-5" />
          <AlertTitle className="text-xl font-bold mb-2">
            Não foi possível carregar suas informações
          </AlertTitle>
          <AlertDescription className="space-y-4">
            <p>
              Houve um problema ao verificar seu acesso. Tente atualizar a página ou faça login novamente.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button 
                onClick={() => window.location.reload()}
                variant="outline"
                className="w-full sm:w-auto"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Atualizar Página
              </Button>
              <Button 
                onClick={handleLogout}
                variant="default"
                className="w-full sm:w-auto"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Fazer Login Novamente
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Permitir acesso durante o onboarding para rotas específicas
  if (isOnboardingRoute()) {
    return <>{children}</>;
  }

  if (!temAcessoModulo(modulo)) {
    // Migração de conta Stripe: plano pago expirado
    if (migracaoNecessaria) {
      return (
        <div className="container mx-auto py-12 px-4">
          <Alert className="max-w-2xl mx-auto border-blue-500">
            <CreditCard className="h-5 w-5 text-blue-600" />
            <AlertTitle className="text-xl font-bold mb-2 text-blue-800 dark:text-blue-200">
              Atualizamos nosso sistema de pagamentos
            </AlertTitle>
            <AlertDescription className="space-y-4">
              <p>
                Para melhorar sua experiência, migramos nossa plataforma de pagamentos. 
                Por isso, será necessário <strong>renovar sua assinatura</strong> para continuar 
                acessando todos os recursos do sistema.
              </p>
              <p className="text-sm text-muted-foreground">
                🔒 <strong>Seus dados estão totalmente seguros.</strong> Nenhuma informação foi perdida — 
                clientes, dispositivos, ordens de serviço e todo o histórico continuam intactos.
              </p>
              <Button
                onClick={() => navigate("/plano")}
                className="w-full sm:w-auto"
              >
                <CreditCard className="mr-2 h-4 w-4" />
                Renovar Minha Assinatura
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    return (
      <div className="container mx-auto py-12 px-4">
        <Alert className="max-w-2xl mx-auto border-primary">
          <Crown className="h-5 w-5 text-primary" />
          <AlertTitle className="text-xl font-bold mb-2">
            Recurso Premium
          </AlertTitle>
          <AlertDescription className="space-y-4">
            <p>
              Este módulo não está disponível no seu plano atual:{" "}
              <span className="font-semibold">
                {assinatura?.plano_tipo.replace(/_/g, " ").toUpperCase()}
              </span>
            </p>
            <p>
              Faça upgrade para um plano superior e desbloqueie todos os
              recursos avançados do sistema!
            </p>
            <Button
              onClick={() => navigate("/plano")}
              className="w-full sm:w-auto"
            >
              <Crown className="mr-2 h-4 w-4" />
              Ver Planos Disponíveis
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return <>{children}</>;
}
