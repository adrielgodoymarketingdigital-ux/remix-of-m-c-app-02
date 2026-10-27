import { useEffect, useState, useSyncExternalStore } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  adiarAtualizacao,
  aplicarAtualizacao,
  assinarAtualizacao,
  mostrarAvisoAtualizacao,
} from "@/lib/pwa/atualizacaoApp";

// Landings e páginas que o cliente da loja abre: não são o app de quem usa o Méc.
const ROTAS_PUBLICAS = ["/", "/lp1", "/lp2", "/es"];
const PREFIXOS_PUBLICOS = ["/c/", "/lp/", "/acompanhar/", "/acompanhar-cliente/", "/entrada/"];
const ehPaginaPublica = (caminho: string) =>
  ROTAS_PUBLICAS.includes(caminho.length > 1 ? caminho.replace(/\/+$/, "") : caminho) ||
  PREFIXOS_PUBLICOS.some((p) => caminho.startsWith(p));

// Diálogo, gaveta, menu ou popover abertos (Radix/vaul): o aviso espera fechar.
// O Select aberto trava a rolagem (data-scroll-locked). Não usar role="listbox":
// as listas do cmdk também usam e ficam abertas dentro das telas.
const SELETOR_SOBREPOSTO =
  '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [role="menu"][data-state="open"]';
const temSobreposicaoAberta = () =>
  document.body.hasAttribute("data-scroll-locked") || document.querySelector(SELETOR_SOBREPOSTO) !== null;

// Só observa a página enquanto há aviso a mostrar; sem versão nova, nada roda.
function useSobreposicaoAberta(ativo: boolean) {
  const [aberta, setAberta] = useState(false);
  useEffect(() => {
    if (!ativo) return;
    const conferir = () => setAberta(temSobreposicaoAberta());
    conferir();
    const observador = new MutationObserver(conferir);
    observador.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-state", "data-scroll-locked"],
    });
    return () => observador.disconnect();
  }, [ativo]);
  return ativo && aberta;
}

/**
 * "Nova versão disponível": aparece quando há versão nova esperando
 * (src/lib/pwa/atualizacaoApp.ts). Nunca recarrega sozinho.
 * Celular: canto inferior esquerdo, acima do menu de baixo e longe dos botões
 * flutuantes da direita. Computador: canto inferior direito, ao lado do chat.
 */
export function PWAUpdateBanner() {
  const { t } = useTranslation("comum");
  const { pathname } = useLocation();
  const mostrar = useSyncExternalStore(assinarAtualizacao, mostrarAvisoAtualizacao);
  const sobreposicaoAberta = useSobreposicaoAberta(mostrar);

  if (!mostrar || sobreposicaoAberta || ehPaginaPublica(pathname)) return null;

  return (
    <div
      role="status"
      data-aviso-nova-versao
      className="fixed left-3 z-40 w-fit max-w-[calc(100vw-7rem)] rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-white shadow-xl animate-in fade-in slide-in-from-bottom-2 print:hidden bottom-[calc(max(env(safe-area-inset-bottom),8px)+4.25rem)] lg:bottom-6 lg:left-auto lg:right-24 lg:max-w-sm"
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        <RefreshCw className="h-4 w-4 shrink-0 text-blue-400" />
        <span>{t("novaVersao.titulo")}</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Button size="sm" variant="secondary" className="h-8 text-xs" onClick={aplicarAtualizacao}>
          {t("novaVersao.atualizar")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white"
          onClick={adiarAtualizacao}
        >
          {t("novaVersao.depois")}
        </Button>
      </div>
    </div>
  );
}
