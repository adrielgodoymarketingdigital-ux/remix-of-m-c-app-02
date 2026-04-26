import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import { AlertTriangle, Calendar, CreditCard, Check } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function TrialEndWarning() {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);
  const { isFuncionario } = useFuncionarioPermissoes();
  const { 
    isTrialing, 
    isTrialWithCard, 
    trialDaysRemaining, 
    trialEndsAt,
    planAfterTrial,
    planPriceAfterTrial,
    isLastDays,
    hasActiveSubscription,
  } = useTrialStatus();

  // Funcionários NUNCA veem warning de trial (usam plano do dono)
  // Check if we should show the modal (last 2 days only, once per session)
  const shouldShow = !isFuncionario &&
                     isTrialing && 
                     isTrialWithCard && 
                     isLastDays && 
                     !dismissed && 
                     !hasActiveSubscription;

  // Check if already shown this session
  useEffect(() => {
    const shownKey = `trial_warning_shown_${trialDaysRemaining}`;
    const alreadyShown = sessionStorage.getItem(shownKey);
    if (alreadyShown) {
      setDismissed(true);
    }
  }, [trialDaysRemaining]);

  const handleDismiss = () => {
    const shownKey = `trial_warning_shown_${trialDaysRemaining}`;
    sessionStorage.setItem(shownKey, 'true');
    setDismissed(true);
  };

  const handleManageSubscription = () => {
    handleDismiss();
    navigate('/plano');
  };

  if (!shouldShow) return null;

  // Format plan name for display
  const planDisplayName = planAfterTrial.replace('_mensal', '').replace('_anual', '');
  const capitalizedPlan = planDisplayName.charAt(0).toUpperCase() + planDisplayName.slice(1);

  // Format end date
  const formattedEndDate = trialEndsAt 
    ? format(trialEndsAt, "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })
    : null;

  return (
    <Dialog open={shouldShow} onOpenChange={(open) => !open && handleDismiss()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 rounded-full bg-orange-100">
              <AlertTriangle className="h-6 w-6 text-orange-600" />
            </div>
            <DialogTitle className="text-xl">
              Seu trial termina {trialDaysRemaining === 1 ? "amanhã" : `em ${trialDaysRemaining} dias`}!
            </DialogTitle>
          </div>
          <DialogDescription className="text-base text-gray-600">
            Após o período de teste, sua assinatura será ativada automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Billing info card */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900">Data da cobrança</p>
                <p className="text-sm text-gray-600">{formattedEndDate}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900">Valor</p>
                <p className="text-sm text-gray-600">
                  Plano {capitalizedPlan} - R${planPriceAfterTrial.toFixed(2).replace('.', ',')}/mês
                </p>
              </div>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">O que você pode fazer:</p>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                <span>Continuar usando e ser cobrado automaticamente</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                <span>Mudar para outro plano antes da cobrança</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                <span>Cancelar antes e não ser cobrado</span>
              </li>
            </ul>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button 
            variant="outline" 
            onClick={handleDismiss}
            className="w-full sm:w-auto"
          >
            Continuar com assinatura
          </Button>
          <Button 
            onClick={handleManageSubscription}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
          >
            Gerenciar assinatura
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
