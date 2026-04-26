import { useState } from "react";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useAssinatura } from "@/hooks/useAssinatura";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Rocket, Loader2 } from "lucide-react";

export function OnboardingReminderBanner() {
  const { progress, dismissOnboarding, resetSkip, loading } = useOnboarding();
  const { assinatura, carregando } = useAssinatura();
  const { isFuncionario } = useFuncionarioPermissoes();
  const [loadingCompletar, setLoadingCompletar] = useState(false);

  // Funcionários NUNCA veem banner de onboarding
  if (isFuncionario) return null;

  // Só mostrar para trial (ativo ou expirado) que pulou mas não dispensou
  const isTrial = assinatura?.plano_tipo === 'trial';
  const isTrialExpirado = assinatura?.status !== 'active' && isTrial;
  const isPagante = assinatura?.status === 'active' && !isTrial;

  const shouldShow =
    !loading &&
    !carregando &&
    (isTrial || isTrialExpirado) &&
    !isPagante &&
    progress.onboardingSkipped &&
    !progress.onboardingDismissed &&
    !progress.onboardingCompleted;

  if (!shouldShow) return null;

  const handleCompletar = async () => {
    setLoadingCompletar(true);
    try {
      // Resetar o skip para mostrar o onboarding novamente
      await resetSkip();
      // Forçar reload da página para garantir que o modal apareça
      window.location.reload();
    } catch (error) {
      console.error('[OnboardingBanner] Erro ao completar:', error);
      setLoadingCompletar(false);
    }
  };

  const handleNaoQuero = async () => {
    await dismissOnboarding();
  };

  return (
    <Card className="p-4 mb-4 border-primary/50 bg-primary/5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
            <Rocket className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Completar o passo a passo</h3>
            <p className="text-sm text-muted-foreground">
              Configure seu sistema em poucos minutos
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" size="sm" onClick={handleNaoQuero} className="flex-1 sm:flex-none">
            Não quero completar
          </Button>
          <Button size="sm" onClick={handleCompletar} disabled={loadingCompletar} className="flex-1 sm:flex-none">
            {loadingCompletar ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Rocket className="h-4 w-4 mr-2" />
            )}
            Completar
          </Button>
        </div>
      </div>
    </Card>
  );
}
