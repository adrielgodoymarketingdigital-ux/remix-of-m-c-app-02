import { useMemo } from "react";
import { useAssinatura } from "./useAssinatura";
import { PLANOS } from "@/types/plano";

interface TrialStatus {
  isTrialing: boolean;
  isTrialWithCard: boolean;
  trialDaysRemaining: number;
  trialHoursRemaining: number;
  trialEndsAt: Date | null;
  trialStartedAt: Date | null;
  planAfterTrial: string;
  planPriceAfterTrial: number;
  canCancel: boolean;
  isLastDays: boolean; // Last 2 days
  trialExpired: boolean;
  hasActiveSubscription: boolean;
}

export function useTrialStatus(): TrialStatus {
  const { assinatura, trialExpirado, diasRestantesTrial, horasRestantesTrial } = useAssinatura();

  return useMemo(() => {
    const assinaturaAny = assinatura as any;
    
    // Check if it's a trial with card (new 7-day system)
    const isTrialWithCard = assinaturaAny?.trial_with_card === true;
    
    // Get trial end date - priorizar trial_end_at para trial com cartão
    const trialEndsAt = assinaturaAny?.trial_end_at 
      ? new Date(assinaturaAny.trial_end_at) 
      : (assinatura?.data_fim ? new Date(assinatura.data_fim) : null);
    
    const trialStartedAt = assinaturaAny?.trial_started_at 
      ? new Date(assinaturaAny.trial_started_at) 
      : (assinatura?.data_inicio ? new Date(assinatura.data_inicio) : null);
    
    // Calculate days remaining for trial with card
    let trialDaysRemaining = diasRestantesTrial;
    let trialHoursRemaining = horasRestantesTrial;
    let trialExpiredCalculated = trialExpirado;
    
    if (isTrialWithCard && trialEndsAt) {
      const now = new Date();
      const diffMs = trialEndsAt.getTime() - now.getTime();
      trialDaysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      trialHoursRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60)));
      trialExpiredCalculated = diffMs <= 0;
    }
    
    // CORRIGIDO: Check if currently in trialing status
    // Para trial com cartão, verificar trial_end_at independentemente de status/plano_tipo
    const isTrialing = isTrialWithCard 
      ? (!trialExpiredCalculated && !assinaturaAny?.trial_canceled)
      : (assinatura?.status === 'trialing' || (assinatura?.plano_tipo === 'trial' && !trialExpirado));
    
    // Determine plan after trial (from stripe_price_id or plano_tipo)
    let planAfterTrial = "intermediario_mensal"; // Default
    let planPriceAfterTrial = 39.90;
    
    if (assinatura?.stripe_price_id) {
      // Map price ID to plan
      const priceToPlano: Record<string, string> = {
        // Novos IDs (nova conta Stripe)
        "price_1TCTqfFu8jWFILvSyfTI73ff": "basico_mensal",
        "price_1TCTrRFu8jWFILvSl50ZKqpy": "intermediario_mensal",
        "price_1TCTrnFu8jWFILvS4hBfmUiz": "profissional_mensal",
        "price_1TCTszFu8jWFILvSLajvpW8A": "basico_anual",
        "price_1TCTtTFu8jWFILvSwTuoRvm8": "intermediario_anual",
        "price_1TCTtxFu8jWFILvSZgjoxpX6": "profissional_anual",
        // IDs legados (conta anterior)
        "price_1SkxEACjA5c0MuV8VVfibyhD": "basico_mensal",
        "price_1SkxLbCjA5c0MuV8M6rYpYd6": "intermediario_mensal",
        "price_1SkxObCjA5c0MuV8G3OccySn": "profissional_mensal",
        "price_1SkxQnCjA5c0MuV8J0F7vf5m": "basico_anual",
        "price_1SkxRPCjA5c0MuV8cgcNtFsf": "intermediario_anual",
        "price_1SkxSNCjA5c0MuV8yJ5ZLr7o": "profissional_anual",
      };
      planAfterTrial = priceToPlano[assinatura.stripe_price_id] || planAfterTrial;
    }
    
    // Get price for the plan
    const planoInfo = PLANOS[planAfterTrial as keyof typeof PLANOS];
    if (planoInfo) {
      planPriceAfterTrial = planoInfo.preco;
    }
    
    // Can cancel if in trial with card and trial hasn't ended
    const canCancel = isTrialWithCard && isTrialing && !trialExpiredCalculated;
    
    // Check if in last 2 days
    const isLastDays = trialDaysRemaining <= 2 && trialDaysRemaining > 0;
    
    // Has active paid subscription (not trial)
    const hasActiveSubscription = assinatura?.status === 'active' && 
                                   !['trial', 'demonstracao'].includes(assinatura?.plano_tipo || '');
    
    return {
      isTrialing,
      isTrialWithCard,
      trialDaysRemaining,
      trialHoursRemaining,
      trialEndsAt,
      trialStartedAt,
      planAfterTrial,
      planPriceAfterTrial,
      canCancel,
      isLastDays,
      trialExpired: trialExpiredCalculated,
      hasActiveSubscription,
    };
  }, [assinatura, trialExpirado, diasRestantesTrial, horasRestantesTrial]);
}
