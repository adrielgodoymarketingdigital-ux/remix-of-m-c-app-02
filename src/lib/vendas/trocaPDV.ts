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
  /** Quanto a loja devolve ao cliente (entrada maior que a venda), em dinheiro ou Pix. */
  diferencaADevolver: number;
  situacao: SituacaoTroca;
  /** Sempre true desde a Fase 2 (entrada maior que a venda vira devolução). */
  podeFinalizar: boolean;
  /** Troca igual ou maior que o total: a troca paga a venda inteira. */
  cobreTudo: boolean;
  /** Parte da entrada usada para pagar a venda (= total da venda quando cobre tudo). */
  trocaAplicada: number;
  /** Troca cobre tudo: não há nada a pagar, nem forma de pagamento. */
  exigeFormaPagamento: boolean;
  /** Entrada maior que a venda: escolher Dinheiro ou Pix para devolver a diferença. */
  exigeFormaDevolucao: boolean;
}

export type FormaDevolucao = "dinheiro" | "pix";
export const NOMES_FORMA_DEVOLUCAO: Record<FormaDevolucao, string> = { dinheiro: "Dinheiro", pix: "Pix" };

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
    podeFinalizar: true,
    cobreTudo: situacao === "igual" || situacao === "maior",
    trocaAplicada: Math.min(entradaC, totalVendaC) / 100,
    exigeFormaPagamento: situacao !== "igual" && situacao !== "maior",
    exigeFormaDevolucao: situacao === "maior",
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
 * valor_troca por linha: por item, proporcional ao peso (bruto − desconto);
 * dentro do item, igual entre as parcelas "a receber". Soma = valorTroca exato.
 * Retorno: [item][parcela]. O PDV usa via planejarTroca (pesos já descontados
 * da 2ª forma e zerados em peça).
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

export const MENSAGEM_TROCA_MAIOR_QUE_ITENS_SEM_PECA =
  "A troca não pode ser maior que o valor dos aparelhos/produtos da venda. Peças não entram na troca. Reduza o valor da troca ou ajuste os itens.";

export interface ItemParaTroca {
  /** preço × quantidade */
  bruto: number;
  /** Desconto manual do item (o PDV divide o desconto igualmente entre os itens). */
  desconto: number;
  /** Peça (vendas.peca_id): o Extrato ignora essas linhas, então nunca recebem troca. */
  peca: boolean;
}

export interface PlanoTroca {
  /** valor_troca de cada linha principal: [item][parcela "a receber"]. Tudo 0 se bloqueado. */
  trocaPorLinha: number[][];
  /**
   * Fatia da 2ª forma de cada item (venda com troca + pagamento duplo), em
   * centavos exatos com soma = 2ª forma: vai em valor_segunda_forma da linha
   * principal e nas linhas auxiliares do item. null = sem 2ª forma.
   */
  segundaPorItem: number[] | null;
  /** O que sobra dos itens sem peça depois do desconto e da fatia da 2ª forma. */
  capacidade: number;
  bloqueio: string | null;
  /**
   * Troca que cobre tudo: desconto de cada item, proporcional ao valor dele
   * (centavos exatos, soma = desconto da venda) — vai em valor_desconto_manual.
   * null = desconto dividido igualmente entre os itens, como sempre.
   */
  descontoPorItem: number[] | null;
  /** Soma exata de valor_troca nas linhas (a devolução é entrada − isto). */
  trocaAplicada: number;
}

/**
 * Plano da troca para uma venda COM troca. O caixa e o Extrato tiram a troca e
 * a 2ª forma linha a linha e limitam cada linha a zero; para a soma subtraída
 * ser exatamente a troca:
 *  - a 2ª forma de cada linha é a fatia do item (e não o valor inteiro repetido
 *    em todas as linhas, como nas vendas sem troca);
 *  - a troca de cada item é proporcional ao que sobra dele depois do desconto e
 *    dessa fatia (nunca negativo), só em itens sem peça;
 *  - se a troca não cabe nesses itens, a venda é bloqueada.
 */
export function planejarTroca(p: {
  itens: ItemParaTroca[];
  parcelasPorItem: number[];
  valorTroca: number;
  /** Valor da 2ª forma (0 = sem pagamento duplo). */
  valorSegunda: number;
  /**
   * Troca igual ou maior que o total (Fase 2): a troca paga a venda inteira.
   * Cada linha principal fica líquida em zero — INCLUSIVE peça (o Extrato
   * ignora a linha de peça, então não muda nada lá) — com o desconto rateado
   * proporcionalmente ao valor do item. valorTroca é ignorado.
   */
  cobreTudo?: { descontoTotal: number };
}): PlanoTroca {
  if (p.cobreTudo) return planejarTrocaQueCobreTudo(p.itens, p.parcelasPorItem, p.cobreTudo.descontoTotal);
  const segundaPorItem = centavos(p.valorSegunda) > 0 ? ratearPorPeso(p.valorSegunda, p.itens.map((i) => i.bruto)) : null;
  const sobras = p.itens.map((i, idx) =>
    i.peca ? 0 : Math.max(0, centavos(i.bruto) - centavos(i.desconto) - centavos(segundaPorItem?.[idx] ?? 0)) / 100,
  );
  const capacidadeC = sobras.reduce((a, s) => a + centavos(s), 0);
  const trocaC = Math.max(0, centavos(p.valorTroca));
  const zeros = () => p.itens.map((_, idx) => Array.from({ length: Math.max(1, Math.floor(p.parcelasPorItem[idx] ?? 1)) }, () => 0));
  if (trocaC > capacidadeC) {
    return { trocaPorLinha: zeros(), segundaPorItem, capacidade: capacidadeC / 100, bloqueio: MENSAGEM_TROCA_MAIOR_QUE_ITENS_SEM_PECA, descontoPorItem: null, trocaAplicada: 0 };
  }
  const trocaPorLinha = trocaC === 0
    ? zeros()
    : planejarTrocaPorLinha(sobras.map((s) => ({ bruto: s, desconto: 0 })), p.parcelasPorItem, trocaC / 100);
  return { trocaPorLinha, segundaPorItem, capacidade: capacidadeC / 100, bloqueio: null, descontoPorItem: null, trocaAplicada: trocaC / 100 };
}

function planejarTrocaQueCobreTudo(itens: ItemParaTroca[], parcelasPorItem: number[], descontoTotal: number): PlanoTroca {
  const descontoPorItem = ratearPorPeso(descontoTotal, itens.map((i) => i.bruto));
  const liquidosC = itens.map((i, idx) => Math.max(0, centavos(i.bruto) - centavos(descontoPorItem[idx])));
  const trocaPorLinha = liquidosC.map((c, idx) => {
    const parcelas = Math.max(1, Math.floor(parcelasPorItem[idx] ?? 1));
    return ratearPorPeso(c / 100, Array.from({ length: parcelas }, () => 1));
  });
  const totalC = liquidosC.reduce((a, b) => a + b, 0);
  return { trocaPorLinha, segundaPorItem: null, capacidade: totalC / 100, bloqueio: null, descontoPorItem, trocaAplicada: totalC / 100 };
}

/** Devolução ao cliente = entrada − o que a troca pagou da venda (centavos exatos, nunca negativa). */
export function calcularDevolucao(valorEntrada: number, trocaAplicada: number): number {
  return Math.max(0, centavos(valorEntrada) - centavos(trocaAplicada)) / 100;
}

/**
 * Colunas da devolução em vendas_trocas, sempre coerentes com o CHECK do banco
 * (vendas_trocas_devolucao_coerente): valor > 0 exige forma; sem devolução,
 * valor 0 e forma vazia.
 */
export function camposDevolucao(devolucao: { valor: number; forma: FormaDevolucao | null } | null | undefined): {
  valor_devolvido: number;
  forma_devolucao: FormaDevolucao | null;
} {
  const valorC = Math.max(0, centavos(devolucao?.valor ?? 0));
  if (valorC === 0 || !devolucao?.forma) return { valor_devolvido: 0, forma_devolucao: null };
  return { valor_devolvido: valorC / 100, forma_devolucao: devolucao.forma };
}

/**
 * Devolução em dinheiro maior que o dinheiro estimado na gaveta: o PDV avisa e
 * pede confirmação (não bloqueia — a sangria também não confere saldo).
 */
export function devolucaoPassaDaGaveta(p: { valorDevolucao: number; forma: FormaDevolucao | null; dinheiroNaGaveta: number }): boolean {
  return p.forma === "dinheiro" && centavos(p.valorDevolucao) > centavos(p.dinheiroNaGaveta);
}

/**
 * Valor da 2ª forma (pagamento duplo) atribuído a um item, para as linhas
 * auxiliares "pagamento_duplo_secundario" de vendas SEM troca: fórmula de
 * sempre do PDV, item × (2ª forma ÷ total a pagar), mantida igual para não
 * mudar essas vendas (com 0 a pagar devolve 0 em vez de dividir por zero).
 * Venda com troca usa PlanoTroca.segundaPorItem (temTroca aqui só existe por
 * compatibilidade: proporcional ao bruto, sem arredondar).
 */
export function valorSegundaFormaItem(p: {
  itemBruto: number;
  subtotal: number;
  totalAPagar: number;
  valorSegunda: number;
  temTroca: boolean;
}): number {
  if (p.temTroca) return p.subtotal > 0 ? (p.itemBruto * p.valorSegunda) / p.subtotal : 0;
  // Mesma ordem de operações da main (item × proporção), para gravar os mesmos bits.
  return p.totalAPagar > 0 ? p.itemBruto * (p.valorSegunda / p.totalAPagar) : 0;
}

// ── Cancelamento ────────────────────────────────────────────────────────────

export type AcaoAparelhoTroca = "manter" | "remover";

export interface SituacaoTrocaNoCancelamento {
  /** vendas_trocas ativa (cancelada = false) para o grupo_venda da linha. */
  trocaAtiva: boolean;
  /** Aparelho recebido; null se não existe mais (excluído de vez). */
  aparelho: { vendido: boolean; excluido: boolean } | null;
}

export interface DecisaoCancelamentoTroca {
  /** Venda com troca: todas as linhas da venda são canceladas juntas. */
  cancelarVendaInteira: boolean;
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

export const MENSAGEM_VENDA_COM_TROCA_INTEIRA = "Vendas com troca são canceladas por inteiro";

/**
 * A troca é da venda inteira, e a venda com troca só é cancelada INTEIRA
 * (Fase 2B): cancelar um item cancela todos os itens da venda e desfaz a
 * troca. Assim a troca (e a devolução) nunca fica valendo para uma venda
 * pela metade.
 */
export function decidirCancelamentoTroca(
  s: SituacaoTrocaNoCancelamento,
  acao: AcaoAparelhoTroca | null,
): DecisaoCancelamentoTroca {
  const nada: DecisaoCancelamentoTroca = {
    cancelarVendaInteira: false, perguntar: false, marcarTrocaCancelada: false, removerAparelho: false, bloqueio: null, podeRemover: false,
  };
  if (!s.trocaAtiva) return nada;

  const aparelhoNoEstoque = !!s.aparelho && !s.aparelho.excluido;
  const vendido = !!s.aparelho?.vendido;
  const podeRemover = aparelhoNoEstoque && !vendido;
  const base = { cancelarVendaInteira: true, perguntar: aparelhoNoEstoque, marcarTrocaCancelada: true, podeRemover };

  if (acao === "remover" && aparelhoNoEstoque && vendido) {
    return { ...base, removerAparelho: false, bloqueio: MENSAGEM_APARELHO_TROCA_VENDIDO };
  }
  return { ...base, removerAparelho: acao === "remover" && podeRemover, bloqueio: null };
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Aviso do cancelamento quando a troca devolveu dinheiro ao cliente. O
 * cancelamento não lança saída nem entrada: a recuperação é combinada com o
 * cliente. null = sem devolução (sem aviso e sem "Estou ciente").
 */
export function avisoDevolucaoNoCancelamento(t: { valorDevolvido: number; formaDevolucao: string | null } | null): string | null {
  if (!t || centavos(t.valorDevolvido) <= 0) return null;
  const forma = t.formaDevolucao === "pix" ? NOMES_FORMA_DEVOLUCAO.pix : NOMES_FORMA_DEVOLUCAO.dinheiro;
  return `O cliente recebeu ${brl.format(centavos(t.valorDevolvido) / 100)} (${forma}) de devolução nesta troca. ` +
    "Cancelar a venda não traz esse dinheiro de volta; combine a recuperação com o cliente. " +
    "Se o cliente devolver o dinheiro, registre um suprimento no caixa.";
}

/** Botão "Confirmar Cancelamento": troca lida, sem bloqueio e, com devolução, "Estou ciente" marcado. */
export function podeConfirmarCancelamento(p: {
  carregando: boolean;
  erroLeitura: boolean;
  bloqueio: string | null;
  exigeCiente: boolean;
  ciente: boolean;
}): boolean {
  return !p.carregando && !p.erroLeitura && !p.bloqueio && (!p.exigeCiente || p.ciente);
}

export interface LinhaVendaCancelavel {
  id: string;
  observacoes: string | null;
  cancelada: boolean | null;
  parcela_numero: number | null;
}

/**
 * Linhas que o cancelamento da venda inteira cancela: as principais ainda
 * ativas (o auxiliar do pagamento duplo vai pela cascata). estornar = só a
 * 1ª linha de cada item: o parcelado "a receber" grava a quantidade cheia em
 * todas as parcelas, mas o estoque baixou uma vez só.
 */
export function linhasParaCancelarVendaInteira<T extends LinhaVendaCancelavel>(linhas: T[]): { linha: T; estornar: boolean }[] {
  return linhas
    .filter((l) => !l.cancelada && l.observacoes !== "pagamento_duplo_secundario")
    .map((linha) => ({ linha, estornar: linha.parcela_numero == null || linha.parcela_numero <= 1 }));
}

// ── Excluir em Dispositivos vendidos ────────────────────────────────────────

export const MENSAGEM_EXCLUIR_VENDA_COM_TROCA = "Esta venda tem troca de aparelho. Cancele pela tela de Vendas.";

/**
 * "Excluir" de Dispositivos vendidos não sabe desfazer a troca: venda com troca
 * ativa é bloqueada (cancela-se pela tela de Vendas). Sem conseguir ler a troca,
 * bloqueia também. null = pode excluir como sempre.
 */
export function bloqueioExcluirDispositivoVendido(leitura: { erro: boolean; trocaAtiva: boolean }): string | null {
  return leitura.erro || leitura.trocaAtiva ? MENSAGEM_EXCLUIR_VENDA_COM_TROCA : null;
}
