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

type Modo = "flutuante" | "faixa";

/**
 * "Nova versão disponível": aparece quando há versão nova esperando
 * (src/lib/pwa/atualizacaoApp.ts). Nunca recarrega sozinho.
 * - "faixa" (celular, no AppLayout logo abaixo do cabeçalho): fica no fluxo da
 *   página e empurra o conteúdo, então não cobre botão nenhum (PDV, Finalizar
 *   Venda, pagamento). Diálogos abertos ficam por cima dela.
 * - "flutuante" (computador, no App): canto inferior direito, ao lado do chat;
 *   some enquanto houver diálogo, gaveta ou menu aberto.
 */
export function PWAUpdateBanner({ modo = "flutuante" }: { modo?: Modo }) {
  const { t } = useTranslation("comum");
  const { pathname } = useLocation();
  const mostrar = useSyncExternalStore(assinarAtualizacao, mostrarAvisoAtualizacao);
  const sobreposicaoAberta = useSobreposicaoAberta(mostrar && modo === "flutuante");

  if (!mostrar || sobreposicaoAberta || ehPaginaPublica(pathname)) return null;

  const titulo = (
    <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
      <RefreshCw className="h-4 w-4 shrink-0 text-blue-400" />
      <span>{t("novaVersao.titulo")}</span>
    </span>
  );
  const botoes = (
    <span className="flex shrink-0 items-center gap-1.5">
      <Button size="sm" variant="secondary" className="h-8 text-xs" onClick={aplicarAtualizacao}>
        {t("novaVersao.atualizar")}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-8 px-2.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white"
        onClick={adiarAtualizacao}
      >
        {t("novaVersao.depois")}
      </Button>
    </span>
  );

  if (modo === "faixa") {
    return (
      <div
        role="status"
        data-aviso-nova-versao
        className="lg:hidden flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 bg-zinc-900 px-4 py-2 text-white print:hidden"
      >
        {titulo}
        {botoes}
      </div>
    );
  }

  return (
    <div
      role="status"
      data-aviso-nova-versao
      className="hidden lg:flex fixed bottom-6 right-24 z-40 max-w-sm flex-col gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-white shadow-xl animate-in fade-in slide-in-from-bottom-2 print:hidden"
    >
      {titulo}
      {botoes}
    </div>
  );
}
