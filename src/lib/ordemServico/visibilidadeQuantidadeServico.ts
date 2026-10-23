/**
 * Quem vê, no assistente da OS, a quantidade por serviço e o "adicionar o
 * mesmo serviço de novo" (etapa 2 da OS com vários dispositivos/serviços).
 * ÚNICA regra: useQuantidadeServicoOSVisivel só chama isto.
 *
 * Hoje: só admin do MecApp (liberação admin-first). OS já gravadas com
 * quantidade continuam abrindo e somando certo para todo mundo — isto só
 * esconde os controles de criar/alterar quantidade e repetir serviço.
 *
 * Para liberar a lojistas, devolva true (ou acrescente lista de lojas/plano ao
 * contexto). Para esconder de todo mundo (reverter a etapa), devolva false.
 */
export interface ContextoQuantidadeServicoOS {
  isAdmin: boolean;
}

export function quantidadeServicoOSVisivelPara(ctx: ContextoQuantidadeServicoOS): boolean {
  return ctx.isAdmin;
}
