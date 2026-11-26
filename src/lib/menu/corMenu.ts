/**
 * "Cor do menu" (Configurações → Cores): UMA cor de fundo escolhida pela loja,
 * usada na barra lateral (desktop) e na barra inferior (celular/PWA). Fica em
 * configuracoes_loja.cores_personalizadas.menu_cor ("#rrggbb").
 *
 * Sem a chave (ou com valor inválido) = null: nenhuma variável é definida e o
 * menu continua com o CSS de sempre (src/index.css). Daqui sai, a partir do
 * fundo, o conjunto de variáveis --sidebar-* no formato do index.css
 * ("H S% L%"), com contraste garantido:
 *   - texto × fundo (normal, hover e item ativo) ≥ 4,5:1;
 *   - destaque (--sidebar-primary) × fundo e × item ativo ≥ 3:1.
 * Sem React nem navegador (testes em Deno).
 */
import { contraste, normalizarCorHex } from "../recibo/corCabecalhoRecibo.ts";

export { normalizarCorHex };

export const CHAVE_COR_MENU = "menu_cor";

export const CONTRASTE_MINIMO_TEXTO = 4.5;
export const CONTRASTE_MINIMO_DESTAQUE = 3;

/** Nomes das variáveis (sem o "--sidebar-"). */
export const NOMES_VARIAVEIS_MENU = [
  "background",
  "foreground",
  "primary",
  "primary-foreground",
  "accent",
  "accent-foreground",
  "border",
  "ring",
  "hover",
  "hover-foreground",
  "muted",
  "subtle",
] as const;

export type NomeVariavelMenu = (typeof NOMES_VARIAVEIS_MENU)[number];
export type VariaveisMenu = Record<NomeVariavelMenu, string>;

/** Valores de src/index.css (iguais no claro e no escuro). Só para prévia e para os testes. */
export const VARIAVEIS_MENU_PADRAO: VariaveisMenu = {
  background: "223 28% 5%",
  foreground: "219 11% 61%",
  primary: "198 93% 60%",
  "primary-foreground": "223 28% 5%",
  accent: "206 43% 10%",
  "accent-foreground": "210 40% 96%",
  border: "220 21% 11%",
  ring: "198 93% 60%",
  hover: "218 24% 9%",
  "hover-foreground": "220 22% 92%",
  muted: "219 11% 53%",
  subtle: "219 11% 41%",
};

/** Cor escolhida pela loja, lida de cores_personalizadas (qualquer formato). Inválida → null. Nunca lança. */
export function corMenuDasCores(cores: unknown): string | null {
  if (!cores || typeof cores !== "object" || Array.isArray(cores)) return null;
  return normalizarCorHex((cores as Record<string, unknown>)[CHAVE_COR_MENU]);
}

// ---------------------------------------------------------------- cores em HSL

interface Hsl {
  h: number;
  s: number;
  l: number;
}

const limitar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function hexParaHsl(hex: string): Hsl {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  // Inteiros, como no index.css: o contraste é sempre medido no valor final.
  return { h: Math.round(h) % 360, s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslParaHex({ h, s, l }: Hsl): string {
  const sf = s / 100;
  const lf = l / 100;
  const a = sf * Math.min(lf, 1 - lf);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = lf - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** "H S% L%" → Hsl (só para os valores que esta lib produz). */
function lerHsl(valor: string): Hsl {
  const [h, s, l] = valor.replace(/%/g, "").split(" ").map(Number);
  return { h, s, l };
}

const formatar = ({ h, s, l }: Hsl) => `${h} ${s}% ${l}%`;
const hsl = (h: number, s: number, l: number): Hsl => ({ h, s: limitar(Math.round(s), 0, 100), l: limitar(Math.round(l), 0, 100) });

/** Contraste WCAG entre duas cores em HSL. */
const c = (a: Hsl, b: Hsl) => contraste(hslParaHex(a), hslParaHex(b));
const piorContraste = (cor: Hsl, fundos: Hsl[]) => Math.min(...fundos.map((f) => c(cor, f)));

const BRANCO = hsl(0, 0, 100);
const PRETO = hsl(0, 0, 0);

/** Branco ou preto, o que tiver mais contraste sobre todos os fundos. */
const extremoMaisLegivel = (fundos: Hsl[]) => (piorContraste(BRANCO, fundos) >= piorContraste(PRETO, fundos) ? BRANCO : PRETO);

/**
 * Tom de texto: parte de `inicio` e vai na direção de `alvo` (ponto a ponto de
 * luminosidade) até alcançar o contraste mínimo sobre todos os fundos. Nem no
 * extremo dá? Fica preto ou branco, o que tiver mais contraste.
 */
function legivel(inicio: Hsl, alvoL: number, fundos: Hsl[], minimo: number): Hsl {
  const passo = alvoL >= inicio.l ? 1 : -1;
  for (let l = inicio.l; passo > 0 ? l <= alvoL : l >= alvoL; l += passo) {
    const cand = hsl(inicio.h, inicio.s, l);
    if (piorContraste(cand, fundos) >= minimo) return cand;
  }
  return extremoMaisLegivel(fundos);
}

/**
 * Fundo do hover / do item ativo: o fundo deslocado `delta` pontos de
 * luminosidade em direção ao texto (como no padrão: menu escuro → hover mais
 * claro). Se o texto forte não ficar legível nele, desloca para o outro lado.
 */
function fundoDeslocado(fundo: Hsl, delta: number, direcao: 1 | -1, textoForte: Hsl): Hsl {
  const rumo = hsl(fundo.h, fundo.s, fundo.l + direcao * delta);
  if (rumo.l !== fundo.l && c(textoForte, rumo) >= CONTRASTE_MINIMO_TEXTO) return rumo;
  const oposto = hsl(fundo.h, fundo.s, fundo.l - direcao * delta);
  return oposto.l !== fundo.l ? oposto : rumo;
}

/** Destaque padrão do sistema (ciano do logo). */
const DESTAQUE_PADRAO = lerHsl(VARIAVEIS_MENU_PADRAO.primary);

/**
 * Todas as variáveis --sidebar-* para o fundo `corEscolhida`.
 * Hex inválido → null (nada a aplicar: vale o CSS padrão).
 */
export function variaveisDoMenu(corEscolhida: unknown): VariaveisMenu | null {
  const hex = normalizarCorHex(corEscolhida);
  if (!hex) return null;
  const fundo = hexParaHsl(hex);

  // Escuro ou claro pela luminância relativa (WCAG): texto branco ou preto, o que contrastar mais.
  const escuro = extremoMaisLegivel([fundo]) === BRANCO;
  const direcao: 1 | -1 = escuro ? 1 : -1; // para onde fica o texto
  const satTexto = Math.min(fundo.s, 40);

  // Texto forte (item ativo, hover, título): quase branco / quase preto no tom do fundo.
  const forteBase = hsl(fundo.h, satTexto, escuro ? 96 : 10);
  const hover = fundoDeslocado(fundo, 4, direcao, forteBase);
  const accent = fundoDeslocado(fundo, 6, direcao, forteBase);
  // Linha divisória: só enfeite (o fundo deslocado para o lado do texto).
  const border = hsl(fundo.h, fundo.s, fundo.l + direcao * 7);

  const extremoL = escuro ? 100 : 0;
  const hoverForeground = legivel(hsl(fundo.h, satTexto, escuro ? 92 : 12), extremoL, [hover], CONTRASTE_MINIMO_TEXTO);
  // Também é o título do menu ("Méc"), direto sobre o fundo.
  const accentForeground = legivel(forteBase, extremoL, [accent, fundo], CONTRASTE_MINIMO_TEXTO);

  // Texto normal: mais suave (no padrão, 61% sobre 5%), legível no fundo e no hover.
  const satSuave = Math.min(fundo.s, 15);
  // Ponto de partida de cada tom: no escuro, acima do fundo; no claro, abaixo (nunca no próprio fundo).
  const partida = (escuroL: number, claroL: number) => (escuro ? limitar(escuroL, fundo.l + 5, 100) : Math.min(claroL, fundo.l - 5));
  const foreground = legivel(hsl(fundo.h, satSuave, partida(limitar(fundo.l + 50, 61, 88), 35)), extremoL, [fundo, hover], CONTRASTE_MINIMO_TEXTO);
  // Rótulo dos grupos (texto): um pouco mais apagado, ainda ≥ 4,5.
  const muted = legivel(hsl(fundo.h, satSuave, partida(fundo.l + 42, 45)), extremoL, [fundo], CONTRASTE_MINIMO_TEXTO);
  // Setas e ícones de apoio: ≥ 3.
  const subtle = legivel(hsl(fundo.h, satSuave, partida(fundo.l + 32, 55)), extremoL, [fundo, hover], CONTRASTE_MINIMO_DESTAQUE);

  // Destaque: o ciano de sempre se for legível no fundo e no item ativo; senão o mesmo matiz
  // clareado/escurecido até ficar; em último caso, o texto forte.
  const fundosDestaque = [fundo, accent];
  let primary = DESTAQUE_PADRAO;
  if (piorContraste(primary, fundosDestaque) < CONTRASTE_MINIMO_DESTAQUE) {
    const candidato = legivel(DESTAQUE_PADRAO, extremoL, fundosDestaque, CONTRASTE_MINIMO_DESTAQUE);
    primary = piorContraste(candidato, fundosDestaque) >= CONTRASTE_MINIMO_DESTAQUE ? candidato : accentForeground;
  }
  // Texto sobre o destaque: a cor do fundo (como no padrão) ou preto/branco.
  const primaryForeground = c(fundo, primary) >= CONTRASTE_MINIMO_TEXTO ? fundo : extremoMaisLegivel([primary]);

  return {
    background: formatar(fundo),
    foreground: formatar(foreground),
    primary: formatar(primary),
    "primary-foreground": formatar(primaryForeground),
    accent: formatar(accent),
    "accent-foreground": formatar(accentForeground),
    border: formatar(border),
    ring: formatar(primary),
    hover: formatar(hover),
    "hover-foreground": formatar(hoverForeground),
    muted: formatar(muted),
    subtle: formatar(subtle),
  };
}

/** Contraste entre duas variáveis "H S% L%" (testes e prévia). */
export function contrasteVariaveis(a: string, b: string): number {
  return c(lerHsl(a), lerHsl(b));
}

/** "H S% L%" → "#rrggbb" (prévia em lugares que não leem as variáveis). */
export function variavelParaHex(valor: string): string {
  return hslParaHex(lerHsl(valor));
}
