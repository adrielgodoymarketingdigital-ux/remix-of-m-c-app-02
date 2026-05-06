import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { OrdemServico } from "@/hooks/useOrdensServico";
import { AvariasOS } from "@/types/ordem-servico";
import { ConfiguracaoLoja, LayoutOSConfig, Layout80mmConfig } from "@/types/configuracao-loja";
import { obterTermoGarantia, LAYOUT_PADRAO } from "@/lib/termo-garantia-utils";
import { ImpressaoCupom80mm } from "./ImpressaoCupom80mm";
import { ImpressaoA4Padrao } from "./ImpressaoA4Padrao";
import { ImpressaoA4Tech } from "./ImpressaoA4Tech";

const CONFIG_80MM_PADRAO: Layout80mmConfig = {
  mostrar_logo: true,
  mostrar_dados_loja: true,
  mostrar_dados_cliente: true,
  mostrar_dados_dispositivo: true,
  mostrar_defeito: true,
  mostrar_servicos: true,
  mostrar_valor: true,
  mostrar_checklist: false,
  mostrar_avarias: false,
  mostrar_senha: true,
  mostrar_assinaturas: true,
  mostrar_termos_condicoes: false,
  mostrar_forma_pagamento: true,
  mostrar_custos_adicionais: true,
};

interface ImpressaoOrdemServicoProps {
  ordem: OrdemServico;
  configuracaoLoja?: ConfiguracaoLoja;
  onFecharImpressao: () => void;
}

export const ImpressaoOrdemServico = ({
  ordem,
  configuracaoLoja,
  onFecharImpressao,
}: ImpressaoOrdemServicoProps) => {
  const avariasData = ordem.avarias as AvariasOS | null;

  // Obter configurações de layout
  const layoutConfig: LayoutOSConfig = {
    ...LAYOUT_PADRAO,
    ...configuracaoLoja?.layout_os_config,
  };

  const is80mm = layoutConfig.formato_papel === '80mm';
  const c80: Layout80mmConfig = {
    ...CONFIG_80MM_PADRAO,
    ...layoutConfig.config_80mm,
  };

  // Obter termo de garantia personalizado
  const termoGarantia = obterTermoGarantia({
    tempoGarantia: ordem.tempo_garantia,
    termoConfig: configuracaoLoja?.termo_garantia_config,
    nomeLoja: configuracaoLoja?.nome_loja,
    nomeCliente: ordem.cliente?.nome,
    dispositivo: `${ordem.dispositivo_marca} ${ordem.dispositivo_modelo}`,
  });

  // Detect standalone PWA mode (installed app)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as any).standalone === true;

  // Renderizar em um portal separado evita que o resto da UI influencie a paginação do print
  const portalEl = useMemo(() => {
    if (typeof document === "undefined") return null;
    const el = document.createElement("div");
    el.id = "print-root";
    el.className = "print-root";
    return el;
  }, []);

  useEffect(() => {
    if (!portalEl) return;
    document.body.appendChild(portalEl);

    const is80mmFormat = layoutConfig.formato_papel === '80mm';
    if (is80mmFormat) {
      document.body.classList.add('print-80mm');
    }

    const isHorizontal = !is80mmFormat && layoutConfig.duas_os_por_folha && layoutConfig.duas_os_orientacao === 'horizontal';
    if (isHorizontal) {
      document.body.classList.add('print-duas-os-horizontal');
    }

    let pageStyleEl: HTMLStyleElement | null = null;
    if (isHorizontal) {
      pageStyleEl = document.createElement('style');
      pageStyleEl.id = 'print-page-landscape';
      pageStyleEl.textContent = '@media print { @page { size: A4 landscape; margin: 8mm; } }';
      document.head.appendChild(pageStyleEl);
    }

    return () => {
      portalEl.remove();
      document.body.classList.remove('print-80mm');
      document.body.classList.remove('print-duas-os-horizontal');
      pageStyleEl?.remove();
    };
  }, [portalEl, layoutConfig.formato_papel, layoutConfig.duas_os_por_folha, layoutConfig.duas_os_orientacao]);

  // Detect Android
  const isAndroid = /android/i.test(navigator.userAgent);

  // On Android, window.print() on the main SPA DOM causes "Preparing preview..." hang.
  // Always use a new window on Android to isolate the print content.
  const handlePrintAndroid = () => {
    if (!portalEl) return;

    // Get the print content
    const contentEl = portalEl.querySelector('.impressao-ordem-container, .cupom-80mm-container, .impressao-duas-os-wrapper');
    const contentHtml = contentEl ? contentEl.outerHTML : portalEl.innerHTML;
    const is80mmFormat = layoutConfig.formato_papel === '80mm';
    const isHorizontalMode = !is80mmFormat && layoutConfig.duas_os_por_folha && layoutConfig.duas_os_orientacao === 'horizontal';

    // Extract CSS custom properties from :root (needed for hsl(var(--...)) references)
    let cssVars = '';
    try {
      const rootStyles = getComputedStyle(document.documentElement);
      const varNames = ['--background','--foreground','--primary','--primary-foreground','--secondary','--secondary-foreground','--muted','--muted-foreground','--accent','--accent-foreground','--border','--input','--ring','--radius'];
      const vars = varNames.map(v => `${v}: ${rootStyles.getPropertyValue(v)};`).join('\n');
      cssVars = `:root { ${vars} }`;
    } catch { /* ignore */ }

    // Extract only print-related CSS rules (not ALL Tailwind classes)
    let printCSS = '';
    try {
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules || [])) {
            const text = rule.cssText;
            // Only keep rules relevant to printing
            if (
              text.includes('impressao-') ||
              text.includes('cupom-') ||
              text.includes('print-') ||
              text.includes('@media print') ||
              text.includes('@page') ||
              text.includes('checklist') ||
              text.includes('silhueta') ||
              text.includes('avaria') ||
              text.includes('.text-xs') ||
              text.includes('.text-sm') ||
              text.includes(':root')
            ) {
              printCSS += text + '\n';
            }
          }
        } catch { /* cross-origin, skip */ }
      }
    } catch { /* ignore */ }

    // Build a self-contained HTML document with minimal CSS
    const htmlDoc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>OS #${ordem.numero_os}</title>
  <style>
    ${cssVars}
    ${printCSS}
    /* Essential resets */
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { margin: 0; padding: 4mm; background: white; color: black; font-family: system-ui, -apple-system, sans-serif; }
    #print-root { position: static !important; overflow: visible !important; width: 100% !important; height: auto !important; display: block !important; }
    .impressao-ordem-container {
      width: 100% !important; max-width: 194mm !important; margin: 0 auto !important;
      display: flex !important; flex-direction: column !important;
      overflow: visible !important; max-height: none !important; height: auto !important;
      background: white; color: #111; font-size: 8pt; line-height: 1.3;
      font-family: system-ui, -apple-system, sans-serif;
    }
    /* ── HEADER TECNOLÓGICO ── */
    .impressao-header {
      margin-bottom: 3mm;
      border-radius: 2px;
      overflow: hidden;
    }
    .impressao-header-top {
      display: flex; align-items: center; gap: 3mm;
      padding: 3mm 4mm;
      background: var(--accent-color, #1e293b);
      color: white;
    }
    .impressao-logo { width: 14mm; height: 14mm; object-fit: contain; border-radius: 1px; background: rgba(255,255,255,0.12); }
    .impressao-header-info { flex: 1; }
    .impressao-titulo { font-size: 13pt; font-weight: 800; margin: 0; letter-spacing: 0.5px; color: white; }
    .impressao-numero-os { font-size: 9pt; font-weight: 600; margin-top: 0.5mm; color: rgba(255,255,255,0.8); }
    .impressao-data-status { display: flex; align-items: center; gap: 2mm; margin-top: 0.8mm; font-size: 7pt; color: rgba(255,255,255,0.65); }
    .impressao-badge {
      display: inline-block; padding: 0.4mm 2mm; font-size: 5.5pt; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.6px;
      background: rgba(255,255,255,0.18); color: white; border-radius: 20px;
      border: 0.5pt solid rgba(255,255,255,0.25);
    }
    .impressao-header-loja {
      padding: 1.5mm 4mm;
      background: #f1f5f9;
      border-top: 0.5pt solid #e2e8f0;
      font-size: 6.5pt; color: #475569; line-height: 1.4;
      display: flex; align-items: center; justify-content: space-between;
    }
    .impressao-header-loja strong { color: #1e293b; font-weight: 700; }
    /* ── BLOCKS ── */
    .impressao-block {
      overflow: visible !important;
      border: 0.5pt solid #e2e8f0;
      border-left: 2pt solid var(--accent-color, #2563eb);
      border-radius: 2px;
      padding: 0;
      margin-bottom: 2.5mm;
    }
    .impressao-block-minimal { padding: 0; }
    .impressao-block-header {
      display: flex; align-items: center; gap: 1.5mm;
      padding: 1mm 2mm;
      background: #f8fafc;
      border-bottom: 0.5pt solid #e2e8f0;
    }
    .impressao-block-header-minimal { display: flex; align-items: center; justify-content: center; padding: 0.8mm; background: #f8fafc; border-bottom: 0.5pt solid #e2e8f0; }
    .impressao-icon { width: 3mm; height: 3mm; color: var(--accent-color, #2563eb); }
    .impressao-block-title { font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; margin: 0; color: #334155; }
    .impressao-block-content { font-size: 7.5pt; padding: 1.5mm 2mm; }
    .impressao-field { display: flex; gap: 1mm; margin-bottom: 0.6mm; }
    .impressao-label { font-weight: 600; white-space: nowrap; font-size: 6.5pt; color: #64748b; }
    .impressao-value { font-size: 7.5pt; color: #1e293b; }
    .impressao-defeito { font-size: 7.5pt; color: #1e293b; }
    /* ── VALOR TOTAL ── */
    .impressao-valor-block .impressao-block-content { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 2mm; }
    .impressao-valor-total {
      font-size: 15pt; font-weight: 800; text-align: center;
      color: #16a34a;
      letter-spacing: -0.3px;
    }
    .impressao-valor-subtotal { font-size: 6.5pt; color: #64748b; text-decoration: line-through; text-align: center; margin-bottom: 0.5mm; }
    .impressao-valor-desconto { font-size: 6.5pt; color: #dc2626; text-align: center; margin-bottom: 1mm; }
    /* ── GRIDS ── */
    .impressao-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 2.5mm; margin-bottom: 2.5mm; }
    .impressao-grid-defeito-valor { display: grid; grid-template-columns: 7fr 3fr; gap: 2.5mm; margin-bottom: 2.5mm; }
    .impressao-grid-adaptativo { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2.5mm; margin-bottom: 2.5mm; }
    /* ── ITENS ── */
    .impressao-itens-lista { margin-bottom: 1mm; }
    .impressao-itens-titulo { font-weight: 700; font-size: 6.5pt; color: #64748b; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 0.8mm; padding-bottom: 0.5mm; border-bottom: 0.3pt solid #e2e8f0; }
    .impressao-item-linha { display: flex; justify-content: space-between; font-size: 7pt; padding: 0.4mm 0; border-bottom: 0.3pt solid #f1f5f9; }
    .impressao-item-nome { flex: 1; color: #334155; }
    .impressao-item-valor { font-weight: 700; white-space: nowrap; color: #1e293b; }
    /* ── CHECKLIST ── */
    .impressao-checklist-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1mm; }
    .impressao-checklist-item { display: flex; align-items: center; gap: 0.5mm; font-size: 6.5pt; }
    /* ── TERMO ── */
    .impressao-termo-garantia { font-size: 6pt; color: #475569; padding: 1.5mm 2mm; border: 0.5pt solid #e2e8f0; border-left: 2pt solid #94a3b8; background: #f8fafc; white-space: pre-line; margin-bottom: 2.5mm; border-radius: 2px; }
    .impressao-termo-title { font-size: 7pt; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 1mm; }
    /* ── FOOTER / ASSINATURAS ── */
    .impressao-footer { margin-top: auto; padding-top: 2mm; border-top: 0.5pt solid #e2e8f0; }
    .impressao-assinaturas { display: flex; justify-content: space-around; gap: 4mm; }
    .impressao-assinatura { display: flex; flex-direction: column; align-items: center; min-width: 30mm; }
    .impressao-linha-assinatura { width: 100%; border-bottom: 0.5pt solid #334155; margin-bottom: 1mm; min-height: 8mm; }
    .impressao-assinatura-label { font-size: 6pt; color: #64748b; text-align: center; }
    .impressao-assinatura-data { font-size: 5.5pt; color: #94a3b8; text-align: center; margin-top: 0.5mm; }
    .impressao-assinatura-digital { display: flex; justify-content: center; margin-bottom: 1mm; }
    .impressao-assinatura-imagem { max-width: 35mm; max-height: 12mm; }
    .impressao-custos-resumo { margin-top: 1mm; padding-top: 1mm; border-top: 0.5pt dashed #cbd5e1; font-size: 7pt; }
    .impressao-custos-resumo > div { display: flex; justify-content: space-between; }
    svg { display: inline-block; vertical-align: middle; }
    .print-trigger-container { display: none !important; }
    /* Cupom 80mm styles - optimized for thermal printers */
    .cupom-80mm-container { width: 72mm; margin: 0 auto; padding: 2mm; font-family: Arial, Helvetica, sans-serif; font-size: 9pt; color: #000; font-weight: 500; line-height: 1.4; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .cupom-section { margin-bottom: 2mm; padding-bottom: 2mm; }
    .cupom-center { text-align: center; }
    .cupom-border-bottom { border-bottom: 1.5px dashed #000; padding-bottom: 2mm; }
    .cupom-loja-nome { font-weight: 900; font-size: 11pt; letter-spacing: 0.3px; }
    .cupom-small { font-size: 7pt; color: #000; font-weight: 500; }
    .cupom-os-numero { font-size: 12pt; font-weight: 900; }
    .cupom-section-title { font-weight: 800; font-size: 8pt; margin-bottom: 1mm; text-decoration: underline; letter-spacing: 0.5px; }
    .cupom-line-between { display: flex; justify-content: space-between; font-weight: 600; }
    .cupom-total { font-size: 13pt; font-weight: 900; text-align: center; border-top: 2px dashed #000; border-bottom: 2px dashed #000; padding: 2.5mm 0; }
    .cupom-logo { max-width: 28mm; max-height: 14mm; }
    .cupom-checklist-item { display: flex; align-items: center; gap: 1.5mm; font-size: 7.5pt; font-weight: 500; }
    .cupom-termo { font-size: 6.5pt; color: #000; white-space: pre-line; font-weight: 500; }
    .cupom-assinaturas { margin-top: 3mm; border-top: 1.5px dashed #000; padding-top: 2mm; }
    .cupom-assinatura-bloco { text-align: center; margin-bottom: 2mm; }
    .cupom-linha-assinatura { border-bottom: 1.5px solid #000; width: 90%; margin: 3mm auto 1mm; }
    .cupom-assinatura-img { max-width: 30mm; max-height: 10mm; }
    /* Duas OS por folha */
    .impressao-duas-os-wrapper { display: flex; flex-direction: row; align-items: flex-start; background: white; gap: 0; }
    .impressao-duas-os-slot { overflow: hidden; position: relative; flex-shrink: 0; }
    .impressao-duas-os-slot > * { transform-origin: top left; transform: scale(0.5); width: 194mm !important; max-width: 194mm !important; }
    .impressao-duas-os-vertical { width: 194mm; }
    .impressao-duas-os-vertical .impressao-duas-os-slot { width: 97mm; height: 138.5mm; }
    .impressao-duas-os-horizontal { width: 277mm; }
    .impressao-duas-os-horizontal .impressao-duas-os-slot { width: 138.5mm; height: 194mm; }
    .impressao-duas-os-horizontal .impressao-duas-os-slot > * { transform: scale(0.713); }
    .impressao-duas-os-corte { width: 0; flex-shrink: 0; border-left: 1pt dashed #aaa; display: flex; align-items: center; justify-content: center; position: relative; }
    .impressao-duas-os-vertical .impressao-duas-os-corte { height: 138.5mm; }
    .impressao-duas-os-horizontal .impressao-duas-os-corte { height: 194mm; }
    .impressao-duas-os-corte-label { background: white; padding: 2mm 0; font-size: 6pt; color: #bbb; font-style: italic; writing-mode: vertical-rl; white-space: nowrap; position: absolute; top: 50%; transform: translateY(-50%) rotate(180deg); }
    ${isHorizontalMode ? '@page { size: A4 landscape; margin: 8mm; }' : (is80mmFormat ? '@page { size: 80mm auto; margin: 0; } body { width: 80mm; padding: 0; }' : '@page { size: A4 portrait; margin: 8mm; }')}
    @media print {
      * { box-shadow: none !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      body { overflow: visible !important; }
      img { max-width: 100% !important; }
      .impressao-duas-os-wrapper { page-break-inside: avoid !important; }
      .impressao-duas-os-slot { overflow: hidden !important; }
      .impressao-duas-os-vertical { width: 194mm !important; }
      .impressao-duas-os-vertical .impressao-duas-os-slot { width: 97mm !important; height: 138.5mm !important; }
      .impressao-duas-os-vertical .impressao-duas-os-corte { height: 138.5mm !important; }
      .impressao-duas-os-horizontal { width: 277mm !important; }
      .impressao-duas-os-horizontal .impressao-duas-os-slot { width: 138.5mm !important; height: 194mm !important; }
      .impressao-duas-os-horizontal .impressao-duas-os-corte { height: 194mm !important; }
    }
  </style>
</head>
<body ${is80mmFormat ? 'class="print-80mm"' : ''}>
  <div id="print-root">
    ${contentHtml}
  </div>
  <script>
    (function() {
      var printed = false;
      function doPrint() {
        if (printed) return;
        printed = true;
        window.print();
        window.onafterprint = function() { window.close(); };
      }
      var images = document.querySelectorAll('img');
      if (images.length === 0) {
        setTimeout(doPrint, 500);
      } else {
        var promises = Array.from(images).map(function(img) {
          if (img.complete) return Promise.resolve();
          return new Promise(function(resolve) {
            img.onload = resolve;
            img.onerror = function() { img.style.display = 'none'; resolve(); };
          });
        });
        Promise.all(promises).then(function() { setTimeout(doPrint, 500); });
      }
      setTimeout(doPrint, 4000);
    })();
  </script>
</body>
</html>`;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.print();
      return;
    }
    printWindow.document.write(htmlDoc);
    printWindow.document.close();
  };

  // Trigger print
  const handlePrint = () => {
    // On ALL Android devices, use the new-window approach to avoid hang
    if (isAndroid) {
      handlePrintAndroid();
      return;
    }

    // On non-standalone contexts, auto-close after print
    if (!isStandalone) {
      const handleAfterPrint = () => {
        window.removeEventListener('afterprint', handleAfterPrint);
        setTimeout(() => {
          onFecharImpressao();
        }, 300);
      };
      window.addEventListener('afterprint', handleAfterPrint);
    }

    setTimeout(() => {
      window.print();
    }, 500);
  };

  if (!portalEl) return null;

  const duasOsPorFolha = !is80mm && (layoutConfig.duas_os_por_folha ?? false);
  const duasOsOrientacao = layoutConfig.duas_os_orientacao ?? 'horizontal';

  const renderA4 = () => {
    if (layoutConfig.versao_layout_a4 === 'tech') {
      return (
        <ImpressaoA4Tech
          ordem={ordem}
          configuracaoLoja={configuracaoLoja}
          layoutConfig={layoutConfig}
          termoGarantia={termoGarantia}
        />
      );
    }
    return (
      <ImpressaoA4Padrao
        ordem={ordem}
        configuracaoLoja={configuracaoLoja}
        layoutConfig={layoutConfig}
        termoGarantia={termoGarantia}
      />
    );
  };

  return createPortal(
    <>
      {/* Print buttons - visible only on screen */}
      <div className="print-trigger-container">
        <button onClick={handlePrint} className="print-trigger-button">
          Imprimir Agora
        </button>
        <button onClick={onFecharImpressao} className="print-close-button">
          {isStandalone ? "Voltar" : "Cancelar"}
        </button>
      </div>

      {/* 80mm: use dedicated receipt-style component */}
      {is80mm ? (
        <ImpressaoCupom80mm
          ordem={ordem}
          configuracaoLoja={configuracaoLoja}
          config80mm={c80}
        />
      ) : duasOsPorFolha ? (
        <div className={`impressao-duas-os-wrapper impressao-duas-os-${duasOsOrientacao}`}>
          <div className="impressao-duas-os-slot">
            {renderA4()}
          </div>
          <div className="impressao-duas-os-corte">
            <span className="impressao-duas-os-corte-label">✂ cortar aqui</span>
          </div>
          <div className="impressao-duas-os-slot">
            {renderA4()}
          </div>
        </div>
      ) : (
        renderA4()
      )}
    </>,
    portalEl
  );
};

