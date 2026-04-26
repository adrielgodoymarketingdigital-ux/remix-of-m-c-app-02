import { useEffect, useCallback } from "react";
import { OrdemServico } from "@/hooks/useOrdensServico";
import { useConfiguracaoLoja } from "@/hooks/useConfiguracaoLoja";
import { EtiquetaOSConfig } from "@/types/configuracao-loja";
import { format } from "date-fns";
import { getPrintScript } from "@/lib/print-utils";

interface ImpressaoEtiquetaProps {
  ordem: OrdemServico;
  onFechar: () => void;
  printWindow?: Window | null;
}

const CONFIG_PADRAO: EtiquetaOSConfig = {
  largura_mm: 44,
  altura_mm: 55,
  mostrar_numero_os: true,
  mostrar_defeito: true,
  mostrar_cliente: true,
  mostrar_dispositivo: true,
  mostrar_data: true,
  mostrar_senha: false,
  mostrar_marca_modelo: true,
  mostrar_telefone: false,
  mostrar_logo: false,
  mostrar_valor: false,
  tamanho_fonte: "normal",
};

export function ImpressaoEtiqueta({ ordem, onFechar, printWindow }: ImpressaoEtiquetaProps) {
  const { config } = useConfiguracaoLoja();

  const etiquetaConfig: EtiquetaOSConfig = {
    ...CONFIG_PADRAO,
    ...((config?.layout_os_config as any)?.etiqueta_config || {}),
  };

  const largura = etiquetaConfig.largura_mm || 44;
  const altura = etiquetaConfig.altura_mm || 55;
  const fontSize = etiquetaConfig.tamanho_fonte === "pequeno" ? "7pt" : etiquetaConfig.tamanho_fonte === "grande" ? "10pt" : "8pt";
  const titleSize = etiquetaConfig.tamanho_fonte === "pequeno" ? "9pt" : etiquetaConfig.tamanho_fonte === "grande" ? "13pt" : "11pt";

  const clienteNome = ordem.cliente?.nome || "—";
  const clienteTelefone = ordem.cliente?.telefone || "";
  const dataEntrada = ordem.created_at ? format(new Date(ordem.created_at), "dd/MM/yyyy") : "";
  const defeito = ordem.defeito_relatado || "";
  const marcaModelo = [ordem.dispositivo_marca, ordem.dispositivo_modelo].filter(Boolean).join(" ");
  const logoUrl = config?.logo_url || "";
  const valorTotal = ordem.total ? `R$ ${Number(ordem.total).toFixed(2).replace('.', ',')}` : "";

  const buildContent = useCallback(() => {
    let html = '<div class="etiqueta-container">';

    if (etiquetaConfig.mostrar_logo && logoUrl) {
      html += `<div class="etiqueta-logo"><img src="${logoUrl}" alt="Logo" style="max-height:8mm;max-width:80%;object-fit:contain;" /></div>`;
    }
    if (etiquetaConfig.mostrar_numero_os) html += `<div class="etiqueta-os-numero">OS #${ordem.numero_os}</div>`;
    if (etiquetaConfig.mostrar_cliente) html += `<div class="etiqueta-campo etiqueta-campo-bold">${clienteNome}</div>`;
    if (etiquetaConfig.mostrar_telefone && clienteTelefone) html += `<div class="etiqueta-campo">${clienteTelefone}</div>`;
    if (etiquetaConfig.mostrar_dispositivo) html += `<div class="etiqueta-campo">${ordem.dispositivo_tipo || ""}</div>`;
    if (etiquetaConfig.mostrar_marca_modelo && marcaModelo) html += `<div class="etiqueta-campo">${marcaModelo}</div>`;
    if (etiquetaConfig.mostrar_defeito && defeito) html += `<div class="etiqueta-defeito">Def: ${defeito}</div>`;
    if (etiquetaConfig.mostrar_valor && valorTotal) html += `<div class="etiqueta-campo etiqueta-campo-bold">${valorTotal}</div>`;
    if (etiquetaConfig.mostrar_data) html += `<div class="etiqueta-campo etiqueta-data">Entrada: ${dataEntrada}</div>`;
    if (etiquetaConfig.mostrar_senha && ordem.senha_desbloqueio) html += `<div class="etiqueta-campo">Senha: ${ordem.senha_desbloqueio}</div>`;

    html += "</div>";
    return html;
  }, [clienteNome, clienteTelefone, dataEntrada, defeito, etiquetaConfig, marcaModelo, ordem, logoUrl, valorTotal]);

  useEffect(() => {
    const targetWindow = printWindow ?? window.open("", "_blank", "width=400,height=400");

    if (!targetWindow) {
      onFechar();
      return;
    }

    targetWindow.document.open();
    targetWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Etiqueta OS #${ordem.numero_os}</title>
        <style>
          @page {
            size: ${largura}mm ${altura}mm;
            margin: 0;
          }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            width: ${largura}mm;
            height: ${altura}mm;
            font-family: Arial, Helvetica, sans-serif;
            font-size: ${fontSize};
            color: #000;
            font-weight: 500;
            line-height: 1.3;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            overflow: hidden;
          }
          .etiqueta-container {
            width: ${largura}mm;
            height: ${altura}mm;
            padding: 1.5mm;
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }
          .etiqueta-os-numero {
            font-weight: 900;
            font-size: ${titleSize};
            text-align: center;
            border-bottom: 1.5px solid #000;
            padding-bottom: 1mm;
            margin-bottom: 1mm;
          }
          .etiqueta-logo {
            text-align: center;
            margin-bottom: 1mm;
          }
          .etiqueta-campo {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            line-height: 1.4;
          }
          .etiqueta-campo-bold {
            font-weight: 700;
          }
          .etiqueta-defeito {
            font-weight: 700;
            overflow: hidden;
            text-overflow: ellipsis;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            line-height: 1.3;
          }
          .etiqueta-data {
            font-size: calc(${fontSize} - 1pt);
            color: #333;
          }
        </style>
      </head>
      <body>
        ${buildContent()}
        ${getPrintScript()}
      </body>
      </html>
    `);
    targetWindow.document.close();
    targetWindow.focus();

    const originalAfterPrint = targetWindow.onafterprint;
    targetWindow.onafterprint = () => {
      originalAfterPrint?.call(targetWindow, new Event("afterprint"));
      onFechar();
    };

    const safetyTimer = window.setTimeout(() => {
      onFechar();
    }, 10000);

    return () => window.clearTimeout(safetyTimer);
  }, [buildContent, fontSize, largura, altura, onFechar, ordem.numero_os, printWindow, titleSize]);

  return null;
}
