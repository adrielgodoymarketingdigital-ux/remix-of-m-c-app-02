import { diaLocalISO, etiquetaNovoVisivel } from "@/lib/menu/menuPrincipal";

/**
 * Etiqueta "Novo" do menu (AppSidebar e MobileMenuDrawer). Depende só da data
 * limite do item (novoAte, dia local): aparece para todos até lá e some sozinha
 * no dia seguinte. Não grava nada no aparelho.
 */
export function useEtiquetaNovoMenu() {
  const mostrarNovo = (item: { novoAte?: string }): boolean =>
    etiquetaNovoVisivel({ novoAte: item.novoAte, hoje: diaLocalISO(new Date()) });

  return { mostrarNovo };
}
