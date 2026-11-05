/**
 * Observa uma impressão de etiquetas sem mudar como ela acontece: printMobile.ts
 * e o documento impresso continuam iguais aos dos outros fluxos. Qualquer falha
 * aqui fica no registro e nunca impede a impressão.
 *
 * Os eventos de impressão disparam só na janela onde o print() roda (medido no
 * Chromium: o pai de um iframe não recebe), então cada caminho observa a sua.
 * A espera começa quando o print() retorna: no Chromium ele bloqueia enquanto a
 * janela de impressão está aberta.
 */
import type { ContextoImpressaoMobile } from "@/lib/printMobile";
import {
  type BotaoEtiqueta,
  type CaminhoImpressaoEtiqueta,
  descreverPlataforma,
  deveAvisarImpressaoNaoAbriu,
  ehSinalDeImpressao,
  ESPERA_SINAL_IMPRESSAO_MS,
  novaTentativaImpressao,
  registrarEventoImpressao,
  type TipoEventoImpressao,
} from "./avisoImpressao.ts";

// O script do documento dispara o print() em até 3s (print-utils.ts).
const ESPERA_PRINT_CHAMADO_MS = 6000;
const ACOMPANHAMENTO_MAXIMO_MS = 60000;

type JanelaImpressao = Window & typeof globalThis;

export interface AcompanhamentoImpressao {
  /** Observa a janela que vai imprimir. Devolve a função que restaura o print() original. */
  observar(janela: Window): () => void;
  /** Chamar logo depois de printViaIframe, antes do documento carregar. */
  observarIframe(iframe: HTMLIFrameElement): void;
  registrar(tipo: TipoEventoImpressao, detalhe?: string): void;
}

export function descreverErroImpressao(erro: unknown): string {
  const texto = erro instanceof Error ? `${erro.name}: ${erro.message}` : String(erro);
  return texto.slice(0, 160);
}

/** Registro de uma tentativa (mesmo número em todos os eventos dela). */
export function criarRegistroTentativa(p: {
  botao: BotaoEtiqueta;
  contexto: ContextoImpressaoMobile;
  caminho: CaminhoImpressaoEtiqueta;
}): (tipo: TipoEventoImpressao, detalhe?: string) => void {
  const tentativa = novaTentativaImpressao();
  const plataforma = descreverPlataforma(navigator.userAgent, navigator.maxTouchPoints ?? 0);
  return (tipo, detalhe) =>
    registrarEventoImpressao({
      quando: new Date().toISOString(),
      tentativa,
      tipo,
      botao: p.botao,
      plataforma,
      instalado: p.contexto.isStandalone,
      caminho: p.caminho,
      ...(detalhe ? { detalhe } : {}),
    });
}

export function iniciarAcompanhamentoImpressao(p: {
  botao: BotaoEtiqueta;
  contexto: ContextoImpressaoMobile;
  caminho: CaminhoImpressaoEtiqueta;
  aoNaoAbrir: () => void;
}): AcompanhamentoImpressao {
  const registrarNaTentativa = criarRegistroTentativa(p);
  let recebeuSinal = false;
  let printChamado = false;
  let verificacaoAgendada = false;
  const limpezas: Array<() => void> = [];

  const registrar = (tipo: TipoEventoImpressao, detalhe?: string) => {
    if (ehSinalDeImpressao(tipo)) recebeuSinal = true;
    registrarNaTentativa(tipo, detalhe);
  };

  const encerrar = () => {
    limpezas.splice(0).forEach((limpar) => limpar());
  };

  // Sair do app só conta como sinal enquanto a impressão desta tentativa está em
  // aberto; depois disso viraria ruído no registro (ex.: sair para colar o diagnóstico).
  const aoOcultar = () => {
    if (document.visibilityState === "hidden") registrar("pagina_oculta");
  };
  document.addEventListener("visibilitychange", aoOcultar);
  const pararDeOuvirVisibilidade = () => document.removeEventListener("visibilitychange", aoOcultar);
  limpezas.push(pararDeOuvirVisibilidade);

  const agendarVerificacao = () => {
    if (verificacaoAgendada) return;
    verificacaoAgendada = true;
    setTimeout(() => {
      pararDeOuvirVisibilidade();
      if (recebeuSinal) return;
      registrar("sem_sinal", `${ESPERA_SINAL_IMPRESSAO_MS}ms`);
      if (deveAvisarImpressaoNaoAbriu({ isIOS: p.contexto.isIOS, isStandalone: p.contexto.isStandalone, recebeuSinal })) {
        registrar("aviso_mostrado");
        p.aoNaoAbrir();
      }
    }, ESPERA_SINAL_IMPRESSAO_MS);
  };

  const ouvir = (alvo: EventTarget, evento: string, aoDisparar: () => void) => {
    alvo.addEventListener(evento, aoDisparar);
    limpezas.push(() => alvo.removeEventListener(evento, aoDisparar));
  };

  setTimeout(() => {
    if (printChamado) return;
    pararDeOuvirVisibilidade();
    registrar("print_nao_chamado", `${ESPERA_PRINT_CHAMADO_MS}ms`);
  }, ESPERA_PRINT_CHAMADO_MS);
  setTimeout(encerrar, ACOMPANHAMENTO_MAXIMO_MS);

  const observar = (janela: Window): (() => void) => {
    try {
      const alvo = janela as JanelaImpressao;
      ouvir(alvo, "beforeprint", () => registrar("beforeprint"));
      ouvir(alvo, "afterprint", () => {
        registrar("afterprint");
        encerrar();
      });
      const midiaPrint = alvo.matchMedia("print");
      ouvir(midiaPrint, "change", () => {
        if (midiaPrint.matches) registrar("midia_print");
      });

      const printOriginal = alvo.print;
      alvo.print = function printObservado() {
        printChamado = true;
        registrar("print_chamado");
        const inicio = performance.now();
        try {
          printOriginal.call(alvo);
        } catch (erro) {
          registrar("erro", descreverErroImpressao(erro));
          throw erro;
        } finally {
          registrar("print_retornou", `${Math.round(performance.now() - inicio)}ms`);
          agendarVerificacao();
        }
      };
      return () => {
        alvo.print = printOriginal;
      };
    } catch (erro) {
      registrar("erro", `monitor: ${descreverErroImpressao(erro)}`);
      return () => {};
    }
  };

  // O afterprint do printViaIframe remove o iframe antes do nosso listener rodar
  // (registrado depois do dele), então aqui o sinal é a remoção. Uma nova impressão
  // também remove o iframe anterior; por isso o detalhe no registro.
  const observarIframe = (iframe: HTMLIFrameElement) => {
    iframe.addEventListener("load", () => {
      if (iframe.contentWindow) observar(iframe.contentWindow);
    }, { once: true });
    const observador = new MutationObserver(() => {
      if (iframe.isConnected) return;
      observador.disconnect();
      if (!printChamado) return;
      registrar("afterprint", "iframe removido");
      encerrar();
    });
    observador.observe(document.body, { childList: true });
    limpezas.push(() => observador.disconnect());
  };

  registrar("inicio");

  return {
    observar,
    observarIframe,
    registrar,
  };
}
