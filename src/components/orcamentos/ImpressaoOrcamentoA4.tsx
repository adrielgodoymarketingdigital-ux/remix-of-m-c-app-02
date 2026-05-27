import { useEffect, useRef } from "react";
import { Orcamento } from "@/types/orcamento";
import { ConfiguracaoLoja, LayoutOrcamentoConfig } from "@/types/configuracao-loja";
import { formatCurrency, formatDate, formatPhone } from "@/lib/formatters";
import { getPrintScript, getAndroidPrintCSS } from "@/lib/print-utils";

interface ImpressaoOrcamentoA4Props {
  orcamento: Orcamento;
  configuracaoLoja?: ConfiguracaoLoja;
  layoutConfig: LayoutOrcamentoConfig;
  onFecharImpressao: () => void;
}

export function ImpressaoOrcamentoA4({
  orcamento,
  configuracaoLoja,
  layoutConfig,
  onFecharImpressao,
}: ImpressaoOrcamentoA4Props) {
  const printedRef = useRef(false);

  useEffect(() => {
    if (printedRef.current) return;
    printedRef.current = true;

    const mostrarLogo = layoutConfig.mostrar_logo ?? true;
    const mostrarDadosLoja = layoutConfig.mostrar_dados_loja ?? true;
    const mostrarDadosCliente = layoutConfig.mostrar_dados_cliente ?? true;
    const mostrarDadosDispositivo = layoutConfig.mostrar_dados_dispositivo ?? true;
    const mostrarItens = layoutConfig.mostrar_itens ?? true;
    const mostrarSubtotal = layoutConfig.mostrar_subtotal ?? true;
    const mostrarDesconto = layoutConfig.mostrar_desconto ?? true;
    const mostrarTotal = layoutConfig.mostrar_total ?? true;
    const mostrarValidade = layoutConfig.mostrar_validade ?? true;
    const mostrarObservacoes = layoutConfig.mostrar_observacoes ?? true;
    const mostrarTermos = layoutConfig.mostrar_termos ?? true;
    const mostrarAssinaturas = layoutConfig.mostrar_assinaturas ?? true;

    const logoHtml =
      mostrarLogo && configuracaoLoja?.logo_url
        ? `<img src="${configuracaoLoja.logo_url}" alt="Logo" class="orcamento-logo" crossorigin="anonymous" onerror="this.style.display='none'" />`
        : "";

    const dadosLojaHtml = mostrarDadosLoja && configuracaoLoja
      ? `<div class="orcamento-loja-info">
          <div class="orcamento-loja-nome">${configuracaoLoja.nome_loja || ""}</div>
          ${configuracaoLoja.cnpj ? `<div class="orcamento-loja-detalhe">CNPJ: ${configuracaoLoja.cnpj}</div>` : ""}
          ${configuracaoLoja.endereco ? `<div class="orcamento-loja-detalhe">${configuracaoLoja.endereco}</div>` : ""}
          ${configuracaoLoja.telefone ? `<div class="orcamento-loja-detalhe">Tel: ${formatPhone(configuracaoLoja.telefone)}</div>` : ""}
          ${configuracaoLoja.email ? `<div class="orcamento-loja-detalhe">${configuracaoLoja.email}</div>` : ""}
        </div>`
      : "";

    const dadosClienteHtml = mostrarDadosCliente
      ? `<div class="orcamento-section">
          <div class="orcamento-section-title">CLIENTE</div>
          <div class="orcamento-field"><span class="orcamento-label">Nome:</span> <span>${orcamento.cliente_nome || "Não informado"}</span></div>
          ${orcamento.cliente_telefone ? `<div class="orcamento-field"><span class="orcamento-label">Telefone:</span> <span>${orcamento.cliente_telefone}</span></div>` : ""}
          ${orcamento.cliente_email ? `<div class="orcamento-field"><span class="orcamento-label">E-mail:</span> <span>${orcamento.cliente_email}</span></div>` : ""}
        </div>`
      : "";

    const temDispositivo = orcamento.tipo_dispositivo || orcamento.marca_dispositivo || orcamento.modelo_dispositivo;
    const dadosDispositivoHtml = mostrarDadosDispositivo && temDispositivo
      ? `<div class="orcamento-section">
          <div class="orcamento-section-title">DISPOSITIVO</div>
          ${orcamento.tipo_dispositivo ? `<div class="orcamento-field"><span class="orcamento-label">Tipo:</span> <span>${orcamento.tipo_dispositivo}</span></div>` : ""}
          ${orcamento.marca_dispositivo ? `<div class="orcamento-field"><span class="orcamento-label">Marca:</span> <span>${orcamento.marca_dispositivo}</span></div>` : ""}
          ${orcamento.modelo_dispositivo ? `<div class="orcamento-field"><span class="orcamento-label">Modelo:</span> <span>${orcamento.modelo_dispositivo}</span></div>` : ""}
          ${orcamento.cor_dispositivo ? `<div class="orcamento-field"><span class="orcamento-label">Cor:</span> <span>${orcamento.cor_dispositivo}</span></div>` : ""}
        </div>`
      : "";

    const itensHtml = mostrarItens && orcamento.itens?.length > 0
      ? `<div class="orcamento-section">
          <div class="orcamento-section-title">ITENS DO ORÇAMENTO</div>
          <table class="orcamento-table">
            <thead>
              <tr>
                <th class="orcamento-th orcamento-th-desc">Descrição</th>
                <th class="orcamento-th orcamento-th-qtd">Qtd</th>
                <th class="orcamento-th orcamento-th-valor">Valor Unit.</th>
                <th class="orcamento-th orcamento-th-total">Total</th>
              </tr>
            </thead>
            <tbody>
              ${orcamento.itens.map((item) => `
              <tr class="orcamento-tr">
                <td class="orcamento-td">${item.descricao}<br/><span class="orcamento-item-tipo">${item.tipo}</span></td>
                <td class="orcamento-td orcamento-td-center">${item.quantidade}</td>
                <td class="orcamento-td orcamento-td-right">${formatCurrency(item.valor_unitario)}</td>
                <td class="orcamento-td orcamento-td-right orcamento-td-bold">${formatCurrency(item.valor_total)}</td>
              </tr>`).join("")}
            </tbody>
          </table>
        </div>`
      : "";

    const totaisHtml = `<div class="orcamento-totais">
      ${mostrarSubtotal ? `<div class="orcamento-totais-linha"><span>Subtotal</span><span>${formatCurrency(orcamento.subtotal)}</span></div>` : ""}
      ${mostrarDesconto && orcamento.desconto > 0 ? `<div class="orcamento-totais-linha orcamento-desconto"><span>Desconto</span><span>- ${formatCurrency(orcamento.desconto)}</span></div>` : ""}
      ${mostrarTotal ? `<div class="orcamento-totais-linha orcamento-total-final"><span>TOTAL</span><span>${formatCurrency(orcamento.valor_total)}</span></div>` : ""}
    </div>`;

    const validadeHtml = mostrarValidade && orcamento.data_validade
      ? `<div class="orcamento-validade">
          <strong>Validade do Orçamento:</strong> ${formatDate(orcamento.data_validade)}
          ${orcamento.validade_dias ? ` (${orcamento.validade_dias} dias)` : ""}
        </div>`
      : "";

    const observacoesHtml = mostrarObservacoes && orcamento.observacoes
      ? `<div class="orcamento-section">
          <div class="orcamento-section-title">OBSERVAÇÕES</div>
          <p class="orcamento-obs-text">${orcamento.observacoes.replace(/\n/g, "<br/>")}</p>
        </div>`
      : "";

    const termosHtml = mostrarTermos && orcamento.termos_condicoes
      ? `<div class="orcamento-section orcamento-termos">
          <div class="orcamento-section-title">TERMOS E CONDIÇÕES</div>
          <p class="orcamento-termos-text">${orcamento.termos_condicoes.replace(/\n/g, "<br/>")}</p>
        </div>`
      : "";

    const assinaturasHtml = mostrarAssinaturas
      ? `<div class="orcamento-assinaturas">
          <div class="orcamento-assinatura-bloco">
            <div class="orcamento-linha-assinatura"></div>
            <div class="orcamento-assinatura-label">Assinatura do Cliente</div>
            <div class="orcamento-assinatura-data">Data: ___/___/______</div>
          </div>
          <div class="orcamento-assinatura-bloco">
            <div class="orcamento-linha-assinatura"></div>
            <div class="orcamento-assinatura-label">Assinatura da Loja</div>
            <div class="orcamento-assinatura-data">Data: ___/___/______</div>
          </div>
        </div>`
      : "";

    const htmlDoc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
  <title>Orçamento ${orcamento.numero_orcamento}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: A4 portrait; margin: 10mm; }
    body {
      font-family: system-ui, -apple-system, Arial, sans-serif;
      font-size: 9pt;
      color: #111;
      background: white;
      padding: 4mm;
      line-height: 1.4;
    }
    .orcamento-container {
      width: 100%;
      max-width: 190mm;
      margin: 0 auto;
    }
    /* Header */
    .orcamento-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 4mm;
      border-bottom: 2pt solid #000;
      padding-bottom: 3mm;
      margin-bottom: 4mm;
    }
    .orcamento-header-left {
      display: flex;
      align-items: center;
      gap: 3mm;
      flex: 1;
    }
    .orcamento-logo {
      width: 16mm;
      height: 16mm;
      object-fit: contain;
    }
    .orcamento-titulo {
      font-size: 16pt;
      font-weight: 900;
      letter-spacing: 0.5px;
      color: #000;
    }
    .orcamento-numero {
      font-size: 10pt;
      font-weight: 700;
      color: #333;
      margin-top: 1mm;
    }
    .orcamento-data-criacao {
      font-size: 7.5pt;
      color: #555;
      margin-top: 0.5mm;
    }
    .orcamento-loja-info {
      text-align: right;
      font-size: 7.5pt;
      color: #333;
      line-height: 1.5;
    }
    .orcamento-loja-nome {
      font-size: 9pt;
      font-weight: 700;
      color: #000;
    }
    .orcamento-loja-detalhe {
      font-size: 7pt;
      color: #555;
    }
    /* Sections */
    .orcamento-section {
      border: 0.5pt solid #ccc;
      border-left: 2.5pt solid #000;
      border-radius: 1px;
      margin-bottom: 3mm;
      overflow: hidden;
    }
    .orcamento-section-title {
      font-size: 7pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      background: #f0f0f0;
      padding: 1mm 2mm;
      border-bottom: 0.5pt solid #ccc;
      color: #000;
    }
    .orcamento-field {
      font-size: 8pt;
      padding: 0.5mm 2mm;
      display: flex;
      gap: 1mm;
    }
    .orcamento-label {
      font-weight: 700;
      white-space: nowrap;
      color: #333;
    }
    /* Grid 2 cols for client/device */
    .orcamento-grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 3mm;
      margin-bottom: 3mm;
    }
    .orcamento-grid-2 .orcamento-section {
      margin-bottom: 0;
    }
    /* Table */
    .orcamento-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8pt;
    }
    .orcamento-th {
      background: #f0f0f0;
      padding: 1.5mm 2mm;
      font-size: 7pt;
      font-weight: 700;
      text-transform: uppercase;
      color: #000;
      border-bottom: 0.5pt solid #ccc;
    }
    .orcamento-th-desc { text-align: left; }
    .orcamento-th-qtd { text-align: center; width: 12mm; }
    .orcamento-th-valor { text-align: right; width: 28mm; }
    .orcamento-th-total { text-align: right; width: 28mm; }
    .orcamento-tr:nth-child(even) { background: #fafafa; }
    .orcamento-td {
      padding: 1.5mm 2mm;
      border-bottom: 0.3pt solid #eee;
      font-size: 8pt;
      color: #111;
    }
    .orcamento-td-center { text-align: center; }
    .orcamento-td-right { text-align: right; }
    .orcamento-td-bold { font-weight: 700; }
    .orcamento-item-tipo {
      font-size: 6.5pt;
      color: #666;
      font-style: italic;
    }
    /* Totals */
    .orcamento-totais {
      margin-bottom: 3mm;
      border: 0.5pt solid #ccc;
      border-radius: 1px;
      overflow: hidden;
    }
    .orcamento-totais-linha {
      display: flex;
      justify-content: space-between;
      padding: 1.5mm 3mm;
      font-size: 8.5pt;
      border-bottom: 0.3pt solid #eee;
    }
    .orcamento-desconto { color: #c00; }
    .orcamento-total-final {
      font-size: 11pt;
      font-weight: 900;
      background: #f0f0f0;
      color: #000;
      border-top: 1pt solid #000;
    }
    /* Validade */
    .orcamento-validade {
      font-size: 8pt;
      padding: 1.5mm 2mm;
      background: #fffbeb;
      border: 0.5pt solid #f59e0b;
      border-radius: 1px;
      margin-bottom: 3mm;
      color: #92400e;
    }
    /* Observações */
    .orcamento-obs-text {
      padding: 2mm;
      font-size: 8pt;
      color: #333;
      white-space: pre-line;
    }
    /* Termos */
    .orcamento-termos { border-left-color: #555; }
    .orcamento-termos-text {
      padding: 2mm;
      font-size: 7pt;
      color: #555;
      white-space: pre-line;
    }
    /* Assinaturas */
    .orcamento-assinaturas {
      display: flex;
      justify-content: space-around;
      gap: 6mm;
      margin-top: 8mm;
      padding-top: 3mm;
      border-top: 0.5pt solid #ccc;
    }
    .orcamento-assinatura-bloco {
      display: flex;
      flex-direction: column;
      align-items: center;
      min-width: 50mm;
    }
    .orcamento-linha-assinatura {
      width: 100%;
      border-bottom: 0.5pt solid #333;
      min-height: 12mm;
      margin-bottom: 1.5mm;
    }
    .orcamento-assinatura-label {
      font-size: 7pt;
      color: #555;
      text-align: center;
    }
    .orcamento-assinatura-data {
      font-size: 6.5pt;
      color: #888;
      text-align: center;
      margin-top: 0.5mm;
    }
    /* Print */
    @media print {
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      body { padding: 0; }
    }
    ${getAndroidPrintCSS()}
  </style>
</head>
<body>
  <div class="orcamento-container">
    <!-- Header -->
    <div class="orcamento-header">
      <div class="orcamento-header-left">
        ${logoHtml}
        <div>
          <div class="orcamento-titulo">ORÇAMENTO</div>
          <div class="orcamento-numero">${orcamento.numero_orcamento}</div>
          <div class="orcamento-data-criacao">Emitido em: ${formatDate(orcamento.created_at)}</div>
        </div>
      </div>
      ${dadosLojaHtml}
    </div>

    <!-- Cliente e Dispositivo -->
    ${(mostrarDadosCliente || mostrarDadosDispositivo) && temDispositivo
      ? `<div class="orcamento-grid-2">${dadosClienteHtml}${dadosDispositivoHtml}</div>`
      : dadosClienteHtml + dadosDispositivoHtml
    }

    <!-- Itens -->
    ${itensHtml}

    <!-- Totais -->
    ${totaisHtml}

    <!-- Validade -->
    ${validadeHtml}

    <!-- Observações -->
    ${observacoesHtml}

    <!-- Termos -->
    ${termosHtml}

    <!-- Assinaturas -->
    ${assinaturasHtml}
  </div>

  ${getPrintScript()}
</body>
</html>`;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      // Fallback: direct window.print()
      window.print();
      setTimeout(onFecharImpressao, 1000);
      return;
    }
    printWindow.document.write(htmlDoc);
    printWindow.document.close();

    // Close this component after a delay
    setTimeout(() => {
      onFecharImpressao();
    }, 500);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
