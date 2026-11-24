import { useIsAdminMecApp } from "@/hooks/useCompatibilidadePelicula";
import {
  OS_TECNICOS_ADICIONAIS_PARA_TODOS,
  tecnicosAdicionaisOSVisivelPara,
} from "@/lib/ordemServico/visibilidadeTecnicosAdicionais";

/**
 * true para quem pode ver e editar os técnicos adicionais da OS. Hoje: só admin
 * do MecApp — usa o mesmo cache de admin do menu e, enquanto carrega, devolve
 * false (o assistente fica como sempre foi). Para mudar quem vê, mexa em
 * src/lib/ordemServico/visibilidadeTecnicosAdicionais.ts, não aqui.
 */
export function useTecnicosAdicionaisOSVisivel(): boolean {
  const { data: isAdmin } = useIsAdminMecApp({ enabled: !OS_TECNICOS_ADICIONAIS_PARA_TODOS });
  return tecnicosAdicionaisOSVisivelPara({ isAdmin: isAdmin === true });
}
