import { useIsAdminMecApp } from "@/hooks/useCompatibilidadePelicula";
import { reciboVendaNovoVisivelPara } from "@/lib/vendas/visibilidadeReciboNovo";

/**
 * true só para quem recebe o recibo de venda no layout novo (hoje: admin do
 * MecApp). Usa o mesmo cache de admin do menu (sem consulta nova). Enquanto
 * carrega devolve false — o recibo fica exatamente como sempre foi. Para
 * liberar, mude a regra em src/lib/vendas/visibilidadeReciboNovo.ts, não aqui.
 */
export function useReciboVendaNovoVisivel(): boolean {
  const { data: isAdmin } = useIsAdminMecApp();
  return reciboVendaNovoVisivelPara({ isAdmin: isAdmin === true });
}
