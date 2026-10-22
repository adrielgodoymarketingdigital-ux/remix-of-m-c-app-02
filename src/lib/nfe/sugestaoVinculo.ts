/**
 * Sugestão de vínculo de cada item da nota de compra com um produto/peça já
 * cadastrado (etapa 2 da importação de XML: só sugere, nada é gravado).
 *
 * Ordem (a primeira que achar vence):
 *   1. código de barras: cEAN ou cEANTrib VÁLIDOS da nota (nunca "SEM GTIN"
 *      nem dígito errado — a leitura já devolve null nesses casos) = codigo_barras
 *      do cadastro. GTIN comparado sem zeros à esquerda (GTIN-13 = GTIN-14 "0…");
 *   2. código do fornecedor (cProd) = sku (produtos) ou codigo_barras do cadastro;
 *   3. nome muito parecido — sugestão FRACA, a tela sempre pede "confira".
 * Nunca é vínculo automático: a tela mostra a proposta e o lojista troca.
 *
 * Sem React nem imports "@/": testado com Deno em scripts/testes-xml-compra/.
 */

export type TipoCadastro = "produto" | "peca";

/** Campos mínimos de produtos/pecas para sugerir e prever custo. */
export interface CandidatoEstoque {
  id: string;
  tipo: TipoCadastro;
  nome: string;
  variacaoLabel: string | null;
  /** Só produtos têm sku (pecas não têm a coluna). */
  sku: string | null;
  codigoBarras: string | null;
  quantidade: number;
  /** Custo atual em reais (numeric(10,2) do banco), null = sem custo. */
  custo: number | null;
}

export type MotivoSugestao = "ean" | "codigo" | "nome";

export interface SugestaoVinculo {
  candidato: CandidatoEstoque;
  motivo: MotivoSugestao;
  /** Quantos cadastros bateram pelo mesmo critério (> 1 = ambíguo, confira). */
  quantidade: number;
  /** Só no motivo "nome": 0..1. */
  similaridade?: number;
}

export interface IndiceCandidatos {
  candidatos: CandidatoEstoque[];
  porGtin: Map<string, CandidatoEstoque[]>;
  porCodigo: Map<string, CandidatoEstoque[]>;
  porToken: Map<string, number[]>;
  nomesNormalizados: string[];
}

export const SIMILARIDADE_MINIMA_NOME = 0.8;
/** cProd curto demais ("1", "A") bate com qualquer coisa: não serve de vínculo. */
export const TAMANHO_MINIMO_CODIGO = 3;

export const normalizarCodigo = (v: string | null | undefined) => (v ?? "").trim().toUpperCase().replace(/\s+/g, "");

/** GTIN só com dígitos (8 a 14) e sem zeros à esquerda; outra coisa → null. */
export function normalizarGtin(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  if (!/^\d{8,14}$/.test(t)) return null;
  return t.replace(/^0+/, "") || null;
}

export function normalizarNome(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export const nomeExibicao = (c: Pick<CandidatoEstoque, "nome" | "variacaoLabel">) =>
  c.variacaoLabel ? `${c.nome} (${c.variacaoLabel})` : c.nome;

const bigramas = (s: string) => {
  const t = s.replace(/ /g, "");
  const r = new Map<string, number>();
  for (let i = 0; i < t.length - 1; i++) {
    const b = t.slice(i, i + 2);
    r.set(b, (r.get(b) ?? 0) + 1);
  }
  return r;
};

/** Coeficiente de Dice por bigramas (0..1) entre nomes já normalizados. */
export function similaridadeNomes(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const ba = bigramas(a);
  const bb = bigramas(b);
  let total = 0;
  let comuns = 0;
  for (const n of ba.values()) total += n;
  for (const n of bb.values()) total += n;
  for (const [k, n] of ba) comuns += Math.min(n, bb.get(k) ?? 0);
  return total === 0 ? 0 : (2 * comuns) / total;
}

// Palavras de 3+ letras e números de qualquer tamanho ("13" em "iPhone 13" é o que distingue o modelo).
const tokens = (nomeNormalizado: string) => nomeNormalizado.split(" ").filter((t) => t.length >= 3 || /^\d+$/.test(t));

function adicionar<K, V>(mapa: Map<K, V[]>, chave: K, valor: V) {
  const lista = mapa.get(chave);
  if (lista) {
    if (!lista.includes(valor)) lista.push(valor);
  } else mapa.set(chave, [valor]);
}

export function indexarCandidatos(candidatos: CandidatoEstoque[]): IndiceCandidatos {
  const porGtin = new Map<string, CandidatoEstoque[]>();
  const porCodigo = new Map<string, CandidatoEstoque[]>();
  const porToken = new Map<string, number[]>();
  const nomesNormalizados = candidatos.map((c) => normalizarNome(nomeExibicao(c)));
  candidatos.forEach((c, i) => {
    const gtin = normalizarGtin(c.codigoBarras);
    if (gtin) adicionar(porGtin, gtin, c);
    for (const codigo of [c.sku, c.codigoBarras]) {
      const n = normalizarCodigo(codigo);
      if (n.length >= TAMANHO_MINIMO_CODIGO) adicionar(porCodigo, n, c);
    }
    for (const t of new Set(tokens(nomesNormalizados[i]))) adicionar(porToken, t, i);
  });
  return { candidatos, porGtin, porCodigo, porToken, nomesNormalizados };
}

export interface ItemParaSugestao {
  ean: string | null;
  eanTrib?: string | null;
  cProd: string;
  xProd: string;
}

/** Até 40 candidatos que mais compartilham palavras com o nome (evita N×M comparações). */
function candidatosPorNome(indice: IndiceCandidatos, nomeNormalizado: string): number[] {
  const contagem = new Map<number, number>();
  for (const t of new Set(tokens(nomeNormalizado))) {
    const lista = indice.porToken.get(t);
    // Palavra presente em quase tudo ("capa", "para") não ajuda a escolher.
    if (!lista || lista.length > 2000) continue;
    for (const i of lista) contagem.set(i, (contagem.get(i) ?? 0) + 1);
  }
  return [...contagem.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([i]) => i);
}

export function sugerirVinculo(item: ItemParaSugestao, indice: IndiceCandidatos): SugestaoVinculo | null {
  // 1. Código de barras (cEAN, depois cEANTrib).
  for (const ean of [item.ean, item.eanTrib]) {
    const gtin = normalizarGtin(ean);
    const achados = gtin ? indice.porGtin.get(gtin) : undefined;
    if (achados?.length) return { candidato: achados[0], motivo: "ean", quantidade: achados.length };
  }

  // 2. Código do fornecedor.
  const codigo = normalizarCodigo(item.cProd);
  if (codigo.length >= TAMANHO_MINIMO_CODIGO) {
    const achados = indice.porCodigo.get(codigo);
    if (achados?.length) return { candidato: achados[0], motivo: "codigo", quantidade: achados.length };
  }

  // 3. Nome parecido (fraca).
  const nome = normalizarNome(item.xProd);
  let melhor: { i: number; s: number } | null = null;
  let empatados = 0;
  for (const i of candidatosPorNome(indice, nome)) {
    const s = similaridadeNomes(nome, indice.nomesNormalizados[i]);
    if (s < SIMILARIDADE_MINIMA_NOME) continue;
    if (!melhor || s > melhor.s) {
      melhor = { i, s };
      empatados = 1;
    } else if (s === melhor.s) empatados++;
  }
  if (melhor) {
    return { candidato: indice.candidatos[melhor.i], motivo: "nome", quantidade: empatados, similaridade: melhor.s };
  }
  return null;
}

/** Busca manual (seletor): por nome, sku ou código de barras; no máximo `limite`. */
export function buscarCandidatos(indice: IndiceCandidatos, termo: string, limite = 50): CandidatoEstoque[] {
  const nome = normalizarNome(termo);
  const codigo = normalizarCodigo(termo);
  if (!nome && !codigo) return indice.candidatos.slice(0, limite);
  const r: CandidatoEstoque[] = [];
  for (let i = 0; i < indice.candidatos.length && r.length < limite; i++) {
    const c = indice.candidatos[i];
    if (
      (nome && indice.nomesNormalizados[i].includes(nome)) ||
      (codigo && (normalizarCodigo(c.sku).includes(codigo) || normalizarCodigo(c.codigoBarras).includes(codigo)))
    ) {
      r.push(c);
    }
  }
  return r;
}
