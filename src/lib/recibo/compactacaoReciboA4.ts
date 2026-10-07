/**
 * Compactação do recibo de venda em A4 (reimpressão do histórico de Vendas)
 * para a venda de um aparelho caber em UMA página. Só espaçamento: nenhuma
 * palavra muda, e cabeçalho, bloco da troca e VALOR TOTAL ficam como estão.
 * Ordem do enxugamento: margens/entrelinhas primeiro; a letra dos termos só
 * diminuiria depois, e nunca abaixo de FONTE_MINIMA_TERMOS_PX.
 * Térmico (58/80mm): string vazia — o CSS do cupom não muda.
 * Vem DEPOIS do CSS base do recibo (mesma especificidade: a regra posterior vale).
 * Sem React nem navegador: testado com Deno em scripts/testes-recibo-cabecalho/.
 */

/** Menor letra aceita nos termos de garantia (≈ 6pt). */
export const FONTE_MINIMA_TERMOS_PX = 8;

/** Letra dos termos no A4 compacto (a de antes era 10px; não foi preciso reduzir). */
export const FONTE_TERMOS_A4_PX = 10;

/** Espaço acima de cada linha de assinatura (antes: 40px, no style embutido). */
export const ESPACO_ASSINATURA_A4_PX = 16;

/** Recibo compactado: a reimpressão do histórico de Vendas ou o recibo do PDV. */
export type ReciboCompactado = "vendas" | "pdv";

/**
 * Regras comuns aos dois recibos + as de cada um. Títulos e linhas do PDV têm
 * margem no style embutido: por isso as regras comuns de título/linha levam
 * !important (no recibo de Vendas não há style embutido nelas — mesmo efeito).
 * Totais (VALOR TOTAL / resumo), cabeçalho e bloco da troca ficam de fora.
 */
export function cssCompactacaoReciboA4(termico: boolean, recibo: ReciboCompactado = "vendas"): string {
  if (termico) return "";
  const fonteTermos = Math.max(FONTE_MINIMA_TERMOS_PX, FONTE_TERMOS_A4_PX);
  const comum = `
    /* A4 compacto (src/lib/recibo/compactacaoReciboA4.ts): só espaçamento. */
    body { padding: 0; }
    .recibo-section { margin-bottom: 8px; }
    .recibo-section h3 { padding-bottom: 1mm !important; margin-bottom: 1mm !important; }
    .recibo-info { margin: 0.4mm 0 !important; page-break-inside: avoid; break-inside: avoid; }
    /* Assinaturas: o espaçamento vem no style embutido (margin-top: 40px); linha e nome nunca se separam. */
    div[style*="margin-top: 40px"] { margin-top: ${ESPACO_ASSINATURA_A4_PX}px !important; page-break-inside: avoid; break-inside: avoid; }`;
  if (recibo === "pdv") {
    // Termo do PDV já usa a letra mínima (8px): só a entrelinha diminui.
    return `${comum}
    .item-venda { padding: 3px 0; page-break-inside: avoid; break-inside: avoid; }
    .termo-garantia-pdv-section { margin-bottom: 4px; }
    .termo-garantia-pdv-texto { line-height: 1.3; }`;
  }
  return `${comum}
    .recibo-checklist { margin-top: 1mm; gap: 3px 14px; }
    .termos-garantia { font-size: ${fonteTermos}px; line-height: 1.3; }`;
}
