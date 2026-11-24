/**
 * Quem vê, no assistente da OS, o bloco "Técnicos adicionais" (etapa Serviço).
 * ÚNICA regra: useTecnicosAdicionaisOSVisivel só chama isto. Quem não vê não lê
 * nem grava os_tecnicos_adicionais pelo assistente (a tela fica como era).
 *
 * Hoje: SÓ ADMIN do MecApp (liberação gradual, igual aos dispositivos adicionais).
 * Para liberar a todos, mude OS_TECNICOS_ADICIONAIS_PARA_TODOS para true (o hook
 * deixa de consultar admin sozinho).
 */
export interface ContextoTecnicosAdicionaisOS {
  isAdmin: boolean;
}

/** true = técnicos adicionais para todos (a regra não olha admin e o hook nem consulta admin). */
export const OS_TECNICOS_ADICIONAIS_PARA_TODOS = false;

export function tecnicosAdicionaisOSVisivelPara(ctx: ContextoTecnicosAdicionaisOS): boolean {
  return OS_TECNICOS_ADICIONAIS_PARA_TODOS || ctx.isAdmin;
}
