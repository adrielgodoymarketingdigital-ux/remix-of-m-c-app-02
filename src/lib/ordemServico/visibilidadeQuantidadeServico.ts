/**
 * Quem vê, no assistente da OS, a quantidade por serviço e o "adicionar o
 * mesmo serviço de novo" (etapa 2 da OS com vários dispositivos/serviços).
 * ÚNICA regra: useQuantidadeServicoOSVisivel só chama isto. Sem ela, o mesmo
 * serviço não entra duas vezes na OS — e a OS com vários aparelhos precisa
 * disso (ex.: "Troca de tela" no Dispositivo 1 e no Dispositivo 2).
 *
 * Hoje: LIBERADO A TODOS, junto com a OS com vários aparelhos. Para voltar a
 * só admin do MecApp, mude QUANTIDADE_SERVICO_OS_PARA_TODOS para false (o hook
 * volta a consultar admin sozinho). OS já gravadas com quantidade continuam
 * abrindo e somando certo para todo mundo.
 */
export interface ContextoQuantidadeServicoOS {
  isAdmin: boolean;
}

/** true = quantidade e serviço repetido para todos (a regra não olha admin e o hook nem consulta admin). */
export const QUANTIDADE_SERVICO_OS_PARA_TODOS = true;

export function quantidadeServicoOSVisivelPara(ctx: ContextoQuantidadeServicoOS): boolean {
  return QUANTIDADE_SERVICO_OS_PARA_TODOS || ctx.isAdmin;
}
