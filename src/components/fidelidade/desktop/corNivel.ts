import type { CSSProperties } from "react";

/**
 * Cor do nível de fidelidade no layout do computador.
 *
 * A cor vem do banco (fidelidade_niveis.cor) e o lojista escolhe qualquer hex.
 * Por isso o texto do chip nunca usa a cor do nível: o texto fica em `foreground`
 * (token do tema) e a cor aparece só como fundo translúcido e numa bolinha sólida.
 * Assim fica legível com qualquer hex, no tema claro e no escuro.
 */

const HEX_CURTO = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i;
const HEX_LONGO = /^#?([0-9a-f]{6})$/i;

/**
 * Normaliza a cor salva para "#rrggbb" (minúsculo).
 * Aceita "#rgb", "#rrggbb", com ou sem "#", com espaços nas pontas.
 * Qualquer outra coisa (nome de cor, hex incompleto, texto solto) vira null,
 * e o chip cai no visual neutro. Isso também impede que um valor estranho
 * vá parar dentro do `style`.
 */
export function normalizarCorNivel(cor: string | null | undefined): string | null {
  if (typeof cor !== "string") return null;
  const valor = cor.trim();
  const curto = HEX_CURTO.exec(valor);
  if (curto) {
    return `#${curto[1]}${curto[1]}${curto[2]}${curto[2]}${curto[3]}${curto[3]}`.toLowerCase();
  }
  const longo = HEX_LONGO.exec(valor);
  if (longo) return `#${longo[1]}`.toLowerCase();
  return null;
}

/** Estilos inline do chip de nível. Campos ausentes = visual neutro (classes de quem chama). */
export interface EstiloChipNivel {
  /** Fundo e borda do chip. */
  chip: CSSProperties;
  /** Bolinha sólida com a cor do nível. */
  ponto: CSSProperties;
  /** false quando a cor é inválida ou não existe. */
  temCor: boolean;
}

/** Porcentagem da cor do nível misturada no fundo do chip. */
export const OPACIDADE_FUNDO_NIVEL = 16;
/** Porcentagem da cor do nível misturada na borda do chip. */
export const OPACIDADE_BORDA_NIVEL = 45;

/**
 * Fundo e borda usam `color-mix(... transparent)`, que deixa ver o fundo do cartão
 * por baixo: no tema claro vira um tom pastel, no escuro um tom fechado.
 * Navegador sem `color-mix()` descarta a declaração inteira, então o chip fica
 * só com a bolinha e o texto, sem quebrar.
 */
export function estiloChipNivel(cor: string | null | undefined): EstiloChipNivel {
  const hex = normalizarCorNivel(cor);
  if (!hex) return { chip: {}, ponto: {}, temCor: false };
  return {
    chip: {
      backgroundColor: `color-mix(in srgb, ${hex} ${OPACIDADE_FUNDO_NIVEL}%, transparent)`,
      borderColor: `color-mix(in srgb, ${hex} ${OPACIDADE_BORDA_NIVEL}%, transparent)`,
    },
    ponto: { backgroundColor: hex },
    temCor: true,
  };
}
