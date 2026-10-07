/**
 * Grade de etiquetas numa folha/rolo e o CSS de impressão dela (@page + grade).
 * Recebe medidas já resolvidas (largura, altura, colunas, linhas, margens e
 * espaços) e devolve a posição/tamanho de cada etiqueta na página e o CSS.
 * Tudo em mm e sem escala (impressão a 100%). Sem React nem navegador (testado
 * com Deno em scripts/testes-etiquetas/). As margens e espaços de um padrão
 * salvo saem de calcularLayoutFolha (etiquetasProduto.ts).
 */

export interface MedidasFolha {
  larguraFolhaMm: number;
  alturaFolhaMm: number;
  larguraMm: number;
  alturaMm: number;
  colunas: number;
  /** Linhas por página. */
  linhas: number;
  margemEsquerdaMm: number;
  margemSuperiorMm: number;
  /** Espaço entre colunas. */
  gapColunasMm: number;
  /** Espaço entre linhas. */
  gapLinhasMm: number;
}

export interface PosicaoEtiqueta {
  /** 0-based, da esquerda para a direita, de cima para baixo. */
  indice: number;
  coluna: number;
  linha: number;
  xMm: number;
  yMm: number;
  larguraMm: number;
  alturaMm: number;
}

export interface GradeFolha {
  medidas: MedidasFolha;
  posicoes: PosicaoEtiqueta[];
  /** Só a regra @page (tamanho do papel, sem margem). */
  cssPage: string;
}

export class ErroLayoutFolha extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroLayoutFolha";
  }
}

// Folga para arredondamento de ponto flutuante (0,001 mm).
const FOLGA_MM = 0.001;
const arred = (v: number) => Math.round(v * 1000) / 1000 + 0;
/** "107.00mm": formato usado no CSS de impressão. */
export const mmCss = (v: number) => `${v.toFixed(2)}mm`;

function validar(m: MedidasFolha): void {
  const positivo = (v: number, nome: string) => {
    if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) throw new ErroLayoutFolha(`${nome} deve ser maior que zero (recebido: ${v}).`);
  };
  const naoNegativo = (v: number, nome: string) => {
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) throw new ErroLayoutFolha(`${nome} não pode ser negativo(a) (recebido: ${v}).`);
  };
  const inteiroPositivo = (v: number, nome: string) => {
    if (!Number.isInteger(v) || v < 1) throw new ErroLayoutFolha(`${nome} deve ser um número inteiro a partir de 1 (recebido: ${v}).`);
  };
  positivo(m.larguraFolhaMm, "Largura da folha");
  positivo(m.alturaFolhaMm, "Altura da folha");
  positivo(m.larguraMm, "Largura da etiqueta");
  positivo(m.alturaMm, "Altura da etiqueta");
  inteiroPositivo(m.colunas, "Colunas");
  inteiroPositivo(m.linhas, "Linhas");
  naoNegativo(m.margemEsquerdaMm, "Margem esquerda");
  naoNegativo(m.margemSuperiorMm, "Margem superior");
  naoNegativo(m.gapColunasMm, "Espaço entre colunas");
  naoNegativo(m.gapLinhasMm, "Espaço entre linhas");

  const larguraUsada = m.margemEsquerdaMm + m.colunas * m.larguraMm + (m.colunas - 1) * m.gapColunasMm;
  if (larguraUsada > m.larguraFolhaMm + FOLGA_MM) {
    throw new ErroLayoutFolha(`${m.colunas} colunas ocupam ${arred(larguraUsada)}mm e a folha tem ${m.larguraFolhaMm}mm de largura.`);
  }
  const alturaUsada = m.margemSuperiorMm + m.linhas * m.alturaMm + (m.linhas - 1) * m.gapLinhasMm;
  if (alturaUsada > m.alturaFolhaMm + FOLGA_MM) {
    throw new ErroLayoutFolha(`${m.linhas} linhas ocupam ${arred(alturaUsada)}mm e a folha tem ${m.alturaFolhaMm}mm de altura.`);
  }
}

/** Posição e tamanho de cada etiqueta numa página. Medida inválida → ErroLayoutFolha. */
export function calcularGradeFolha(medidas: MedidasFolha): GradeFolha {
  validar(medidas);
  const m = medidas;
  const posicoes: PosicaoEtiqueta[] = [];
  for (let linha = 0; linha < m.linhas; linha++) {
    for (let coluna = 0; coluna < m.colunas; coluna++) {
      posicoes.push({
        indice: linha * m.colunas + coluna,
        coluna,
        linha,
        xMm: arred(m.margemEsquerdaMm + coluna * (m.larguraMm + m.gapColunasMm)),
        yMm: arred(m.margemSuperiorMm + linha * (m.alturaMm + m.gapLinhasMm)),
        larguraMm: m.larguraMm,
        alturaMm: m.alturaMm,
      });
    }
  }
  return { medidas: m, posicoes, cssPage: `@page { size: ${mmCss(m.larguraFolhaMm)} ${mmCss(m.alturaFolhaMm)}; margin: 0; }` };
}

/**
 * CSS de impressão da grade: @page do tamanho do papel (margem 0, sem escala) e
 * uma .etq-folha por página com colunas de largura FIXA em mm (nunca fr/100%)
 * alinhadas ao início — a etiqueta não estica e cada coluna fica exatamente na
 * posição calculada. Margem direita/inferior = o que sobra da página.
 */
export function montarCssGradeFolha(grade: GradeFolha): string {
  const m = grade.medidas;
  const mm = mmCss;
  return `
    ${grade.cssPage}
    .etq-folha {
      width: ${mm(m.larguraFolhaMm)}; height: ${mm(m.alturaFolhaMm)}; box-sizing: border-box; overflow: hidden;
      padding: ${mm(m.margemSuperiorMm)} 0 0 ${mm(m.margemEsquerdaMm)}; margin: 0;
      display: grid; grid-template-columns: repeat(${m.colunas}, ${mm(m.larguraMm)}); grid-auto-rows: ${mm(m.alturaMm)};
      column-gap: ${mm(m.gapColunasMm)}; row-gap: ${mm(m.gapLinhasMm)};
      justify-content: start; align-content: start;
      page-break-after: always; break-after: page;
    }
    .etq-folha:last-child { page-break-after: auto; break-after: auto; }
    .etq-celula {
      width: ${mm(m.larguraMm)}; height: ${mm(m.alturaMm)}; overflow: hidden;
      page-break-inside: avoid; break-inside: avoid;
    }
    /* iOS imprime via #print-root, cujo CSS global de impressão força width:100% e overflow:visible. */
    #print-root .etq-folha { width: ${mm(m.larguraFolhaMm)} !important; }
    #print-root .etq-folha, #print-root .etq-celula, #print-root .etq-etiqueta,
    #print-root .etq-nome, #print-root .etq-linha, #print-root .etq-loja { overflow: hidden !important; }
  `;
}
