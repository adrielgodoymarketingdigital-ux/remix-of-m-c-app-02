// TikTok Pixel (ttq) — eventos de conversão do funil de cadastro/assinatura.
// O snippet base (ttq.load + ttq.page inicial) vive no index.html e roda em
// toda página. Como o app é uma SPA (React Router sem reload de página), uma
// navegação client-side de Landing → Auth → CadastroPlano → Checkout NUNCA
// dispara um novo ttq.page() sozinha — por isso essas funções são chamadas
// manualmente nos mesmos pontos onde o Meta Pixel já é disparado
// (src/lib/tracking.ts), em vez de depender só do snippet global.
// Sem CAPI (Events API) do TikTok configurada — só client-side por enquanto.
//
// DESLIGADO por padrão (não anunciamos mais no TikTok): só dispara com
// VITE_TIKTOK_PIXEL_ATIVO=true, a mesma chave que libera o snippet no index.html.

const TIKTOK_PIXEL_ATIVO = import.meta.env.VITE_TIKTOK_PIXEL_ATIVO === 'true';

export function trackTiktokPageView(): void {
  if (!TIKTOK_PIXEL_ATIVO) return;
  try {
    window.ttq?.page();
  } catch (error) {
    console.error('[Tracking][TikTok] Erro em trackTiktokPageView:', error);
  }
}

/** Disparar quando um cadastro é concluído com sucesso (página Auth). */
export function trackTiktokCompleteRegistration(): void {
  if (!TIKTOK_PIXEL_ATIVO) return;
  try {
    window.ttq?.track('CompleteRegistration');
  } catch (error) {
    console.error('[Tracking][TikTok] Erro em trackTiktokCompleteRegistration:', error);
  }
}

/** Disparar ao abrir uma página/dialog de checkout (Pix ou Cartão). */
export function trackTiktokInitiateCheckout(value?: number): void {
  if (!TIKTOK_PIXEL_ATIVO) return;
  try {
    window.ttq?.track('InitiateCheckout', { value: value || 0, currency: 'BRL' });
  } catch (error) {
    console.error('[Tracking][TikTok] Erro em trackTiktokInitiateCheckout:', error);
  }
}
