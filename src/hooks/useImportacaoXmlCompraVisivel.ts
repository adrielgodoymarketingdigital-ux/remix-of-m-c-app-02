import { useFiscalVisivel } from "@/hooks/useFiscalVisivel";
import { importacaoXmlCompraVisivelPara } from "@/lib/nfe/visibilidade";

/**
 * true só para quem pode ver a importação de XML de compra. Enquanto carrega
 * devolve false (herda de useFiscalVisivel). Para liberar a lojistas, mude a
 * regra em src/lib/nfe/visibilidade.ts, não aqui.
 */
export function useImportacaoXmlCompraVisivel(): boolean {
  const fiscalVisivel = useFiscalVisivel();
  return importacaoXmlCompraVisivelPara({ fiscalVisivel });
}
