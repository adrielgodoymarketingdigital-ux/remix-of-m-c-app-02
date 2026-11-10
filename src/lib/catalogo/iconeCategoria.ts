/**
 * Ícone das categorias do Catálogo (campo opcional `icone` em catalogo_config.categoriasCatalogo).
 * Lista fechada de nomes de ícones lucide; a tela converte o nome no componente.
 * Categoria antiga (sem ícone, ou com valor fora da lista) recebe um ícone escolhido pelo nome,
 * com a pasta como reserva. Nada é gravado aqui: a escolha automática é só de exibição até o
 * lojista salvar. O catálogo público ignora o campo.
 * Sem dependências (testado com Deno: deno test -A --no-check src/lib/catalogo/).
 */

/** Ícones que o lojista pode escolher (nomes do lucide, em kebab-case). A ordem é a do seletor. */
export const ICONES_CATEGORIA = [
  "folder",
  "smartphone",
  "tablet",
  "laptop",
  "watch",
  "headphones",
  "speaker",
  "cable",
  "battery-charging",
  "plug-zap",
  "shield",
  "monitor",
  "gamepad-2",
  "camera",
  "cpu",
  "wrench",
  "package",
  "tag",
  "gift",
  "sparkles",
] as const;

export type IconeCategoria = (typeof ICONES_CATEGORIA)[number];

/** Reserva quando nada combina. */
export const ICONE_RESERVA: IconeCategoria = "folder";

export function ehIconeValido(valor: unknown): valor is IconeCategoria {
  return typeof valor === "string" && (ICONES_CATEGORIA as readonly string[]).includes(valor);
}

function normalizar(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Regras por palavra (pt-BR e es). Cada entrada: prefixos que a palavra pode começar → ícone.
 * Prefixo e não palavra inteira, para pegar plural e variações ("capinhas", "carregadores").
 * Prefixos curtos e ambíguos ficam de fora ("som", "tv", "case") e entram como palavra exata
 * em PALAVRAS_EXATAS.
 */
const REGRAS_PREFIXO: ReadonlyArray<readonly [readonly string[], IconeCategoria]> = [
  [["pelicul", "vidro", "protetor", "protector", "blindag"], "shield"],
  [["capa", "capinha", "funda", "carcaca", "carcasa"], "smartphone"],
  [["cabo", "cable"], "cable"],
  [["carregador", "cargador", "powerbank", "bateria", "bateri"], "battery-charging"],
  [["tomada", "adaptador", "enchufe", "fonte"], "plug-zap"],
  [["fone", "headset", "auricular", "airpod", "earbud", "headphone", "acessorio", "accesorio"], "headphones"],
  [["caixinha", "speaker", "altavoz", "parlante", "jbl"], "speaker"],
  [["celular", "smartphone", "iphone", "aparelho", "telefon", "seminovo", "semi-novo", "usado"], "smartphone"],
  [["tablet", "ipad"], "tablet"],
  [["notebook", "laptop", "macbook", "computador", "computadora"], "laptop"],
  [["relogio", "reloj", "smartwatch"], "watch"],
  [["eletronic", "electronic", "monitor", "televis", "tela", "pantalla", "display", "frontal"], "monitor"],
  [["game", "gamer", "console", "videogame", "joystick", "controle", "control"], "gamepad-2"],
  [["camera", "camara"], "camera"],
  [["placa", "chip", "componente", "processador", "memoria"], "cpu"],
  [["peca", "pecas", "repuesto", "ferrament", "herramient", "reparo", "conserto", "manutenc"], "wrench"],
  [["promoc", "oferta", "desconto", "descuento", "liquidac", "saldo"], "tag"],
  [["presente", "regalo", "kit", "combo"], "gift"],
  [["novidade", "novedad", "lancamento", "lanzamiento", "destaque"], "sparkles"],
];

/** Palavras curtas que só valem inteiras (como prefixo dariam falso positivo). */
const PALAVRAS_EXATAS: ReadonlyMap<string, IconeCategoria> = new Map([
  ["case", "smartphone"],
  ["cases", "smartphone"],
  ["som", "speaker"],
  ["tv", "monitor"],
  ["tvs", "monitor"],
  ["pc", "laptop"],
  ["mac", "laptop"],
  ["watch", "watch"],
]);

function iconeDaPalavra(palavra: string): IconeCategoria | null {
  const exata = PALAVRAS_EXATAS.get(palavra);
  if (exata) return exata;
  for (const [prefixos, icone] of REGRAS_PREFIXO) {
    if (prefixos.some((p) => palavra.startsWith(p))) return icone;
  }
  return null;
}

/**
 * Sugere um ícone pelo nome. Lê as palavras na ordem em que aparecem e a PRIMEIRA que
 * combina decide ("Cabo de carregador" → cabo; "Carregadores e cabos" → carregador).
 * Sem combinação → pasta.
 */
export function sugerirIconePorNome(nome: string | null | undefined): IconeCategoria {
  const palavras = normalizar(nome ?? "").split(/[^a-z0-9-]+/).filter(Boolean);
  for (const palavra of palavras) {
    const icone = iconeDaPalavra(palavra);
    if (icone) return icone;
  }
  return ICONE_RESERVA;
}

/** Ícone a exibir: o salvo, se for da lista; senão o sugerido pelo nome. */
export function iconeDaCategoria(categoria: { nome?: string | null; icone?: string | null }): IconeCategoria {
  return ehIconeValido(categoria.icone) ? categoria.icone : sugerirIconePorNome(categoria.nome);
}
