// Estoque mínimo POR ITEM (produtos/pecas.estoque_minimo, fase 3).
// Precedência do limite de "baixo": item > loja (configuracao_estoque) > padrão da tela.
// Funções puras: as telas e o cadastro só chamam estas.
import { LIMITE_BAIXO_MAXIMO, limiteParaSalvar } from "./configuracaoEstoque";

/** Mínimo do item, se for um inteiro de 0 ao teto; qualquer outra coisa = "não definido". */
export function estoqueMinimoValido(valor: unknown): number | null {
  return typeof valor === "number" && Number.isInteger(valor) && valor >= 0 && valor <= LIMITE_BAIXO_MAXIMO
    ? valor
    : null;
}

/**
 * Limite que vai para situacaoEstoque: o do item, se definido; senão o da loja.
 * Vazio nos dois = a tela usa o padrão dela (situacaoEstoque cuida disso).
 */
export function limiteDoItem(
  estoqueMinimo: unknown,
  limiteLoja: number | null | undefined,
): number | null | undefined {
  const doItem = estoqueMinimoValido(estoqueMinimo);
  return doItem !== null ? doItem : limiteLoja;
}

/** Algum item da lista tem mínimo próprio? (o PDF muda o subtítulo do cartão) */
export function algumItemComMinimo(itens: { estoque_minimo?: unknown }[]): boolean {
  return itens.some((i) => estoqueMinimoValido(i.estoque_minimo) !== null);
}

/** Estado inicial do campo no cadastro: texto e a opção "Não avisar". */
export function campoInicialEstoqueMinimo(valor: unknown): { texto: string; naoAvisar: boolean } {
  const v = estoqueMinimoValido(valor);
  return { texto: v !== null && v > 0 ? String(v) : "", naoAvisar: v === 0 };
}

export type EnvioEstoqueMinimo =
  | { ok: false }
  | { ok: true; campos: { estoque_minimo?: number | null } };

/**
 * O que mandar no insert/update. A chave só vai quando a coluna existe e o
 * valor mudou (no cadastro novo: quando foi preenchido). Assim, antes da
 * migration, o payload é igual ao de sempre e nada existente é sobrescrito.
 */
export function estoqueMinimoParaEnviar(p: {
  colunaExiste: boolean;
  /** Valor salvo do item em edição; undefined = cadastro novo. */
  original: unknown;
  texto: string;
  naoAvisar: boolean;
}): EnvioEstoqueMinimo {
  if (!p.colunaExiste) return { ok: true, campos: {} };
  const resultado = limiteParaSalvar(p.texto, p.naoAvisar);
  if (!resultado.ok) return { ok: false };
  const novo = resultado.valor;
  const anterior = p.original === undefined ? null : estoqueMinimoValido(p.original);
  return novo === anterior ? { ok: true, campos: {} } : { ok: true, campos: { estoque_minimo: novo } };
}
