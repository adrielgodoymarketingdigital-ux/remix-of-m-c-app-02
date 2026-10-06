/**
 * Troca de aparelho no PDV (Fase 1): regras puras, sem imports (testadas com
 * Deno em scripts/testes-troca-pdv/).
 *
 * A entrada (aparelho recebido do cliente) é PAGAMENTO EM ESPÉCIE: abate o que
 * o cliente paga e o que entra no caixa/Extrato, mas NÃO muda o valor da venda
 * (faturamento) nem o lucro — o aparelho vira estoque pelo valor cheio.
 * Na venda, a entrada fica em vendas.valor_troca, rateada por linha como o
 * desconto; a ligação com o aparelho fica em vendas_trocas (uma por venda).
 */

/** Dados da entrada informados no PDV. Nada é gravado até a venda ser finalizada. */
export interface DadosEntradaTroca {
  vendedor: { nome: string; cpf: string | null; telefone: string | null };
  aparelho: {
    marca: string;
    modelo: string;
    imei: string | null;
    numeroSerie: string | null;
    cor: string | null;
    capacidadeGb: number | null;
    condicao: string;
    checklistEntrada: Record<string, boolean> | null;
  };
  /** Valor pago pelo aparelho (custo no estoque) — é o que abate a venda. */
  valorEntrada: number;
  /** Preço pretendido na revenda. */
  valorVenda: number;
  observacoes: string | null;
}

const centavos = (valor: number): number => Math.round((Number(valor) || 0) * 100);

export type SituacaoTroca = "sem_troca" | "menor" | "igual" | "maior";

export interface TotaisComTroca {
  /** Valor da venda (subtotal − desconto). Não muda com a troca. */
  totalVenda: number;
  valorEntrada: number;
  /** Quanto o cliente ainda paga (nunca negativo). */
  aPagar: number;
  /** Quanto a loja deveria devolver (entrada maior que a venda). Fase 1 não permite. */
  diferencaADevolver: number;
  situacao: SituacaoTroca;
  podeFinalizar: boolean;
  /** Troca igual ao total: não há nada a pagar, nem forma de pagamento. */
  exigeFormaPagamento: boolean;
}

export const MENSAGEM_TROCA_MAIOR_QUE_VENDA =
  "O aparelho recebido vale mais que a venda. A devolução da diferença ao cliente ainda não está disponível no PDV; registre a venda e a compra do aparelho separadamente ou ajuste os valores.";

/** Nome da forma gravada (forma_pagamento = "outro" + "[forma:Troca]") quando a troca paga a venda inteira. */
export const NOME_FORMA_TROCA_TOTAL = "Troca";

/** Diferença calculada em centavos, sem esconder o caso de entrada maior que a venda. */
export function calcularTotaisComTroca(entrada: { subtotal: number; desconto: number; valorEntrada: number }): TotaisComTroca {
  const totalVendaC = Math.max(0, centavos(entrada.subtotal) - centavos(entrada.desconto));
  const entradaC = Math.max(0, centavos(entrada.valorEntrada));
  const saldoC = totalVendaC - entradaC;
  const situacao: SituacaoTroca =
    entradaC === 0 ? "sem_troca" : saldoC > 0 ? "menor" : saldoC === 0 ? "igual" : "maior";
  return {
    totalVenda: totalVendaC / 100,
    valorEntrada: entradaC / 100,
    aPagar: Math.max(0, saldoC) / 100,
    diferencaADevolver: Math.max(0, -saldoC) / 100,
    situacao,
    podeFinalizar: situacao !== "maior",
    exigeFormaPagamento: situacao !== "igual",
  };
}

/**
 * Divide `valor` proporcionalmente aos pesos, em centavos, pelo maior resto:
 * a soma das partes é exatamente `valor`. Pesos todos zero → partes iguais.
 * Com valor ≤ soma dos pesos, nenhuma parte passa do seu peso.
 */
export function ratearPorPeso(valor: number, pesos: number[]): number[] {
  if (pesos.length === 0) return [];
  const totalC = Math.max(0, centavos(valor));
  const pesosC = pesos.map((p) => Math.max(0, centavos(p)));
  const somaPesos = pesosC.reduce((a, b) => a + b, 0);
  const base = somaPesos > 0 ? pesosC : pesosC.map(() => 1);
  const somaBase = somaPesos > 0 ? somaPesos : base.length;

  const brutas = base.map((p) => (totalC * p) / somaBase);
  const partes = brutas.map(Math.floor);
  let sobra = totalC - partes.reduce((a, b) => a + b, 0);
  const ordem = brutas
    .map((b, i) => ({ i, resto: b - Math.floor(b) }))
    .sort((a, b) => b.resto - a.resto || a.i - b.i);
  for (let k = 0; sobra > 0; k = (k + 1) % ordem.length, sobra--) partes[ordem[k].i] += 1;
  return partes.map((c) => c / 100);
}

/**
 * valor_troca de cada linha que o PDV grava: por item, proporcional ao valor
 * do item já com desconto (bruto − desconto do item); dentro do item, igual
 * entre as parcelas "a receber". Soma de todas as linhas = valorTroca exato.
 * Retorno: [item][parcela].
 */
export function planejarTrocaPorLinha(
  itens: { bruto: number; desconto: number }[],
  parcelasPorItem: number[],
  valorTroca: number,
): number[][] {
  const porItem = ratearPorPeso(valorTroca, itens.map((i) => Math.max(0, i.bruto - i.desconto)));
  return porItem.map((parte, idx) => {
    const parcelas = Math.max(1, Math.floor(parcelasPorItem[idx] ?? 1));
    return ratearPorPeso(parte, Array.from({ length: parcelas }, () => 1));
  });
}

/**
 * Valor da 2ª forma (pagamento duplo) atribuído a um item, para as linhas
 * auxiliares "pagamento_duplo_secundario".
 *  - Sem troca: fórmula de sempre do PDV, item × (2ª forma ÷ total a pagar),
 *    mantida igual para não mudar vendas sem troca (com 0 a pagar devolve 0
 *    em vez de dividir por zero).
 *  - Com troca: proporcional ao bruto do item sobre o subtotal, para a soma
 *    das linhas ser exatamente a 2ª forma (com a fórmula antiga o valor
 *    inflaria pela troca — e vira a conta a receber da 2ª forma).
 */
export function valorSegundaFormaItem(p: {
  itemBruto: number;
  subtotal: number;
  totalAPagar: number;
  valorSegunda: number;
  temTroca: boolean;
}): number {
  if (p.temTroca) return p.subtotal > 0 ? (p.itemBruto * p.valorSegunda) / p.subtotal : 0;
  return p.totalAPagar > 0 ? (p.itemBruto * p.valorSegunda) / p.totalAPagar : 0;
}

// ── Cancelamento ────────────────────────────────────────────────────────────

export type AcaoAparelhoTroca = "manter" | "remover";

export interface SituacaoTrocaNoCancelamento {
  /** vendas_trocas ativa (cancelada = false) para o grupo_venda da linha. */
  trocaAtiva: boolean;
  /** Outras linhas principais da mesma venda ainda não canceladas. */
  outrasLinhasAtivas: number;
  /** Aparelho recebido; null se não existe mais (excluído de vez). */
  aparelho: { vendido: boolean; excluido: boolean } | null;
}

export interface DecisaoCancelamentoTroca {
  /** Mostrar a pergunta manter/tirar do estoque. */
  perguntar: boolean;
  marcarTrocaCancelada: boolean;
  removerAparelho: boolean;
  /** Mensagem quando a ação pedida não pode ser feita (nada deve ser cancelado). */
  bloqueio: string | null;
  /** "Tirar do estoque" indisponível (aparelho já vendido). */
  podeRemover: boolean;
}

export const MENSAGEM_APARELHO_TROCA_VENDIDO =
  "O aparelho recebido na troca já foi vendido e não pode ser tirado do estoque. Escolha mantê-lo para cancelar esta venda.";

/**
 * A troca é da venda inteira: só é desfeita quando a última linha principal
 * ativa da venda é cancelada. Cancelar um item de uma venda com vários itens
 * não mexe na troca (ela continua valendo para os outros).
 */
export function decidirCancelamentoTroca(
  s: SituacaoTrocaNoCancelamento,
  acao: AcaoAparelhoTroca | null,
): DecisaoCancelamentoTroca {
  const nada: DecisaoCancelamentoTroca = { perguntar: false, marcarTrocaCancelada: false, removerAparelho: false, bloqueio: null, podeRemover: false };
  if (!s.trocaAtiva || s.outrasLinhasAtivas > 0) return nada;

  const aparelhoNoEstoque = !!s.aparelho && !s.aparelho.excluido;
  const vendido = !!s.aparelho?.vendido;
  const podeRemover = aparelhoNoEstoque && !vendido;
  const base = { perguntar: aparelhoNoEstoque, marcarTrocaCancelada: true, podeRemover };

  if (acao === "remover" && aparelhoNoEstoque && vendido) {
    return { ...base, removerAparelho: false, bloqueio: MENSAGEM_APARELHO_TROCA_VENDIDO };
  }
  return { ...base, removerAparelho: acao === "remover" && podeRemover, bloqueio: null };
}
