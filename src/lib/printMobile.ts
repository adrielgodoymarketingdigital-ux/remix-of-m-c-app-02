/**
 * Mecanismos de impressão pra mobile/PWA standalone.
 *
 * Android: `printViaIframe` injeta o documento num <iframe> 1×1px oculto via
 * srcdoc, em vez de window.open() — cronicamente instável em Chrome Android
 * (trava em "Preparing preview…").
 *
 * iOS: `printViaPrintRoot` injeta direto no documento principal via
 * #print-root — iframe.contentWindow.print() passou a ser silenciosamente
 * ignorado em standalone no Safari 27 (set/2026), confirmado em device real
 * com alerts de diagnóstico (print() chamado sem erro nenhum, nenhuma UI de
 * impressão aparece). Não há documentação oficial da Apple sobre essa
 * mudança — só a evidência direta do teste.
 */

export interface ContextoImpressaoMobile {
  isAndroid: boolean;
  isIOS: boolean;
  /** Android ou iOS, independente de estar instalado como PWA. */
  isMobile: boolean;
  /** Rodando como PWA instalada (display-mode: standalone), em qualquer plataforma. */
  isStandalone: boolean;
}

export function detectarContextoImpressaoMobile(): ContextoImpressaoMobile {
  const isAndroid = /android/i.test(navigator.userAgent);
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isMobile = isAndroid || isIOS;
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return { isAndroid, isIOS, isMobile, isStandalone };
}

/**
 * Injeta `htmlDoc` num iframe 1×1px oculto e deixa o script embutido no
 * próprio documento disparar window.print(). No iOS, reforça chamando
 * contentWindow.print() ~1s depois do load (2 requestAnimationFrame pra
 * garantir pelo menos 1 frame pintado antes) — o script interno às vezes
 * não dispara sozinho quando o documento vem de srcdoc. O reforço é
 * guardado por `window.__printed` (setado pelo doPrint() do documento
 * injetado) pra nunca competir/duplicar com o disparo interno.
 *
 * Cleanup do iframe: escuta 'afterprint' no `contentWindow` do iframe —
 * setado só dentro do `onload`, quando `contentWindow` já aponta pro
 * documento carregado via srcdoc (antes do load ainda seria o about:blank
 * anterior à navegação, e o listener se perderia). Isso deixa o cleanup
 * inteiramente do lado do pai: o documento injetado não precisa saber o id
 * do iframe nem alcançar `window.parent` — evita repetir essa string mágica
 * em cada um dos documentos que usam essa função.
 */
export function printViaIframe(htmlDoc: string, isIOS: boolean, debug = false): void {
  document.getElementById('print-iframe-mobile')?.remove();

  const iframe = document.createElement('iframe');
  iframe.id = 'print-iframe-mobile';
  iframe.style.position = 'fixed';
  // iOS Safari não calcula layout de iframe 0×0 (área imprimível vazia →
  // página em branco). Damos tamanho real mas fora da viewport visível.
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '1px';
  iframe.style.height = '1px';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  iframe.onload = () => {
    if (debug) alert('DEBUG 1/5: iframe onload disparado');
    const win = iframe.contentWindow as (Window & { __printed?: boolean }) | null;
    if (!win) {
      if (debug) alert('DEBUG: contentWindow é null — abortando');
      return;
    }

    win.addEventListener('afterprint', () => {
      if (debug) alert('DEBUG 5/5: afterprint disparado, removendo iframe');
      iframe.remove();
    });

    if (isIOS) {
      const reforcarPrint = () => {
        if (win.__printed) {
          if (debug) alert('DEBUG: reforço abortado — __printed já true');
          return;
        }
        if (debug) alert('DEBUG 4/5: reforço iOS vai chamar print()');
        try {
          win.focus();
          win.print();
        } catch (e) {
          if (debug) alert('DEBUG: erro no reforço — ' + String(e));
        }
      };
      setTimeout(() => {
        requestAnimationFrame(() => requestAnimationFrame(reforcarPrint));
      }, 1000);
    }
  };

  iframe.srcdoc = htmlDoc;
}

/**
 * Imprime direto no documento principal via #print-root — caminho iOS, sem
 * iframe. Reaproveita o mesmo #print-root que ImpressaoOrdemServico.tsx e
 * ImpressaoTermoResponsabilidade.tsx já usam no caminho desktop (portal +
 * window.print() síncrono) — ver @media print em index.css, que esconde
 * #root e mostra #print-root durante a impressão.
 *
 * bodyHtml/styleCss são injetados como HTML/CSS GLOBAL na página viva (não é
 * um documento isolado como no iframe/popup) — todo seletor em styleCss deve
 * vir prefixado (ex: .recibo-print-*) pra não vazar pro resto do app enquanto
 * o diálogo de impressão estiver aberto.
 *
 * Limpa #print-root no afterprint pra não deixar conteúdo de uma impressão
 * anterior residual numa próxima chamada.
 */
export function printViaPrintRoot(bodyHtml: string, styleCss: string): void {
  let printRoot = document.getElementById('print-root');
  if (!printRoot) {
    printRoot = document.createElement('div');
    printRoot.id = 'print-root';
    document.body.appendChild(printRoot);
  }

  const limpar = () => {
    printRoot!.innerHTML = '';
    window.removeEventListener('afterprint', limpar);
  };
  window.addEventListener('afterprint', limpar);

  printRoot.innerHTML = `<style>${styleCss}</style>${bodyHtml}`;
  window.focus();
  window.print();
}

/**
 * Baixa `url` e retorna como data URI base64, ou `null` se falhar/expirar
 * (timeout de 4s). Usado pra embutir o logo da loja no documento isolado
 * sem depender de rede no momento da impressão.
 */
export async function urlParaBase64(url: string, timeoutMs = 4000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { mode: 'cors', signal: controller.signal });
    clearTimeout(timeoutId);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Converte todas as <img> dentro de `contentEl` pra data URI base64 dentro
 * de `html` (string serializada, ex: `contentEl.outerHTML`). Pra fluxos que
 * montam o conteúdo a partir de um ref de DOM real (ao contrário de string
 * de template pura) — ver useRef + innerHTML nos recibos de venda/PDV.
 * Mantém o src original de qualquer imagem que falhar/expirar.
 */
export async function inlineImagesAsBase64(contentEl: Element, html: string): Promise<string> {
  let out = html;
  const imgs = Array.from(contentEl.querySelectorAll('img'));
  await Promise.all(imgs.map(async (img) => {
    const b64 = await urlParaBase64(img.src);
    if (b64) out = out.replace(img.src, b64);
  }));
  return out;
}
