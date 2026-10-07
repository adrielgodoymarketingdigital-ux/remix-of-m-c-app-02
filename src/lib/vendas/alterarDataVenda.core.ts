// Contas puras de "alterar data da venda" entre caixas fechados (ver alterarDataVenda.ts).
import { agruparVendasPorFormaPagamento, type VendaFormaPagamento } from "../formaPagamento.ts";
import { somarDevolucoesTroca, type DevolucaoTrocaLida } from "../caixa/devolucoesTroca.ts";

export interface ParteCaixa {
  total_dinheiro: number;
  total_pix: number;
  total_cartao: number;
  total_a_receber: number;
  /** Devolução da troca em dinheiro da venda (sai da gaveta; caixas.total_devolucoes_troca). */
  devolucoes_dinheiro: number;
}

export const PARTE_ZERO: ParteCaixa = { total_dinheiro: 0, total_pix: 0, total_cartao: 0, total_a_receber: 0, devolucoes_dinheiro: 0 };
const FORMAS_CARTAO = ["debito", "credito", "credito_parcelado"];

// Mesmo mapeamento forma → coluna do fecharCaixa (useCaixa.ts). Formas
// customizadas ("outro") não entram em coluna nenhuma — igual ao fechamento.
export const somarNaParte = (parte: ParteCaixa, forma: string, valor: number) => {
  if (forma === "dinheiro") parte.total_dinheiro += valor;
  else if (forma === "pix") parte.total_pix += valor;
  else if (FORMAS_CARTAO.includes(forma)) parte.total_cartao += valor;
  else if (forma === "a_receber" || forma === "a_prazo") parte.total_a_receber += valor;
};

/** Valores de venda da parte (o que entra em total_vendas). A devolução não é venda. */
export const totalDaParte = (p: ParteCaixa) => p.total_dinheiro + p.total_pix + p.total_cartao + p.total_a_receber;

/** A parte mexe em algum caixa? (venda que a troca cobriu inteira pode ter só a devolução). */
export const parteMexeNoCaixa = (p: ParteCaixa) => totalDaParte(p) !== 0 || p.devolucoes_dinheiro !== 0;

/**
 * Parte da venda no caixa = o que o fecharCaixa contaria destas linhas
 * (já sem canceladas e sem itens de OS) + a devolução da troca em dinheiro
 * (mesma regra do fechamento: troca ativa, forma dinheiro).
 */
export function calcularParteDaVenda(contaveis: VendaFormaPagamento[], trocas: DevolucaoTrocaLida[]): ParteCaixa {
  const parte = { ...PARTE_ZERO };
  for (const item of agruparVendasPorFormaPagamento(contaveis.map((l) => ({ ...l, total: Number(l.total) || 0 })))) {
    somarNaParte(parte, item.chave, item.total);
  }
  parte.devolucoes_dinheiro = somarDevolucoesTroca(trocas).dinheiro;
  return parte;
}

export interface TotaisCaixaFechado {
  total_dinheiro: number | null;
  total_pix: number | null;
  total_cartao: number | null;
  total_a_receber: number | null;
  total_vendas: number | null;
  saldo_final: number | null;
  total_devolucoes_troca?: number | null;
}

/**
 * Novos totais de um caixa fechado ao tirar (sinal −1) ou pôr (+1) a parte.
 * saldo_final só se move pelo dinheiro (mesma regra de ajustarCaixasFechadosOS),
 * agora líquido da devolução em dinheiro. total_devolucoes_troca só vai no
 * update quando a venda tem devolução em dinheiro (venda sem troca: mesmo
 * update de antes); nunca fica negativo (CHECK do banco).
 */
export function novosTotaisCaixa(caixa: TotaisCaixaFechado, parte: ParteCaixa, sinal: 1 | -1) {
  const n = (v: number | null | undefined) => Number(v || 0);
  return {
    total_dinheiro: n(caixa.total_dinheiro) + sinal * parte.total_dinheiro,
    total_pix: n(caixa.total_pix) + sinal * parte.total_pix,
    total_cartao: n(caixa.total_cartao) + sinal * parte.total_cartao,
    total_a_receber: n(caixa.total_a_receber) + sinal * parte.total_a_receber,
    total_vendas: n(caixa.total_vendas) + sinal * totalDaParte(parte),
    saldo_final: parte.devolucoes_dinheiro
      ? n(caixa.saldo_final) + sinal * (parte.total_dinheiro - parte.devolucoes_dinheiro)
      : n(caixa.saldo_final) + sinal * parte.total_dinheiro,
    ...(parte.devolucoes_dinheiro
      ? { total_devolucoes_troca: Math.max(0, Math.round((n(caixa.total_devolucoes_troca) + sinal * parte.devolucoes_dinheiro) * 100) / 100) }
      : {}),
  };
}
