import { useIsAdminMecApp } from "@/hooks/useCompatibilidadePelicula";
import { fiscalVisivelPara } from "@/lib/fiscal/visibilidade";

/** Como useFiscalVisivel, mais o "ainda verificando" (para a rota não redirecionar antes da hora). */
export function useFiscalVisivelStatus(): { visivel: boolean; carregando: boolean } {
  const { data: isAdmin, isLoading } = useIsAdminMecApp();
  return { visivel: fiscalVisivelPara({ isAdmin: isAdmin === true }), carregando: isLoading };
}

/**
 * true só para quem pode ver o módulo fiscal (hoje: admin do MecApp). Tudo da
 * etapa fiscal depende disto: item de menu, tela Configurações › Fiscal e o
 * bloco "Dados fiscais" dos cadastros. Enquanto carrega devolve false, então
 * nada fiscal aparece nem entra em payload de gravação.
 *
 * Para liberar a lojistas (lista de lojas ou plano), mude a regra em
 * src/lib/fiscal/visibilidade.ts, não aqui.
 */
export function useFiscalVisivel(): boolean {
  return useFiscalVisivelStatus().visivel;
}
