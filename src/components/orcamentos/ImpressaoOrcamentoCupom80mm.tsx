import { useEffect, useRef } from "react";
import { Orcamento } from "@/types/orcamento";
import { ConfiguracaoLoja, LayoutOrcamentoConfig } from "@/types/configuracao-loja";
import { formatCurrency, formatDate, formatPhone } from "@/lib/formatters";
import { getPrintScript } from "@/lib/print-utils";
import { resolvePaperSize, getThermalPrintCSS } from "@/lib/paper-size-utils";

interface ImpressaoOrcamentoCupom80mmProps {
  orcamento: Orcamento;
  configuracaoLoja?: ConfiguracaoLoja;
  layoutConfig: LayoutOrcamentoConfig;
  onFecharImpressao: () => void;
}

export function ImpressaoOrcamentoCupom80mm({
  orcamento,
  configuracaoLoja,
  layoutConfig,
  onFecharImpressao,
}: ImpressaoOrcamentoCupom80mmProps) {
  const printedRef = useRef(false);

  useEffect(() => {
    if (printedRef.current) return;
    printedRef.current = true;

    const paper = resolvePaperSize("80mm");
    const thermalCSS = getThermalPrintCSS(paper);

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
    const mostrarTermos = layoutConfig.mostrar_termos ?? false;
    const mostrarAssinaturas = layoutConfig.mostrar_assinaturas ?? true;

    const logoHtml =
      mostrarLogo && configuracaoLoja?.logo_url
        ? `<div class="cupom-secao cupom-centro">
            <img src="${configuracaoLoja.logo_url}" alt="Logo" class="cupom-logo" crossorigin="anonymous" onerror="this.style.display='none'" />
          </div>`
        : "";

    const dadosLojaHtml =
      mostrarDadosLoja && configuracaoLoja
        ? `<div class="cupom-secao cupom-centro cupom-borda-baixo">
            <div class="cupom-loja-nome">${configuracaoLoja.nome_loja || ""}</div>
            ${configuracaoLoja.cnpj ? `<div class="cupom-pequeno">CNPJ: ${configuracaoLoja.cnpj}</div>` : ""}
            ${configuracaoLoja.endereco ? `<div class="cupom-pequeno">${configuracaoLoja.endereco}</div>` : ""}
            ${configuracaoLoja.telefone ? `<div class="cupom-pequeno">Tel: ${formatPhone(configuracaoLoja.telefone)}</div>` : ""}
          </div>`
        : "";

    const cabecalhoHtml = `<div class="cupom-secao cupom-centro">
      <div class="cupom-orcamento-numero">ORÇAMENTO</div>
      <div class="cupom-orcamento-ref">${orcamento.numero_orcamento}</div>
      <div class="cupom-pequeno">${formatDate(orcamento.created_at)}</div>
    </div>`;

    const clienteHtml =
      mostrarDadosCliente
        ? `<div class="cupom-secao cupom-borda-baixo">
            <div class="cupom-titulo-secao">CLIENTE</div>
            <div>Nome: ${orcamento.cliente_nome || "Não informado"}</div>
            ${orcamento.cliente_telefone ? `<div>Tel: ${orcamento.cliente_telefone}</div>` : ""}
            ${orcamento.cliente_email ? `<div>Email: ${orcamento.cliente_email}</div>` : ""}
          </div>`
        : "";

    const temDispositivo = orcamento.tipo_dispositivo || orcamento.marca_dispositivo || orcamento.modelo_dispositivo;
    const dispositivoHtml =
      mostrarDadosDispositivo && temDispositivo
        ? `<div class="cupom-secao cupom-borda-baixo">
            <div class="cupom-titulo-secao">DISPOSITIVO</div>
            ${orcamento.tipo_dispositivo ? `<div>${orcamento.tipo_dispositivo}</div>` : ""}
            ${orcamento.marca_dispositivo ? `<div>${orcamento.marca_dispositivo}${orcamento.modelo_dispositivo ? ` ${orcamento.modelo_dispositivo}` : ""}</div>` : ""}
            ${orcamento.cor_dispositivo ? `<div>Cor: ${orcamento.cor_dispositivo}</div>` : ""}
          </div>`
        : "";

    const itensHtml =
      mostrarItens && orcamento.itens?.length > 0
        ? `<div class="cupom-secao cupom-borda-baixo">
            <div class="cupom-titulo-secao">ITENS</div>
            ${orcamento.itens.map((item) =>
              `<div class="cupom-linha-entre">
                <span>${item.quantidade}x ${item.descricao}</span>
                <span>${formatCurrency(item.valor_total)}</span>
              </div>`
            ).join("")}
          </div>`
        : "";

    const totaisHtml = `<div class="cupom-secao">
      ${mostrarSubtotal ? `<div class="cupom-linha-entre"><span>Subtotal</span><span>${formatCurrency(orcamento.subtotal)}</span></div>` : ""}
      ${mostrarDesconto && orcamento.desconto > 0 ? `<div class="cupom-linha-entre cupom-desconto"><span>Desconto</span><span>- ${formatCurrency(orcamento.desconto)}</span></div>` : ""}
      ${mostrarTotal ? `<div class="cupom-total">TOTAL: ${formatCurrency(orcamento.valor_total)}</div>` : ""}
    </div>`;

    const validadeHtml =
      mostrarValidade && orcamento.data_validade
        ? `<div class="cupom-secao cupom-borda-baixo">
            <div class="cupom-linha-entre">
              <span class="cupom-titulo-secao" style="margin-bottom:0">VALIDADE</span>
              <span>${formatDate(orcamento.data_validade)}</span>
            </div>
          </div>`
        : "";

    const observacoesHtml =
      mostrarObservacoes && orcamento.observacoes
        ? `<div class="cupom-secao cupom-borda-baixo">
            <div class="cupom-titulo-secao">OBSERVAÇÕES</div>
            <div style="white-space:pre-line;font-size:7pt">${orcamento.observacoes}</div>
          </div>`
        : "";

    const termosHtml =
      mostrarTermos && orcamento.termos_condicoes
        ? `<div class="cupom-secao cupom-termos">
            <div class="cupom-titulo-secao">TERMOS</div>
            <div style="font-size:6pt;white-space:pre-line">${orcamento.termos_condicoes}</div>
          </div>`
        : "";

    const assinaturasHtml = mostrarAssinaturas
      ? `<div class="cupom-assinaturas">
          <div class="cupom-assinatura-bloco">
            <div class="cupom-linha-assinatura"></div>
            <div class="cupom-pequeno">Assinatura do Cliente</div>
          </div>
          <div class="cupom-assinatura-bloco">
            <div class="cupom-linha-assinatura"></div>
            <div class="cupom-pequeno">Assinatura da Loja</div>
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
    ${thermalCSS}
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 9pt;
      color: #000;
      font-weight: 500;
      line-height: 1.4;
      background: white;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .cupom-container {
      width: 72mm;
      margin: 0 auto;
      padding: 2mm;
    }
    .cupom-secao {
      margin-bottom: 2mm;
      padding-bottom: 2mm;
    }
    .cupom-centro { text-align: center; }
    .cupom-borda-baixo {
      border-bottom: 1.5px dashed #000;
      padding-bottom: 2mm;
    }
    .cupom-loja-nome {
      font-weight: 900;
      font-size: 11pt;
      letter-spacing: 0.3px;
    }
    .cupom-pequeno {
      font-size: 7pt;
      color: #000;
      font-weight: 500;
    }
    .cupom-logo {
      max-width: 28mm;
      max-height: 14mm;
    }
    .cupom-orcamento-numero {
      font-size: 11pt;
      font-weight: 900;
    }
    .cupom-orcamento-ref {
      font-size: 9pt;
      font-weight: 700;
    }
    .cupom-titulo-secao {
      font-weight: 800;
      font-size: 8pt;
      margin-bottom: 1mm;
      text-decoration: underline;
      letter-spacing: 0.5px;
    }
    .cupom-linha-entre {
      display: flex;
      justify-content: space-between;
      font-weight: 600;
    }
    .cupom-desconto { color: #c00; }
    .cupom-total {
      font-size: 13pt;
      font-weight: 900;
      text-align: center;
      border-top: 2px dashed #000;
      border-bottom: 2px dashed #000;
      padding: 2.5mm 0;
      margin-top: 1mm;
    }
    .cupom-termos {
      font-size: 6.5pt;
      color: #000;
      white-space: pre-line;
      font-weight: 500;
    }
    .cupom-assinaturas {
      margin-top: 3mm;
      border-top: 1.5px dashed #000;
      padding-top: 2mm;
    }
    .cupom-assinatura-bloco {
      text-align: center;
      margin-bottom: 2mm;
    }
    .cupom-linha-assinatura {
      border-bottom: 1.5px solid #000;
      width: 90%;
      margin: 3mm auto 1mm;
    }
    @media print {
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      body { padding: 0 !important; }
    }
  </style>
</head>
<body>
  <div class="cupom-container">
    ${logoHtml}
    ${dadosLojaHtml}
    ${cabecalhoHtml}
    ${clienteHtml}
    ${dispositivoHtml}
    ${itensHtml}
    ${totaisHtml}
    ${validadeHtml}
    ${observacoesHtml}
    ${termosHtml}
    ${assinaturasHtml}
  </div>

  ${getPrintScript()}
</body>
</html>`;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      window.print();
      setTimeout(onFecharImpressao, 1000);
      return;
    }
    printWindow.document.write(htmlDoc);
    printWindow.document.close();

    setTimeout(() => {
      onFecharImpressao();
    }, 500);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
