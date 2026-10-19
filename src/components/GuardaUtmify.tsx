import { useLayoutEffect, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

/** Definido no index.html (fonte única da lista de rotas públicas da UTMify). */
interface MecUtmify {
  carregado: boolean;
  ehRotaPublica: (caminho: string) => boolean;
  carregar: () => void;
}

declare global {
  interface Window {
    __mecUtmify?: MecUtmify;
  }
}

/**
 * Mantém o pixel da UTMify só nas páginas públicas também na navegação SPA.
 *
 * Um script já carregado não pode ser desligado (o pixel fica com um
 * observador + intervalo de 2s "preenchendo" campos de e-mail). Então:
 *  - pixel ativo e a rota passa a ser do app/login → não monta a tela e
 *    recarrega a página (que volta sem o pixel, pela regra do index.html);
 *  - rota pública alcançada pelo app → carrega o pixel ali, como hoje.
 */
export function GuardaUtmify({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const utmify = typeof window !== "undefined" ? window.__mecUtmify : undefined;
  const publica = !utmify || utmify.ehRotaPublica(pathname);
  const precisaRecarregar = !!utmify?.carregado && !publica;

  useLayoutEffect(() => {
    if (!utmify) return;
    if (publica) utmify.carregar();
    else if (utmify.carregado) window.location.reload();
  }, [pathname, publica, utmify]);

  // Enquanto o pixel estiver ativo, nenhuma tela do app/login é montada
  if (precisaRecarregar) return null;
  return <>{children}</>;
}
