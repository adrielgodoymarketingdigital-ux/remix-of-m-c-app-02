import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { OrdemServico } from "@/hooks/useOrdensServico";
import { formatCurrency, formatDate, formatPhone, formatCPF } from "@/lib/formatters";
import { AvariasOS, AvariaVisual, ProdutoUtilizado, ServicoRealizado, CustoAdicional } from "@/types/ordem-servico";
import { ConfiguracaoLoja, LayoutOSConfig, Layout80mmConfig } from "@/types/configuracao-loja";
import { SilhuetaComAvarias } from "./SilhuetaComAvarias";
import { PatternLockVisualizacao } from "./PatternLockVisualizacao";
import { checklistIcons } from "@/lib/checklist-icons";
import { CheckCircle2, XCircle, User, Smartphone, Lock, FileText, DollarSign, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { decryptSenhaDesbloqueio } from "@/lib/password-encryption";
import { obterTermoGarantia, LAYOUT_PADRAO } from "@/lib/termo-garantia-utils";
import { ImpressaoCupom80mm } from "./ImpressaoCupom80mm";

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
  const checklistEntrada = avariasData?.checklist?.entrada || {};
  const checklistSaida = avariasData?.checklist?.saida || {};
  const avariasVisuais = (avariasData?.avarias_visuais || []) as AvariaVisual[];
  const senhaDesbloqueio = decryptSenhaDesbloqueio(avariasData?.senha_desbloqueio);
  const assinaturas = avariasData?.assinaturas;
  // Suportar ambos os formatos: servicos_realizados (novo) e servicos_inline (onboarding)
  let servicosRealizados: ServicoRealizado[] = (avariasData?.servicos_realizados || []) as ServicoRealizado[];
  if (servicosRealizados.length === 0 && (avariasData as any)?.servicos_inline?.length > 0) {
    servicosRealizados = ((avariasData as any).servicos_inline as any[]).map((s: any, i: number) => ({
      id: `inline-${i}`,
      nome: s.nome,
      preco: s.valor || 0,
      custo: 0,
      lucro: s.valor || 0,
    }));
  }
  const produtosUtilizados = (avariasData?.produtos_utilizados || []) as ProdutoUtilizado[];
  const custosAdicionais = (avariasData?.custos_adicionais || []) as CustoAdicional[];

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

  // Helper: should a section be visible?
  const mostrar = (secao: keyof Layout80mmConfig, fallbackA4?: boolean): boolean => {
    if (!is80mm) return fallbackA4 ?? true;
    return c80[secao] ?? true;
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

    // Add 80mm class to body for @page size override
    const is80mmFormat = layoutConfig.formato_papel === '80mm';
    if (is80mmFormat) {
      document.body.classList.add('print-80mm');
    }

    return () => {
      portalEl.remove();
      document.body.classList.remove('print-80mm');
    };
  }, [portalEl, layoutConfig.formato_papel]);

  // Detect Android
  const isAndroid = /android/i.test(navigator.userAgent);

  // On Android, window.print() on the main SPA DOM causes "Preparing preview..." hang.
  // Always use a new window on Android to isolate the print content.
  const handlePrintAndroid = () => {
    if (!portalEl) return;

    // Get the print content
    const contentEl = portalEl.querySelector('.impressao-ordem-container, .cupom-80mm-container');
    const contentHtml = contentEl ? contentEl.outerHTML : portalEl.innerHTML;
    const is80mmFormat = layoutConfig.formato_papel === '80mm';

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
      background: white; color: black; font-size: 8pt; line-height: 1.25;
      font-family: system-ui, -apple-system, sans-serif;
    }
    .impressao-block { overflow: visible !important; border: 0.5pt solid #ddd; border-radius: 1px; padding: 2mm; margin-bottom: 2mm; }
    .impressao-block-minimal { padding: 1.5mm; }
    .impressao-header { margin-bottom: 3mm; padding-bottom: 2mm; border-bottom: 0.5pt solid #ddd; }
    .impressao-header-content { display: flex; align-items: center; gap: 3mm; margin-bottom: 1.5mm; }
    .impressao-logo { width: 14mm; height: 14mm; object-fit: contain; }
    .impressao-header-info { flex: 1; }
    .impressao-titulo { font-size: 13pt; font-weight: 700; margin: 0; color: #333; }
    .impressao-numero-os { font-size: 9pt; font-weight: 600; margin-top: 0.5mm; }
    .impressao-data-status { display: flex; align-items: center; gap: 2mm; margin-top: 0.5mm; font-size: 8pt; color: #666; }
    .impressao-badge { display: inline-block; padding: 0.3mm 1.5mm; font-size: 6pt; font-weight: 600; text-transform: uppercase; background: #f0f0f0; }
    .impressao-loja-info { padding: 1.5mm; background: #f8f8f8; font-size: 7pt; line-height: 1.25; color: #666; }
    .impressao-loja-info .text-sm { font-size: 8pt; }
    .impressao-loja-info .text-xs { font-size: 6pt; }
    .impressao-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; margin-bottom: 3mm; }
    .impressao-grid-defeito-valor { display: grid; grid-template-columns: 7fr 3fr; gap: 3mm; margin-bottom: 3mm; }
    .impressao-grid-adaptativo { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm; margin-bottom: 3mm; }
    .impressao-block-header { display: flex; align-items: center; gap: 1.5mm; padding: 1mm 1.5mm; margin-bottom: 1.5mm; background: #f5f5f5; border-bottom: 0.5pt solid #ddd; }
    .impressao-block-header-minimal { display: flex; align-items: center; justify-content: center; margin-bottom: 0.5mm; }
    .impressao-icon { width: 3mm; height: 3mm; color: #333; }
    .impressao-block-title { font-size: 7pt; font-weight: 700; text-transform: uppercase; margin: 0; }
    .impressao-block-content { font-size: 7.5pt; }
    .impressao-field { display: flex; gap: 1mm; margin-bottom: 0.5mm; }
    .impressao-label { font-weight: 600; white-space: nowrap; font-size: 7pt; color: #555; }
    .impressao-value { font-size: 7.5pt; }
    .impressao-defeito { font-size: 7.5pt; }
    .impressao-valor-total { font-size: 14pt; font-weight: 700; text-align: center; color: #222; }
    .impressao-itens-lista { margin-bottom: 1mm; }
    .impressao-itens-titulo { font-weight: 700; font-size: 7pt; margin-bottom: 0.5mm; }
    .impressao-item-linha { display: flex; justify-content: space-between; font-size: 7pt; padding: 0.3mm 0; }
    .impressao-item-nome { flex: 1; }
    .impressao-item-valor { font-weight: 600; white-space: nowrap; }
    .impressao-checklist-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1mm; }
    .impressao-checklist-item { display: flex; align-items: center; gap: 0.5mm; font-size: 6.5pt; }
    .impressao-termo-garantia { font-size: 6pt; color: #444; padding: 1.5mm; border: 0.5pt solid #ddd; background: #fafafa; white-space: pre-line; }
    .impressao-footer { margin-top: auto; padding-top: 2mm; border-top: 0.5pt solid #ddd; }
    .impressao-assinaturas { display: flex; justify-content: space-around; gap: 4mm; }
    .impressao-assinatura { display: flex; flex-direction: column; align-items: center; min-width: 30mm; }
    .impressao-assinatura-linha { width: 100%; border-bottom: 0.5pt solid #000; margin-bottom: 1mm; min-height: 8mm; }
    .impressao-assinatura-label { font-size: 6pt; color: #666; text-align: center; }
    .impressao-assinatura-img { max-width: 35mm; max-height: 12mm; }
    .impressao-custos-resumo { margin-top: 1mm; padding-top: 1mm; border-top: 0.5pt dashed #ccc; font-size: 7pt; }
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
    ${is80mmFormat ? '@page { size: 80mm auto; margin: 0; } body { width: 80mm; padding: 0; }' : '@page { size: A4; margin: 8mm; }'}
    @media print {
      * { box-shadow: none !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      body { overflow: visible !important; }
      img { max-width: 100% !important; }
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
      ) : (
        /* A4: existing layout */
        <div className="impressao-ordem-container">
          {/* Header Block */}
          <div className="impressao-header">
            <div className="impressao-header-content">
              {layoutConfig.mostrar_logo_impressao && configuracaoLoja?.logo_url && (
                <img src={configuracaoLoja.logo_url} alt="Logo" className="impressao-logo" />
              )}
              <div className="impressao-header-info">
                <h1 className="impressao-titulo">ORDEM DE SERVIÇO</h1>
                <div className="impressao-numero-os">#{ordem.numero_os}</div>
                <div className="impressao-data-status">
                  <span>{formatDate(ordem.created_at)}</span>
                  <Badge className="impressao-badge">{ordem.status}</Badge>
                </div>
              </div>
            </div>
            {configuracaoLoja && (
              <div className="impressao-loja-info">
                <div className="text-sm">
                  <strong>{configuracaoLoja.nome_loja}</strong>
                </div>
                {configuracaoLoja.cnpj && <div className="text-xs">CNPJ: {configuracaoLoja.cnpj}</div>}
                {configuracaoLoja.endereco && <div className="text-xs">{configuracaoLoja.endereco}</div>}
                {configuracaoLoja.telefone && (
                  <div className="text-xs">Tel: {formatPhone(configuracaoLoja.telefone)}</div>
                )}
              </div>
            )}
          </div>

          {/* Two-Column Layout: Cliente + Dispositivo */}
          <div className="impressao-grid-2">
            {/* Cliente Block */}
            <div className="impressao-block impressao-block-minimal">
              <div className="impressao-block-header-minimal">
                <User className="impressao-icon" />
              </div>
              <div className="impressao-block-content">
                <div className="impressao-field">
                  <span className="impressao-label">Nome:</span>
                  <span className="impressao-value">{ordem.cliente?.nome || "N/A"}</span>
                </div>
                <div className="impressao-field">
                  <span className="impressao-label">Tel:</span>
                  <span className="impressao-value">
                    {ordem.cliente?.telefone ? formatPhone(ordem.cliente.telefone) : "N/A"}
                  </span>
                </div>
                <div className="impressao-field">
                  <span className="impressao-label">CPF:</span>
                  <span className="impressao-value">
                    {ordem.cliente?.cpf ? formatCPF(ordem.cliente.cpf) : "N/A"}
                  </span>
                </div>
              </div>
            </div>

            {/* Dispositivo Block */}
            <div className="impressao-block impressao-block-minimal">
              <div className="impressao-block-header-minimal">
                <Smartphone className="impressao-icon" />
              </div>
              <div className="impressao-block-content">
                <div className="impressao-field">
                  <span className="impressao-label">Tipo/Marca:</span>
                  <span className="impressao-value">
                    {ordem.dispositivo_tipo} {ordem.dispositivo_marca}
                  </span>
                </div>
                <div className="impressao-field">
                  <span className="impressao-label">Modelo/Cor:</span>
                  <span className="impressao-value">
                    {ordem.dispositivo_modelo} ({ordem.dispositivo_cor || "N/A"})
                  </span>
                </div>
                <div className="impressao-field">
                  <span className="impressao-label">IMEI/Série:</span>
                  <span className="impressao-value">
                    {ordem.dispositivo_imei || ordem.dispositivo_numero_serie || "N/A"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Grid Defeito + Valor */}
          <div className="impressao-grid-defeito-valor">
            {/* Defeito Relatado Block */}
            <div className="impressao-block impressao-defeito-block">
              <div className="impressao-block-header">
                <FileText className="impressao-icon" />
                <h2 className="impressao-block-title">Defeito Relatado</h2>
              </div>
              <div className="impressao-block-content">
                <p className="impressao-defeito">{ordem.defeito_relatado}</p>
              </div>
            </div>

            {/* Valor Total Block */}
            <div className="impressao-block impressao-valor-block">
              <div className="impressao-block-header">
                <DollarSign className="impressao-icon" />
                <h2 className="impressao-block-title">Valor do Serviço</h2>
              </div>
              <div className="impressao-block-content">
                <div className="impressao-valor-total">{formatCurrency(ordem.total || 0)}</div>
              </div>
            </div>
          </div>

          {/* Itens do Serviço (Serviços + Produtos) */}
          {(servicosRealizados.length > 0 || produtosUtilizados.length > 0) && (
            <div className="impressao-block">
              <div className="impressao-block-header">
                <Package className="impressao-icon" />
                <h2 className="impressao-block-title">Itens do Serviço</h2>
              </div>
              <div className="impressao-block-content">
                {servicosRealizados.length > 0 && (
                  <div className="impressao-itens-lista">
                    <div className="impressao-itens-titulo">Serviços:</div>
                    {servicosRealizados.map((servico) => (
                      <div key={servico.id} className="impressao-item-linha">
                        <span className="impressao-item-nome">• {servico.nome}</span>
                        <span className="impressao-item-valor">{formatCurrency(servico.preco)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {produtosUtilizados.length > 0 && (
                  <div className="impressao-itens-lista">
                    <div className="impressao-itens-titulo">Produtos/Peças:</div>
                    {produtosUtilizados.map((produto) => (
                      <div key={produto.id} className="impressao-item-linha">
                        <span className="impressao-item-nome">• {produto.quantidade}x {produto.nome}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Custos Adicionais */}
          {custosAdicionais.length > 0 && (
            <div className="impressao-block">
              <div className="impressao-block-header">
                <Package className="impressao-icon" />
                <h2 className="impressao-block-title">Custos Adicionais</h2>
              </div>
              <div className="impressao-block-content">
                <div className="impressao-itens-lista">
                  {custosAdicionais.map((custo) => (
                    <div key={custo.id} className="impressao-item-linha">
                      <span className="impressao-item-nome">
                        • {custo.tipo === 'frete' ? 'Frete' : custo.tipo === 'brinde' ? 'Brinde' : custo.descricao}
                        {custo.descricao && custo.tipo !== 'outro' ? ` - ${custo.descricao}` : ''}
                        <span style={{ fontSize: '0.7em', color: '#666', marginLeft: '4px' }}>
                          ({custo.repassar_cliente ? 'Cliente paga' : 'Loja assume'})
                        </span>
                      </span>
                      <span className="impressao-item-valor">{formatCurrency(custo.valor)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Forma de Pagamento */}
          {(ordem as any).forma_pagamento && (
            <div className="impressao-block">
              <div className="impressao-block-header">
                <DollarSign className="impressao-icon" />
                <h2 className="impressao-block-title">Forma de Pagamento</h2>
              </div>
              <div className="impressao-block-content">
                <p>{(ordem as any).forma_pagamento}</p>
              </div>
            </div>
          )}

          {/* Grid Adaptativo: Senha + Checklist + Avarias */}
          <div className="impressao-grid-adaptativo">
            {/* Senha de Desbloqueio Block */}
            {layoutConfig.mostrar_senha && senhaDesbloqueio && (
              <div className="impressao-block">
                <div className="impressao-block-header">
                  <Lock className="impressao-icon" />
                  <h2 className="impressao-block-title">Senha de Desbloqueio</h2>
                </div>
                <div className="impressao-block-content impressao-senha-content">
                  <div className="impressao-senha-info">
                    <div className="impressao-field">
                      <span className="impressao-label">Tipo:</span>
                      <span className="impressao-value">
                        {senhaDesbloqueio.tipo === "numero" && "PIN"}
                        {senhaDesbloqueio.tipo === "letra" && "Texto"}
                        {senhaDesbloqueio.tipo === "padrao" && "Padrão Android"}
                      </span>
                    </div>
                    {senhaDesbloqueio.tipo !== "padrao" && (
                      <div className="impressao-field">
                        <span className="impressao-label">Senha:</span>
                        <span className="impressao-value impressao-senha-valor">
                          {senhaDesbloqueio.valor || "N/A"}
                        </span>
                      </div>
                    )}
                    {senhaDesbloqueio.tipo === "padrao" && senhaDesbloqueio.padrao && (
                      <div className="impressao-field">
                        <PatternLockVisualizacao pattern={senhaDesbloqueio.padrao} size={80} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Sem Teste - Entrada */}
            {layoutConfig.mostrar_checklist && avariasData?.checklist?.sem_teste && (
              <div className="impressao-block">
                <div className="impressao-block-header">
                  <CheckCircle2 className="impressao-icon" />
                  <h2 className="impressao-block-title">Checklist de Entrada</h2>
                </div>
                <div className="impressao-block-content">
                  <p style={{ fontSize: '9pt', fontStyle: 'italic', margin: '4px 0' }}>
                    ⚠️ Sem teste: Não foi possível realizar os testes porque o aparelho chegou desligado.
                  </p>
                </div>
              </div>
            )}

            {/* Checklist de Entrada Block */}
            {layoutConfig.mostrar_checklist && Object.keys(checklistEntrada).length > 0 && (
              <div className="impressao-block">
                {!avariasData?.checklist?.sem_teste && (
                  <div className="impressao-block-header">
                    <CheckCircle2 className="impressao-icon" />
                    <h2 className="impressao-block-title">Checklist de Entrada</h2>
                  </div>
                )}
                <div className="impressao-block-content">
                  <div className="impressao-checklist">
                    {Object.entries(checklistEntrada).map(([item, status]) => {
                      const Icon = checklistIcons[item] || Smartphone;
                      return (
                        <div key={item}>
                          <div className="impressao-checklist-item">
                            <Icon className="impressao-checklist-icon" />
                            <span className="impressao-checklist-label">{item.replace(/_/g, " ")}</span>
                            {status ? (
                              <CheckCircle2 className="impressao-check-ok" />
                            ) : (
                              <XCircle className="impressao-check-erro" />
                            )}
                          </div>
                          {item === 'peca_trocada' && status && avariasData?.checklist?.peca_trocada_descricao_entrada && (
                            <div style={{ fontSize: '8pt', paddingLeft: '20px', fontStyle: 'italic', marginBottom: '4px' }}>
                              Peça: {avariasData.checklist.peca_trocada_descricao_entrada}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Checklist de Saída Block */}
            {layoutConfig.mostrar_checklist && Object.keys(checklistSaida).length > 0 && (
              <div className="impressao-block">
                <div className="impressao-block-header">
                  <CheckCircle2 className="impressao-icon" />
                  <h2 className="impressao-block-title">Checklist de Saída</h2>
                </div>
                <div className="impressao-block-content">
                  <div className="impressao-checklist">
                    {Object.entries(checklistSaida).map(([item, status]) => {
                      const Icon = checklistIcons[item] || Smartphone;
                      return (
                        <div key={item}>
                          <div className="impressao-checklist-item">
                            <Icon className="impressao-checklist-icon" />
                            <span className="impressao-checklist-label">{item.replace(/_/g, " ")}</span>
                            {status ? (
                              <CheckCircle2 className="impressao-check-ok" />
                            ) : (
                              <XCircle className="impressao-check-erro" />
                            )}
                          </div>
                          {item === 'peca_trocada' && status && avariasData?.checklist?.peca_trocada_descricao_saida && (
                            <div style={{ fontSize: '8pt', paddingLeft: '20px', fontStyle: 'italic', marginBottom: '4px' }}>
                              Peça: {avariasData.checklist.peca_trocada_descricao_saida}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Avarias Visuais Block */}
            {layoutConfig.mostrar_avarias && avariasVisuais.length > 0 && (
              <div className="impressao-block">
                <div className="impressao-block-header">
                  <Smartphone className="impressao-icon" />
                  <h2 className="impressao-block-title">Avarias Visuais</h2>
                </div>
                <div className="impressao-block-content">
                  <div className="impressao-avarias-container">
                    {avariasVisuais.filter((a) => a.lado === "frente").length > 0 && (
                      <div className="impressao-silhueta">
                        <div className="impressao-silhueta-label">Frente</div>
                        <SilhuetaComAvarias
                          tipoDispositivo={ordem.dispositivo_tipo}
                          subtipoRelogio={(avariasData as any)?.dispositivo_subtipo}
                          lado="frente"
                          avarias={avariasVisuais.filter((a) => a.lado === "frente")}
                          printMode={true}
                        />
                      </div>
                    )}
                    {avariasVisuais.filter((a) => a.lado === "traseira").length > 0 && (
                      <div className="impressao-silhueta">
                        <div className="impressao-silhueta-label">Traseira</div>
                        <SilhuetaComAvarias
                          tipoDispositivo={ordem.dispositivo_tipo}
                          subtipoRelogio={(avariasData as any)?.dispositivo_subtipo}
                          lado="traseira"
                          avarias={avariasVisuais.filter((a) => a.lado === "traseira")}
                          printMode={true}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Termo de Garantia */}
          {layoutConfig.mostrar_termos_condicoes && (
            <div className="impressao-termo-garantia">
              <div className="impressao-termo-title">Termo de Garantia do Serviço</div>
              <p className="impressao-termo-text">
                {termoGarantia}
              </p>
            </div>
          )}

          {/* Footer - Assinaturas */}
          {layoutConfig.mostrar_assinaturas && (
            <div className="impressao-footer">
              <div className="impressao-assinatura">
                {assinaturas?.tipo_assinatura_entrada === "digital" && assinaturas?.cliente_entrada ? (
                  <div className="impressao-assinatura-digital">
                    <img
                      src={assinaturas.cliente_entrada}
                      alt="Assinatura do Cliente"
                      className="impressao-assinatura-imagem"
                    />
                  </div>
                ) : (
                  <div className="impressao-linha-assinatura"></div>
                )}
                <span className="impressao-assinatura-label">Assinatura do Cliente (Entrada)</span>
                <span className="impressao-assinatura-data">
                  {assinaturas?.tipo_assinatura_entrada === "digital" && assinaturas?.data_assinatura_entrada
                    ? formatDate(assinaturas.data_assinatura_entrada)
                    : `${configuracaoLoja?.endereco?.split(",")[1]?.trim() || "________"}, ${formatDate(new Date())}`}
                </span>
              </div>
              <div className="impressao-assinatura">
                {assinaturas?.tipo_assinatura_saida === "digital" && assinaturas?.cliente_saida ? (
                  <div className="impressao-assinatura-digital">
                    <img
                      src={assinaturas.cliente_saida}
                      alt="Assinatura de Recebimento"
                      className="impressao-assinatura-imagem"
                    />
                  </div>
                ) : (
                  <div className="impressao-linha-assinatura"></div>
                )}
                <span className="impressao-assinatura-label">Assinatura do Cliente (Saída)</span>
                <span className="impressao-assinatura-data">
                  {assinaturas?.tipo_assinatura_saida === "digital" && assinaturas?.data_assinatura_saida
                    ? formatDate(assinaturas.data_assinatura_saida)
                    : `${configuracaoLoja?.endereco?.split(",")[1]?.trim() || "________"}, ___/___/______`}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </>,
    portalEl
  );
};

