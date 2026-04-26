import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEventTracking } from './useEventTracking';

export type TipoNegocio = 'assistencia' | 'vendas' | null;

export interface OnboardingProgress {
  tipoNegocio: TipoNegocio;
  stepClienteCadastrado: boolean;
  stepClienteCadastradoAt: string | null;
  stepDispositivoCadastrado: boolean;
  stepDispositivoCadastradoAt: string | null;
  stepPecaCadastrada: boolean;
  stepPecaCadastradaAt: string | null;
  stepOsCriada: boolean;
  stepOsCriadaAt: string | null;
  stepLucroVisualizado: boolean;
  stepLucroVisualizadoAt: string | null;
  ahaMomentReached: boolean;
  ahaMomentReachedAt: string | null;
  onboardingCompleted: boolean;
  onboardingCompletedAt: string | null;
  // Novos campos para skip/dismiss
  onboardingSkipped: boolean;
  onboardingSkippedAt: string | null;
  onboardingDismissed: boolean;
  onboardingDismissedAt: string | null;
}

const initialProgress: OnboardingProgress = {
  tipoNegocio: null,
  stepClienteCadastrado: false,
  stepClienteCadastradoAt: null,
  stepDispositivoCadastrado: false,
  stepDispositivoCadastradoAt: null,
  stepPecaCadastrada: false,
  stepPecaCadastradaAt: null,
  stepOsCriada: false,
  stepOsCriadaAt: null,
  stepLucroVisualizado: false,
  stepLucroVisualizadoAt: null,
  ahaMomentReached: false,
  ahaMomentReachedAt: null,
  onboardingCompleted: false,
  onboardingCompletedAt: null,
  onboardingSkipped: false,
  onboardingSkippedAt: null,
  onboardingDismissed: false,
  onboardingDismissedAt: null
};

export function useOnboarding() {
  const [progress, setProgress] = useState<OnboardingProgress>(initialProgress);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const { trackEvent } = useEventTracking();

  // Carregar progresso do onboarding
  const loadProgress = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      
      if (!user) {
        setLoading(false);
        return;
      }

      setUserId(user.id);

      const { data, error } = await supabase
        .from('user_onboarding')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('[Onboarding] Erro ao carregar progresso:', error);
        setLoading(false);
        return;
      }

      if (data) {
        setProgress({
          tipoNegocio: (data as any).tipo_negocio as TipoNegocio,
          stepClienteCadastrado: data.step_cliente_cadastrado || false,
          stepClienteCadastradoAt: data.step_cliente_cadastrado_at,
          stepDispositivoCadastrado: data.step_dispositivo_cadastrado || false,
          stepDispositivoCadastradoAt: data.step_dispositivo_cadastrado_at,
          stepPecaCadastrada: (data as any).step_peca_cadastrada || false,
          stepPecaCadastradaAt: (data as any).step_peca_cadastrada_at,
          stepOsCriada: data.step_os_criada || false,
          stepOsCriadaAt: data.step_os_criada_at,
          stepLucroVisualizado: data.step_lucro_visualizado || false,
          stepLucroVisualizadoAt: data.step_lucro_visualizado_at,
          ahaMomentReached: data.aha_moment_reached || false,
          ahaMomentReachedAt: data.aha_moment_reached_at,
          onboardingCompleted: data.onboarding_completed || false,
          onboardingCompletedAt: data.onboarding_completed_at,
          onboardingSkipped: (data as any).onboarding_skipped || false,
          onboardingSkippedAt: (data as any).onboarding_skipped_at,
          onboardingDismissed: (data as any).onboarding_dismissed || false,
          onboardingDismissedAt: (data as any).onboarding_dismissed_at
        });
      } else {
        // Criar registro de onboarding se não existir
        const { error: insertError } = await supabase
          .from('user_onboarding')
          .insert({ user_id: user.id });

        if (insertError) {
          console.error('[Onboarding] Erro ao criar onboarding:', insertError);
        }
      }

      setLoading(false);
    } catch (err) {
      console.error('[Onboarding] Erro inesperado:', err);
      setLoading(false);
    }
  }, []);

  // Definir o tipo de negócio
  const setTipoNegocio = useCallback(async (tipo: 'assistencia' | 'vendas') => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from('user_onboarding')
        .update({ tipo_negocio: tipo } as any)
        .eq('user_id', userId);

      if (error) {
        console.error('[Onboarding] Erro ao definir tipo de negócio:', error);
        return;
      }

      // Registrar evento
      await trackEvent('onboarding_tipo_negocio_selected', { tipo });

      // Recarregar progresso
      await loadProgress();
    } catch (err) {
      console.error('[Onboarding] Erro inesperado ao definir tipo:', err);
    }
  }, [userId, loadProgress, trackEvent]);

  // Atualizar um passo específico
  const completeStep = useCallback(async (step: 'cliente_cadastrado' | 'dispositivo_cadastrado' | 'peca_cadastrada' | 'os_criada' | 'lucro_visualizado') => {
    if (!userId) return;

    try {
      const { error } = await supabase.rpc('update_onboarding_step', {
        _user_id: userId,
        _step: step
      });

      if (error) {
        console.error('[Onboarding] Erro ao completar passo:', error);
        return;
      }

      // Registrar evento
      await trackEvent('onboarding_step_completed', { step });

      // Recarregar progresso
      await loadProgress();
    } catch (err) {
      console.error('[Onboarding] Erro inesperado ao completar passo:', err);
    }
  }, [userId, loadProgress, trackEvent]);

  // Pular o onboarding (mostra banner depois)
  const skipOnboarding = useCallback(async () => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from('user_onboarding')
        .update({ 
          onboarding_skipped: true, 
          onboarding_skipped_at: new Date().toISOString() 
        } as any)
        .eq('user_id', userId);

      if (error) {
        console.error('[Onboarding] Erro ao pular onboarding:', error);
        return;
      }

      await trackEvent('onboarding_skipped');
      await loadProgress();
    } catch (err) {
      console.error('[Onboarding] Erro inesperado ao pular:', err);
    }
  }, [userId, loadProgress, trackEvent]);

  // Dispensar o onboarding permanentemente
  const dismissOnboarding = useCallback(async () => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from('user_onboarding')
        .update({ 
          onboarding_dismissed: true, 
          onboarding_dismissed_at: new Date().toISOString() 
        } as any)
        .eq('user_id', userId);

      if (error) {
        console.error('[Onboarding] Erro ao dispensar onboarding:', error);
        return;
      }

      await trackEvent('onboarding_dismissed');
      await loadProgress();
    } catch (err) {
      console.error('[Onboarding] Erro inesperado ao dispensar:', err);
    }
  }, [userId, loadProgress, trackEvent]);

  // Resetar o skip para voltar ao onboarding
  const resetSkip = useCallback(async () => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from('user_onboarding')
        .update({ 
          onboarding_skipped: false, 
          onboarding_skipped_at: null 
        } as any)
        .eq('user_id', userId);

      if (error) {
        console.error('[Onboarding] Erro ao resetar skip:', error);
        return;
      }

      await loadProgress();
    } catch (err) {
      console.error('[Onboarding] Erro inesperado ao resetar skip:', err);
    }
  }, [userId, loadProgress]);

  // Verificar se o onboarding deve ser exibido
  const shouldShowOnboarding = useCallback(() => {
    // Não mostrar se já completou os passos principais baseado no tipo
    if (progress.tipoNegocio === 'assistencia' && progress.stepOsCriada) return false;
    if (progress.tipoNegocio === 'vendas' && progress.stepDispositivoCadastrado) return false;
    
    // Não mostrar se ainda está carregando
    if (loading) return false;
    
    return true;
  }, [progress.tipoNegocio, progress.stepOsCriada, progress.stepDispositivoCadastrado, loading]);

  // Obter o passo atual baseado no tipo de negócio
  const getCurrentStep = useCallback(() => {
    // Se não selecionou tipo, está no passo 0 (seleção)
    if (!progress.tipoNegocio) return 0;

    if (progress.tipoNegocio === 'assistencia') {
      // Assistência: Cliente -> Peça -> OS -> Lucro
      if (!progress.stepClienteCadastrado) return 1;
      if (!progress.stepPecaCadastrada) return 2;
      if (!progress.stepOsCriada) return 3;
      if (!progress.stepLucroVisualizado) return 4;
      return 5;
    } else {
      // Vendas: Cliente -> Dispositivo -> Lucro
      if (!progress.stepClienteCadastrado) return 1;
      if (!progress.stepDispositivoCadastrado) return 2;
      if (!progress.stepLucroVisualizado) return 3;
      return 4;
    }
  }, [progress]);

  // Obter progresso em percentual
  const getProgressPercentage = useCallback(() => {
    if (!progress.tipoNegocio) return 0;

    if (progress.tipoNegocio === 'assistencia') {
      // 4 passos para assistência
      let completed = 0;
      if (progress.stepClienteCadastrado) completed++;
      if (progress.stepPecaCadastrada) completed++;
      if (progress.stepOsCriada) completed++;
      if (progress.stepLucroVisualizado) completed++;
      return (completed / 4) * 100;
    } else {
      // 3 passos para vendas
      let completed = 0;
      if (progress.stepClienteCadastrado) completed++;
      if (progress.stepDispositivoCadastrado) completed++;
      if (progress.stepLucroVisualizado) completed++;
      return (completed / 3) * 100;
    }
  }, [progress]);

  // Obter total de passos baseado no tipo
  const getTotalSteps = useCallback(() => {
    if (!progress.tipoNegocio) return 4;
    return progress.tipoNegocio === 'assistencia' ? 4 : 3;
  }, [progress.tipoNegocio]);

  // Carregar ao montar
  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  // Escutar mudanças em tempo real
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('onboarding_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_onboarding',
          filter: `user_id=eq.${userId}`
        },
        () => {
          loadProgress();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, loadProgress]);

  return {
    progress,
    loading,
    setTipoNegocio,
    completeStep,
    shouldShowOnboarding,
    getCurrentStep,
    getProgressPercentage,
    getTotalSteps,
    reload: loadProgress,
    skipOnboarding,
    dismissOnboarding,
    resetSkip
  };
}
