/**
 * Fórmulas puras (sem dependência de rede) do rateio de custo da 2ª forma de
 * pagamento "a receber". Isoladas aqui para poderem ser testadas diretamente
 * (ver scripts/investigacao-lucro-vendas/testes-regressao.mjs).
 */

const toNum = (v: unknown): number => Number((v as number | string | null | undefined) || 0);

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

export interface LinhaPrincipalParaRateio {
  total?: number | string | null;
  valor_desconto_manual?: number | string | null;
  valor_desconto_cupom?: number | string | null;
  valor_segunda_forma?: number | string | null;
  custo_unitario?: number | string | null;
  quantidade?: number | string | null;
}

/**
 * custo_unitario a gravar numa parcela da 2ª forma ao reconhecê-la.
 *
 * custoRestante      = custoTotalPrincipal × clamp(valor_segunda_forma / receitaBase)
 *                      (== custoTotalPrincipal − custo já reconhecido na principal)
 * fatiaDestaParcela  = custoRestante × (parcelaTotal / somaTodasParcelasSecundarias)
 *
 * O denominador é a soma REAL das parcelas secundárias (não valor_segunda_forma
 * nem receitaBase): garante Σ fatias = custoRestante exatamente, sem sobra nem
 * falta por arredondamento, mesmo quando o PDV gravou
 * valor_segunda_forma ≠ Σ parcelas (ex.: venda com desconto manual).
 */
export const calcularCustoUnitarioParcelaSecundaria = (
  principal: LinhaPrincipalParaRateio,
  parcelaTotal: number,
  somaParcelasSecundarias: number,
  parcelaQuantidade: number,
): number => {
  const receitaBase =
    toNum(principal.total) -
    toNum(principal.valor_desconto_manual) -
    toNum(principal.valor_desconto_cupom);
  if (receitaBase <= 0 || somaParcelasSecundarias <= 0) return 0;

  const custoTotalPrincipal = toNum(principal.custo_unitario) * toNum(principal.quantidade || 1);
  const fracaoRestante = clamp01(toNum(principal.valor_segunda_forma) / receitaBase);
  const custoRestante = custoTotalPrincipal * fracaoRestante;

  const fatiaDestaParcela = custoRestante * (parcelaTotal / somaParcelasSecundarias);
  const qtd = parcelaQuantidade > 0 ? parcelaQuantidade : 1;
  return fatiaDestaParcela / qtd;
};
