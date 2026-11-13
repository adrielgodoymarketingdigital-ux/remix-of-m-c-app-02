/**
 * Personalização do recibo de venda (layout novo, A4): o que o lojista escolhe
 * mostrar e os textos dele. Fica em configuracoes_loja.recibo_venda_config
 * (jsonb; nulo = padrão). Puro, sem React nem Supabase: testado com Deno em
 * scripts/testes-recibo-venda-novo/reciboVendaConfig.test.ts.
 *
 * Regra de ouro: config ausente, nula, vazia ou igual ao padrão = recibo
 * IDÊNTICO ao de sempre. Nada muda para quem nunca configurou.
 *
 * Nunca viram interruptor (o recibo sempre mostra): número e data da venda,
 * itens (nome, quantidade e total), total, forma de pagamento e o selo de
 * venda cancelada.
 *
 * Os textos do lojista são texto puro: a limpeza não interpreta nada (HTML,
 * ${}, {{variável}} ficam como foram escritos) e quem desenha escapa (React).
 */

export const VERSAO_RECIBO_VENDA_CONFIG = 1;

/** Interruptores (true = mostra, como hoje). */
export interface MostrarReciboVenda {
  /** Logo no cabeçalho (desligado: aparece o nome da loja). */
  logo: boolean;
  /** Endereço, telefone, WhatsApp, e-mail e site no cabeçalho. */
  contatos_cabecalho: boolean;
  /** QR das redes/site/catálogo no cabeçalho. */
  qr: boolean;
  cliente_cpf: boolean;
  cliente_telefone: boolean;
  cliente_endereco: boolean;
  /** CNPJ no quadro da loja. */
  loja_cnpj: boolean;
  /** Nome do vendedor (no quadro da loja e na assinatura). */
  vendedor: boolean;
  /** Fotos dos itens. */
  fotos_itens: boolean;
  /** Cor, capacidade, condição, IMEI e nº de série dos aparelhos. */
  detalhes_aparelho: boolean;
  /** Coluna "Valor unit." dos itens. */
  valor_unitario: boolean;
  /** Linhas de desconto e cupom no resumo (o total continua líquido). */
  descontos: boolean;
  /** Quadro do aparelho recebido na troca. */
  troca: boolean;
  /** Tabela de parcelas a receber (o resumo "N parcelas" continua). */
  parcelas: boolean;
  /** Termos de garantia dos aparelhos. */
  garantias: boolean;
  /** Campos de assinatura do vendedor e do comprador. */
  assinaturas: boolean;
  /** Rodapé (agradecimento, frase e contatos). */
  rodape: boolean;
}

export type InterruptorReciboVenda = keyof MostrarReciboVenda;

/** Textos do lojista ("" = como hoje: bloco novo não aparece; texto fixo continua). */
export interface TextosReciboVenda {
  /** Bloco novo logo abaixo do título. */
  topo: string;
  /** Substitui "Obrigado por escolher a {loja}!" quando preenchido. */
  agradecimento: string;
  /** Substitui "Qualquer dúvida, entre em contato pelos nossos canais." quando preenchido. */
  frase_rodape: string;
  /** Bloco novo antes das assinaturas. */
  observacoes: string;
  /** Bloco novo: política de troca e devolução. */
  politica_troca: string;
}

export type CampoTextoReciboVenda = keyof TextosReciboVenda;

export interface ReciboVendaConfig {
  versao: typeof VERSAO_RECIBO_VENDA_CONFIG;
  mostrar: MostrarReciboVenda;
  textos: TextosReciboVenda;
}

export const INTERRUPTORES_RECIBO_VENDA: readonly InterruptorReciboVenda[] = [
  "logo",
  "contatos_cabecalho",
  "qr",
  "cliente_cpf",
  "cliente_telefone",
  "cliente_endereco",
  "loja_cnpj",
  "vendedor",
  "fotos_itens",
  "detalhes_aparelho",
  "valor_unitario",
  "descontos",
  "troca",
  "parcelas",
  "garantias",
  "assinaturas",
  "rodape",
];

export const LIMITES_TEXTOS_RECIBO_VENDA: Readonly<Record<CampoTextoReciboVenda, { caracteres: number; linhas: number }>> = {
  topo: { caracteres: 300, linhas: 4 },
  agradecimento: { caracteres: 120, linhas: 1 },
  frase_rodape: { caracteres: 200, linhas: 2 },
  observacoes: { caracteres: 1500, linhas: 20 },
  politica_troca: { caracteres: 1500, linhas: 20 },
};

export const CAMPOS_TEXTO_RECIBO_VENDA = Object.keys(LIMITES_TEXTOS_RECIBO_VENDA) as CampoTextoReciboVenda[];

/** Padrão = recibo de hoje: tudo ligado, nenhum texto. */
export const RECIBO_VENDA_CONFIG_PADRAO: Readonly<ReciboVendaConfig> = Object.freeze({
  versao: VERSAO_RECIBO_VENDA_CONFIG,
  mostrar: Object.freeze(
    Object.fromEntries(INTERRUPTORES_RECIBO_VENDA.map((k) => [k, true])) as unknown as MostrarReciboVenda,
  ),
  textos: Object.freeze(Object.fromEntries(CAMPOS_TEXTO_RECIBO_VENDA.map((k) => [k, ""])) as unknown as TextosReciboVenda),
});

/** Cópia nova e mutável do padrão. */
export function reciboVendaConfigPadrao(): ReciboVendaConfig {
  return {
    versao: VERSAO_RECIBO_VENDA_CONFIG,
    mostrar: { ...RECIBO_VENDA_CONFIG_PADRAO.mostrar },
    textos: { ...RECIBO_VENDA_CONFIG_PADRAO.textos },
  };
}

// ── Limpeza de texto ────────────────────────────────────────────────────────

/**
 * Caracteres de controle (menos a quebra de linha, tratada antes), separadores
 * de linha/parágrafo Unicode e marcas de direção (bidi), que podem embaralhar
 * a ordem do texto impresso.
 */
// deno-lint-ignore no-control-regex
const CONTROLES = /[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F-\u009F\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

const SURROGATE_SOLTO = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/** Caracteres como a pessoa vê (emoji com modificador conta 1); sem Intl.Segmenter, por code point. */
function caracteresVisiveis(texto: string): string[] {
  const Segmenter = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: "grapheme" }) => { segment(t: string): Iterable<{ segment: string }> } }).Segmenter;
  if (!Segmenter) return Array.from(texto);
  return Array.from(new Segmenter(undefined, { granularity: "grapheme" }).segment(texto), (s) => s.segment);
}

/**
 * Texto do lojista pronto para imprimir: quebras de linha padronizadas (\n),
 * sem caracteres de controle (tab vira espaço), cada linha aparada, no máximo
 * UMA linha em branco seguida, sem linhas em branco nas pontas, cortado em
 * `maxLinhas` linhas e `maxCaracteres` caracteres (contando as quebras; corte
 * por caractere visível, sem partir emoji/acentos compostos ao meio). Não
 * interpreta nada: HTML, ${}, {{x}} saem como foram escritos.
 * Qualquer coisa que não seja texto vira "".
 */
export function limparTextoRecibo(texto: unknown, maxCaracteres: number, maxLinhas: number): string {
  if (typeof texto !== "string") return "";
  const limiteCar = Number.isFinite(maxCaracteres) ? Math.max(0, Math.floor(maxCaracteres)) : 0;
  const limiteLin = Number.isFinite(maxLinhas) ? Math.max(0, Math.floor(maxLinhas)) : 0;
  if (limiteCar === 0 || limiteLin === 0) return "";

  const linhas = texto
    // Metade de emoji solta (surrogate sem par) não é Unicode válido e o jsonb
    // do Postgres recusa: sai antes de tudo.
    .replace(SURROGATE_SOLTO, "")
    .normalize("NFC")
    .replace(/\r\n?|\u2028|\u2029|\u0085/g, "\n")
    .replace(/\t/g, " ")
    .replace(CONTROLES, "")
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim());

  // No máximo uma linha em branco seguida.
  const juntas: string[] = [];
  for (const l of linhas) {
    if (l === "" && (juntas.length === 0 || juntas[juntas.length - 1] === "")) continue;
    juntas.push(l);
  }
  while (juntas.length && juntas[juntas.length - 1] === "") juntas.pop();

  let resultado = juntas.slice(0, limiteLin).join("\n").trimEnd();
  const caracteres = caracteresVisiveis(resultado);
  if (caracteres.length > limiteCar) resultado = caracteres.slice(0, limiteCar).join("").trimEnd();
  return resultado;
}

// ── Normalização ────────────────────────────────────────────────────────────

const objetoSimples = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;

/**
 * Qualquer entrada (null, undefined, {}, parcial, tipos errados, lixo) →
 * config sempre válida e completa.
 *  - não é objeto, ou `versao` presente e diferente de 1 (versão futura ou
 *    tipo errado) → padrão inteiro;
 *  - interruptor só desliga com `false` exato; ausente ou outro tipo = ligado;
 *  - texto só conta se for string (limpa e cortada nos limites); senão "";
 *  - chaves desconhecidas são ignoradas.
 */
export function normalizarReciboVendaConfig(entrada: unknown): ReciboVendaConfig {
  const config = reciboVendaConfigPadrao();
  if (!objetoSimples(entrada)) return config;
  if (entrada.versao !== undefined && entrada.versao !== VERSAO_RECIBO_VENDA_CONFIG) return config;

  const mostrar = entrada.mostrar;
  if (objetoSimples(mostrar)) {
    for (const k of INTERRUPTORES_RECIBO_VENDA) {
      if (Object.prototype.hasOwnProperty.call(mostrar, k) && mostrar[k] === false) config.mostrar[k] = false;
    }
  }

  const textos = entrada.textos;
  if (objetoSimples(textos)) {
    for (const k of CAMPOS_TEXTO_RECIBO_VENDA) {
      if (!Object.prototype.hasOwnProperty.call(textos, k)) continue;
      const { caracteres, linhas } = LIMITES_TEXTOS_RECIBO_VENDA[k];
      config.textos[k] = limparTextoRecibo(textos[k], caracteres, linhas);
    }
  }
  return config;
}

/** true quando a config (já normalizada) não muda nada no recibo. */
export function ehReciboVendaConfigPadrao(config: ReciboVendaConfig): boolean {
  return (
    INTERRUPTORES_RECIBO_VENDA.every((k) => config.mostrar[k] === true) &&
    CAMPOS_TEXTO_RECIBO_VENDA.every((k) => config.textos[k] === "")
  );
}
