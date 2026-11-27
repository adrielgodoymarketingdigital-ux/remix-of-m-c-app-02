/**
 * Recibo de venda / termo de garantia de DISPOSITIVO em A4 numa folha só:
 * regra pura que escolhe quanto compactar a partir das alturas MEDIDAS do
 * documento (mm) em cada nível. Sem import nenhum (testável no Deno).
 * Mesma ideia do recibo personalizado da OS (lib/ordemServico/compactacaoReciboPersonalizado.ts).
 *
 * Níveis (cumulativos):
 *   0 = documento de sempre (PDF, HTML e CSS idênticos aos de antes);
 *   1 = menos espaçamento vertical (fonte igual);
 *   2 = nível 1 + fonte das linhas e do termo um pouco menor (termo nunca abaixo de 7 pt).
 * Vale o PRIMEIRO nível cuja altura cabe no limite da folha.
 *
 * Se nem o nível 2 couber: volta ao nível 0 e o documento sai em mais de uma
 * folha, com o fim do termo de garantia JUNTO das assinaturas — a folha das
 * assinaturas nunca fica só com elas (nem só com o rodapé).
 *
 * Qualquer medida ausente ou inválida = documento de sempre (nível 0, sem
 * agrupamento). Nunca se esconde conteúdo: só espaçamento e fonte.
 */

/**
 * PDF (jsPDF, mm): altura = Y logo depois das assinaturas. O conteúdo vai até
 * 280 mm (verificarNovaPagina) e o rodapé começa em 281 mm; 4 mm de folga.
 */
export const LIMITE_UMA_FOLHA_PDF_MM = 276;
/** PDF: área de conteúdo de uma folha (de 15 mm a 280 mm) — o bloco "fim do termo + assinaturas" tem de caber nela. */
export const AREA_CONTEUDO_PDF_MM = 265;

/**
 * HTML (mm): folha A4 com @page de 10 mm tem 277 mm úteis; o Android ainda tira
 * 2 × 4 mm (269). Margem de segurança: 265.
 */
export const LIMITE_UMA_FOLHA_HTML_MM = 265;

export const NIVEL_MAXIMO_COMPACTACAO = 2;
export type NivelCompactacao = 0 | 1 | 2;

export type MotivoCompactacao =
  | "cabe" // cabe sem compactar
  | "compactado" // cabe no nível 1 ou 2
  | "duasFolhas" // nem o nível 2 cabe: nível 0 + fim do termo junto das assinaturas
  | "finalMaiorQueFolha" // o bloco final sozinho não cabe numa folha: documento de sempre
  | "medicaoInvalida"; // alguma medida faltou ou não faz sentido

export interface DecisaoCompactacao {
  nivel: NivelCompactacao;
  /** Fim do termo + assinaturas num bloco só (só quando nem compactado cabe). */
  agruparFinal: boolean;
  motivo: MotivoCompactacao;
}

export interface MedidasCompactacao {
  /** Altura do documento inteiro (mm) nos níveis 0, 1 e 2, nessa ordem. */
  alturasPorNivel: readonly (number | null | undefined)[];
  /** Altura (mm), no nível 0, do bloco que vai junto das assinaturas (fim do termo + assinaturas + o que vem depois). */
  alturaFinalMm: number | null | undefined;
}

/** O documento de sempre. */
export const SEM_COMPACTACAO: DecisaoCompactacao = Object.freeze({ nivel: 0, agruparFinal: false, motivo: "medicaoInvalida" }) as DecisaoCompactacao;

function valida(mm: number | null | undefined): mm is number {
  return typeof mm === "number" && Number.isFinite(mm) && mm > 0;
}

/**
 * @param limiteMm altura máxima de UMA folha (LIMITE_UMA_FOLHA_PDF_MM ou LIMITE_UMA_FOLHA_HTML_MM)
 * @param areaFolhaMm espaço de uma folha inteira para o bloco final (padrão = limiteMm)
 */
export function decidirCompactacao(medidas: MedidasCompactacao | null | undefined, limiteMm: number, areaFolhaMm: number = limiteMm): DecisaoCompactacao {
  const alturas = medidas?.alturasPorNivel;
  if (!alturas || alturas.length !== NIVEL_MAXIMO_COMPACTACAO + 1) return SEM_COMPACTACAO;
  for (const altura of alturas) if (!valida(altura)) return SEM_COMPACTACAO;
  if (!valida(limiteMm) || !valida(areaFolhaMm)) return SEM_COMPACTACAO;

  for (let nivel = 0; nivel <= NIVEL_MAXIMO_COMPACTACAO; nivel++) {
    if ((alturas[nivel] as number) <= limiteMm) {
      return { nivel: nivel as NivelCompactacao, agruparFinal: false, motivo: nivel === 0 ? "cabe" : "compactado" };
    }
  }

  // Nem o nível 2 cabe: mais de uma folha, no nível 0.
  const final = medidas.alturaFinalMm;
  if (!valida(final)) return SEM_COMPACTACAO;
  if (final > areaFolhaMm) return { nivel: 0, agruparFinal: false, motivo: "finalMaiorQueFolha" };
  return { nivel: 0, agruparFinal: true, motivo: "duasFolhas" };
}

/** A decisão muda alguma coisa no documento? (nível 0 sem agrupamento = documento de sempre) */
export function decisaoMudaDocumento(decisao: DecisaoCompactacao | null | undefined): boolean {
  return !!decisao && (decisao.nivel > 0 || decisao.agruparFinal);
}

// ===================== PDF (gerarReciboVendaPDF, só A4) =====================

/** Medidas do PDF A4 por nível (mm e pt). Nível 0 = os números de sempre do arquivo. */
export interface EscalaPDFA4 {
  /** Distância entre linhas de campo (Nome, Aparelho...). */
  passoLinha: number;
  fonteLinhaPt: number;
  /** Distância entre linhas do termo. */
  passoTermo: number;
  fonteTermoPt: number;
  /** Do topo de um título de seção (caixa de 6 mm) até a 1ª linha. */
  avancoTitulo: number;
  /** Espaço depois da faixa de data/pagamento/total. */
  aposFaixa: number;
  /** Espaço depois de cada seção (comprador, produto, troca). */
  aposSecao: number;
  /** Espaço depois do termo. */
  aposTermo: number;
  /** Espaço depois do VALOR TOTAL. */
  aposTotal: number;
  /** Espaço antes da linha das assinaturas. */
  antesAssinaturas: number;
}

export const ESCALAS_PDF_A4: readonly EscalaPDFA4[] = Object.freeze([
  { passoLinha: 5, fonteLinhaPt: 9, passoTermo: 4, fonteTermoPt: 8, avancoTitulo: 9, aposFaixa: 6, aposSecao: 3, aposTermo: 6, aposTotal: 10, antesAssinaturas: 10 },
  { passoLinha: 4.4, fonteLinhaPt: 9, passoTermo: 3.5, fonteTermoPt: 8, avancoTitulo: 8.5, aposFaixa: 4, aposSecao: 1.5, aposTermo: 3, aposTotal: 8, antesAssinaturas: 7 },
  { passoLinha: 4, fonteLinhaPt: 8.5, passoTermo: 3.1, fonteTermoPt: 7, avancoTitulo: 8.2, aposFaixa: 4, aposSecao: 1.5, aposTermo: 3, aposTotal: 8, antesAssinaturas: 7 },
]);

/** Menor fonte permitida para o corpo do termo (pt). */
export const FONTE_MINIMA_TERMO_PT = 7;

/**
 * Quantas linhas do FIM do termo vão para a folha das assinaturas quando nem
 * compactado cabe numa folha: o último bloco (depois da última linha em
 * branco), estendido para trás, bloco a bloco, até ter pelo menos `minimo`
 * linhas com texto; termo sem linha em branco = o termo inteiro. Nunca passa
 * de `maximo` (o que cabe numa folha junto das assinaturas); 0 = nada a fazer.
 */
export function linhasDoBlocoFinal(linhas: readonly string[], maximo: number, minimo = 3): number {
  const total = linhas.length;
  if (!total || !Number.isFinite(maximo) || maximo < 1) return 0;
  const comTexto = (de: number) => linhas.slice(de).filter((l) => l.trim() !== "").length;
  let inicio = total;
  // Sobe até a linha em branco anterior; repete enquanto o bloco tiver menos de `minimo` linhas com texto.
  do {
    let i = inicio - 1;
    while (i >= 0 && linhas[i].trim() === "") i--; // linhas em branco no fim do bloco
    while (i >= 0 && linhas[i].trim() !== "") i--; // o bloco
    inicio = i + 1;
  } while (inicio > 0 && comTexto(inicio) < minimo);
  return Math.min(total - inicio, Math.floor(maximo));
}

// ===================== HTML antigo (DialogReimprimirReciboVenda, só A4) =====================

/** Classe do bloco "último termo + assinaturas" (só existe quando agruparFinal). */
export const CLASSE_FINAL_JUNTO = "recibo-print-final-junto";

/**
 * CSS a mais do HTML A4 antigo por nível (vem depois do CSS de sempre e ganha
 * dele). Nível 0 = nada. O termo do HTML já é 9px (≈ 6,75 pt): a fonte dele
 * NÃO diminui em nível nenhum, só o espaço entre as linhas.
 */
export function cssCompactacaoReciboDispositivoA4(decisao: DecisaoCompactacao | null | undefined): string {
  if (!decisaoMudaDocumento(decisao)) return "";
  const partes: string[] = [];
  const nivel = decisao!.nivel;
  if (nivel >= 1) {
    partes.push(`
    /* Compactação nível 1: menos espaçamento */
    .recibo-print-header { padding: 7px 12px; }
    .recibo-print-faixa-data { margin-bottom: 5px; }
    .recibo-print-grid-2col { gap: 6px; margin-bottom: 5px; }
    .recibo-print-card-body { padding: 5px 10px; }
    .recibo-print-field { margin-bottom: 3px; }
    .recibo-print-tabela-dispositivos th, .recibo-print-tabela-dispositivos td { padding: 2px 6px; }
    .recibo-print-termo-box { margin-bottom: 5px !important; }
    .recibo-print-termo-header { padding: 4px 10px; }
    .recibo-print-termo-body { padding: 6px 10px; line-height: 1.45; }
    .recibo-print-assinaturas { margin-top: 6px; padding-top: 6px; }`);
  }
  if (nivel >= 2) {
    partes.push(`
    /* Compactação nível 2: linhas um pouco menores (termo continua 9px) */
    .recibo-print-header-loja h1 { font-size: 13px; }
    .recibo-print-field-value { font-size: 10px; }
    .recibo-print-field-value.recibo-print-destaque { font-size: 12px; }
    .recibo-print-termo-body { line-height: 1.35; }`);
  }
  if (decisao!.agruparFinal) {
    partes.push(`
    /* Último termo + assinaturas na mesma folha */
    .${CLASSE_FINAL_JUNTO} { page-break-inside: avoid; break-inside: avoid; }`);
  }
  return partes.join("\n");
}

/** Marcador do último termo no HTML antigo (o termo de cada aparelho começa assim). */
const INICIO_TERMO = '<div class="recibo-print-termo-box"';

/**
 * HTML do corpo com o ÚLTIMO termo e as assinaturas (o fim do corpo) dentro de
 * um bloco que não se parte entre folhas. Sem termo = corpo de sempre.
 */
export function agruparTermoFinalEAssinaturas(bodyHtml: string): string {
  const i = bodyHtml.lastIndexOf(INICIO_TERMO);
  if (i < 0) return bodyHtml;
  return `${bodyHtml.slice(0, i)}<div class="${CLASSE_FINAL_JUNTO}">${bodyHtml.slice(i)}</div>`;
}

/** Corpo + CSS finais do HTML A4 antigo para a decisão (nível 0 sem agrupamento = os de sempre, byte a byte). */
export function aplicarCompactacaoReciboDispositivoA4(
  doc: { css: string; body: string },
  decisao: DecisaoCompactacao | null | undefined,
): { css: string; body: string } {
  if (!decisaoMudaDocumento(decisao)) return doc;
  return {
    css: doc.css + cssCompactacaoReciboDispositivoA4(decisao),
    body: decisao!.agruparFinal ? agruparTermoFinalEAssinaturas(doc.body) : doc.body,
  };
}

// ===================== HTML do recibo novo (kit recibo-novo, só A4) =====================
// O recibo novo já tem a sua compactação de impressão (@media print do
// cssReciboVendaNovo): aqui só entra o agrupamento do fim, quando ele não cabe
// numa folha — a última garantia + textos + assinaturas + rodapé num bloco só.

/** Classe do bloco "última garantia + assinaturas + rodapé" do recibo novo. */
export const CLASSE_FINAL_JUNTO_RECIBO_NOVO = "rvn-final-junto";

export const CSS_FINAL_JUNTO_RECIBO_NOVO = `
.${CLASSE_FINAL_JUNTO_RECIBO_NOVO} { page-break-inside: avoid; break-inside: avoid; }
`;

const INICIO_GARANTIA_NOVO = '<section class="rvn-painel rvn-garantia">';
const INICIO_ASSINATURAS_NOVO = '<section class="rvn-assinaturas">';
const INICIO_RODAPE_NOVO = '<footer class="rvn-rodape">';

/**
 * HTML do recibo novo com a ÚLTIMA garantia, o que vem depois dela e as
 * assinaturas (e o rodapé logo em seguida, se houver) num bloco que não se
 * parte. Sem garantia ou sem assinaturas = HTML de sempre.
 */
export function agruparGarantiaFinalReciboNovo(html: string): string {
  const inicio = html.lastIndexOf(INICIO_GARANTIA_NOVO);
  const assinaturas = html.indexOf(INICIO_ASSINATURAS_NOVO, inicio);
  if (inicio < 0 || assinaturas < 0) return html;
  let fim = html.indexOf("</section>", assinaturas);
  if (fim < 0) return html;
  fim += "</section>".length;
  const rodape = html.indexOf(INICIO_RODAPE_NOVO, fim);
  if (rodape >= 0 && html.slice(fim, rodape).trim() === "") {
    const fimRodape = html.indexOf("</footer>", rodape);
    if (fimRodape >= 0) fim = fimRodape + "</footer>".length;
  }
  return `${html.slice(0, inicio)}<div class="${CLASSE_FINAL_JUNTO_RECIBO_NOVO}">${html.slice(inicio, fim)}</div>${html.slice(fim)}`;
}

/**
 * Decisão do recibo novo a partir da altura medida (mm) e do bloco final (mm):
 * cabe = nada muda; não cabe = agrupa o fim (sem níveis de compactação aqui).
 */
export function decidirAgrupamentoReciboNovo(alturaMm: number | null | undefined, finalMm: number | null | undefined, limiteMm: number = LIMITE_UMA_FOLHA_HTML_MM): DecisaoCompactacao {
  return decidirCompactacao({ alturasPorNivel: [alturaMm, alturaMm, alturaMm], alturaFinalMm: finalMm }, limiteMm);
}

/**
 * CSS de medição do recibo novo: o CSS de impressão com o @media print valendo
 * na tela (a medição roda num iframe escondido, não na impressão).
 */
export function cssMedicaoReciboNovo(cssImpressao: string): string {
  return cssImpressao.replace(/@media print\b/g, "@media all");
}
