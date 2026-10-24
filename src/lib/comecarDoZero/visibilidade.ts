/**
 * Quem vê o "Começar do zero" (card em Configurações › Exportação). ÚNICO lugar
 * da regra. Hoje: admin do MecApp OU a conta de teste marcada com
 * assinaturas.modulos_extras.comecar_do_zero = true (na própria assinatura).
 * A marca existe porque o banco recusa contas admin (trava da etapa 1): sem
 * ela não haveria como testar o fluxo inteiro em produção.
 * Para liberar a todos os lojistas, troque o corpo por `return true`.
 */
export function comecarDoZeroVisivelPara(quem: { isAdmin: boolean; temMarcaTeste: boolean }): boolean {
  return quem.isAdmin || quem.temMarcaTeste;
}
