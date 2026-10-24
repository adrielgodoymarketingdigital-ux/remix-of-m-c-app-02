import { useIsAdminMecApp } from "@/hooks/useCompatibilidadePelicula";
import { dispositivosAdicionaisOSVisivelPara } from "@/lib/ordemServico/visibilidadeDispositivosAdicionais";

/**
 * true só para quem pode ver e editar os dispositivos adicionais no assistente
 * da OS (hoje: admin do MecApp). Enquanto carrega devolve false — o assistente
 * fica exatamente como sempre foi. Para liberar, mude a regra em
 * src/lib/ordemServico/visibilidadeDispositivosAdicionais.ts, não aqui.
 */
export function useDispositivosAdicionaisOSVisivel(): boolean {
  const { data: isAdmin } = useIsAdminMecApp();
  return dispositivosAdicionaisOSVisivelPara({ isAdmin: isAdmin === true });
}
