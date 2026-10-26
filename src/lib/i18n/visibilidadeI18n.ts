/**
 * Quem tem o idioma da conta aplicado (tradução, seletor de idioma em
 * Configurações e, na etapa 5, moeda/data/fuso da conta). ÚNICA regra:
 * useI18nVisivel só chama isto. Quem não vê fica em pt-BR, idêntico ao de
 * sempre: nenhuma consulta a mais ao banco e nenhum arquivo de idioma baixado.
 *
 * Hoje: SÓ ADMIN do MecApp. Para liberar a todos, mude I18N_PARA_TODOS para
 * true (o hook deixa de consultar admin sozinho). Para esconder de todo mundo,
 * devolva false.
 */
export interface ContextoI18n {
  isAdmin: boolean;
}

/** true = idioma da conta para todos (a regra não olha admin e o hook nem consulta admin). */
export const I18N_PARA_TODOS = false;

export function i18nVisivelPara(ctx: ContextoI18n): boolean {
  return I18N_PARA_TODOS || ctx.isAdmin;
}
