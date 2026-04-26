import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { saveSessionMeta, isSessionWithinLongTermWindow } from "@/lib/sessionStorage";

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

    const restore = async () => {
      try {
        // 1. Tentar obter sessão existente (sem network — apenas localStorage)
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
          // Sessão válida encontrada
          if (!cancelled) {
            saveSessionMeta(session.user.id);
            setState({ isRestoring: false, hasSession: true });
          }
          return;
        }

        // 2. Sem sessão direta — verificar se estamos offline
        const isOffline = !navigator.onLine;

        if (isOffline) {
          // Offline: verificar se existe janela de longa duração válida
          const withinWindow = isSessionWithinLongTermWindow();
          console.log("[useSessionRestore] Offline — usando sessão cached:", withinWindow);
          if (!cancelled) {
            setState({ isRestoring: false, hasSession: withinWindow });
          }
          return;
        }

        // 3. Online mas sem sessão — tentar refresh (access_token expirado, refresh_token válido)
        console.log("[useSessionRestore] Tentando refreshSession...");
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

        if (refreshData.session && !refreshError) {
          console.log("[useSessionRestore] Sessão restaurada via refresh!");
          if (!cancelled) {
            saveSessionMeta(refreshData.session.user.id);
            setState({ isRestoring: false, hasSession: true });
          }
          return;
        }

        // 4. Sem sessão possível — redirecionar para login
        console.log("[useSessionRestore] Nenhuma sessão válida encontrada.");
        if (!cancelled) {
          setState({ isRestoring: false, hasSession: false });
        }
      } catch (e) {
        console.warn("[useSessionRestore] Erro na restauração:", e);
        // Em caso de erro (ex: offline sem cache), liberar o app para não travar
        if (!cancelled) {
          setState({ isRestoring: false, hasSession: false });
        }
      }
    };

    restore();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
