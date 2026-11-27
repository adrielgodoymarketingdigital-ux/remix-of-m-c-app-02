import { ReactNode } from "react";
import { useAssinatura } from "@/hooks/useAssinatura";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Crown, AlertCircle, RefreshCw } from "lucide-react";
import { textoRenovarPlano } from "@/lib/planoVencido";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { LIMITES_POR_PLANO } from "@/types/assinatura";
import { useTranslation } from "react-i18next";
import { destinoUpgradeProfissional } from "@/lib/marketing/upgradeProfissional";
import { AppLayout } from "@/components/layout/AppLayout";

interface ComVerificacaoPlanoProps {
  children: ReactNode;
  modulo: keyof typeof LIMITES_POR_PLANO.trial.modulos;
}

export function ComVerificacaoPlano({ children, modulo }: ComVerificacaoPlanoProps) {
  const { temAcessoModulo, assinatura, carregando, planoVencido, planoAnterior } = useAssinatura();
  const { isFuncionario, carregando: carregandoFuncionario, temAcessoModulo: temAcessoModuloFuncionario } = useFuncionarioPermissoes();
  const navigate = useNavigate();
  const { t } = useTranslation("marketing");
  // Marketing fica no menu de todos os planos: o bloqueio dele sai DENTRO do
  // layout (menu e barra inferior), senão no PWA não há como voltar. Os outros
  // módulos seguem com a tela solta de sempre.
  const comLayout = (conteudo: JSX.Element) => (modulo === "marketing" ? <AppLayout>{conteudo}</AppLayout> : conteudo);

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
      // Marketing: além da permissão, o plano do DONO precisa ter o módulo
      // (para funcionário, useAssinatura já carrega a assinatura do dono).
      // Os outros módulos seguem só pela permissão, como sempre.
      if (modulo === "marketing" && !temAcessoModulo(modulo)) {
        return comLayout(
          <div className="container mx-auto py-12 px-4">
            <Alert className="max-w-2xl mx-auto border-primary">
              <Crown className="h-5 w-5 text-primary" />
              <AlertTitle className="text-xl font-bold mb-2">{t("bloqueio.titulo")}</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>{t("bloqueio.descricao")}</p>
                <p className="text-sm text-muted-foreground">{t("bloqueio.funcionario")}</p>
              </AlertDescription>
            </Alert>
          </div>,
        );
      }
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

  // Sem assinatura após carregamento — bloquear módulos restritos (getLimitesFree já é aplicado no hook)
  // Apenas libera se o módulo estiver disponível no plano Free (verificado abaixo via temAcessoModulo)
  // Nota: temAcessoModulo já usa getLimitesFree quando assinatura é null, então o check abaixo cobre isso.

  // Módulos com mensagem de bloqueio personalizada
  // botao: só quando o módulo tem um destino próprio; sem ele, "Ver Planos Disponíveis".
  const BLOQUEIOS_PERSONALIZADOS: Partial<Record<typeof modulo, { titulo: string; descricao: string; botao?: { texto: string; destino: string } }>> = {
    precificador: {
      titulo: "Funcionalidade exclusiva do Plano Ultra",
      descricao: "O Precificador com cálculo de DIFAL e taxas de cartão está disponível apenas no Plano Ultra. Faça upgrade e tenha acesso completo a essa e outras ferramentas exclusivas.",
    },
    marketing: {
      titulo: t("bloqueio.titulo"),
      descricao: t("bloqueio.descricao"),
      botao: { texto: t("bloqueio.botaoUpgrade"), destino: destinoUpgradeProfissional(assinatura?.plano_tipo) },
    },
  };

  // Verificar acesso ao módulo
  if (!temAcessoModulo(modulo)) {
    // Já foi pagante e o plano venceu: qualquer módulo bloqueado pede para renovar
    if (planoVencido) {
      return comLayout(
        <div className="container mx-auto py-12 px-4">
          <Alert className="max-w-2xl mx-auto border-destructive/40">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <AlertTitle className="text-xl font-bold mb-2">Seu plano venceu</AlertTitle>
            <AlertDescription className="space-y-4">
              <p>{textoRenovarPlano(planoAnterior)}</p>
              <Button onClick={() => navigate("/plano")} className="w-full sm:w-auto">
                <RefreshCw className="mr-2 h-4 w-4" />
                Renovar agora
              </Button>
            </AlertDescription>
          </Alert>
        </div>,
      );
    }

    const personalizado = BLOQUEIOS_PERSONALIZADOS[modulo];
    return comLayout(
      <div className="container mx-auto py-12 px-4">
        <Alert className="max-w-2xl mx-auto border-primary">
          <Crown className="h-5 w-5 text-primary" />
          <AlertTitle className="text-xl font-bold mb-2">
            {personalizado?.titulo ?? "Recurso Premium"}
          </AlertTitle>
          <AlertDescription className="space-y-4">
            <p>
              {personalizado?.descricao ?? (
                <>
                  Este módulo não está disponível no seu plano atual
                  {assinatura && (
                    <>
                      :{" "}
                      <span className="font-semibold">
                        {assinatura.plano_tipo.replace(/_/g, " ").toUpperCase()}
                      </span>
                    </>
                  )}. Faça upgrade para um plano superior e desbloqueie todos os recursos avançados do sistema!
                </>
              )}
            </p>
            <Button onClick={() => navigate(personalizado?.botao?.destino ?? "/plano")} className="w-full sm:w-auto">
              <Crown className="mr-2 h-4 w-4" />
              {personalizado?.botao?.texto ?? "Ver Planos Disponíveis"}
            </Button>
          </AlertDescription>
        </Alert>
      </div>,
    );
  }

  return <>{children}</>;
}
