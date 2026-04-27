import { ReactNode } from "react";
import { useAssinatura } from "@/hooks/useAssinatura";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Crown, AlertCircle, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { LIMITES_POR_PLANO } from "@/types/assinatura";

interface ComVerificacaoPlanoProps {
  children: ReactNode;
  modulo: keyof typeof LIMITES_POR_PLANO.trial.modulos;
}

export function ComVerificacaoPlano({ children, modulo }: ComVerificacaoPlanoProps) {
  const { temAcessoModulo, assinatura, carregando, migracaoNecessaria } = useAssinatura();
  const { isFuncionario, carregando: carregandoFuncionario, temAcessoModulo: temAcessoModuloFuncionario } = useFuncionarioPermissoes();
  const navigate = useNavigate();

  // Ainda carregando dados de assinatura — mostrar brevemente
  // Limitado a 8s pelo watchdog do useAssinatura; não bloquear indefinidamente
  if (carregando && !assinatura) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          <p className="text-sm text-muted-foreground">Carregando informações...</p>
        </div>
      </div>
    );
  }

  // FUNCIONÁRIOS: verificar permissão específica do módulo
  if (isFuncionario && !carregandoFuncionario) {
    const moduloParaPermissao = modulo as any;
    if (temAcessoModuloFuncionario(moduloParaPermissao)) {
      return <>{children}</>;
    }
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

  // Funcionário ainda carregando — liberar temporariamente para não travar
  if (isFuncionario && carregandoFuncionario) {
    return <>{children}</>;
  }

  // Sem assinatura após carregamento — liberar e deixar o ProtectedAppRoute tratar
  if (!assinatura) {
    return <>{children}</>;
  }

  // Verificar acesso ao módulo
  if (!temAcessoModulo(modulo)) {
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
              <Button onClick={() => navigate("/plano")} className="w-full sm:w-auto">
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
                {assinatura.plano_tipo.replace(/_/g, " ").toUpperCase()}
              </span>
            </p>
            <p>
              Faça upgrade para um plano superior e desbloqueie todos os recursos avançados do sistema!
            </p>
            <Button onClick={() => navigate("/plano")} className="w-full sm:w-auto">
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
