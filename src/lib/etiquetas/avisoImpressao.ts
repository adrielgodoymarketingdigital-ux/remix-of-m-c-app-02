/**
 * Regra do aviso "a impressão não abriu" e registro de diagnóstico das etiquetas
 * de produto. Sem DOM nem import (testável no Deno); quem observa a impressão é
 * monitorImpressaoEtiquetas.ts.
 *
 * Só guarda dados do aparelho e dos passos da impressão: nada de produto nem de cliente.
 */

export const ESPERA_SINAL_IMPRESSAO_MS = 1500;
export const MENSAGEM_IMPRESSAO_NAO_ABRIU =
  "Não foi possível abrir a impressão neste aparelho. Tente pelo navegador.";

const LIMITE_EVENTOS = 20;

export type BotaoEtiqueta = "imprimir" | "teste";
export type CaminhoImpressaoEtiqueta = "window.open" | "iframe" | "print-root" | "camada-ios";
export type PlataformaImpressao = "iphone" | "ipad" | "ipad-provavel" | "android" | "computador";

export type TipoEventoImpressao =
  | "inicio"
  | "print_chamado"
  | "print_retornou"
  | "print_nao_chamado"
  | "beforeprint"
  | "afterprint"
  | "midia_print"
  | "pagina_oculta"
  | "sem_sinal"
  | "aviso_mostrado"
  | "popup_bloqueado"
  | "erro"
  // Camada do iPhone com app instalado (prévia + Compartilhar PDF)
  | "camada_aberta"
  | "pdf_pronto"
  | "pdf_falhou"
  | "compartilhado"
  | "compartilhar_falhou"
  | "imprimir_nao_abriu";

export interface EventoImpressao {
  quando: string;
  tentativa: number;
  tipo: TipoEventoImpressao;
  botao: BotaoEtiqueta;
  plataforma: PlataformaImpressao;
  instalado: boolean;
  caminho: CaminhoImpressaoEtiqueta | null;
  detalhe?: string;
}

/** Qualquer um destes indica que o sistema reagiu ao print(). */
export function ehSinalDeImpressao(tipo: TipoEventoImpressao): boolean {
  return tipo === "beforeprint" || tipo === "afterprint" || tipo === "midia_print" || tipo === "pagina_oculta";
}

/** iPhone/iPad reconhecido como iOS com o app instalado: imprime pela camada (prévia + PDF). */
export function usarCamadaIOS(p: { isIOS: boolean; isStandalone: boolean }): boolean {
  return p.isIOS && p.isStandalone;
}

/**
 * Só avisa no iPhone/iPad reconhecido como iOS e com o app instalado, onde o
 * print() ignorado foi confirmado em aparelho real (cc435dc e diagnóstico de
 * 2026-11-05). Lá a impressão vai pela camada; o aviso fica de reserva se ela falhar.
 *
 * Nos outros ambientes a falta de sinal só vai para o registro (sem_sinal):
 * Android não foi medido em aparelho real e o WebKit nem sempre dispara os
 * eventos, então um aviso ali poderia aparecer com a impressão aberta. Para
 * ligar outro ambiente depois de medir, a mudança é só aqui.
 */
export function deveAvisarImpressaoNaoAbriu(p: { isIOS: boolean; isStandalone: boolean; recebeuSinal: boolean }): boolean {
  return p.isIOS && p.isStandalone && !p.recebeuSinal;
}

/** Só para o registro: não muda o caminho de impressão (o detector é o de printMobile.ts). */
export function descreverPlataforma(userAgent: string, maxTouchPoints: number): PlataformaImpressao {
  if (/iphone|ipod/i.test(userAgent)) return "iphone";
  if (/ipad/i.test(userAgent)) return "ipad";
  if (/android/i.test(userAgent)) return "android";
  // iPadOS se identifica como Mac; só a tela de toque diferencia.
  if (/macintosh/i.test(userAgent) && maxTouchPoints > 1) return "ipad-provavel";
  return "computador";
}

// ── Registro em memória ─────────────────────────────────────────────────────

let eventos: readonly EventoImpressao[] = [];
const ouvintes = new Set<() => void>();
let ultimaTentativa = 0;

export function novaTentativaImpressao(): number {
  ultimaTentativa += 1;
  return ultimaTentativa;
}

export function registrarEventoImpressao(evento: EventoImpressao): void {
  eventos = [...eventos, evento].slice(-LIMITE_EVENTOS);
  console.info(`[etiquetas-impressao] ${formatarEventoImpressao(evento)}`);
  ouvintes.forEach((ouvinte) => ouvinte());
}

export function listarEventosImpressao(): readonly EventoImpressao[] {
  return eventos;
}

/** Formato de useSyncExternalStore: devolve a função que cancela a assinatura. */
export function assinarEventosImpressao(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

export function limparEventosImpressao(): void {
  eventos = [];
  ouvintes.forEach((ouvinte) => ouvinte());
}

export function formatarEventoImpressao(e: EventoImpressao): string {
  const partes = [
    e.quando,
    `#${e.tentativa}`,
    e.tipo,
    e.botao,
    e.plataforma,
    e.instalado ? "instalado" : "navegador",
    e.caminho ?? "sem-caminho",
  ];
  if (e.detalhe) partes.push(e.detalhe);
  return partes.join(" | ");
}

export function formatarDiagnosticoImpressao(lista: readonly EventoImpressao[], cabecalho: string[]): string {
  const corpo = lista.length ? lista.map(formatarEventoImpressao) : ["Nenhuma impressão de etiqueta registrada ainda."];
  return [...cabecalho, "", ...corpo].join("\n");
}
