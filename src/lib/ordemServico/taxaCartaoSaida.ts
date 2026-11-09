/**
 * Cartão na entrega da OS (DialogAssinaturaSaida): bandeira, parcelas e a conta
 * "Taxa de Cartão". Lógica pura — sem React, sem Supabase, sem alias "@/" —
 * para rodar nos testes Deno.
 *
 * Regras (decididas pelo Adriel em 2026-11-09):
 * - base da taxa = valor recebido agora: saldo restante se houve entrada, total se não;
 *   a forma é a escolhida agora (não a da criação);
 * - parcelas só mudam quando a forma é crédito parcelado; nas outras formas o valor
 *   gravado continua o mesmo;
 * - a conta "Taxa de Cartão" segue o formato da criação da OS
 *   (handleSubmitOrdemServico.ts), com a data = "Data no caixa", e só é lançada se:
 *   forma de cartão, bandeira escolhida, taxa > 0, saldo não ficou a prazo e a OS
 *   ainda não tem conta "Taxa de Cartão".
 */

export const FORMAS_CARTAO_SAIDA = ["debito", "credito", "credito_parcelado"] as const;
export const CATEGORIA_TAXA_CARTAO = "Taxa de Cartão";
/** Opções do seletor de parcelas (igual ao ResumoFinanceiro da criação da OS). */
export const OPCOES_PARCELAS = Array.from({ length: 12 }, (_, i) => i + 1);
/** Valor inicial do seletor quando a OS não tem parcelas gravadas (igual à edição da OS). */
export const PARCELAS_PADRAO = 2;

/** Bandeira cadastrada em Taxas de Cartão (subconjunto de TaxaCartao do useTaxasCartao). */
export interface TaxaBandeira {
  id: string;
  bandeira: string;
  taxa_debito: number;
  taxa_credito: number;
  taxas_parcelado: Record<string, number>;
}

/** Assinatura do calcularTaxa do useTaxasCartao (a mesma conta da criação da OS). */
export type CalcularTaxa<T extends TaxaBandeira = TaxaBandeira> = (
  taxaCartao: T,
  formaPagamento: string,
  numeroParcelas?: number,
  valorTotal?: number,
) => { percentual: number; valor: number };

export const SEM_TAXA = Object.freeze({ percentual: 0, valor: 0 });

export function ehFormaCartao(forma: string | null | undefined): boolean {
  return !!forma && (FORMAS_CARTAO_SAIDA as readonly string[]).includes(forma);
}

/** Valor recebido agora na entrega: saldo restante se houve entrada; total se não houve. */
export function valorRecebidoAgora(total: number | null | undefined, entradaPaga: number | null | undefined): number {
  const t = Number(total || 0);
  const e = Number(entradaPaga || 0);
  return e > 0 ? Math.max(0, t - e) : t;
}

/** Parcelas iniciais do seletor: as gravadas na OS (1 a 12) ou o padrão. */
export function parcelasIniciais(gravadas: unknown): number {
  const n = Number(gravadas);
  return Number.isInteger(n) && n >= 1 && n <= 12 ? n : PARCELAS_PADRAO;
}

/** Texto da opção do seletor: "3x de R$ 33,33". */
export function rotuloParcela(n: number, valor: number, formatar: (v: number) => string): string {
  return `${n}x de ${formatar(valor / n)}`;
}

/** "nenhuma" e vazio = sem bandeira (mesma convenção do SeletorBandeiraCartao). */
export function bandeiraEscolhida<T extends TaxaBandeira>(
  taxasAtivas: readonly T[],
  bandeiraId: string | null | undefined,
): T | null {
  if (!bandeiraId || bandeiraId === "nenhuma") return null;
  return taxasAtivas.find((t) => t.id === bandeiraId) ?? null;
}

export interface EntradaTaxaSaida<T extends TaxaBandeira> {
  forma: string | null | undefined;
  taxasAtivas: readonly T[];
  bandeiraId: string | null | undefined;
  parcelas: number;
  /** valorRecebidoAgora(...) */
  base: number;
  saldoAPrazo: boolean;
  calcularTaxa: CalcularTaxa<T>;
}

/**
 * Taxa exibida e lançada na entrega. Zero quando: forma não é cartão, sem bandeira,
 * saldo a prazo ou base zero. Parcelas só contam no crédito parcelado.
 */
export function taxaDaSaida<T extends TaxaBandeira>(e: EntradaTaxaSaida<T>): {
  taxa: T | null;
  percentual: number;
  valor: number;
} {
  const taxa = bandeiraEscolhida(e.taxasAtivas, e.bandeiraId);
  if (!taxa || !ehFormaCartao(e.forma) || e.saldoAPrazo || !(e.base > 0)) {
    return { taxa, ...SEM_TAXA };
  }
  const parcelas = e.forma === "credito_parcelado" ? e.parcelas : undefined;
  const { percentual, valor } = e.calcularTaxa(taxa, e.forma as string, parcelas, e.base);
  return { taxa, percentual, valor };
}

export type MotivoSemTaxa =
  | "forma_nao_cartao"
  | "sem_bandeira"
  | "saldo_a_prazo"
  | "taxa_zero"
  | "ja_existe";

/** Decide se a conta "Taxa de Cartão" deve ser lançada (sem a consulta de duplicidade). */
export function motivoSemTaxaAntesDaConsulta(
  forma: string | null | undefined,
  taxa: TaxaBandeira | null,
  saldoAPrazo: boolean,
  valorTaxa: number,
): MotivoSemTaxa | null {
  if (!ehFormaCartao(forma)) return "forma_nao_cartao";
  if (!taxa) return "sem_bandeira";
  if (saldoAPrazo) return "saldo_a_prazo";
  if (!(valorTaxa > 0)) return "taxa_zero";
  return null;
}

/** Regra de duplicidade: a OS já tem conta "Taxa de Cartão"? (linhas da consulta por os_numero) */
export function jaTemContaTaxa(
  contas: ReadonlyArray<{ categoria?: string | null; os_numero?: string | null }> | null | undefined,
  numeroOS: string,
): boolean {
  return (contas ?? []).some((c) => c.categoria === CATEGORIA_TAXA_CARTAO && c.os_numero === numeroOS);
}

/**
 * Patch de dados_pagamento na entrega. Parcelas só entram no crédito parcelado;
 * nas outras formas o objeto fica exatamente como antes (a chave nem aparece).
 */
export function dadosPagamentoDaSaida<D extends object>(
  atual: D | null | undefined,
  formaSelecionada: string | null | undefined,
  parcelas: number,
): D & { forma?: unknown; parcelas?: number } {
  const anterior = (atual ?? {}) as D & { forma?: unknown; parcelas?: number };
  return {
    ...anterior,
    forma: formaSelecionada || anterior.forma,
    ...(formaSelecionada === "credito_parcelado" ? { parcelas } : {}),
  };
}

export interface ContaTaxaCartao {
  nome: string;
  tipo: "pagar";
  valor: number;
  data: string;
  status: "pago";
  recorrente: false;
  categoria: typeof CATEGORIA_TAXA_CARTAO;
  descricao: string;
  os_numero: string;
  user_id: string;
  empresa_id: string | null;
}

/** Mesmo formato da criação da OS (handleSubmitOrdemServico.ts, "REGISTRAR TAXA DE CARTÃO"). */
export function montarContaTaxaCartao(p: {
  bandeira: string;
  numeroOS: string;
  percentual: number;
  valorTaxa: number;
  base: number;
  dataCaixa: string;
  userId: string;
  empresaId: string | null;
  formatar: (v: number) => string;
}): ContaTaxaCartao {
  return {
    nome: `Taxa Cartão ${p.bandeira} - OS ${p.numeroOS}`,
    tipo: "pagar",
    valor: p.valorTaxa,
    data: p.dataCaixa,
    status: "pago",
    recorrente: false,
    categoria: CATEGORIA_TAXA_CARTAO,
    descricao: `Taxa ${p.percentual}% da bandeira ${p.bandeira} sobre OS ${p.numeroOS} (${p.formatar(p.base)})`,
    os_numero: p.numeroOS,
    user_id: p.userId,
    empresa_id: p.empresaId,
  };
}
