/**
 * Quem vê, no assistente da OS, os dispositivos adicionais ("Outros aparelhos
 * desta OS", "+ Novo dispositivo", os blocos por aparelho das etapas 4 e 5 e o
 * aparelho de cada serviço) e, na lista de OS, a linha com aparelhos e
 * serviços. ÚNICA regra: useDispositivosAdicionaisOSVisivel só chama isto.
 * Quem não vê também não lê nem grava a tabela os_dispositivos_adicionais pelo
 * assistente.
 *
 * Hoje: LIBERADO A TODOS (lojistas, funcionários, gerentes, qualquer plano).
 * Para voltar a só admin do MecApp, mude OS_MULTI_DISPOSITIVO_PARA_TODOS para
 * false (o hook volta a consultar admin sozinho). Para esconder de todo mundo,
 * devolva false.
 */
export interface ContextoDispositivosAdicionaisOS {
  isAdmin: boolean;
}

/** true = OS com vários aparelhos para todos (a regra não olha admin e o hook nem consulta admin). */
export const OS_MULTI_DISPOSITIVO_PARA_TODOS = true;

export function dispositivosAdicionaisOSVisivelPara(ctx: ContextoDispositivosAdicionaisOS): boolean {
  return OS_MULTI_DISPOSITIVO_PARA_TODOS || ctx.isAdmin;
}
