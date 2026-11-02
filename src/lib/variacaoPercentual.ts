/**
 * Calcula a variação percentual entre dois valores (ex: mês atual vs. mês
 * anterior, ou hoje vs. ontem). Segue o mesmo tratamento de zero/negativo já
 * usado em useDesempenhoSistema.ts e useAdminFinanceiro.ts: sem base de
 * comparação, 100% se o valor atual é positivo, 0% se ambos são zero. Base
 * negativa (prejuízo no período anterior): mede sobre o valor absoluto, para o
 * sinal seguir o sentido real (-500 → -1000 é queda; -500 → +200 é alta).
 */
export const calcularVariacaoPercentual = (atual: number, anterior: number): number => {
  if (anterior !== 0) {
    return ((atual - anterior) / Math.abs(anterior)) * 100;
  }
  if (atual > 0) {
    return 100;
  }
  return 0;
};
