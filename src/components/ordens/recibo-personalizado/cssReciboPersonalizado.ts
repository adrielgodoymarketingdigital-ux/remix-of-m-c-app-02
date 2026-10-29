/**
 * CSS do recibo A4 PERSONALIZADO da OS. Vai num <style> DENTRO do próprio
 * recibo: assim ele acompanha o HTML quando a impressão do Android copia o
 * recibo para o documento isolado do iframe (handlePrintAndroid só copia
 * regras com certos nomes). Tudo sob .impressao-ordem-container.os-recibo-personalizado
 * e com !important em cada declaração: as regras gerais de index.css e do
 * documento do Android (várias com !important) não alcançam este recibo, e as
 * deste recibo não alcançam o Padrão/Tech. Fonte: a mesma do recibo de sempre
 * (Arial/Helvetica); nada externo.
 */

const R = ".impressao-ordem-container.os-recibo-personalizado";

const AZUL_ESCURO = "#0a1a3f";
const AZUL_ESCURO_2 = "#0f2a6b";
const AZUL = "#1d4ed8";
const AZUL_CLARO = "#60a5fa";
const FUNDO_TITULO = "#eef4ff";
const BORDA = "#e2e8f0";
const TEXTO = "#0f172a";
const TEXTO_SUAVE = "#475569";
const VERDE = "#16a34a";
const VERMELHO = "#dc2626";

const CSS_BASE = `
${R} {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 9pt;
  font-weight: 400;
  line-height: 1.35;
  color: ${TEXTO};
  background: #fff;
  padding: 3mm;
  gap: 3mm;
  display: flex;
  flex-direction: column;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
${R} * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
${R} > * { flex-shrink: 0; }
${R} svg { display: inline-block; vertical-align: middle; }
${R} h1, ${R} h2, ${R} p, ${R} figure { margin: 0; padding: 0; }
${R} h1, ${R} h2 { line-height: 1.2; }

${R} .osr-header {
  display: flex; align-items: stretch; gap: 5mm;
  padding: 4mm 5mm; border-radius: 2.5mm;
  background: linear-gradient(135deg, ${AZUL_ESCURO} 0%, ${AZUL_ESCURO_2} 100%);
  color: #fff;
}
${R} .osr-logo-box {
  width: 34mm; min-height: 22mm; flex-shrink: 0; padding: 2mm;
  border: 0.3mm solid rgba(255,255,255,0.28); border-radius: 2mm; background: rgba(255,255,255,0.06);
  display: flex; align-items: center; justify-content: center; overflow: hidden;
}
${R} .osr-logo-box img { max-width: 100%; max-height: 20mm; object-fit: contain; display: block; }
${R} .osr-logo-nome { font-size: 11pt; font-weight: 800; text-align: center; line-height: 1.15; color: #fff; overflow-wrap: anywhere; }
${R} .osr-titulo-area { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 1mm; }
${R} .osr-titulo { font-size: 17pt; font-weight: 800; letter-spacing: 0.3px; line-height: 1.1; color: #fff; }
${R} .osr-numero { font-size: 13pt; font-weight: 800; color: ${AZUL_CLARO}; overflow-wrap: anywhere; }
${R} .osr-data-status { display: flex; align-items: center; flex-wrap: wrap; gap: 3mm; font-size: 9pt; color: rgba(255,255,255,0.92); }
${R} .osr-status {
  display: inline-flex; align-items: center; gap: 1.5mm; padding: 0.8mm 3mm;
  border: 0.3mm solid rgba(255,255,255,0.85); border-radius: 10mm;
  font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; color: #fff;
}
${R} .osr-status-ponto { width: 2mm; height: 2mm; border-radius: 50%; background: #f59e0b; display: inline-block; flex-shrink: 0; }
${R} .osr-loja {
  width: 64mm; flex-shrink: 0; padding-left: 5mm; border-left: 0.3mm solid rgba(255,255,255,0.28);
  display: flex; flex-direction: column; justify-content: center; gap: 1.2mm;
  font-size: 8.5pt; color: rgba(255,255,255,0.92);
}
${R} .osr-loja-nome { font-size: 9.5pt; font-weight: 800; color: #fff; overflow-wrap: anywhere; }
${R} .osr-loja-linha { display: flex; align-items: flex-start; gap: 2mm; overflow-wrap: anywhere; }
${R} .osr-loja-linha svg { width: 3.5mm; height: 3.5mm; flex-shrink: 0; margin-top: 0.2mm; color: #fff; }

${R} .osr-linha-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; }
${R} .osr-linha-defeito { display: grid; grid-template-columns: 7fr 3fr; gap: 3mm; }
${R} .osr-linha-senha { display: grid; grid-template-columns: 1fr 2fr; gap: 3mm; }

${R} .osr-card { border: 0.3mm solid ${BORDA}; border-radius: 2.5mm; background: #fff; overflow: hidden; break-inside: avoid; page-break-inside: avoid; }
${R} .osr-card-header { display: flex; align-items: center; gap: 2.5mm; padding: 2mm 4mm; background: ${FUNDO_TITULO}; }
${R} .osr-card-header svg { width: 5mm; height: 5mm; flex-shrink: 0; color: ${AZUL}; }
${R} .osr-card-titulo { font-size: 9pt; line-height: 1.25; font-weight: 800; text-transform: uppercase; letter-spacing: 0.3px; color: ${TEXTO}; }
${R} .osr-card-body { padding: 2.5mm 4mm; }
${R} .osr-campo { display: grid; grid-template-columns: 26mm 1fr; gap: 2mm; padding: 1.1mm 0; border-bottom: 0.2mm solid #eef2f7; }
${R} .osr-campo:last-child { border-bottom: 0; }
${R} .osr-campo-cheio { grid-template-columns: 1fr; }
${R} .osr-rotulo { color: ${TEXTO_SUAVE}; }
${R} .osr-valor { font-weight: 700; color: ${TEXTO}; overflow-wrap: anywhere; }
${R} .osr-texto { white-space: pre-wrap; overflow-wrap: anywhere; }

${R} .osr-card-valor .osr-card-header { background: #e9f8ef; }
${R} .osr-card-valor .osr-card-header svg { color: ${VERDE}; }
${R} .osr-valor-body { display: flex; flex-direction: column; align-items: stretch; justify-content: center; min-height: 14mm; }
${R} .osr-valor-total { font-size: 18pt; font-weight: 800; color: ${VERDE}; text-align: center; overflow-wrap: anywhere; }
${R} .osr-valor-linha { display: flex; justify-content: space-between; gap: 2mm; font-size: 8pt; color: ${TEXTO_SUAVE}; }
${R} .osr-valor-linha-desconto { color: ${VERMELHO}; margin-bottom: 1mm; }

${R} .osr-card-senha .osr-card-header { background: #f3effe; }
${R} .osr-card-senha .osr-card-header svg { color: #7c3aed; }
${R} .osr-senha-valor { font-size: 14pt; font-weight: 800; letter-spacing: 0.5px; overflow-wrap: anywhere; }

${R} .osr-checklist { display: grid; grid-template-columns: 1fr 1fr; column-gap: 6mm; }
${R} .osr-check-item { display: flex; align-items: center; gap: 2mm; padding: 0.9mm 0; }
${R} .osr-check-icone { width: 4mm; height: 4mm; flex-shrink: 0; color: #334155; }
${R} .osr-check-rotulo { flex: 1; min-width: 0; }
${R} .osr-check-rotulo::first-letter { text-transform: uppercase; }
${R} .osr-marca { width: 4.2mm; height: 4.2mm; border-radius: 50%; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; }
${R} .osr-marca svg { width: 3mm; height: 3mm; color: #fff; }
${R} .osr-marca-ok { background: ${VERDE}; }
${R} .osr-marca-erro { background: ${VERMELHO}; }
${R} .osr-check-detalhe { font-size: 8pt; font-style: italic; padding-left: 6mm; color: ${TEXTO_SUAVE}; }
${R} .osr-aviso { font-style: italic; margin-bottom: 1.5mm; }

${R} .osr-itens-titulo { font-size: 8pt; font-weight: 700; text-transform: uppercase; color: ${TEXTO_SUAVE}; margin-bottom: 0.8mm; }
${R} .osr-itens + .osr-itens { margin-top: 2mm; }
${R} .osr-item { display: flex; justify-content: space-between; gap: 3mm; padding: 0.9mm 0; border-bottom: 0.2mm dotted #cbd5e1; }
${R} .osr-item:last-child { border-bottom: 0; }
${R} .osr-item-nome { flex: 1; min-width: 0; overflow-wrap: anywhere; }
${R} .osr-item-valor { font-weight: 700; white-space: nowrap; }
${R} .osr-item-obs { font-size: 0.85em; color: #666; margin-left: 4px; }

${R} .osr-fotos { display: grid; gap: 4mm; }
${R} .osr-fotos-2 { grid-template-columns: 1fr 1fr; }
${R} .osr-fotos-3 { grid-template-columns: 1fr 1fr 1fr; }
${R} .osr-foto { break-inside: avoid; page-break-inside: avoid; }
${R} .osr-foto-caixa { height: 52mm; border-radius: 2mm; background: #f8fafc; border: 0.2mm solid ${BORDA}; display: flex; align-items: center; justify-content: center; overflow: hidden; }
${R} .osr-fotos-2 .osr-foto-caixa { height: 62mm; }
${R} .osr-foto-caixa img { max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain; display: block; }
${R} .osr-foto figcaption { text-align: center; font-size: 8.5pt; padding-top: 1.2mm; color: #334155; }
${R} .osr-fotos-excedentes { font-size: 8pt; color: #555; margin-top: 2mm; }

${R} .osr-termo { font-size: 8pt; color: #334155; white-space: pre-line; overflow-wrap: anywhere; }

${R} .osr-assinaturas {
  display: flex; align-items: stretch; margin-top: auto;
  padding: 5mm 2mm 3mm; border-radius: 2.5mm; background: #f1f5f9;
  break-inside: avoid; page-break-inside: avoid;
}
${R} .osr-assinatura { flex: 1; min-width: 0; padding: 0 4mm; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; text-align: center; }
${R} .osr-assinatura + .osr-assinatura { border-left: 0.3mm solid #cbd5e1; }
${R} .osr-assinatura-linha { width: 85%; height: 12mm; border-bottom: 0.3mm solid #334155; margin-bottom: 1.5mm; }
${R} .osr-assinatura-imagem { max-width: 40mm; max-height: 14mm; margin-bottom: 1mm; display: block; }
${R} .osr-assinatura-rotulo { font-size: 8.5pt; color: #334155; }
${R} .osr-assinatura-data { font-size: 8pt; color: #64748b; margin-top: 1mm; }

${R} .osr-avarias .impressao-avarias-container { display: flex; justify-content: center; gap: 4mm; }

/* Dispositivos adicionais: componente compartilhado (DispositivosAdicionaisImpressao),
   usado como está — só o visual é ajustado aqui, por fora. */
${R} .impressao-dispositivos-adicionais { display: flex; flex-direction: column; gap: 3mm; }
${R} .impressao-dispositivos-adicionais .impressao-block { border: 0.3mm solid ${BORDA}; border-left: 0.3mm solid ${BORDA}; border-radius: 2.5mm; overflow: hidden; margin: 0; padding: 0; background: #fff; break-inside: avoid; page-break-inside: avoid; }
${R} .impressao-dispositivos-adicionais .impressao-block-header { display: flex; align-items: center; gap: 2.5mm; padding: 2mm 4mm; margin: 0; background: ${FUNDO_TITULO}; border-bottom: 0; }
${R} .impressao-dispositivos-adicionais .impressao-block-title { font-size: 9pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.3px; color: ${TEXTO}; margin: 0; }
${R} .impressao-dispositivos-adicionais .impressao-icon { width: 5mm; height: 5mm; color: ${AZUL}; }
${R} .impressao-dispositivos-adicionais .impressao-block-content { padding: 2.5mm 4mm; font-size: 9pt; }
${R} .impressao-dispositivos-adicionais .impressao-field { display: flex; gap: 2mm; padding: 0.8mm 0; margin: 0; }
${R} .impressao-dispositivos-adicionais .impressao-label { color: ${TEXTO_SUAVE}; font-size: 9pt; font-weight: 400; }
${R} .impressao-dispositivos-adicionais .impressao-value { color: ${TEXTO}; font-size: 9pt; font-weight: 700; }
${R} .impressao-dispositivos-adicionais .impressao-grid-adaptativo { display: grid; grid-template-columns: repeat(auto-fill, minmax(55mm, 1fr)); gap: 3mm; margin-top: 2mm; }
${R} .impressao-dispositivos-adicionais .impressao-checklist { display: grid; grid-template-columns: 1fr 1fr; gap: 0.8mm 3mm; }
${R} .impressao-dispositivos-adicionais .impressao-checklist-item { display: flex; align-items: center; gap: 1.5mm; font-size: 8.5pt; }
${R} .impressao-dispositivos-adicionais .impressao-checklist-icon { width: 3.5mm; height: 3.5mm; color: #334155; }
${R} .impressao-dispositivos-adicionais .impressao-check-ok { width: 3.8mm; height: 3.8mm; color: ${VERDE}; }
${R} .impressao-dispositivos-adicionais .impressao-check-erro { width: 3.8mm; height: 3.8mm; color: ${VERMELHO}; }

@media print {
  ${R} {
    width: 194mm; max-width: 194mm; min-height: 0; height: auto;
    max-height: none; overflow: visible; padding: 0; margin: 0;
    font-size: 9pt; font-weight: 400; color: ${TEXTO};
  }
  ${R} .osr-header, ${R} .osr-card, ${R} .osr-linha-2, ${R} .osr-linha-defeito,
  ${R} .osr-linha-senha, ${R} .osr-assinaturas, ${R} .osr-foto { break-inside: avoid; page-break-inside: avoid; }
  ${R} .osr-assinaturas { margin-top: 0; }
}
`;

/** Põe !important em cada declaração (o recibo não pode herdar nada das regras gerais). */
function comImportant(css: string): string {
  return css.replace(/([a-z-]+\s*:\s*[^;{}]+?)\s*;/g, (_, declaracao: string) =>
    declaracao.includes("!important") ? `${declaracao};` : `${declaracao} !important;`,
  );
}

export const CSS_RECIBO_PERSONALIZADO = comImportant(CSS_BASE);
