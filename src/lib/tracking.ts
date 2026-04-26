// Tracking parameters utility for Meta CAPI integration
// NOTE: O Meta Pixel e captura de parâmetros são feitos no index.html
// Este arquivo exporta tipos e função para acessar os parâmetros

import { supabase } from "@/integrations/supabase/client";

export interface TrackingParams {
  fbp: string | null;
  fbc: string | null;
  fbclid: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  client_user_agent: string;
}

// Cookie reader com decodeURIComponent para garantir leitura correta
function getCookie(name: string): string | null {
  try {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    if (match && match[2]) {
      return decodeURIComponent(match[2]);
    }
    return null;
  } catch {
    return null;
  }
}

// Generate UUID v4 for event deduplication
function generateEventId(): string {
  return crypto.randomUUID?.() || 
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
}

// Get all tracking parameters (usa dados já capturados pelo index.html + cookies do Meta Pixel)
export function getTrackingParams(): TrackingParams {
  if (typeof window === 'undefined') {
    return {
      fbp: null,
      fbc: null,
      fbclid: null,
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      utm_content: null,
      utm_term: null,
      client_user_agent: '',
    };
  }

  const params = new URLSearchParams(window.location.search);
  
  // Ler cookies _fbp e _fbc
  const fbp = getCookie('_fbp');
  const fbc = getCookie('_fbc');
  const fbclid = localStorage.getItem('tracking_fbclid') || params.get('fbclid');

  // Se temos fbclid mas não temos fbc, criar o fbc no formato correto
  let finalFbc = fbc;
  if (!finalFbc && fbclid) {
    finalFbc = `fb.1.${Date.now()}.${fbclid}`;
    // Salvar o cookie para uso futuro
    document.cookie = `_fbc=${encodeURIComponent(finalFbc)}; path=/; max-age=7776000; SameSite=Lax`;
  }

  const result: TrackingParams = {
    fbp,
    fbc: finalFbc,
    fbclid,
    utm_source: localStorage.getItem('tracking_utm_source') || params.get('utm_source'),
    utm_medium: localStorage.getItem('tracking_utm_medium') || params.get('utm_medium'),
    utm_campaign: localStorage.getItem('tracking_utm_campaign') || params.get('utm_campaign'),
    utm_content: localStorage.getItem('tracking_utm_content') || params.get('utm_content'),
    utm_term: localStorage.getItem('tracking_utm_term') || params.get('utm_term'),
    client_user_agent: navigator.userAgent,
  };

  console.log('[Tracking] getTrackingParams resultado:', {
    fbp: result.fbp || 'NÃO ENCONTRADO',
    fbc: result.fbc || 'NÃO ENCONTRADO',
    fbclid: result.fbclid || 'NÃO ENCONTRADO',
    hasUtmSource: !!result.utm_source,
  });

  return result;
}

/**
 * Envia evento para Meta Conversion API via edge function
 * Retorna true se enviou com sucesso
 */
async function sendMetaCapiEvent(params: {
  event_name: string;
  event_id: string;
  email?: string;
  custom_data?: Record<string, unknown>;
}): Promise<boolean> {
  try {
    const tracking = getTrackingParams();

    const { data, error } = await supabase.functions.invoke('meta-capi-event', {
      body: {
        event_name: params.event_name,
        event_id: params.event_id,
        email: params.email || null,
        fbp: tracking.fbp,
        fbc: tracking.fbc,
        client_user_agent: tracking.client_user_agent,
        custom_data: params.custom_data || {},
      },
    });

    if (error) {
      console.error('[Tracking] CAPI edge function error:', error);
      return false;
    }

    console.log('[Tracking] CAPI response:', data);
    return data?.success === true;
  } catch (err) {
    console.error('[Tracking] Failed to send CAPI event:', err);
    return false;
  }
}

/**
 * Dispara o evento CompleteRegistration com deduplicação Pixel + CAPI
 * Gera um event_id único e envia tanto para o Pixel (frontend) quanto para a CAPI (backend)
 * Garante que o evento seja disparado apenas uma vez por usuário
 * @param userId - ID do usuário no Supabase
 * @param email - Email do usuário (para hash SHA256 na CAPI)
 * @returns true se o evento foi disparado, false se já havia sido disparado anteriormente
 */
export async function trackCompleteRegistration(userId: string, email?: string): Promise<boolean> {
  try {
    // 1. Verificar se já foi rastreado
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('registration_tracked')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (fetchError) {
      console.error('[Tracking] Erro ao verificar registration_tracked:', fetchError);
      // Continuar mesmo com erro, para não perder o evento
    }

    if (profile?.registration_tracked) {
      console.log('[Tracking] CompleteRegistration já foi disparado para este usuário');
      return false;
    }

    // 2. Gerar event_id único para deduplicação
    const eventId = generateEventId();
    console.log('[Tracking] CompleteRegistration event_id:', eventId);

    // 3. Disparar evento no Meta Pixel com event_id
    if (typeof window !== 'undefined' && window.fbq) {
      (window.fbq as any)('track', 'CompleteRegistration', {
        content_name: 'Signup',
        currency: 'BRL',
        value: 0,
        status: true,
      }, { eventID: eventId });

      console.log('[Tracking] CompleteRegistration Pixel disparado com eventID:', eventId);
    } else {
      console.warn('[Tracking] Meta Pixel (fbq) não disponível');
    }

    // 4. Enviar para Meta CAPI (backend) com mesmo event_id
    sendMetaCapiEvent({
      event_name: 'CompleteRegistration',
      event_id: eventId,
      email,
      custom_data: {
        plan: 'free',
        content_name: 'Signup',
        currency: 'BRL',
        value: 0,
      },
    }).then((success) => {
      console.log('[Tracking] CAPI CompleteRegistration sent:', success);
    }).catch((err) => {
      console.error('[Tracking] CAPI CompleteRegistration failed:', err);
    });

    // 5. Marcar como rastreado no banco (mesmo que o pixel/CAPI não estejam disponíveis)
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ registration_tracked: true })
      .eq('user_id', userId);

    if (updateError) {
      console.error('[Tracking] Erro ao marcar registration_tracked:', updateError);
    }

    return true;
  } catch (error) {
    console.error('[Tracking] Erro inesperado em trackCompleteRegistration:', error);
    return false;
  }
}

// Expose global function (sobrescreve a do index.html com versão mais robusta)
declare global {
  interface Window {
    __getTrackingParams: () => TrackingParams;
  }
}

if (typeof window !== 'undefined') {
  window.__getTrackingParams = getTrackingParams;
}
