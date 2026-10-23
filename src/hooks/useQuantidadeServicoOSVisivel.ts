import { useIsAdminMecApp } from "@/hooks/useCompatibilidadePelicula";
import { quantidadeServicoOSVisivelPara } from "@/lib/ordemServico/visibilidadeQuantidadeServico";

/**
 * true só para quem pode usar quantidade por serviço e serviço repetido na OS
 * (hoje: admin do MecApp). Enquanto carrega devolve false — o seletor fica
 * exatamente como sempre foi. Para liberar, mude a regra em
 * src/lib/ordemServico/visibilidadeQuantidadeServico.ts, não aqui.
 */
export function useQuantidadeServicoOSVisivel(): boolean {
  const { data: isAdmin } = useIsAdminMecApp();
  return quantidadeServicoOSVisivelPara({ isAdmin: isAdmin === true });
}
