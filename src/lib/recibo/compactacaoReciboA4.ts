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

export function cssCompactacaoReciboA4(termico: boolean): string {
  if (termico) return "";
  const fonteTermos = Math.max(FONTE_MINIMA_TERMOS_PX, FONTE_TERMOS_A4_PX);
  return `
    /* A4 em uma página (src/lib/recibo/compactacaoReciboA4.ts): só espaçamento. */
    body { padding: 0; }
    .recibo-section { margin-bottom: 8px; }
    .recibo-section h3 { padding-bottom: 1mm; margin-bottom: 1mm; }
    .recibo-info { margin: 0.4mm 0; page-break-inside: avoid; break-inside: avoid; }
    .recibo-checklist { margin-top: 1mm; gap: 3px 14px; }
    .termos-garantia { font-size: ${fonteTermos}px; line-height: 1.3; }
    /* Assinaturas: o espaçamento vem no style embutido (margin-top: 40px). */
    div[style*="margin-top: 40px"] { margin-top: ${ESPACO_ASSINATURA_A4_PX}px !important; }`;
}
