import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { MENU_PRINCIPAL, chaveNovoVisto, diaLocalISO, etiquetaNovoVisivel } from "@/lib/menu/menuPrincipal";

// Itens do menu com etiqueta "Novo" (novoAte em menuPrincipal.ts).
const URLS_COM_NOVO = new Set(MENU_PRINCIPAL.filter((item) => item.novoAte).map((item) => item.url));

// localStorage pode falhar (modo privado, cota cheia): nunca quebra o menu e
// conta como "ainda não abriu".
function jaAbriu(url: string): boolean {
  try {
    return localStorage.getItem(chaveNovoVisto(url)) === "1";
  } catch {
    return false;
  }
}

function gravarAberto(url: string): void {
  try {
    localStorage.setItem(chaveNovoVisto(url), "1");
  } catch {
    /* sem armazenamento: a etiqueta continua */
  }
}

/**
 * Etiqueta "Novo" do menu (AppSidebar e MobileMenuDrawer). Some depois que o
 * usuário abre o item neste aparelho: ao tocar no item ou ao chegar na rota.
 */
export function useEtiquetaNovoMenu() {
  const { pathname } = useLocation();
  const [, setVersao] = useState(0);

  const marcarAberto = useCallback((url: string) => {
    if (!URLS_COM_NOVO.has(url)) return;
    gravarAberto(url);
    setVersao((v) => v + 1);
  }, []);

  useEffect(() => {
    if (URLS_COM_NOVO.has(pathname)) marcarAberto(pathname);
  }, [pathname, marcarAberto]);

  const mostrarNovo = (item: { url: string; novoAte?: string }): boolean =>
    etiquetaNovoVisivel({ novoAte: item.novoAte, hoje: diaLocalISO(new Date()), jaAbriu: jaAbriu(item.url) });

  return { mostrarNovo, marcarAberto };
}
