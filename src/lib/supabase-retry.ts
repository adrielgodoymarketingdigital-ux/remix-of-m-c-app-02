/**
 * Retry wrapper with exponential backoff for Supabase queries.
 * Retries up to 3 times (1s, 2s, 3s delays) before throwing.
 * Only retries on network/timeout errors, not auth or RLS errors.
 */

const NON_RETRYABLE_PATTERNS = [
  'JWT', 'Auth', 'refresh_token', 'row-level security',
  'permission denied', '42501', '42P01', 'relation',
];

function isRetryable(error: unknown): boolean {
  if (!error) return false;
  const message = (error as any)?.message || String(error);
  const code = (error as any)?.code;

  // Don't retry auth or permission errors
  if (NON_RETRYABLE_PATTERNS.some(p => message.includes(p))) return false;
  if (code === '42501' || code === 'PGRST301') return false;

  // Retry network errors, timeouts, fetch failures
  if (message.includes('Failed to fetch')) return true;
  if (message.includes('NetworkError')) return true;
  if (message.includes('timeout')) return true;
  if (message.includes('ETIMEDOUT')) return true;
  if (message.includes('ERR_NETWORK')) return true;
  if (message.includes('aborted')) return true;
  if (code === 'ECONNABORTED') return true;

  // Retry 5xx server errors
  const status = (error as any)?.status || (error as any)?.statusCode;
  if (status && status >= 500) return true;

  // Default: retry unknown errors (could be transient)
  return true;
}

function isNetworkError(error: unknown): boolean {
  const message = (error as any)?.message || String(error);
  return (
    message.includes('Failed to fetch') ||
    message.includes('NetworkError') ||
    message.includes('ERR_NETWORK') ||
    !navigator.onLine
  );
}

export function classifyError(error: unknown): {
  type: 'network' | 'auth' | 'permission' | 'server' | 'unknown';
  userMessage: string;
} {
  const message = (error as any)?.message || String(error);
  const status = (error as any)?.status || (error as any)?.statusCode;

  if (isNetworkError(error)) {
    return {
      type: 'network',
      userMessage: 'Sem conexão com a internet. Verifique sua rede e tente novamente.',
    };
  }

  if (message.includes('JWT') || message.includes('Auth') || message.includes('refresh_token')) {
    return {
      type: 'auth',
      userMessage: 'Sua sessão expirou. Por favor, faça login novamente.',
    };
  }

  if (message.includes('row-level security') || message.includes('permission denied')) {
    return {
      type: 'permission',
      userMessage: 'Você não tem permissão para acessar esses dados.',
    };
  }

  if (status && status >= 500) {
    return {
      type: 'server',
      userMessage: 'O servidor está temporariamente indisponível. Tente novamente em alguns instantes.',
    };
  }

  return {
    type: 'unknown',
    userMessage: 'Ocorreu um erro inesperado. Tente novamente.',
  };
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function withRetry<T>(
  fn: () => Promise<T>,
  hookName: string,
  maxRetries = 3,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!isRetryable(error) || attempt === maxRetries) {
        const classified = classifyError(error);
        console.error(`[${hookName}]`, {
          error,
          attempt,
          errorType: classified.type,
          timestamp: new Date().toISOString(),
        });
        throw error;
      }

      const delay = attempt * 1000; // 1s, 2s, 3s
      console.warn(`[${hookName}] Tentativa ${attempt}/${maxRetries} falhou, retentando em ${delay}ms...`, error);
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Helper to check if an error should suppress toast (auth errors during session transitions)
 */
export function shouldSuppressToast(error: unknown): boolean {
  const classified = classifyError(error);
  return classified.type === 'auth';
}
