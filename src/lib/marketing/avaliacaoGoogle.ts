// Marketing → Avaliações no Google: regras puras (sem imports; testadas com
// Deno em scripts/testes-marketing-avaliacao/).
//
// A configuração mora em configuracoes_loja.mensagens_whatsapp_os (jsonb), em
// chaves com prefixo "marketing_" para nunca colidir com o slug de um status
// de OS nem com "os_tracking". Sem migration.

export const CHAVE_LINK_AVALIACAO = "marketing_avaliacao_google_link";
export const CHAVE_MENSAGEM_AVALIACAO = "marketing_avaliacao_google_mensagem";
export const CHAVE_ATIVO_AVALIACAO = "marketing_avaliacao_google_ativo";

export const STATUS_ENTREGUE = "entregue";

/** Tamanho máximo do link aceito (links de avaliação reais têm bem menos). */
export const LIMITE_LINK_AVALIACAO = 500;

/** Variáveis aceitas na mensagem de pedido de avaliação. */
export const VARIAVEIS_AVALIACAO = ["{{cliente}}", "{{loja}}", "{{numero_os}}", "{{dispositivo}}", "{{link_avaliacao}}"] as const;

/** Mensagem usada quando a loja não personalizou. */
export const MENSAGEM_AVALIACAO_PADRAO =
  "Olá{{cliente}}! Obrigado por escolher a {{loja}}. Sua opinião é muito importante para nós: se gostou do atendimento, deixe sua avaliação no Google: {{link_avaliacao}}";

export type MotivoLinkInvalido = "vazio" | "longo" | "invalido" | "esquema" | "dominio" | "incompleto";

export type ResultadoLinkAvaliacao = { ok: true; url: string } | { ok: false; motivo: MotivoLinkInvalido };

// Hosts aceitos em qualquer caminho.
const HOSTS_AVALIACAO = new Set(["g.page", "search.google.com", "maps.app.goo.gl", "goo.gl", "g.co"]);
// Hosts aceitos só no caminho /maps.
const HOSTS_GOOGLE_MAPS = new Set(["www.google.com", "google.com"]);

/**
 * Aceita SOMENTE https e hosts do Google usados para avaliação. Sem esquema,
 * prefixa https://. Qualquer outro esquema (http, javascript:, data:...) é recusado.
 */
export function validarLinkAvaliacaoGoogle(texto: string | null | undefined): ResultadoLinkAvaliacao {
  const bruto = (texto ?? "").trim();
  if (!bruto) return { ok: false, motivo: "vazio" };
  if (bruto.length > LIMITE_LINK_AVALIACAO) return { ok: false, motivo: "longo" };
  if (/\s/.test(bruto)) return { ok: false, motivo: "invalido" };

  let comEsquema = bruto;
  if (/^[a-z][a-z0-9+.-]*:/i.test(bruto)) {
    if (!/^https:\/\//i.test(bruto)) return { ok: false, motivo: "esquema" };
  } else {
    comEsquema = `https://${bruto.replace(/^\/+/, "")}`;
  }

  let url: URL;
  try {
    url = new URL(comEsquema);
  } catch {
    return { ok: false, motivo: "invalido" };
  }
  if (url.protocol !== "https:") return { ok: false, motivo: "esquema" };
  if (url.username || url.password || url.port) return { ok: false, motivo: "dominio" };

  const host = url.hostname.toLowerCase();
  const caminho = url.pathname;
  const hostOk = HOSTS_AVALIACAO.has(host) ||
    (HOSTS_GOOGLE_MAPS.has(host) && (caminho === "/maps" || caminho.startsWith("/maps/")));
  if (!hostOk) return { ok: false, motivo: "dominio" };
  // Só o domínio ("g.page") não leva a avaliação nenhuma.
  if (caminho.length <= 1 && !url.search) return { ok: false, motivo: "incompleto" };
  if (url.href.length > LIMITE_LINK_AVALIACAO) return { ok: false, motivo: "longo" };

  return { ok: true, url: url.href };
}

export interface DadosMensagemAvaliacao {
  /** Nome do cliente (pode vir completo; usa só o primeiro nome). */
  cliente?: string | null;
  loja?: string | null;
  /** Link JÁ validado (validarLinkAvaliacaoGoogle). */
  link: string;
  numeroOS?: string | null;
  dispositivo?: string | null;
}

/**
 * Monta o texto final. {{cliente}} grudado na palavra anterior ("Olá{{cliente}}")
 * vira ", João"; com espaço antes vira "João"; sem nome, some junto com o espaço.
 * Sem {{link_avaliacao}} no modelo, o link entra numa linha nova no fim: a
 * mensagem nunca sai sem o link.
 */
export function montarMensagemAvaliacao(template: string | null | undefined, dados: DadosMensagemAvaliacao): string {
  const modelo = template && template.trim() ? template : MENSAGEM_AVALIACAO_PADRAO;
  const nome = (dados.cliente ?? "").trim().split(/\s+/)[0] ?? "";
  const link = dados.link;

  let texto = nome
    ? modelo
        .replace(/(\S)\{\{cliente\}\}/g, (_m, antes: string) => `${antes}, ${nome}`)
        .replace(/\{\{cliente\}\}/g, () => nome)
    : modelo.replace(/[ \t]*\{\{cliente\}\}/g, "");

  const temLink = texto.includes("{{link_avaliacao}}");
  texto = texto
    .replace(/\{\{loja\}\}/g, () => (dados.loja ?? "").trim())
    .replace(/\{\{numero_os\}\}/g, () => (dados.numeroOS ?? "").trim())
    .replace(/\{\{dispositivo\}\}/g, () => (dados.dispositivo ?? "").trim())
    .replace(/\{\{link_avaliacao\}\}/g, () => link);

  if (!temLink && link) texto = `${texto.trimEnd()}\n${link}`;
  return texto;
}

export interface EntradaAvaliacaoAoEntregar {
  novoStatus: string;
  statusAnterior: string | null | undefined;
  emLote: boolean;
  /** A OS está gravada com o novo status (relida do banco). */
  mudou: boolean;
  /** Há link salvo e ele passa em validarLinkAvaliacaoGoogle. */
  linkConfigurado: boolean;
  /** A loja ligou "Oferecer pedido de avaliação ao entregar uma OS". */
  ativo: boolean;
}

export function deveOferecerAvaliacaoAoEntregar(e: EntradaAvaliacaoAoEntregar): boolean {
  return (
    e.novoStatus === STATUS_ENTREGUE &&
    e.statusAnterior !== STATUS_ENTREGUE &&
    !e.emLote &&
    e.mudou &&
    e.linkConfigurado &&
    e.ativo
  );
}

export interface ConfigAvaliacaoGoogle {
  /** Texto salvo (pode ser inválido, para a tela mostrar). */
  link: string;
  /** Link validado, ou null. Só este vai para a mensagem e para "Testar link". */
  linkValido: string | null;
  /** Mensagem salva ("" = usar a padrão). */
  mensagem: string;
  /** Sem chave salva = ligado (a tela já nasce ligada). */
  ativo: boolean;
}

/** Lê as chaves marketing_* de mensagens_whatsapp_os (qualquer formato vindo do banco). */
export function lerConfigAvaliacaoGoogle(mensagens: unknown): ConfigAvaliacaoGoogle {
  const m = mensagens && typeof mensagens === "object" && !Array.isArray(mensagens)
    ? (mensagens as Record<string, unknown>)
    : {};
  const texto = (v: unknown) => (typeof v === "string" ? v : "");
  const link = texto(m[CHAVE_LINK_AVALIACAO]);
  const validado = validarLinkAvaliacaoGoogle(link);
  const ativoSalvo = m[CHAVE_ATIVO_AVALIACAO];
  return {
    link,
    linkValido: validado.ok ? validado.url : null,
    mensagem: texto(m[CHAVE_MENSAGEM_AVALIACAO]),
    ativo: typeof ativoSalvo === "string" ? ativoSalvo === "1" : true,
  };
}

export interface OSParaAvaliacao {
  status: string | null;
  data_saida?: string | null;
}

/**
 * OS entregues nos últimos `dias` (pela data de saída), da mais recente para a
 * mais antiga, no máximo `limite`.
 */
export function selecionarOSEntreguesRecentes<T extends OSParaAvaliacao>(
  ordens: T[],
  agora: Date,
  dias = 30,
  limite = 50,
): T[] {
  const corte = agora.getTime() - dias * 24 * 60 * 60 * 1000;
  return ordens
    .map((o) => ({ o, t: o.data_saida ? new Date(o.data_saida).getTime() : Number.NaN }))
    .filter(({ o, t }) => o.status === STATUS_ENTREGUE && !Number.isNaN(t) && t >= corte)
    .sort((a, b) => b.t - a.t)
    .slice(0, limite)
    .map(({ o }) => o);
}
