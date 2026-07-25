/**
 * Calcula a variação percentual entre dois valores (ex: mês atual vs. mês
 * anterior, ou hoje vs. ontem). Segue o mesmo tratamento de zero/negativo já
 * usado em useDesempenhoSistema.ts e useAdminFinanceiro.ts: sem base de
 * comparação, 100% se o valor atual é positivo, 0% se ambos são zero.
 */
export const calcularVariacaoPercentual = (atual: number, anterior: number): number => {
  if (anterior > 0) {
    return ((atual - anterior) / anterior) * 100;
  }
  if (atual > 0) {
    return 100;
  }
  return 0;
};
