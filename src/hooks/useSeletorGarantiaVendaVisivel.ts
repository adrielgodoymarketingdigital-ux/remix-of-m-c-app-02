import { useIsAdminMecApp } from "@/hooks/useCompatibilidadePelicula";
import { seletorGarantiaVendaVisivelPara } from "@/lib/garantias/visibilidadeMinhasGarantias";

/**
 * true = seletor único de "Minhas garantias" na venda; false = seletor antigo.
 * Regra e freio em src/lib/garantias/visibilidadeMinhasGarantias.ts.
 * Admin vem do mesmo cache do menu; enquanto carrega = seletor antigo.
 */
export function useSeletorGarantiaVendaVisivel(): boolean {
  const { data: isAdmin } = useIsAdminMecApp();
  return seletorGarantiaVendaVisivelPara({ isAdmin });
}
