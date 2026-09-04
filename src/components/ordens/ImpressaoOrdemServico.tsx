import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { OrdemServico } from "@/hooks/useOrdensServico";
import { AvariasOS } from "@/types/ordem-servico";
import { ConfiguracaoLoja, LayoutOSConfig, Layout80mmConfig } from "@/types/configuracao-loja";
import { obterTermoGarantia, LAYOUT_PADRAO } from "@/lib/termo-garantia-utils";
import { ImpressaoCupom80mm } from "./ImpressaoCupom80mm";
import { ImpressaoA4Padrao } from "./ImpressaoA4Padrao";
import { ImpressaoA4Tech } from "./ImpressaoA4Tech";
import {
  getCupom80mmOSBaseCSS,
  getCupom80mmOSPrintDocCSS,
  resolverAlturaCupom80mm,
  CUPOM_80MM_ALTURA_FALLBACK_MM,
} from "@/lib/paper-size-utils";

// Converte <img> externas (logo) para data URI base64 dentro do HTML serializado,
// evitando bloqueio de CORS no documento isolado. Timeout de 4s por imagem.
async function inlineImagesAsBase64(contentEl: Element, html: string): Promise<string> {
  let out = html;
  const imgs = Array.from(contentEl.querySelectorAll('img'));
  await Promise.all(imgs.map(async (img) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(img.src, { mode: 'cors', signal: controller.signal });
      clearTimeout(timeoutId);
      const blob = await res.blob();
      const b64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      out = out.replace(img.src, b64);
    } catch { /* manter src original se falhar ou expirar */ }
  }));
  return out;
}

// Copia as CSS custom properties do :root para uma string ":root { ... }" —
// necessário porque as silhuetas usam fill="hsl(var(--muted))" etc.
function extractRootCssVars(): string {
  try {
    const rootStyles = getComputedStyle(document.documentElement);
    const varNames = ['--background','--foreground','--primary','--primary-foreground','--secondary','--secondary-foreground','--muted','--muted-foreground','--accent','--accent-foreground','--border','--input','--ring','--radius'];
    const vars = varNames.map(v => `${v}: ${rootStyles.getPropertyValue(v)};`).join('\n');
    return `:root { ${vars} }`;
  } catch {
    return '';
  }
}

// Monta o documento isolado do cupom 80mm. Usado duas vezes por print80mm():
// 1) sem script (documento de PROVA, só pra medir a altura real renderizada);
// 2) com script (documento FINAL, com a altura já calculada, que efetivamente
// imprime). Mesma função nas duas chamadas — garante que o que foi medido e o
// que imprime têm exatamente a mesma forma (sem divergência tela-vs-impressão).
function buildCupom80mmDoc(
  numeroOS: string | number,
  cssVars: string,
  contentHtml: string,
  alturaMm: number,
  incluirScriptDeImpressao: boolean,
): string {
  const script = incluirScriptDeImpressao
    ? `
  <script>
    (function() {
      var printed = false;
      function doPrint() {
        if (printed) return;
        printed = true;
        window.__printed = true;
        window.focus();
        window.print();
        window.onafterprint = function() {
          try {
            var p = window.parent;
            if (p && typeof p.__osPrint80mmDone === 'function') p.__osPrint80mmDone();
            p.document.getElementById('print-iframe-android')?.remove();
          } catch (e) {}
        };
      }
      var images = document.querySelectorAll('img');
      if (images.length === 0) {
        setTimeout(doPrint, 300);
      } else {
        var promises = Array.from(images).map(function(img) {
          if (img.complete) return Promise.resolve();
          return new Promise(function(resolve) {
            img.onload = resolve;
            img.onerror = function() { img.style.display = 'none'; resolve(); };
          });
        });
        Promise.all(promises).then(function() { setTimeout(doPrint, 300); });
      }
      setTimeout(doPrint, 4000);
    })();
  </script>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
  <title>OS #${numeroOS}</title>
  <style>
    ${cssVars}
    ${getCupom80mmOSPrintDocCSS(alturaMm)}
  </style>
</head>
<body>
  <div id="print-root">${contentHtml}</div>${script}
</body>
</html>`;
}

// Mede a altura real (px) do .cupom-80mm-container dentro de um documento
// IDÊNTICO em forma ao que vai imprimir (mesmo buildCupom80mmDoc), carregado
// num <iframe> oculto descartável — elimina qualquer divergência entre o
// preview em tela e o documento de impressão. Sem script de auto-print (senão
// dispararia uma impressão indesejada durante a medição). Nunca rejeita: em
// caso de timeout/erro, resolve null e quem chama decide o fallback.
function medirAlturaCupom80mmPx(htmlDocProva: string): Promise<number | null> {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.id = 'print-iframe-medicao-80mm';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '1px';
    iframe.style.height = '1px';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    iframe.style.border = '0';

    let resolvido = false;
    const finalizar = (valor: number | null) => {
      if (resolvido) return;
      resolvido = true;
      clearTimeout(timeoutId);
      iframe.remove();
      resolve(valor);
    };

    // Rede de segurança: se onload/rAF nunca disparar, não trava a impressão —
    // segue com o fallback fixo (resolverAlturaCupom80mm trata null como falha).
    const timeoutId = setTimeout(() => finalizar(null), 2000);

    iframe.onload = () => {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        try {
          const el = iframe.contentDocument?.querySelector('.cupom-80mm-container');
          const altura = el ? el.getBoundingClientRect().height : null;
          finalizar(altura && altura > 0 ? altura : null);
        } catch {
          finalizar(null);
        }
      }));
    };

    document.body.appendChild(iframe);
    iframe.srcdoc = htmlDocProva;
  });
}

// Ciclo de vida do <iframe> oculto usado para imprimir um documento isolado
// (srcdoc). Extraído de handlePrintAndroid para ser reaproveitado por print80mm.
// window.open()+Blob é cronicamente instável no Chrome Android — o iframe com
// srcdoc carrega no mesmo processo e iframe.contentWindow.print() é reconhecido.
function printViaIframe(htmlDoc: string, isIOS: boolean) {
  document.getElementById('print-iframe-android')?.remove();

  const iframe = document.createElement('iframe');
  iframe.id = 'print-iframe-android';
  iframe.style.position = 'fixed';
  // iOS Safari não calcula layout de iframe 0x0 (área imprimível vazia → página
  // em branco). Damos tamanho real mas fora da viewport visível.
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '1px';
  iframe.style.height = '1px';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  // O script embutido no htmlDoc chama window.print() após as imagens
  // carregarem (fallback 4s). No iOS o script interno às vezes não dispara a
  // partir de srcdoc — reforçamos daqui após 2 rAF (garante 1 frame pintado),
  // checando __printed para não competir com o doPrint() interno.
  iframe.onload = () => {
    if (isIOS) {
      const reforcarPrint = () => {
        const win = iframe.contentWindow as (Window & { __printed?: boolean }) | null;
        if (!win || win.__printed) return;
        try {
          win.focus();
          win.print();
        } catch { /* ignore — script interno cobre o fallback */ }
      };
      setTimeout(() => {
        requestAnimationFrame(() => requestAnimationFrame(reforcarPrint));
      }, 1000);
    }
  };

  iframe.srcdoc = htmlDoc;
}

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

// Escolha de formato POR IMPRESSÃO (A4 x 80mm), lembrada entre impressões de
// OS. Chave dedicada: NÃO compartilha com o formato dos recibos de venda/PDV
// (SeletorFormatoPapelDialog usa "ultimo_formato_papel_impressao"). A OS só
// suporta 'a4' | '80mm' — 58mm/personalizado não se aplicam aqui.
const CHAVE_FORMATO_OS = "ultimo_formato_papel_os";

function lerFormatoOSSalvo(): 'a4' | '80mm' | null {
  try {
    const v = localStorage.getItem(CHAVE_FORMATO_OS);
    return v === '80mm' || v === 'a4' ? v : null;
  } catch {
    return null;
  }
}

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

  // Formato escolhido para ESTA impressão. Prioridade: última escolha salva
  // (localStorage, chave dedicada) → formato configurado pela loja
  // (layout_os_config.formato_papel) → 'a4'. Se o usuário não tocar nos
  // botões do modal, o resultado é idêntico ao comportamento anterior.
  const [formatoEscolhido, setFormatoEscolhido] = useState<'a4' | '80mm'>(
    () => lerFormatoOSSalvo() ?? (layoutConfig.formato_papel === '80mm' ? '80mm' : 'a4'),
  );
  const is80mm = formatoEscolhido === '80mm';

  const escolherFormato = (f: 'a4' | '80mm') => {
    setFormatoEscolhido(f);
    try {
      localStorage.setItem(CHAVE_FORMATO_OS, f);
    } catch {
      /* ignore — modo privado / storage indisponível */
    }
  };

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

    // 80mm agora imprime sempre por print80mm() (documento isolado) — nada a
    // fazer aqui nesse caso. A classe body.print-80mm foi removida.
    const isDuasOS = !is80mm && layoutConfig.duas_os_por_folha;
    const isHorizontal = isDuasOS && layoutConfig.duas_os_orientacao === 'horizontal';
    if (isHorizontal) {
      document.body.classList.add('print-duas-os-horizontal');
    }

    // Injetar @page sem margem para duas OS (o conteúdo já é dimensionado para a folha inteira)
    let pageStyleEl: HTMLStyleElement | null = null;
    if (isDuasOS) {
      pageStyleEl = document.createElement('style');
      pageStyleEl.id = 'print-page-duas-os';
      pageStyleEl.textContent = isHorizontal
        ? '@media print { @page { size: A4 landscape; margin: 0; } }'
        : '@media print { @page { size: A4 portrait; margin: 0; } }';
      document.head.appendChild(pageStyleEl);
    }

    return () => {
      portalEl.remove();
      document.body.classList.remove('print-duas-os-horizontal');
      pageStyleEl?.remove();
    };
  }, [portalEl, formatoEscolhido, is80mm, layoutConfig.duas_os_por_folha, layoutConfig.duas_os_orientacao]);

  // Detect mobile browsers (Android or iOS)
  const isAndroid = /android/i.test(navigator.userAgent);
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isMobile = isAndroid || isIOS;

  // Ref para o container das duas OS — usado na geração de PDF
  const duasOsContainerRef = useRef<HTMLDivElement>(null);

  // On Android, window.print() on the main SPA DOM causes "Preparing preview..." hang.
  // Always use a new window on Android to isolate the print content.
  const handlePrintAndroid = async () => {
    if (!portalEl) return;

    // Get the print content
    const contentEl = portalEl.querySelector('.impressao-ordem-container, .impressao-duas-os-wrapper');
    let contentHtml = contentEl ? contentEl.outerHTML : portalEl.innerHTML;

    // Converter imagens externas (logo) para base64 para evitar bloqueio de CORS na nova janela.
    if (contentEl) {
      contentHtml = await inlineImagesAsBase64(contentEl, contentHtml);
    }
    // handlePrintAndroid trata só A4 agora (80mm vai por print80mm()).
    const isHorizontalMode = layoutConfig.duas_os_por_folha && layoutConfig.duas_os_orientacao === 'horizontal';

    const cssVars = extractRootCssVars();

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
  <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
  <title>OS #${ordem.numero_os}</title>
  <style>
    ${cssVars}
    ${printCSS}
    /* Essential resets */
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { margin: 0; padding: ${layoutConfig.duas_os_por_folha ? '0' : '4mm'}; background: white; color: black; font-family: system-ui, -apple-system, sans-serif; }
    #print-root { position: static !important; overflow: visible !important; width: 100% !important; height: auto !important; display: block !important; }
    .impressao-ordem-container {
      width: 100% !important; max-width: 194mm !important; margin: 0 auto !important;
      display: flex !important; flex-direction: column !important;
      overflow: visible !important; max-height: none !important; height: auto !important;
      background: white; color: #111; font-size: 8pt; line-height: 1.3;
      font-family: system-ui, -apple-system, sans-serif;
    }
    .impressao-duas-os-slot .impressao-ordem-container { max-width: 100% !important; font-size: 8pt; }
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
    /* ── HEADER LAYOUT PADRÃO ── */
    .impressao-a4-padrao .impressao-header { margin-bottom: 3mm; padding-bottom: 2mm; border-bottom: 1.5pt solid #000; border-radius: 0; overflow: visible; }
    .impressao-a4-padrao .impressao-header-content { display: flex; align-items: center; gap: 3mm; margin-bottom: 1.5mm; }
    .impressao-a4-padrao .impressao-logo { width: 14mm; height: 14mm; object-fit: contain; background: none; border-radius: 0; }
    .impressao-a4-padrao .impressao-titulo { font-size: 14pt; font-weight: 900; letter-spacing: 0.03em; margin: 0; color: #000; }
    .impressao-a4-padrao .impressao-numero-os { font-size: 10pt; font-weight: 800; margin-top: 0.5mm; color: #000; }
    .impressao-a4-padrao .impressao-data-status { display: flex; align-items: center; gap: 2mm; margin-top: 0.5mm; font-size: 8pt; font-weight: 600; color: #000; }
    .impressao-a4-padrao .impressao-badge { display: inline-block; padding: 0.3mm 1.5mm; border-radius: 1px; font-size: 7pt; font-weight: 700; text-transform: uppercase; background: #eee; color: #000; border: 1pt solid #000; }
    .impressao-a4-padrao .impressao-loja-info { padding: 1.5mm; background: #f5f5f5; border-radius: 1px; font-size: 7.5pt; font-weight: 500; line-height: 1.3; color: #000; }
    .impressao-a4-padrao .impressao-loja-info .text-sm { font-size: 8pt; }
    .impressao-a4-padrao .impressao-loja-info .text-xs { font-size: 6pt; }
    .impressao-a4-padrao .impressao-block { border: 1pt solid #000; border-left: 3pt solid #000; border-radius: 1px; padding: 2mm; }
    .impressao-a4-padrao .impressao-block-minimal { padding: 1.5mm; }
    .impressao-a4-padrao .impressao-block-header { display: flex; align-items: center; gap: 1mm; margin-bottom: 1mm; padding-bottom: 0.5mm; border-bottom: 0.5pt solid #000; }
    .impressao-a4-padrao .impressao-block-title { font-size: 7pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.4px; margin: 0; color: #000; }
    .impressao-a4-padrao .impressao-block-content { font-size: 7.5pt; }
    .impressao-a4-padrao .impressao-label { color: #000; font-weight: 700; }
    .impressao-a4-padrao .impressao-value { color: #000; }
    .impressao-a4-padrao .impressao-footer { border-top: 1pt solid #000; }
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
    /* 80mm não passa mais por aqui — imprime via print80mm() (doc isolado). */
    /* Duas OS por folha — screen: dimensões baseadas em viewport para funcionar em mobile */
    .impressao-duas-os-wrapper { display: flex; flex-direction: row; align-items: flex-start; background: white; gap: 0; overflow: hidden; width: 100vw; }
    .impressao-duas-os-slot { overflow: hidden; position: relative; flex-shrink: 0; }
    .impressao-duas-os-slot > * { transform-origin: top left; position: absolute; top: 0; left: 0; width: 194mm !important; max-width: 194mm !important; }
    /* Vertical (retrato): proporção A4 = 297/210. Corte = 0.5vw. Slots ocupam (100vw - 0.5vw) / 2 cada */
    .impressao-duas-os-vertical { height: calc(100vw * 1.4142); }
    .impressao-duas-os-vertical .impressao-duas-os-slot { width: calc((100vw - 0.5vw) / 2); height: calc(100vw * 1.4142); }
    .impressao-duas-os-vertical .impressao-duas-os-corte { width: 0.5vw; flex-shrink: 0; border-left: 1pt dashed #aaa; height: calc(100vw * 1.4142); display: flex; align-items: center; justify-content: center; position: relative; }
    /* Horizontal (paisagem): proporção A4 landscape = 210/297 */
    .impressao-duas-os-horizontal { height: calc(100vw * 0.7071); }
    .impressao-duas-os-horizontal .impressao-duas-os-slot { width: calc((100vw - 0.5vw) / 2); height: calc(100vw * 0.7071); }
    .impressao-duas-os-horizontal .impressao-duas-os-corte { width: 0.5vw; flex-shrink: 0; border-left: 1pt dashed #aaa; height: calc(100vw * 0.7071); display: flex; align-items: center; justify-content: center; position: relative; }
    .impressao-duas-os-corte-label { background: white; padding: 2mm 0; font-size: 6pt; color: #bbb; font-style: italic; writing-mode: vertical-rl; white-space: nowrap; position: absolute; top: 50%; transform: translateY(-50%) rotate(180deg); }
    /* ── FONTES AMPLIADAS PARA 2 OS (compensa escala ~0.54) ── */
    .impressao-duas-os-slot .impressao-header-loja { font-size: 10pt !important; }
    .impressao-duas-os-slot .impressao-loja-info { font-size: 10pt !important; }
    .impressao-duas-os-slot .impressao-loja-info .text-sm { font-size: 11pt !important; }
    .impressao-duas-os-slot .impressao-loja-info .text-xs { font-size: 9pt !important; }
    .impressao-duas-os-horizontal .impressao-duas-os-slot .impressao-header-loja { font-size: 8pt !important; }
    .impressao-duas-os-horizontal .impressao-duas-os-slot .impressao-loja-info { font-size: 8pt !important; }
    .impressao-duas-os-horizontal .impressao-duas-os-slot .impressao-loja-info .text-sm { font-size: 9pt !important; }
    .impressao-duas-os-horizontal .impressao-duas-os-slot .impressao-loja-info .text-xs { font-size: 7pt !important; }
    ${isHorizontalMode ? '@page { size: A4 landscape; margin: 0; }' : '@page { size: A4 portrait; margin: 0; }'}
    @media print {
      * { box-sizing: border-box; box-shadow: none !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      html, body { margin: 0 !important; padding: 0 !important; overflow: visible !important; width: 100% !important; height: auto !important; -webkit-text-size-adjust: none !important; }
      .impressao-duas-os-wrapper { page-break-inside: avoid !important; break-inside: avoid !important; }
      .impressao-duas-os-slot { overflow: hidden !important; position: relative !important; }
      .impressao-duas-os-slot > * { transform-origin: top left; width: 194mm !important; max-width: 194mm !important; position: absolute !important; top: 0 !important; left: 0 !important; }
      .impressao-duas-os-vertical { width: 210mm !important; height: 297mm !important; }
      .impressao-duas-os-vertical .impressao-duas-os-slot { width: 104.5mm !important; height: 297mm !important; }
      .impressao-duas-os-vertical .impressao-duas-os-slot > * { transform: scale(0.539) !important; }
      .impressao-duas-os-vertical .impressao-duas-os-corte { width: 1mm !important; height: 297mm !important; }
      .impressao-duas-os-horizontal { width: 297mm !important; height: 210mm !important; }
      .impressao-duas-os-horizontal .impressao-duas-os-slot { width: 148mm !important; height: 210mm !important; }
      .impressao-duas-os-horizontal .impressao-duas-os-slot > * { transform: scale(0.763) !important; }
      .impressao-duas-os-horizontal .impressao-duas-os-corte { width: 1mm !important; height: 210mm !important; }
    }
  </style>
</head>
<body>
  <div id="print-root">
    ${contentHtml}
  </div>
  <script>
    (function() {
      // Calcula e aplica escala dos slots de 2 OS dinamicamente para a TELA,
      // pois CSS não permite calc() entre unidades absolutas (px) e relativas (vw) para transform.
      // No contexto de impressão (matchMedia('print')), a escala correta já vem fixa
      // via @media print (scale 0.539/0.763, calculada em mm reais do papel) — não
      // sobrescrever aqui, senão o JS aplica a escala da tela do celular no papel,
      // quebrando o layout e travando a geração da pré-visualização no Chrome Android.
      function applyDuasOsScale() {
        if (window.matchMedia('print').matches) return;
        var slots = document.querySelectorAll('.impressao-duas-os-slot > *');
        if (!slots.length) return;
        var vw = window.innerWidth;
        var slotW = (vw - vw * 0.005) / 2; // (100vw - 0.5vw) / 2
        // 194mm em px: 1mm ≈ 3.7795px a 96dpi
        var contentWPx = 194 * 3.7795;
        var scale = slotW / contentWPx;
        for (var i = 0; i < slots.length; i++) {
          slots[i].style.transform = 'scale(' + scale + ')';
        }
      }
      document.addEventListener('DOMContentLoaded', applyDuasOsScale);
      // fallback caso DOMContentLoaded já tenha disparado
      setTimeout(applyDuasOsScale, 50);
      window.addEventListener('resize', applyDuasOsScale);
      window.addEventListener('beforeprint', function() {
        var slots = document.querySelectorAll('.impressao-duas-os-slot > *');
        for (var i = 0; i < slots.length; i++) {
          slots[i].style.transform = '';
        }
      });

      var printed = false;
      function doPrint() {
        if (printed) return;
        printed = true;
        window.__printed = true;
        window.focus();
        window.print();
        window.onafterprint = function() {
          // Remove o iframe de impressão da página pai após o usuário concluir/cancelar
          try {
            window.parent.document.getElementById('print-iframe-android')?.remove();
          } catch { /* ignore */ }
        };
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

    printViaIframe(htmlDoc, isIOS);
  };

  // Impressão 80mm — documento ISOLADO para todos os dispositivos (desktop e PWA).
  // Nada do index.css é herdado: o único @page é o do getCupom80mmOSPrintDocCSS().
  //
  // Altura do @page calculada em duas fases (em vez de um valor fixo genérico,
  // que desperdiçaria papel de bobina numa impressora térmica real):
  //   1) monta um documento de PROVA (sem script de impressão) com a altura de
  //      fallback, carrega num iframe descartável e mede a altura real
  //      renderizada do .cupom-80mm-container;
  //   2) usa essa medida (com margem de segurança) pra montar o documento
  //      FINAL, que é o que efetivamente imprime.
  const print80mm = async () => {
    if (!portalEl) return;

    const contentEl = portalEl.querySelector('.cupom-80mm-container');
    if (!contentEl) return;

    let contentHtml = contentEl.outerHTML;
    contentHtml = await inlineImagesAsBase64(contentEl, contentHtml);

    const cssVars = extractRootCssVars();
    const numeroOS = ordem.numero_os;

    const docProva = buildCupom80mmDoc(numeroOS, cssVars, contentHtml, CUPOM_80MM_ALTURA_FALLBACK_MM, false);
    const alturaMedidaPx = await medirAlturaCupom80mmPx(docProva);

    const { alturaMm, usouFallback } = resolverAlturaCupom80mm(alturaMedidaPx);
    if (usouFallback) {
      console.warn(
        '[ImpressaoOrdemServico] Não foi possível medir a altura do cupom 80mm com confiança — usando altura fixa de segurança.',
        { alturaMedidaPx, alturaMmFallback: alturaMm },
      );
    }

    const htmlDoc = buildCupom80mmDoc(numeroOS, cssVars, contentHtml, alturaMm, true);

    // Desktop non-PWA: fechar o preview após imprimir, igual ao fluxo A4. O
    // afterprint dispara na janela do iframe; o script interno chama este hook
    // no window pai de forma síncrona (antes de remover o próprio iframe).
    const w = window as Window & { __osPrint80mmDone?: () => void };
    if (!isMobile && !isStandalone) {
      w.__osPrint80mmDone = () => {
        delete w.__osPrint80mmDone;
        setTimeout(() => onFecharImpressao(), 300);
      };
    }
    printViaIframe(htmlDoc, isIOS);
  };

  // Trigger print
  const handlePrint = () => {
    // 80mm: sempre documento isolado, qualquer dispositivo.
    if (is80mm) {
      print80mm();
      return;
    }

    // PWA (standalone) e Android: sempre usar nova janela com HTML completo,
    // inclusive no modo 2 OS por folha (o CSS de scale/dimensões já está embutido no htmlDoc)
    if (isMobile || isStandalone) {
      handlePrintAndroid();
      return;
    }

    // Browser (non-standalone): auto-close after print
    const handleAfterPrint = () => {
      window.removeEventListener('afterprint', handleAfterPrint);
      setTimeout(() => {
        onFecharImpressao();
      }, 300);
    };
    window.addEventListener('afterprint', handleAfterPrint);

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
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", minWidth: "240px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 600, opacity: 0.7 }}>
              Formato de impressão
            </span>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {(["a4", "80mm"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => escolherFormato(f)}
                  className="print-trigger-button"
                  style={
                    formatoEscolhido === f
                      ? { flex: 1 }
                      : { flex: 1, background: "hsl(var(--secondary))", color: "hsl(var(--secondary-foreground))" }
                  }
                >
                  {f === "a4" ? "A4" : "80mm"}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: "1rem" }}>
            <button onClick={handlePrint} className="print-trigger-button" style={{ flex: 1 }}>
              Imprimir Agora
            </button>
            <button onClick={onFecharImpressao} className="print-close-button">
              {isStandalone ? "Voltar" : "Cancelar"}
            </button>
          </div>
        </div>
      </div>

      {/* 80mm: use dedicated receipt-style component.
          CSS do cupom vem do helper (fonte única, mesma da impressão) — o
          preview em tela injeta as classes .cupom-* aqui. */}
      {is80mm ? (
        <>
          <style dangerouslySetInnerHTML={{ __html: getCupom80mmOSBaseCSS() }} />
          <ImpressaoCupom80mm
            ordem={ordem}
            configuracaoLoja={configuracaoLoja}
            config80mm={c80}
          />
        </>
      ) : duasOsPorFolha ? (
        <div
          ref={duasOsContainerRef}
          className={`impressao-duas-os-wrapper impressao-duas-os-${duasOsOrientacao}`}
        >
          <div className="impressao-duas-os-slot os-pdf-slot">
            {renderA4()}
          </div>
          <div className="impressao-duas-os-corte">
            <span className="impressao-duas-os-corte-label">✂ cortar aqui</span>
          </div>
          <div className="impressao-duas-os-slot os-pdf-slot">
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

