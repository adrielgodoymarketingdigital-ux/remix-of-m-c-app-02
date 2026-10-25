/**
 * Quem recebe o recibo de venda no layout novo (A4) no PDV, na reimpressão em
 * Vendas e no recibo de Dispositivos vendidos. ÚNICA regra:
 * useReciboVendaNovoVisivel só chama isto. Quem não vê fica com os recibos de
 * sempre, sem nenhuma diferença (nem consulta a mais).
 *
 * Hoje: só admin do MecApp (liberação admin-first). Para liberar a todos,
 * devolva true. Para esconder de todo mundo, devolva false.
 */
export interface ContextoReciboVendaNovo {
  isAdmin: boolean;
}

export function reciboVendaNovoVisivelPara(ctx: ContextoReciboVendaNovo): boolean {
  return ctx.isAdmin;
}
