/**
 * Quem vê o módulo fiscal (tela Configurações › Fiscal e o bloco "Dados
 * fiscais" dos cadastros). ÚNICA regra: useFiscalVisivel só chama isto.
 *
 * Etapa 2B: somente admin do MecApp (user_roles.role = 'admin', o mesmo
 * mecanismo das telas /admin/*).
 *
 * Ponto de extensão (NÃO implementado): para liberar a lojistas, acrescente
 * campos ao contexto e a condição aqui, por exemplo
 *   - lista de lojas piloto: `lojasLiberadas.includes(userId)`;
 *   - por plano: `plano` em Profissional/Ultra (useAssinatura().assinatura.plano_tipo).
 * A gravação da configuração passa pela Edge Function fiscal-config-salvar,
 * que hoje também exige admin: liberar aqui sem liberar lá deixa a tela
 * aberta, mas o salvar responde 403.
 */
export interface ContextoFiscal {
  isAdmin: boolean;
}

export function fiscalVisivelPara(ctx: ContextoFiscal): boolean {
  return ctx.isAdmin;
}
