/**
 * Padrão de folha/rolo de etiquetas e a validação do que vem do banco/localStorage.
 * Sem dependências do app (testado com Deno em scripts/testes-etiquetas/);
 * etiquetasProduto.ts reexporta tudo.
 */
import { lerAjusteVertical } from "./ajusteVertical.ts";

/**
 * Folha/rolo de etiquetas medido pelo próprio usuário (ou uma das sugestões) —
 * qualquer tamanho de papel: A4, rolo de 80mm, rolo de 58mm etc.
 * Medidas guardadas em mm; a tela mostra em cm. Salva em
 * configuracoes_loja.etiquetas_padroes (lista JSON) — ver usePadroesEtiqueta.
 */
export interface PadraoEtiqueta {
  id: string;
  nome: string;
  larguraFolhaMm: number;
  larguraMm: number;
  alturaMm: number;
  colunas: number;
  /** null = linhas calculadas pela quantidade de etiquetas na hora da impressão. */
  linhas: number | null;
  /**
   * Espaço vertical entre o fim de uma fileira e o início da próxima (mm).
   * Para rolo contínuo (linhas = 1) é a distância real entre etiquetas.
   * Para folha pré-cortada com várias fileiras, normalmente é 0 e a folha
   * tem sua própria altura fixa (alturaFolhaMm).
   */
  espacoFileiraMm: number;
  /**
   * Altura física da folha/papel (mm). Para rolo contínuo (linhas = 1),
   * é calculada automaticamente como alturaMm + espacoFileiraMm — não pedir
   * ao usuário nesse caso. Para folha pré-cortada (ex: A4), é a altura real
   * da folha, informada pelo usuário.
   */
  alturaFolhaMm: number;
  /** Calibração da impressora desta folha/rolo (mm, -5..+5; positivo desce). Ver ajusteVertical.ts. */
  ajusteVerticalMm: number;
}

/** Valor padrão (compatibilidade com padrões salvos antes desta mudança). */
export const ALTURA_FOLHA_MM = 297;

export const LIMITES_PADRAO = {
  larguraFolhaMm: { min: 20, max: 300 },
  // Até 1,5m: cobre rolos longos, não só folhas A4.
  alturaFolhaMm: { min: 20, max: 1500 },
  larguraMm: { min: 10, max: 300 },
  alturaMm: { min: 10, max: 1500 },
  colunas: { min: 1, max: 20 },
  linhas: { min: 1, max: 50 },
  espacoFileiraMm: { min: 0, max: 100 },
} as const;

function numeroNoIntervalo(v: unknown, min: number, max: number): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
}

/** Valida um padrão vindo do banco/localStorage; null se estiver incompleto. */
export function normalizarPadrao(bruto: unknown): PadraoEtiqueta | null {
  if (!bruto || typeof bruto !== "object") return null;
  const p = bruto as Record<string, unknown>;
  const L = LIMITES_PADRAO;
  if (typeof p.id !== "string" || !p.id || typeof p.nome !== "string") return null;
  if (!numeroNoIntervalo(p.larguraFolhaMm, L.larguraFolhaMm.min, L.larguraFolhaMm.max)) return null;
  // Padrões salvos antes da altura configurável não têm o campo: eram sempre A4.
  const alturaFolhaMm = numeroNoIntervalo(p.alturaFolhaMm, L.alturaFolhaMm.min, L.alturaFolhaMm.max)
    ? p.alturaFolhaMm
    : ALTURA_FOLHA_MM;
  // Idem para o espaço entre fileiras: antes não existia (0).
  const espacoFileiraMm = numeroNoIntervalo(p.espacoFileiraMm, L.espacoFileiraMm.min, L.espacoFileiraMm.max)
    ? p.espacoFileiraMm
    : 0;
  if (!numeroNoIntervalo(p.larguraMm, L.larguraMm.min, L.larguraMm.max)) return null;
  if (!numeroNoIntervalo(p.alturaMm, L.alturaMm.min, L.alturaMm.max)) return null;
  if (!numeroNoIntervalo(p.colunas, L.colunas.min, L.colunas.max)) return null;
  let linhas: number | null = null;
  if (p.linhas != null) {
    if (!numeroNoIntervalo(p.linhas, L.linhas.min, L.linhas.max)) return null;
    linhas = p.linhas;
  }
  return {
    id: p.id,
    nome: p.nome,
    larguraFolhaMm: p.larguraFolhaMm,
    alturaFolhaMm,
    larguraMm: p.larguraMm,
    alturaMm: p.alturaMm,
    colunas: Math.round(p.colunas),
    linhas: linhas === null ? null : Math.round(linhas),
    espacoFileiraMm,
    // Também ausente nos padrões antigos (0); fora do intervalo é limitado, não invalida.
    ajusteVerticalMm: lerAjusteVertical(p),
  };
}

export function normalizarPadroes(bruto: unknown): PadraoEtiqueta[] {
  if (!Array.isArray(bruto)) return [];
  return bruto.map(normalizarPadrao).filter((p): p is PadraoEtiqueta => p !== null);
}
