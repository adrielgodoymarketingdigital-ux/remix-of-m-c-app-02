// Utilitário para gerenciar dismiss de cards com tempo de expiração

export type DismissDuration = 'forever' | 'month' | 'week' | 'hours';

interface DismissData {
  dismissedAt: number;
  expiresAt: number | null; // null = forever
}

const STORAGE_KEY_PREFIX = 'card_dismissed_';

export function isDismissed(cardId: string): boolean {
  const key = STORAGE_KEY_PREFIX + cardId;
  const stored = localStorage.getItem(key);
  
  if (!stored) return false;
  
  try {
    const data: DismissData = JSON.parse(stored);
    
    // Se não tem expiração, está dismissado para sempre
    if (data.expiresAt === null) return true;
    
    // Verificar se expirou
    if (Date.now() > data.expiresAt) {
      localStorage.removeItem(key);
      return false;
    }
    
    return true;
  } catch {
    localStorage.removeItem(key);
    return false;
  }
}

export function dismissCard(cardId: string, duration: DismissDuration): void {
  const key = STORAGE_KEY_PREFIX + cardId;
  const now = Date.now();
  
  let expiresAt: number | null = null;
  
  switch (duration) {
    case 'forever':
      expiresAt = null;
      break;
    case 'month':
      expiresAt = now + 30 * 24 * 60 * 60 * 1000; // 30 dias
      break;
    case 'week':
      expiresAt = now + 7 * 24 * 60 * 60 * 1000; // 7 dias
      break;
    case 'hours':
      expiresAt = now + 24 * 60 * 60 * 1000; // 24 horas
      break;
  }
  
  const data: DismissData = {
    dismissedAt: now,
    expiresAt,
  };
  
  localStorage.setItem(key, JSON.stringify(data));
}

export function undismissCard(cardId: string): void {
  const key = STORAGE_KEY_PREFIX + cardId;
  localStorage.removeItem(key);
}

export const DISMISS_OPTIONS = [
  { value: 'forever' as DismissDuration, label: 'Sem prazo' },
  { value: 'month' as DismissDuration, label: 'Por 1 mês' },
  { value: 'week' as DismissDuration, label: 'Por 1 semana' },
  { value: 'hours' as DismissDuration, label: 'Por 24 horas' },
] as const;
