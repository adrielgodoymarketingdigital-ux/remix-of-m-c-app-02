/**
 * Aplica a cor do menu no <html> (variáveis --sidebar-* inline) e lembra a
 * última cor aplicada no localStorage, para a próxima abertura já começar com
 * ela (sem piscar o padrão) antes de o banco responder.
 *
 * Sem cor (null): remove as variáveis inline e a chave local — vale o CSS de
 * src/index.css, exatamente como antes deste recurso.
 *
 * Também guarda a cor aplicada em memória e avisa quem assina (a barra inferior
 * e o menu do celular só trocam as classes de cor quando há cor escolhida).
 */
import { NOMES_VARIAVEIS_MENU, normalizarCorHex, variaveisDoMenu } from "./corMenu.ts";

export const CHAVE_LOCAL_COR_MENU = "mecapp_cor_menu";

let corAplicada: string | null = null;
const ouvintes = new Set<() => void>();

/** Cor aplicada agora (null = padrão). */
export const corMenuAplicada = (): string | null => corAplicada;

/** Para useSyncExternalStore. */
export function assinarCorMenu(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

function lerLocal(): string | null {
  try {
    return normalizarCorHex(window.localStorage.getItem(CHAVE_LOCAL_COR_MENU));
  } catch {
    return null;
  }
}

function gravarLocal(cor: string | null) {
  try {
    if (cor) window.localStorage.setItem(CHAVE_LOCAL_COR_MENU, cor);
    else window.localStorage.removeItem(CHAVE_LOCAL_COR_MENU);
  } catch {
    // modo privado / armazenamento bloqueado: só não lembra para a próxima vez
  }
}

/** Aplica (ou tira, com null/inválida) a cor do menu. */
export function aplicarCorMenu(cor: string | null): void {
  const variaveis = variaveisDoMenu(cor);
  const hex = variaveis ? normalizarCorHex(cor) : null;
  if (typeof document !== "undefined") {
    const estilo = document.documentElement.style;
    for (const nome of NOMES_VARIAVEIS_MENU) {
      if (variaveis) estilo.setProperty(`--sidebar-${nome}`, variaveis[nome]);
      else estilo.removeProperty(`--sidebar-${nome}`);
    }
  }
  gravarLocal(hex);
  if (hex !== corAplicada) {
    corAplicada = hex;
    ouvintes.forEach((o) => o());
  }
}

/** Antes do primeiro render: aplica a última cor lembrada, se houver (sem cor, não toca em nada). */
export function aplicarCorMenuLembrada(): void {
  const cor = lerLocal();
  if (cor) aplicarCorMenu(cor);
}
