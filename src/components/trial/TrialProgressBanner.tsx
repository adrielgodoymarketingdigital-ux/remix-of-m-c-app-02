import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import { Clock, Gift, Calendar, CreditCard, Settings } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function TrialProgressBanner() {
  const navigate = useNavigate();
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

  // Don't show if not in trial or has active subscription
  if (!isTrialing || hasActiveSubscription) return null;

  // Format plan name for display
  const planDisplayName = planAfterTrial.replace('_mensal', '').replace('_anual', '');
  const capitalizedPlan = planDisplayName.charAt(0).toUpperCase() + planDisplayName.slice(1);

  // Format end date
  const formattedEndDate = trialEndsAt 
    ? format(trialEndsAt, "dd 'de' MMMM", { locale: ptBR })
    : null;

  // Determine banner color based on days remaining
  const getBannerStyles = () => {
    if (isLastDays) {
      return "bg-gradient-to-r from-orange-500 to-red-500";
    }
    if (trialDaysRemaining <= 3) {
      return "bg-gradient-to-r from-yellow-500 to-orange-500";
    }
    return "bg-gradient-to-r from-blue-500 to-blue-600";
  };

  return (
    <div className={`${getBannerStyles()} text-white p-3 sm:p-4 rounded-lg mb-4 shadow-md`}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {/* Left side - Trial info */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex-shrink-0">
            {isLastDays ? (
              <Clock className="h-5 w-5 animate-pulse" />
            ) : (
              <Gift className="h-5 w-5" />
            )}
          </div>
          
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-bold text-sm sm:text-base">
                {isLastDays ? "⚠️ " : "🎁 "}
                Trial - {trialDaysRemaining === 1 
                  ? "1 dia restante" 
                  : `${trialDaysRemaining} dias restantes`}
              </p>
            </div>
            
            <div className="text-xs sm:text-sm opacity-90 flex flex-wrap items-center gap-2">
              {isTrialWithCard && (
                <>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Termina em {formattedEndDate}
                  </span>
                  <span className="hidden sm:inline">•</span>
                  <span className="flex items-center gap-1">
                    <CreditCard className="h-3 w-3" />
                    {capitalizedPlan} R${planPriceAfterTrial.toFixed(2).replace('.', ',')}/mês
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right side - Action button */}
        <Button 
          variant="secondary" 
          size="sm"
          onClick={() => navigate('/plano')}
          className="bg-white/20 hover:bg-white/30 text-white border-white/30 whitespace-nowrap text-xs sm:text-sm h-8 px-3"
        >
          <Settings className="mr-1.5 h-3.5 w-3.5" />
          Gerenciar
        </Button>
      </div>

      {/* Warning message for last days */}
      {isLastDays && isTrialWithCard && (
        <div className="mt-2 pt-2 border-t border-white/20 text-xs sm:text-sm">
          ⚡ Após o trial, você será cobrado automaticamente R${planPriceAfterTrial.toFixed(2).replace('.', ',')}. 
          <button 
            onClick={() => navigate('/plano')} 
            className="underline ml-1 hover:no-underline"
          >
            Cancele ou mude o plano aqui
          </button>
        </div>
      )}
    </div>
  );
}
