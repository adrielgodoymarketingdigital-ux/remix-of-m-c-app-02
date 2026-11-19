/**
 * Recibo A4 PERSONALIZADO da OS em uma folha: regra pura que escolhe quanto
 * compactar, a partir das alturas MEDIDAS do recibo (mm) em cada nível.
 * Sem import nenhum (testável no Deno).
 *
 * Níveis (cumulativos; o CSS de cada um está em cssReciboPersonalizado.ts):
 *   0 = recibo de sempre (HTML e CSS idênticos aos de antes);
 *   1 = menos espaçamento (fonte igual);
 *   2 = nível 1 + desenhos das avarias menores;
 *   3 = nível 2 + fonte um pouco menor (texto 8 pt, termo 7,5 pt).
 * Vale o PRIMEIRO nível cuja altura cabe em LIMITE_UMA_FOLHA_MM.
 *
 * Se nem o nível 3 couber: volta ao nível 0 e o recibo sai em 2 folhas, com o
 * bloco final (termo de garantia + assinaturas) inteiro e, quando cabe junto,
 * levando o bloco anterior — para a folha 2 nunca ficar só com a garantia.
 *
 * Qualquer medida ausente ou inválida = recibo de sempre (nível 0, sem
 * agrupamento). Nunca se esconde conteúdo.
 */

/** Folha A4 com 8 mm de margem tem 281 mm; o Android ainda tira 2 × 4 mm (273). Margem de segurança: 270. */
export const LIMITE_UMA_FOLHA_MM = 270;

export const NIVEL_MAXIMO_COMPACTACAO = 3;
export type NivelCompactacao = 0 | 1 | 2 | 3;

/** Como o fim do recibo vai para a folha 2 quando nem compactado cabe. */
export type AgrupamentoFinal =
  | "nenhum" // recibo de sempre
  | "final" // termo + assinaturas inteiros, juntos
  | "anteriorEFinal"; // o bloco anterior + termo + assinaturas, juntos

export type MotivoCompactacao =
  | "cabe" // cabe sem compactar
  | "compactado" // cabe num dos níveis 1 a 3
  | "duasFolhas" // nem o nível 3 cabe
  | "medicaoInvalida" // alguma medida faltou ou não faz sentido
  | "finalMaiorQueFolha"; // termo + assinaturas sozinhos não cabem numa folha

export interface DecisaoCompactacao {
  nivel: NivelCompactacao;
  agrupamento: AgrupamentoFinal;
  motivo: MotivoCompactacao;
}

export interface MedidasCompactacao {
  /** Altura total do recibo (mm) nos níveis 0, 1, 2 e 3, nessa ordem. */
  alturasPorNivel: readonly (number | null | undefined)[];
  /** Do topo do termo (ou das assinaturas, sem termo) ao fim do recibo, no nível 0. null = não há bloco final. */
  alturaFinalMm: number | null | undefined;
  /** Do topo do bloco anterior ao bloco final até o fim do recibo, no nível 0. */
  alturaAnteriorEFinalMm: number | null | undefined;
}

/** O recibo de sempre. */
export const SEM_COMPACTACAO: DecisaoCompactacao = Object.freeze({ nivel: 0, agrupamento: "nenhum", motivo: "medicaoInvalida" }) as DecisaoCompactacao;

function valida(mm: number | null | undefined): mm is number {
  return typeof mm === "number" && Number.isFinite(mm) && mm > 0;
}

export function decidirCompactacao(medidas: MedidasCompactacao, limiteMm: number = LIMITE_UMA_FOLHA_MM): DecisaoCompactacao {
  const alturas = medidas.alturasPorNivel;
  if (alturas.length !== NIVEL_MAXIMO_COMPACTACAO + 1) return SEM_COMPACTACAO;
  for (const altura of alturas) if (!valida(altura)) return SEM_COMPACTACAO;

  for (let nivel = 0; nivel <= NIVEL_MAXIMO_COMPACTACAO; nivel++) {
    if ((alturas[nivel] as number) <= limiteMm) {
      return { nivel: nivel as NivelCompactacao, agrupamento: "nenhum", motivo: nivel === 0 ? "cabe" : "compactado" };
    }
  }

  // Nem o nível 3 cabe: 2 folhas, no nível 0.
  const final = medidas.alturaFinalMm;
  if (final === null) return { nivel: 0, agrupamento: "nenhum", motivo: "duasFolhas" }; // sem termo nem assinaturas: nada a proteger
  if (!valida(final)) return SEM_COMPACTACAO;
  if (final > limiteMm) return { nivel: 0, agrupamento: "nenhum", motivo: "finalMaiorQueFolha" };
  const comAnterior = medidas.alturaAnteriorEFinalMm;
  if (!valida(comAnterior) || comAnterior < final) return SEM_COMPACTACAO;
  return { nivel: 0, agrupamento: comAnterior <= limiteMm ? "anteriorEFinal" : "final", motivo: "duasFolhas" };
}

/** A decisão muda alguma coisa no recibo? (nível 0 sem agrupamento = recibo de sempre) */
export function decisaoMudaRecibo(decisao: DecisaoCompactacao | null | undefined): boolean {
  return !!decisao && (decisao.nivel > 0 || decisao.agrupamento !== "nenhum");
}
