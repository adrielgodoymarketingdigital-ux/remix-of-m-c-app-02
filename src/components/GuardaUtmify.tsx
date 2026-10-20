import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { aguardarPurchasePendente } from "@/lib/tracking";

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

/** Espera máxima pelo envio do Purchase (CAPI) antes de recarregar, ao sair da /obrigado. */
const ESPERA_MAXIMA_PURCHASE_MS = 4000;

const ehObrigado = (caminho: string) => caminho.replace(/\/+$/, "") === "/obrigado";

/** Tela da espera pelo Purchase ao sair da /obrigado (mesmo visual do RouteFallback do App). */
const AbrindoPainel = () => (
  <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-4">
    <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
    <p className="text-sm text-muted-foreground">Abrindo seu painel…</p>
  </div>
);

/**
 * Mantém o pixel da UTMify só nas páginas públicas também na navegação SPA.
 *
 * Um script já carregado não pode ser desligado (o pixel fica com um
 * observador + intervalo de 2s "preenchendo" campos de e-mail). Então:
 *  - pixel ativo e a rota passa a ser do app/login → não monta a tela e
 *    recarrega a página (que volta sem o pixel, pela regra do index.html);
 *    vindo da /obrigado, antes espera o envio do Purchase terminar (com limite);
 *  - rota pública alcançada pelo app → carrega o pixel ali, como hoje.
 */
export function GuardaUtmify({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const utmify = typeof window !== "undefined" ? window.__mecUtmify : undefined;
  const publica = !utmify || utmify.ehRotaPublica(pathname);
  const precisaRecarregar = !!utmify?.carregado && !publica;
  const anteriorRef = useRef(pathname);
  const recarregandoRef = useRef(false);
  const [aguardandoPurchase, setAguardandoPurchase] = useState(false);

  useLayoutEffect(() => {
    const anterior = anteriorRef.current;
    anteriorRef.current = pathname;
    if (!utmify) return;
    if (publica) {
      utmify.carregar();
      return;
    }
    if (!utmify.carregado || recarregandoRef.current) return;
    recarregandoRef.current = true;
    if (ehObrigado(anterior)) {
      setAguardandoPurchase(true);
      aguardarPurchasePendente(ESPERA_MAXIMA_PURCHASE_MS).then(() => window.location.reload());
    } else {
      window.location.reload();
    }
  }, [pathname, publica, utmify]);

  // Enquanto o pixel estiver ativo, nenhuma tela do app/login é montada
  if (precisaRecarregar) return aguardandoPurchase ? <AbrindoPainel /> : null;
  return <>{children}</>;
}
