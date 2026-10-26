import { useIsAdminMecApp } from "@/hooks/useCompatibilidadePelicula";
import {
  dispositivosAdicionaisOSVisivelPara,
  OS_MULTI_DISPOSITIVO_PARA_TODOS,
} from "@/lib/ordemServico/visibilidadeDispositivosAdicionais";

/**
 * true para quem pode ver e editar os dispositivos adicionais da OS. Hoje:
 * liberado a todos — a consulta de admin nem é feita (enabled: false). Se a
 * regra voltar a só admin, usa o mesmo cache de admin do menu e, enquanto
 * carrega, devolve false (o assistente fica como sempre foi). Para mudar quem
 * vê, mexa em src/lib/ordemServico/visibilidadeDispositivosAdicionais.ts, não aqui.
 */
export function useDispositivosAdicionaisOSVisivel(): boolean {
  const { data: isAdmin } = useIsAdminMecApp({ enabled: !OS_MULTI_DISPOSITIVO_PARA_TODOS });
  return dispositivosAdicionaisOSVisivelPara({ isAdmin: isAdmin === true });
}
