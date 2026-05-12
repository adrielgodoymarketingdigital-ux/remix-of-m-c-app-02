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
    
    // Determine plan after trial (from plano_tipo stored in assinaturas)
    let planAfterTrial = "intermediario_mensal"; // Default
    let planPriceAfterTrial = 39.90;

    if (assinaturaAny?.plano_tipo && !["trial", "demonstracao", "free"].includes(assinaturaAny.plano_tipo)) {
      planAfterTrial = assinaturaAny.plano_tipo;
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
