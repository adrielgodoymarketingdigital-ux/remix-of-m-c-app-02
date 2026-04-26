/**
 * Utilitários de persistência de sessão de longa duração (30-90 dias)
 * 
 * O Supabase gerencia os tokens JWT/refresh internamente no localStorage.
 * Este módulo complementa com metadados para controle de janela de 90 dias
 * e suporte ao modo offline.
 */

const SESSION_META_KEY = "mec_session_meta";
const SESSION_SUBSCRIPTION_CACHE_KEY = "mec_subscription_cache";
const LONG_TERM_WINDOW_DAYS = 90;

interface SessionMeta {
  userId: string;
  lastActive: string; // ISO string
  windowExpiresAt: string; // ISO string - 90 dias após último acesso
}

interface SubscriptionCache {
  assinatura: any;
  onboarding: any;
  cachedAt: string; // ISO string
  userId: string;
}

/**
 * Salva metadados da sessão e renova a janela de 90 dias a cada acesso
 */
export function saveSessionMeta(userId: string): void {
  const now = new Date();
  const windowExpires = new Date();
  windowExpires.setDate(windowExpires.getDate() + LONG_TERM_WINDOW_DAYS);

  const meta: SessionMeta = {
    userId,
    lastActive: now.toISOString(),
    windowExpiresAt: windowExpires.toISOString(),
  };

  try {
    localStorage.setItem(SESSION_META_KEY, JSON.stringify(meta));
  } catch (e) {
    console.warn("[sessionStorage] Falha ao salvar metadados da sessão:", e);
  }
}

/**
 * Recupera os metadados da sessão salva
 */
export function getSessionMeta(): SessionMeta | null {
  try {
    const raw = localStorage.getItem(SESSION_META_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionMeta;
  } catch (e) {
    return null;
  }
}

/**
 * Verifica se a sessão ainda está dentro da janela de 90 dias
 */
export function isSessionWithinLongTermWindow(): boolean {
  const meta = getSessionMeta();
  if (!meta) return false;

  const expiresAt = new Date(meta.windowExpiresAt);
  return expiresAt > new Date();
}

/**
 * Limpa todos os metadados de sessão (usar no logout)
 */
export function clearSessionMeta(): void {
  try {
    localStorage.removeItem(SESSION_META_KEY);
    localStorage.removeItem(SESSION_SUBSCRIPTION_CACHE_KEY);
  } catch (e) {
    console.warn("[sessionStorage] Falha ao limpar metadados da sessão:", e);
  }
}

/**
 * Salva cache da assinatura e onboarding para uso offline
 */
export function saveSubscriptionCache(userId: string, assinatura: any, onboarding: any): void {
  try {
    const cache: SubscriptionCache = {
      assinatura,
      onboarding,
      cachedAt: new Date().toISOString(),
      userId,
    };
    localStorage.setItem(SESSION_SUBSCRIPTION_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn("[sessionStorage] Falha ao salvar cache de assinatura:", e);
  }
}

/**
 * Recupera cache da assinatura para uso offline
 * Só retorna se o cache for do mesmo userId e tiver menos de 7 dias
 */
export function getSubscriptionCache(userId: string): { assinatura: any; onboarding: any } | null {
  try {
    const raw = localStorage.getItem(SESSION_SUBSCRIPTION_CACHE_KEY);
    if (!raw) return null;

    const cache = JSON.parse(raw) as SubscriptionCache;

    // Verificar se é do mesmo usuário
    if (cache.userId !== userId) return null;

    // Verificar se o cache tem menos de 7 dias
    const cachedAt = new Date(cache.cachedAt);
    const maxAge = new Date();
    maxAge.setDate(maxAge.getDate() - 7);
    if (cachedAt < maxAge) return null;

    return { assinatura: cache.assinatura, onboarding: cache.onboarding };
  } catch (e) {
    return null;
  }
}
