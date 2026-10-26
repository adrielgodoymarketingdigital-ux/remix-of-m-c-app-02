import { useIsAdminMecApp } from "@/hooks/useCompatibilidadePelicula";
import { RECIBO_VENDA_NOVO_PARA_TODOS, reciboVendaNovoVisivelPara } from "@/lib/vendas/visibilidadeReciboNovo";

/**
 * true para quem recebe o recibo de venda no layout novo. Hoje: liberado a
 * todos — a consulta de admin nem é feita (enabled: false). Se a regra voltar
 * a só admin, usa o mesmo cache de admin do menu e, enquanto carrega, devolve
 * false (o recibo fica como sempre foi). Para mudar quem vê, mexa em
 * src/lib/vendas/visibilidadeReciboNovo.ts, não aqui.
 */
export function useReciboVendaNovoVisivel(): boolean {
  const { data: isAdmin } = useIsAdminMecApp({ enabled: !RECIBO_VENDA_NOVO_PARA_TODOS });
  return reciboVendaNovoVisivelPara({ isAdmin: isAdmin === true });
}
