import { useIsAdminMecApp } from "@/hooks/useCompatibilidadePelicula";
import {
  QUANTIDADE_SERVICO_OS_PARA_TODOS,
  quantidadeServicoOSVisivelPara,
} from "@/lib/ordemServico/visibilidadeQuantidadeServico";

/**
 * true para quem pode usar quantidade por serviço e serviço repetido na OS.
 * Hoje: liberado a todos — a consulta de admin nem é feita (enabled: false).
 * Se a regra voltar a só admin, enquanto carrega devolve false (o seletor fica
 * como sempre foi). Para mudar quem vê, mexa em
 * src/lib/ordemServico/visibilidadeQuantidadeServico.ts, não aqui.
 */
export function useQuantidadeServicoOSVisivel(): boolean {
  const { data: isAdmin } = useIsAdminMecApp({ enabled: !QUANTIDADE_SERVICO_OS_PARA_TODOS });
  return quantidadeServicoOSVisivelPara({ isAdmin: isAdmin === true });
}
