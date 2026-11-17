import { useIsAdminMecApp } from "@/hooks/useCompatibilidadePelicula";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import { useIdentidade } from "@/hooks/useResolvedUserId";
import {
  type PapelLojaRecibo,
  reciboVendaNovoVisivelPara,
  telaPersonalizarReciboVisivelPara,
} from "@/lib/vendas/visibilidadeReciboNovo";

/**
 * Para mudar quem vê, mexa em src/lib/vendas/visibilidadeReciboNovo.ts (regra
 * e freio de emergência), não aqui.
 */

/**
 * true para usar o recibo de venda novo (A4). `loja` é a linha de
 * configuracoes_loja que o diálogo de recibo JÁ leu (useConfiguracaoLoja):
 * nenhuma consulta a mais. Admin vem do mesmo cache do menu. Enquanto algo
 * carrega ou falha → false (o recibo fica como sempre foi).
 */
export function useReciboVendaNovoVisivel(loja: { recibo_venda_config?: unknown } | null | undefined): boolean {
  const { data: isAdmin } = useIsAdminMecApp();
  return reciboVendaNovoVisivelPara({ isAdmin: isAdmin === true, loja });
}

/**
 * Papel do usuário na loja (mesmas fontes em cache do resto do app):
 * gerente de filial > funcionário > dono. null = ainda carregando.
 */
export function usePapelLojaRecibo(): PapelLojaRecibo | null {
  const { isFuncionario, carregando: carregandoPermissoes } = useFuncionarioPermissoes();
  const { isGerenteFilial, carregando: carregandoIdentidade } = useIdentidade();
  if (carregandoPermissoes || carregandoIdentidade) return null;
  return isGerenteFilial ? "gerente" : isFuncionario ? "funcionario" : "dono";
}

/** true para mostrar "Personalizar recibo de venda" (admin ou dono; carregando = false). */
export function useTelaPersonalizarReciboVisivel(): boolean {
  const { data: isAdmin } = useIsAdminMecApp();
  const papel = usePapelLojaRecibo();
  return telaPersonalizarReciboVisivelPara({ isAdmin: isAdmin === true, papel });
}
