/**
 * Cor do cabeçalho dos recibos A4 do layout novo (recibo personalizado da OS e
 * recibo de venda novo), escolhida em Configurações → Cores e guardada em
 * configuracoes_loja.cores_personalizadas.recibo_cabecalho_cor ("#rrggbb").
 *
 * Sem a chave (ou com valor inválido) = null: cada recibo continua com o azul
 * de sempre, escrito no próprio CSS dele, sem nada novo no HTML. Esta lib só
 * entra quando há uma cor válida. Sem React nem navegador (testes em Deno/Node).
 */

export const CHAVE_COR_CABECALHO_RECIBO = "recibo_cabecalho_cor";

/** Texto escuro usado quando a cor escolhida é clara (o mesmo tom do texto dos recibos). */
export const TEXTO_ESCURO = "#0f172a";
export const TEXTO_CLARO = "#ffffff";

/** "#rgb" ou "#rrggbb" (maiúsculas ou minúsculas) → "#rrggbb" minúsculo; qualquer outra coisa → null. */
export function normalizarCorHex(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const v = valor.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(v)) return v;
  if (/^#[0-9a-f]{3}$/.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  return null;
}

/**
 * Cor escolhida pela loja, lida do objeto de configuracoes_loja que o recibo já
 * recebe. Loja ausente, sem cores_personalizadas, valor inválido ou qualquer
 * erro → null (azul padrão). Nunca lança.
 */
export function corCabecalhoDaLoja(loja: unknown): string | null {
  try {
    if (!loja || typeof loja !== "object") return null;
    const cores = (loja as { cores_personalizadas?: unknown }).cores_personalizadas;
    if (!cores || typeof cores !== "object" || Array.isArray(cores)) return null;
    return normalizarCorHex((cores as Record<string, unknown>)[CHAVE_COR_CABECALHO_RECIBO]);
  } catch {
    return null;
  }
}

type Rgb = [number, number, number];

function paraRgb(hex: string): Rgb {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
}

function paraHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, "0")).join("")}`;
}

/** Mistura `a` com `b` (t = 0 → a, t = 1 → b). */
export function misturar(a: string, b: string, t: number): string {
  const x = paraRgb(a);
  const y = paraRgb(b);
  return paraHex([0, 1, 2].map((i) => x[i] + (y[i] - x[i]) * t) as Rgb);
}

/** Mesma cor, `fracao` mais escura (0,15 = 15%). */
export function escurecer(hex: string, fracao: number): string {
  return paraHex(paraRgb(hex).map((c) => c * (1 - fracao)) as Rgb);
}

/** Luminância relativa (WCAG 2). */
export function luminancia(hex: string): number {
  const [r, g, b] = paraRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razão de contraste WCAG entre duas cores (1 a 21). */
export function contraste(a: string, b: string): number {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Pior contraste de `cor` sobre as duas pontas do degradê. */
const piorContraste = (cor: string, fundos: string[]) => Math.min(...fundos.map((f) => contraste(cor, f)));

export interface PaletaCabecalhoRecibo {
  /** Início do degradê: a cor escolhida. */
  fundo: string;
  /** Fim do degradê: a cor ~15% mais escura. */
  fundo2: string;
  /** Branco ou escuro, o que tiver mais contraste sobre o degradê inteiro. */
  texto: string;
  textoClaro: boolean;
  /** Texto secundário (endereço, data): o texto com um pouco de transparência. */
  textoSuave: string;
  /** Divisórias e contorno da caixa do logo. */
  borda: string;
  /** Fundo translúcido da caixa do logo. */
  superficie: string;
  /** Contorno do selo de situação da OS. */
  contornoSelo: string;
  /**
   * Destaque derivado da cor (número da OS, ícones de contato, onda): sobre cor
   * escura, um tom claro dela; sobre cor clara, um tom escuro dela. Sempre com
   * contraste ≥ 3 sobre as duas pontas do degradê.
   */
  acento: string;
}

/** Contraste mínimo do destaque (WCAG: 3:1 para texto grande/negrito e ícones). */
export const CONTRASTE_MINIMO_ACENTO = 3;

export function paletaCabecalhoRecibo(corEscolhida: string): PaletaCabecalhoRecibo {
  const fundo = normalizarCorHex(corEscolhida);
  if (!fundo) throw new Error(`cor inválida: ${corEscolhida}`);
  const fundo2 = escurecer(fundo, 0.15);
  const fundos = [fundo, fundo2];
  const textoClaro = piorContraste(TEXTO_CLARO, fundos) >= piorContraste(TEXTO_ESCURO, fundos);
  const texto = textoClaro ? TEXTO_CLARO : TEXTO_ESCURO;
  // Destaque: parte de um tom da própria cor e vai na direção do texto até ficar legível.
  let acento = texto;
  for (let t = 0.55; t <= 1.0001; t += 0.05) {
    const candidato = misturar(fundo, texto, Math.min(1, t));
    if (piorContraste(candidato, fundos) >= CONTRASTE_MINIMO_ACENTO) {
      acento = candidato;
      break;
    }
  }
  const rgbTexto = textoClaro ? "255,255,255" : "15,23,42";
  return {
    fundo,
    fundo2,
    texto,
    textoClaro,
    textoSuave: `rgba(${rgbTexto},${textoClaro ? "0.92" : "0.85"})`,
    borda: `rgba(${rgbTexto},${textoClaro ? "0.28" : "0.25"})`,
    superficie: `rgba(${rgbTexto},${textoClaro ? "0.06" : "0.05"})`,
    contornoSelo: `rgba(${rgbTexto},${textoClaro ? "0.85" : "0.7"})`,
    acento,
  };
}
