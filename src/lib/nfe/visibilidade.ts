/**
 * Quem vê o botão "Importar XML" (importação de NF-e de compra) em Produtos.
 * ÚNICA regra: useImportacaoXmlCompraVisivel só chama isto.
 *
 * Etapa 1: mesma regra do módulo fiscal (useFiscalVisivel → hoje só admin do
 * MecApp), porque a importação vai alimentar os campos fiscais.
 *
 * Ponto de extensão (NÃO implementado): para liberar a lojistas sem liberar o
 * fiscal, acrescente campos ao contexto e a condição aqui, por exemplo
 *   - lista de lojas piloto: `lojasLiberadas.includes(userId)`;
 *   - por plano: `plano` em Profissional/Ultra.
 * Para esconder de todo mundo (reverter a etapa), devolva false.
 */
export interface ContextoImportacaoXml {
  fiscalVisivel: boolean;
}

export function importacaoXmlCompraVisivelPara(ctx: ContextoImportacaoXml): boolean {
  return ctx.fiscalVisivel;
}
