// Vendas (tabela `vendas`) no caixa: colunas lidas e a soma por forma de
// pagamento. Usado pelo fechamento real (useCaixa.ts), pela prévia do
// fechamento (DialogFechamentoCaixa.tsx) e por "Vendas por forma" do
// Financeiro — mesma conta e mesmas colunas nos três.
//
// vendas.total é BRUTO; o desconto (valor_desconto_manual/valor_desconto_cupom)
// é abatido da 1ª forma em agruparVendasPorFormaPagamento. Vendas avulsas e OS
// continuam somadas à parte, por quem chama.
import {
  agruparVendasPorFormaPagamento,
  valorLiquidoVenda,
  type BreakdownFormaPagamento,
  type VendaFormaPagamento,
} from "../formaPagamento.ts";

/** Colunas de `vendas` que o agrupador do caixa usa (inclui o desconto). */
export const COLUNAS_VENDAS_CAIXA =
  "forma_pagamento, total, observacoes, segunda_forma_pagamento, valor_segunda_forma, valor_troca, valor_desconto_manual, valor_desconto_cupom" as const;

const FORMAS_CARTAO = ["debito", "credito", "credito_parcelado"];

export interface TotaisVendasNoCaixa {
  breakdown: BreakdownFormaPagamento[];
  total_dinheiro: number;
  total_pix: number;
  total_cartao: number;
  total_a_receber: number;
}

/**
 * Soma das vendas por forma, como o fechamento grava (dinheiro, pix, cartão,
 * a receber). Formas customizadas ficam só no breakdown. Mesma ordem de soma
 * de antes (percorre o breakdown), para dar os mesmos bits.
 */
export function somarVendasNoCaixa(vendas: VendaFormaPagamento[]): TotaisVendasNoCaixa {
  const breakdown = agruparVendasPorFormaPagamento(vendas);
  let total_dinheiro = 0;
  let total_pix = 0;
  let total_cartao = 0;
  let total_a_receber = 0;

  for (const item of breakdown) {
    if (item.chave === "dinheiro") total_dinheiro += item.total;
    else if (item.chave === "pix") total_pix += item.total;
    else if (FORMAS_CARTAO.includes(item.chave)) total_cartao += item.total;
    else if (item.chave === "a_receber" || item.chave === "a_prazo") total_a_receber += item.total;
  }

  return { breakdown, total_dinheiro, total_pix, total_cartao, total_a_receber };
}

/** Chave usada para as vendas sem vendedor no agregado por funcionário. */
export const SEM_FUNCIONARIO = "__sem_funcionario__";

export interface VendaDoFuncionario {
  funcionario_id?: string | null;
  observacoes?: string | null;
  total: number | string | null | undefined;
  valor_desconto_manual?: number | string | null;
  valor_desconto_cupom?: number | string | null;
}

/**
 * Vendido por funcionário na prévia do fechamento: valor líquido de cada linha
 * (total − desconto; a troca NÃO sai daqui). Ignora a linha auxiliar do
 * pagamento duplo, que duplicaria o valor do mesmo vendedor.
 */
export function agregarVendasPorFuncionario(
  vendas: VendaDoFuncionario[],
): Record<string, { total: number; quantidade: number }> {
  const mapa: Record<string, { total: number; quantidade: number }> = {};
  for (const venda of vendas) {
    if (venda.observacoes === "pagamento_duplo_secundario") continue;
    const valor = valorLiquidoVenda(venda);
    const fid = venda.funcionario_id ?? SEM_FUNCIONARIO;
    if (!mapa[fid]) mapa[fid] = { total: 0, quantidade: 0 };
    mapa[fid].total += valor;
    mapa[fid].quantidade += 1;
  }
  return mapa;
}
