/**
 * CSS do recibo de venda no layout novo (ReciboVendaNovo). Só classes rvn-*,
 * sem fonte remota (Inter se estiver instalada, Arial de reserva) — a
 * impressão copia o HTML do recibo para outra janela junto com este CSS.
 *
 * paraImpressao: acrescenta @page A4 (margem 10mm) e o corpo da página de
 * impressão; na prévia dentro do app fica de fora (não mexe na página).
 */
export interface OpcoesCssReciboVendaNovo {
  paraImpressao?: boolean;
}

export function cssReciboVendaNovo(opcoes: OpcoesCssReciboVendaNovo = {}): string {
  const impressao = opcoes.paraImpressao
    ? `
@page { size: A4 portrait; margin: 10mm; }
html, body { margin: 0; padding: 0; background: #ffffff; }
`
    : "";
  return `${impressao}
.rvn {
  --rvn-navy: #0b1429;
  --rvn-navy-2: #143763;
  --rvn-azul: #1f63f0;
  --rvn-azul-escuro: #1254d7;
  --rvn-ciano: #18a0e8;
  --rvn-tinta: #101b33;
  --rvn-cinza: #5f6f8c;
  --rvn-linha: #e0e8f3;
  --rvn-palido: #f1f6ff;
  --rvn-fundo: #f6f9fd;
  --rvn-laranja: #d97800;
  --rvn-laranja-fundo: #fff1d8;
  --rvn-verde: #0f8a4b;
  --rvn-verde-fundo: #e3f6ec;
  --rvn-vermelho: #c62828;
  --rvn-vermelho-fundo: #fde7e7;
  box-sizing: border-box;
  max-width: 850px;
  margin: 0 auto;
  background: #ffffff;
  color: var(--rvn-tinta);
  font-family: Inter, Arial, Helvetica, sans-serif;
  font-size: 13px;
  line-height: 1.4;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 14px 50px rgba(21, 36, 64, 0.1);
  text-align: left;
}
.rvn *, .rvn *::before, .rvn *::after { box-sizing: border-box; }
.rvn p { margin: 0; }
.rvn svg { flex-shrink: 0; }
.rvn-icone { width: 18px; height: 18px; }
.rvn-muted { color: var(--rvn-cinza); }
.rvn-direita { text-align: right; }
.rvn-negrito { font-weight: 700; }

/* Cabeçalho escuro com borda curva */
.rvn-cab {
  position: relative;
  background: linear-gradient(115deg, var(--rvn-navy), var(--rvn-navy-2));
  color: #ffffff;
  padding: 26px 32px 46px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.35fr) auto;
  gap: 24px;
  align-items: center;
}
.rvn-cab--sem-qr { grid-template-columns: minmax(0, 1fr) minmax(0, 1.6fr); }
.rvn-cab-curva { position: absolute; left: 0; right: 0; bottom: -1px; width: 100%; height: 34px; display: block; }
.rvn-cab-marca { display: flex; align-items: center; justify-content: center; min-height: 90px; }
.rvn-cab-logo {
  background: #ffffff;
  border-radius: 12px;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  max-width: 100%;
}
.rvn-cab-logo img { display: block; max-width: 210px; max-height: 84px; width: auto; height: auto; object-fit: contain; }
.rvn-cab-nome { font-size: 30px; font-weight: 800; letter-spacing: -0.5px; line-height: 1.1; text-align: center; overflow-wrap: anywhere; }
.rvn-cab-contatos {
  border-left: 1px solid rgba(255, 255, 255, 0.25);
  padding-left: 22px;
  display: flex;
  flex-direction: column;
  gap: 7px;
  font-size: 12px;
  min-width: 0;
}
.rvn-cab-contatos:first-child { border-left: 0; padding-left: 0; }
.rvn-contato { display: flex; align-items: flex-start; gap: 10px; overflow-wrap: anywhere; }
.rvn-contato .rvn-icone { width: 16px; height: 16px; margin-top: 1px; color: #7cc4ff; }
.rvn-cab-qr {
  border-left: 1px solid rgba(255, 255, 255, 0.25);
  padding-left: 22px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  text-align: center;
}
.rvn-qr-caixa { background: #ffffff; border-radius: 10px; padding: 7px; line-height: 0; }
.rvn-qr-caixa svg { width: 84px; height: 84px; display: block; }
.rvn-qr-legenda { font-size: 10px; font-weight: 600; letter-spacing: 0.3px; max-width: 120px; line-height: 1.3; }
.rvn-qr-redes { display: flex; gap: 10px; }
.rvn-qr-redes .rvn-icone { width: 17px; height: 17px; }

/* Corpo */
.rvn-corpo { padding: 22px 32px 26px; }
.rvn-titulo { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 20px; }
.rvn-titulo-esq { display: flex; align-items: center; gap: 18px; min-width: 0; }
.rvn-titulo-icone {
  width: 72px;
  height: 72px;
  border-radius: 14px;
  background: linear-gradient(135deg, var(--rvn-azul), var(--rvn-ciano));
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
}
.rvn-titulo-icone .rvn-icone { width: 38px; height: 38px; }
.rvn-titulo h1 { margin: 0; font-size: 30px; line-height: 1.1; font-weight: 800; letter-spacing: -0.6px; color: var(--rvn-navy); }
.rvn-titulo-numero { font-size: 19px; color: var(--rvn-cinza); margin-top: 2px; }
.rvn-titulo-data { display: flex; align-items: center; gap: 8px; margin-top: 4px; font-size: 14px; }
.rvn-titulo-data .rvn-icone { width: 16px; height: 16px; color: var(--rvn-cinza); }
.rvn-situacao { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; text-align: right; }
.rvn-selo {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 11px 18px;
  border-radius: 12px;
  font-weight: 800;
  font-size: 15px;
  white-space: nowrap;
  background: #e6efff;
  color: var(--rvn-azul-escuro);
}
.rvn-selo .rvn-icone { width: 26px; height: 26px; }
.rvn-selo--cancelada { background: var(--rvn-vermelho-fundo); color: var(--rvn-vermelho); }
.rvn-situacao-frase { font-size: 12px; color: var(--rvn-cinza); max-width: 260px; }

.rvn-painel { border: 1px solid var(--rvn-linha); border-radius: 12px; margin-bottom: 14px; overflow: hidden; break-inside: avoid; page-break-inside: avoid; }
.rvn-painel-titulo {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 18px;
  background: var(--rvn-palido);
  font-size: 15px;
  font-weight: 800;
  color: var(--rvn-navy);
}
.rvn-painel-titulo .rvn-icone { width: 22px; height: 22px; color: var(--rvn-azul); }

/* Cliente e loja */
.rvn-pessoas { display: grid; grid-template-columns: 1fr 1fr; background: var(--rvn-fundo); padding: 14px 18px; gap: 20px; }
.rvn-pessoa { display: flex; gap: 14px; align-items: flex-start; min-width: 0; }
.rvn-pessoa + .rvn-pessoa { border-left: 1px solid var(--rvn-linha); padding-left: 20px; }
.rvn-pessoa-icone {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: #e3edff;
  color: var(--rvn-azul);
  display: flex;
  align-items: center;
  justify-content: center;
}
.rvn-pessoa-icone .rvn-icone { width: 22px; height: 22px; }
.rvn-pessoa-dados { min-width: 0; overflow-wrap: anywhere; }
.rvn-rotulo { font-weight: 700; }
.rvn-pessoa-nome { font-weight: 700; font-size: 14px; }

/* Itens */
.rvn-tabela { width: 100%; border-collapse: collapse; }
.rvn-tabela th {
  font-size: 11px;
  font-weight: 600;
  color: #566884;
  text-transform: uppercase;
  text-align: left;
  padding: 11px 12px;
  border-bottom: 1px solid var(--rvn-linha);
  background: #ffffff;
}
.rvn-tabela td { padding: 13px 12px; border-top: 1px solid var(--rvn-linha); vertical-align: middle; }
.rvn-tabela tr:first-child td { border-top: 0; }
.rvn-tabela .rvn-col-num { width: 34px; color: var(--rvn-cinza); }
.rvn-tabela .rvn-col-foto { width: 82px; }
.rvn-tabela .rvn-col-qtd { width: 60px; text-align: center; }
.rvn-tabela .rvn-col-valor { width: 120px; text-align: right; white-space: nowrap; }
.rvn-foto { width: 66px; height: 66px; object-fit: contain; display: block; border-radius: 8px; background: #ffffff; }
.rvn-item-nome { font-weight: 800; font-size: 15px; overflow-wrap: anywhere; }
.rvn-item-detalhe { color: var(--rvn-cinza); font-size: 12px; overflow-wrap: anywhere; }
.rvn-etiqueta { display: inline-block; margin-top: 5px; padding: 2px 10px; border-radius: 7px; background: #e9f0ff; color: #2b3f63; font-size: 11px; }
.rvn-resumo { border-top: 1px solid var(--rvn-linha); padding: 8px 18px 10px; }
.rvn-resumo-linha { display: flex; justify-content: flex-end; gap: 40px; padding: 3px 0; font-size: 14px; }
.rvn-resumo-linha span:last-child { min-width: 120px; text-align: right; font-weight: 800; }
.rvn-resumo-linha--negativo span:last-child { color: var(--rvn-vermelho); }

/* Troca */
.rvn-troca { background: var(--rvn-palido); border-color: #d6e3f6; padding: 14px 18px 16px; }
.rvn-troca-titulo { display: flex; align-items: center; gap: 12px; font-size: 16px; font-weight: 800; color: var(--rvn-azul-escuro); margin-bottom: 10px; }
.rvn-troca-titulo .rvn-icone { width: 24px; height: 24px; }
.rvn-troca-grade { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
.rvn-troca-grade > div + div { border-left: 1px solid #d6e3f6; padding-left: 20px; }
.rvn-troca-aparelho { display: flex; gap: 14px; align-items: center; min-width: 0; }
.rvn-troca-aparelho .rvn-foto { width: 92px; height: 92px; }
.rvn-troca-aparelho p { margin: 2px 0; overflow-wrap: anywhere; }
.rvn-linha-valor { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding: 3px 0; }
.rvn-linha-valor span:first-child { min-width: 0; overflow-wrap: anywhere; }
.rvn-linha-valor span:last-child { white-space: nowrap; }
.rvn-linha-valor--destaque {
  margin-top: 6px;
  padding: 8px 10px;
  border-radius: 8px;
  background: #e2ecff;
  font-weight: 800;
}
.rvn-linha-valor--destaque span:last-child { color: var(--rvn-azul-escuro); font-size: 17px; }
.rvn-troca-obs { margin-top: 6px; font-style: italic; color: var(--rvn-cinza); }

/* Faixa de total e pagamento */
.rvn-total { border: 1px solid #c9dcff; border-radius: 12px; overflow: hidden; margin: 14px 0; break-inside: avoid; page-break-inside: avoid; }
.rvn-total-faixa {
  background: linear-gradient(100deg, #164af0, #159ee0);
  color: #ffffff;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
}
.rvn-total-rotulo { display: flex; align-items: center; gap: 14px; font-size: 18px; font-weight: 800; }
.rvn-total-rotulo .rvn-icone { width: 30px; height: 30px; }
.rvn-total-valor { font-size: 32px; font-weight: 800; white-space: nowrap; }
.rvn-total--cancelada .rvn-total-faixa { background: linear-gradient(100deg, #6b7280, #9ca3af); }
.rvn-total--cancelada .rvn-total-valor { text-decoration: line-through; }
.rvn-pagamento { padding: 12px 20px; display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: start; gap: 10px 20px; }
.rvn-pagamento-obs { grid-column: 1 / -1; text-align: right; }
.rvn-pagamento-cab { display: flex; align-items: center; gap: 14px; min-height: 36px; }
.rvn-pagamento-cab .rvn-icone { width: 26px; height: 26px; color: var(--rvn-navy); }
.rvn-pagamento-cab > span { font-size: 15px; }
.rvn-formas { display: flex; flex-direction: column; gap: 8px; }
.rvn-forma { display: flex; justify-content: flex-end; align-items: center; gap: 8px 16px; flex-wrap: wrap; }
.rvn-forma-esq { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.rvn-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 14px;
  border-radius: 9px;
  font-weight: 800;
  font-size: 15px;
  white-space: nowrap;
  background: var(--rvn-verde-fundo);
  color: var(--rvn-verde);
}
.rvn-chip .rvn-icone { width: 20px; height: 20px; }
.rvn-chip--pendente { background: var(--rvn-laranja-fundo); color: var(--rvn-laranja); }
.rvn-chip--troca { background: #e6efff; color: var(--rvn-azul-escuro); }
.rvn-forma-detalhe { color: var(--rvn-cinza); }
.rvn-forma-valor { font-weight: 800; font-size: 15px; white-space: nowrap; }
.rvn-parcelas { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 2px; }
.rvn-parcelas th { text-align: left; font-weight: 600; color: #566884; padding: 5px 8px; background: var(--rvn-fundo); }
.rvn-parcelas td { padding: 5px 8px; border-top: 1px solid var(--rvn-linha); }
.rvn-parcelas .rvn-direita { text-align: right; }
.rvn-pagamento-obs { font-weight: 700; color: var(--rvn-azul-escuro); }

/* Garantia */
.rvn-garantia { padding: 14px 20px 16px; display: flex; gap: 14px; }
.rvn-garantia > .rvn-icone { width: 34px; height: 34px; color: var(--rvn-azul); margin-top: 2px; }
.rvn-garantia-titulo { font-size: 16px; font-weight: 800; margin-bottom: 6px; }
.rvn-garantia-titulo span { color: var(--rvn-azul); }
.rvn-garantia > div { min-width: 0; flex: 1; }
.rvn-garantia-texto { font-size: 10.5px; line-height: 1.5; white-space: pre-line; color: #26324a; overflow-wrap: anywhere; column-count: 2; column-gap: 26px; }

/* Assinaturas */
.rvn-assinaturas { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 18px 0; break-inside: avoid; page-break-inside: avoid; }
.rvn-assinatura { border: 1px solid var(--rvn-linha); border-radius: 12px; padding: 26px 20px 12px; display: flex; gap: 14px; align-items: flex-end; }
.rvn-assinatura .rvn-icone { width: 26px; height: 26px; color: var(--rvn-navy); margin-bottom: 18px; }
.rvn-assinatura-campo { flex: 1; text-align: center; min-width: 0; }
.rvn-assinatura-linha { border-top: 1.5px solid #4a5a78; margin-bottom: 6px; }
.rvn-assinatura-nome { font-weight: 700; font-size: 12px; overflow-wrap: anywhere; }
.rvn-assinatura-rotulo { font-size: 12px; color: var(--rvn-cinza); }

/* Rodapé */
.rvn-rodape {
  background: #f2f6fc;
  border-radius: 12px;
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  break-inside: avoid;
  page-break-inside: avoid;
}
.rvn-rodape-esq { display: flex; align-items: center; gap: 14px; min-width: 0; }
.rvn-rodape-esq > .rvn-icone { width: 32px; height: 32px; color: var(--rvn-azul); }
.rvn-rodape-titulo { font-weight: 800; font-size: 15px; }
.rvn-rodape-contatos { display: flex; flex-wrap: wrap; gap: 8px 18px; justify-content: flex-end; font-size: 12px; }
.rvn-rodape-contatos .rvn-contato { align-items: center; gap: 7px; }
.rvn-rodape-contatos .rvn-icone { width: 20px; height: 20px; margin: 0; }
.rvn-rede-instagram { color: #c13584; }
.rvn-rede-facebook { color: #1877f2; }
.rvn-rede-whatsapp { color: #25a244; }
.rvn-rede-site { color: var(--rvn-azul-escuro); }
.rvn-cab .rvn-rede-instagram, .rvn-cab .rvn-rede-facebook, .rvn-cab .rvn-rede-whatsapp { color: #ffffff; }

/* Celular */
@media (max-width: 600px) {
  .rvn { border-radius: 0; font-size: 12px; }
  .rvn-cab { grid-template-columns: 1fr; padding: 20px 18px 40px; gap: 14px; }
  .rvn-cab-marca { min-height: 0; }
  .rvn-cab-contatos, .rvn-cab-qr { border-left: 0; padding-left: 0; }
  .rvn-cab-qr { flex-direction: row; justify-content: center; text-align: left; flex-wrap: wrap; }
  .rvn-corpo { padding: 16px 12px 18px; }
  .rvn-titulo { flex-direction: column; align-items: flex-start; }
  .rvn-titulo-icone { width: 52px; height: 52px; }
  .rvn-titulo-icone .rvn-icone { width: 28px; height: 28px; }
  .rvn-titulo h1 { font-size: 23px; }
  .rvn-situacao { align-items: flex-start; text-align: left; }
  .rvn-pessoas, .rvn-troca-grade { grid-template-columns: 1fr; }
  .rvn-pessoa + .rvn-pessoa, .rvn-troca-grade > div + div { border-left: 0; padding-left: 0; border-top: 1px solid var(--rvn-linha); padding-top: 12px; }
  .rvn-tabela { font-size: 11px; }
  .rvn-tabela th, .rvn-tabela td { padding: 8px 5px; }
  .rvn-tabela .rvn-col-num { display: none; }
  .rvn-tabela .rvn-col-foto { width: 50px; }
  .rvn-tabela .rvn-col-qtd { width: 34px; }
  .rvn-tabela .rvn-col-valor { width: auto; }
  .rvn-tabela .rvn-col-unit { display: none; }
  .rvn-foto { width: 44px; height: 44px; }
  .rvn-item-nome { font-size: 13px; }
  .rvn-resumo-linha { gap: 16px; }
  .rvn-total-rotulo { font-size: 14px; }
  .rvn-total-valor { font-size: 22px; }
  .rvn-assinaturas { gap: 8px; }
  .rvn-assinatura { padding: 22px 10px 10px; }
  .rvn-assinatura .rvn-icone { display: none; }
  .rvn-rodape { flex-direction: column; align-items: flex-start; }
  .rvn-pagamento { grid-template-columns: 1fr; }
  .rvn-pagamento-cab { min-height: 0; }
  .rvn-forma { justify-content: space-between; }
  .rvn-pagamento-obs { text-align: left; }
  .rvn-garantia { padding: 12px; }
  .rvn-garantia > .rvn-icone { display: none; }
  .rvn-garantia-texto { column-count: 1; }
  .rvn-rodape-contatos { justify-content: flex-start; }
}

/* Impressão: cores fiéis, sem sombra nem cantos externos, blocos inteiros e
   mais compacto (área útil do A4 com margem de 10mm ≈ 718 × 1047px) */
@media print {
  .rvn { max-width: none; box-shadow: none; border-radius: 0; font-size: 11px; line-height: 1.32; }
  .rvn, .rvn * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .rvn-painel, .rvn-total, .rvn-assinaturas, .rvn-rodape, .rvn-titulo { break-inside: avoid; page-break-inside: avoid; }
  .rvn-cab { padding: 10px 18px 22px; gap: 16px; border-radius: 10px 10px 0 0; }
  .rvn-cab-curva { height: 18px; }
  .rvn-cab-marca { min-height: 0; }
  .rvn-cab-logo { padding: 5px; border-radius: 8px; }
  .rvn-cab-logo img { max-width: 170px; max-height: 52px; }
  .rvn-cab-nome { font-size: 22px; }
  .rvn-cab-contatos { gap: 3px; font-size: 10px; padding-left: 16px; }
  .rvn-contato .rvn-icone { width: 13px; height: 13px; }
  .rvn-cab-qr { padding-left: 16px; gap: 3px; }
  .rvn-qr-caixa { padding: 4px; border-radius: 6px; }
  .rvn-qr-caixa svg { width: 62px; height: 62px; }
  .rvn-qr-legenda { font-size: 8px; }
  .rvn-qr-redes .rvn-icone { width: 13px; height: 13px; }
  .rvn-corpo { padding: 8px 0 0; }
  .rvn-titulo { margin-bottom: 8px; }
  .rvn-titulo-esq { gap: 12px; }
  .rvn-titulo-icone { width: 46px; height: 46px; border-radius: 10px; }
  .rvn-titulo-icone .rvn-icone { width: 24px; height: 24px; }
  .rvn-titulo h1 { font-size: 22px; }
  .rvn-titulo-numero { font-size: 14px; margin-top: 0; }
  .rvn-titulo-data { font-size: 11px; margin-top: 1px; }
  .rvn-selo { padding: 7px 12px; font-size: 12px; border-radius: 9px; }
  .rvn-selo .rvn-icone { width: 18px; height: 18px; }
  .rvn-situacao-frase { font-size: 10px; }
  .rvn-painel { margin-bottom: 7px; border-radius: 9px; }
  .rvn-painel-titulo { padding: 6px 12px; font-size: 12px; gap: 8px; }
  .rvn-painel-titulo .rvn-icone { width: 16px; height: 16px; }
  .rvn-pessoas { padding: 8px 12px; gap: 14px; }
  .rvn-pessoa { gap: 10px; }
  .rvn-pessoa + .rvn-pessoa { padding-left: 14px; }
  .rvn-pessoa-icone { width: 30px; height: 30px; border-radius: 8px; }
  .rvn-pessoa-icone .rvn-icone { width: 16px; height: 16px; }
  .rvn-pessoa-nome { font-size: 12px; }
  .rvn-tabela th { padding: 5px 8px; font-size: 9px; }
  .rvn-tabela td { padding: 6px 8px; }
  .rvn-tabela .rvn-col-foto { width: 56px; }
  .rvn-foto { width: 44px; height: 44px; }
  .rvn-item-nome { font-size: 12px; }
  .rvn-item-detalhe { font-size: 10px; }
  .rvn-etiqueta { margin-top: 2px; padding: 1px 8px; font-size: 9px; }
  .rvn-resumo { padding: 4px 12px 5px; }
  .rvn-resumo-linha { font-size: 12px; padding: 1px 0; }
  .rvn-troca { padding: 8px 12px 10px; }
  .rvn-troca-titulo { font-size: 13px; margin-bottom: 6px; gap: 8px; }
  .rvn-troca-titulo .rvn-icone { width: 18px; height: 18px; }
  .rvn-troca-grade { gap: 14px; }
  .rvn-troca-grade > div + div { padding-left: 14px; }
  .rvn-troca-aparelho .rvn-foto { width: 58px; height: 58px; }
  .rvn-troca-aparelho p { margin: 1px 0; }
  .rvn-linha-valor { padding: 1px 0; }
  .rvn-linha-valor--destaque { margin-top: 4px; padding: 5px 8px; }
  .rvn-linha-valor--destaque span:last-child { font-size: 14px; }
  .rvn-total { margin: 7px 0; border-radius: 9px; }
  .rvn-total-faixa { padding: 9px 14px; }
  .rvn-total-rotulo { font-size: 14px; gap: 10px; }
  .rvn-total-rotulo .rvn-icone { width: 22px; height: 22px; }
  .rvn-total-valor { font-size: 22px; }
  .rvn-pagamento { padding: 7px 14px; gap: 6px 14px; }
  .rvn-pagamento-cab { min-height: 26px; }
  .rvn-pagamento-cab { gap: 10px; }
  .rvn-pagamento-cab .rvn-icone { width: 18px; height: 18px; }
  .rvn-pagamento-cab > span { font-size: 12px; }
  .rvn-chip { padding: 4px 10px; font-size: 12px; }
  .rvn-chip .rvn-icone { width: 15px; height: 15px; }
  .rvn-forma-valor { font-size: 12px; }
  .rvn-parcelas { font-size: 10px; }
  .rvn-parcelas th, .rvn-parcelas td { padding: 2px 8px; }
  .rvn-garantia { padding: 8px 12px 9px; gap: 10px; }
  .rvn-garantia > .rvn-icone { width: 22px; height: 22px; }
  .rvn-garantia-titulo { font-size: 12px; margin-bottom: 3px; }
  .rvn-garantia-texto { font-size: 8.2px; line-height: 1.3; column-gap: 20px; }
  .rvn-assinaturas { margin: 7px 0; gap: 12px; }
  .rvn-assinatura { padding: 16px 14px 5px; border-radius: 9px; }
  .rvn-assinatura .rvn-icone { width: 16px; height: 16px; margin-bottom: 12px; }
  .rvn-assinatura-nome, .rvn-assinatura-rotulo { font-size: 10px; }
  .rvn-rodape { padding: 6px 14px; border-radius: 9px; }
  .rvn-rodape-esq > .rvn-icone { width: 22px; height: 22px; }
  .rvn-rodape-titulo { font-size: 12px; }
  .rvn-rodape-contatos { font-size: 10px; }
  .rvn-rodape-contatos .rvn-icone { width: 14px; height: 14px; }
}
`;
}
