/**
 * Custo médio ponderado de uma entrada de estoque.
 *
 * ATENÇÃO: réplica exata da regra em SQL de public.registrar_entrada_estoque
 * (supabase/migrations/20261005120000_compra_estoque_entradas_estoque.sql).
 * Se mudar aqui, mude lá também.
 *
 * - O custo novo é arredondado a 2 casas antes do cálculo.
 * - Quantidade anterior <= 0, ou custo anterior nulo/zero → usa o custo novo.
 * - Senão: round((qa × ca + qn × cn) / (qa + qn), 2).
 *
 * As contas são feitas em centavos inteiros (os custos do banco são
 * numeric(10,2)), com arredondamento meio-para-cima — o mesmo resultado do
 * round(numeric, 2) do Postgres para valores positivos, sem erro de ponto
 * flutuante na média (ex.: 1×1,00 + 1×1,01 = 1,005 → 1,01). Custo de entrada
 * com mais de 2 casas pode divergir do SQL na 3ª casa (Math.round em float).
 *
 * Arquivo sem imports: roda direto no Deno (scripts/testes-compra-estoque/).
 */

const paraCentavos = (valor: number) => Math.round(valor * 100);

/** Divide inteiros não negativos arredondando meio-para-cima. */
const dividirArredondando = (numerador: number, denominador: number) =>
  Math.floor((2 * numerador + denominador) / (2 * denominador));

export function calcularCustoMedio(
  quantidadeAnterior: number,
  custoAnterior: number | null | undefined,
  quantidadeNova: number,
  custoNovo: number,
): number {
  const custoNovoCentavos = paraCentavos(custoNovo);

  if (quantidadeAnterior <= 0 || !custoAnterior) {
    return custoNovoCentavos / 100;
  }

  const custoAnteriorCentavos = paraCentavos(custoAnterior);
  const totalCentavos = quantidadeAnterior * custoAnteriorCentavos + quantidadeNova * custoNovoCentavos;
  return dividirArredondando(totalCentavos, quantidadeAnterior + quantidadeNova) / 100;
}
