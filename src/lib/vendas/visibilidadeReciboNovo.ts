/**
 * Quem recebe o recibo de venda no layout novo (A4) no PDV, na reimpressão em
 * Vendas e no recibo de Dispositivos vendidos. ÚNICA regra:
 * useReciboVendaNovoVisivel só chama isto. Quem não vê fica com os recibos de
 * sempre, sem nenhuma diferença (nem consulta a mais).
 *
 * Hoje: LIBERADO A TODOS (lojistas, funcionários, qualquer plano). Para voltar
 * a só admin do MecApp, mude RECIBO_VENDA_NOVO_PARA_TODOS para false (o hook
 * volta a consultar admin sozinho). Para esconder de todo mundo, devolva false.
 */
export interface ContextoReciboVendaNovo {
  isAdmin: boolean;
}

/** true = recibo novo para todos (a regra não olha admin e o hook nem consulta admin). */
export const RECIBO_VENDA_NOVO_PARA_TODOS = false;

export function reciboVendaNovoVisivelPara(ctx: ContextoReciboVendaNovo): boolean {
  return RECIBO_VENDA_NOVO_PARA_TODOS || ctx.isAdmin;
}
