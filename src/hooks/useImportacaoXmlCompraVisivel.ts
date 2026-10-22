import { useFiscalVisivelStatus } from "@/hooks/useFiscalVisivel";
import { importacaoXmlCompraVisivelPara } from "@/lib/nfe/visibilidade";

/** Como useImportacaoXmlCompraVisivel, mais o "ainda verificando" (para a rota não redirecionar antes da hora). */
export function useImportacaoXmlCompraVisivelStatus(): { visivel: boolean; carregando: boolean } {
  const { visivel: fiscalVisivel, carregando } = useFiscalVisivelStatus();
  return { visivel: importacaoXmlCompraVisivelPara({ fiscalVisivel }), carregando };
}

/**
 * true só para quem pode ver a importação de XML de compra (item do menu e a
 * página /configuracoes/fiscal/xml-compra). Enquanto carrega devolve false
 * (herda de useFiscalVisivel). Para liberar a lojistas, mude a regra em
 * src/lib/nfe/visibilidade.ts, não aqui.
 */
export function useImportacaoXmlCompraVisivel(): boolean {
  return useImportacaoXmlCompraVisivelStatus().visivel;
}
