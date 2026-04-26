import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Tipos de eventos que podem ser rastreados
export type EventType =
  | 'login'
  | 'logout'
  | 'cliente_cadastrado'
  | 'dispositivo_cadastrado'
  | 'peca_cadastrada'
  | 'os_criada'
  | 'os_finalizada'
  | 'relatorio_visualizado'
  | 'planos_visitado'
  | 'funcionalidade_bloqueada'
  | 'onboarding_step_completed'
  | 'onboarding_tipo_negocio_selected'
  | 'onboarding_skipped'
  | 'onboarding_dismissed'
  | 'aha_moment_reached'
  | 'upgrade_clicked'
  | 'trial_warning_shown'
  | 'page_view';

interface EventData {
  [key: string]: string | number | boolean | null | undefined;
}

export function useEventTracking() {
  const trackEvent = useCallback(async (eventType: EventType, eventData: EventData = {}) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      
      if (!user) {
        console.log('[EventTracking] Usuário não autenticado, evento ignorado:', eventType);
        return null;
      }

      // Usar a função RPC para registrar o evento
      const { data, error } = await supabase.rpc('track_user_event', {
        _event_type: eventType,
        _event_data: eventData
      });

      if (error) {
        console.error('[EventTracking] Erro ao registrar evento:', error);
        return null;
      }

      console.log('[EventTracking] Evento registrado:', eventType, eventData);
      return data;
    } catch (err) {
      console.error('[EventTracking] Erro inesperado:', err);
      return null;
    }
  }, []);

  // Helpers para eventos específicos
  const trackLogin = useCallback(() => trackEvent('login'), [trackEvent]);
  
  const trackLogout = useCallback(() => trackEvent('logout'), [trackEvent]);
  
  const trackClienteCadastrado = useCallback((clienteId: string) => 
    trackEvent('cliente_cadastrado', { cliente_id: clienteId }), [trackEvent]);
  
  const trackDispositivoCadastrado = useCallback((dispositivoId: string) => 
    trackEvent('dispositivo_cadastrado', { dispositivo_id: dispositivoId }), [trackEvent]);
  
  const trackOSCriada = useCallback((osId: string, temCliente: boolean, temDispositivo: boolean) => 
    trackEvent('os_criada', { os_id: osId, tem_cliente: temCliente, tem_dispositivo: temDispositivo }), [trackEvent]);
  
  const trackOSFinalizada = useCallback((osId: string, valorTotal: number) => 
    trackEvent('os_finalizada', { os_id: osId, valor_total: valorTotal }), [trackEvent]);
  
  const trackRelatorioVisualizado = useCallback((tipoRelatorio: string) => 
    trackEvent('relatorio_visualizado', { tipo: tipoRelatorio }), [trackEvent]);
  
  const trackPlanosVisitado = useCallback(() => 
    trackEvent('planos_visitado'), [trackEvent]);
  
  const trackFuncionalidadeBloqueada = useCallback((funcionalidade: string) => 
    trackEvent('funcionalidade_bloqueada', { funcionalidade }), [trackEvent]);
  
  const trackUpgradeClicked = useCallback((origem: string) => 
    trackEvent('upgrade_clicked', { origem }), [trackEvent]);
  
  const trackPageView = useCallback((pagina: string) => 
    trackEvent('page_view', { pagina }), [trackEvent]);

  return {
    trackEvent,
    trackLogin,
    trackLogout,
    trackClienteCadastrado,
    trackDispositivoCadastrado,
    trackOSCriada,
    trackOSFinalizada,
    trackRelatorioVisualizado,
    trackPlanosVisitado,
    trackFuncionalidadeBloqueada,
    trackUpgradeClicked,
    trackPageView
  };
}
