import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { saveSessionMeta, isSessionWithinLongTermWindow } from "@/lib/sessionStorage";
import { inicializarOneSignal } from "@/hooks/useNotificacoes";

interface SessionRestoreState {
  isRestoring: boolean;
  hasSession: boolean;
}

/**
 * Hook de restauração de sessão — roda UMA VEZ na inicialização do app.
 *
 * Fluxo:
 * 1. Tenta obter sessão existente via getSession()
 * 2. Se não tiver sessão válida mas tiver refresh_token, tenta refreshSession()
 * 3. Se estiver offline, libera com sessão cached (sem tentar network)
 * 4. Atualiza metadados de sessão de longa duração (janela de 90 dias)
 * 5. Expõe `isRestoring` para bloquear renderização de rotas até estar pronto
 */
export function useSessionRestore(): SessionRestoreState {
  const [state, setState] = useState<SessionRestoreState>({
    isRestoring: true,
    hasSession: false,
  });

  useEffect(() => {
    let cancelled = false;

    // Timeout máximo de 3s — nunca deixar o app travado em tela branca
    const maxTimer = setTimeout(() => {
      if (!cancelled) {
        console.warn("[useSessionRestore] Timeout — liberando sem sessão.");
        setState({ isRestoring: false, hasSession: false });
      }
    }, 3000);

    const restore = async () => {
      try {
        // 1. Tentar obter sessão existente (sem network — apenas localStorage)
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
          if (!cancelled) {
            clearTimeout(maxTimer);
            saveSessionMeta(session.user.id);
            setState({ isRestoring: false, hasSession: true });
            setTimeout(() => {
              inicializarOneSignal(session.user.id).catch(console.error);
            }, 2000);
          }
          return;
        }

        // 2. Sem sessão direta — verificar se estamos offline
        const isOffline = !navigator.onLine;

        if (isOffline) {
          const withinWindow = isSessionWithinLongTermWindow();
          if (!cancelled) {
            clearTimeout(maxTimer);
            setState({ isRestoring: false, hasSession: withinWindow });
          }
          return;
        }

        // 3. Online mas sem sessão — tentar refresh com timeout de 5s
        const refreshPromise = supabase.auth.refreshSession();
        const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));

        const result = await Promise.race([refreshPromise, timeoutPromise]);

        if (result && 'data' in result && result.data.session && !result.error) {
          if (!cancelled) {
            clearTimeout(maxTimer);
            saveSessionMeta(result.data.session.user.id);
            setState({ isRestoring: false, hasSession: true });
            setTimeout(() => {
              inicializarOneSignal(result.data.session!.user.id).catch(console.error);
            }, 2000);
          }
          return;
        }

        if (!cancelled) {
          clearTimeout(maxTimer);
          setState({ isRestoring: false, hasSession: false });
        }
      } catch (e) {
        console.warn("[useSessionRestore] Erro na restauração:", e);
        if (!cancelled) {
          clearTimeout(maxTimer);
          setState({ isRestoring: false, hasSession: false });
        }
      }
    };

    restore();

    return () => {
      cancelled = true;
      clearTimeout(maxTimer);
    };
  }, []);

  return state;
}
