/**
 * Recibo de venda no layout novo (A4): tudo o que o recibo mostra, já pronto
 * para desenhar — cabeçalho, QR, situação, cliente, itens, resumo, troca,
 * faixa de total, pagamento (com parcelas e vencimentos), garantias, vendedor
 * e rodapé. Puro, sem React nem Supabase: testado com Deno em
 * scripts/testes-recibo-venda-novo/.
 *
 * Duas entradas:
 *  - entradaDoPDV: o recibo logo depois de finalizar no PDV (DadosReciboPDV);
 *  - entradaDasLinhas: o recibo reaberto (Vendas, Dispositivos vendidos), a
 *    partir das linhas de `vendas` lidas por carregarReciboVenda — junta as
 *    linhas de parcela num item só e ignora as linhas pagamento_duplo_secundario
 *    (só usadas para as parcelas da 2ª forma).
 *
 * Valores sempre em centavos e pelas regras da troca e do parcelamento
 * (calcularTotaisComTroca, montarBlocoTrocaRecibo, valoresContaReceberComTroca,
 * valorAReceberSemConta). Os textos ficam crus: quem desenha escapa (o React
 * já escapa); só URLs http(s) chegam aos links e ao QR.
 */
import {
  type BlocoTrocaRecibo,
  type DadosTrocaRecibo,
  formatarMoedaRecibo,
  montarBlocoTrocaRecibo,
} from "./reciboTroca.ts";
import {
  calcularTotaisComTroca,
  NOME_FORMA_TROCA_TOTAL,
  ratearPorPeso,
  valorAReceberSemConta,
  valoresContaReceberComTroca,
} from "./trocaPDV.ts";
import { nomeFormaPagamento } from "../formaPagamento.ts";
import { MARCADOR_PAGAMENTO_DUPLO_SECUNDARIO } from "../vendasFinanceiras.ts";
import { formatarTermoDispositivo, resolverTextoTermoDispositivo } from "../termo-garantia-utils.ts";

// ── Entrada ─────────────────────────────────────────────────────────────────

/** Campos de configuracoes_loja usados no recibo (o objeto da loja pode ser passado direto). */
export interface LojaReciboEntrada {
  nome_loja?: string | null;
  logo_url?: string | null;
  cnpj?: string | null;
  endereco?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  site?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  catalogo_ativo?: boolean | null;
  catalogo_slug?: string | null;
}

export interface ClienteReciboEntrada {
  nome?: string | null;
  cpf?: string | null;
  telefone?: string | null;
  endereco?: string | null;
}

export type TipoItemRecibo = "dispositivo" | "produto" | "peca";

export interface ItemReciboEntrada {
  tipo: TipoItemRecibo;
  nome: string;
  quantidade: number;
  /** preço × quantidade, sem desconto. */
  bruto: number;
  cor?: string | null;
  capacidadeGb?: number | null;
  condicao?: string | null;
  imei?: string | null;
  imei2?: string | null;
  numeroSerie?: string | null;
  sku?: string | null;
  fotoUrl?: string | null;
  /** Meses de garantia contratual (0/null = sem garantia contratual). */
  tempoGarantiaMeses?: number | null;
  /** Modelo de termo escolhido no item (null = termo global da loja). */
  modeloTermoId?: string | null;
}

export interface ParcelaReciboEntrada {
  valor: number;
  /** "YYYY-MM-DD" (ou ISO); null = sem vencimento informado. */
  vencimento: string | null;
}

export interface FormaReciboEntrada {
  /** Forma como gravada no banco ("pix", "credito_parcelado", "a_receber", "outro"...). */
  forma: string;
  /** Nome de exibição (forma customizada já resolvida). */
  nome: string;
  /** Parcelas do cartão (só existe logo após o PDV: o banco não guarda). */
  parcelasCartao?: number | null;
  /** Parcelas "a receber" (valor que o cliente paga em cada uma). */
  parcelasReceber?: ParcelaReciboEntrada[] | null;
  /** Vencimento do "a receber" à vista. */
  vencimento?: string | null;
}

export interface PagamentoReciboEntrada {
  primeira: FormaReciboEntrada;
  /** Pagamento duplo: a 2ª forma e o valor dela (a 1ª fica com o resto). */
  segunda?: (FormaReciboEntrada & { valor: number }) | null;
}

export interface TrocaReciboEntrada extends DadosTrocaRecibo {
  condicao?: string | null;
  fotoUrl?: string | null;
}

interface SecaoTermo {
  visivel: boolean;
  conteudo: string;
}

export interface ModeloTermoEntrada {
  id: string;
  secoes_com_garantia: SecaoTermo[];
  secoes_sem_garantia: SecaoTermo[];
}

export interface TermoConfigEntrada {
  modo?: "livre" | "secoes";
  secoes_com_garantia?: SecaoTermo[];
  secoes_sem_garantia?: SecaoTermo[];
  termo_com_garantia?: string;
  termo_sem_garantia?: string;
}

export interface EntradaReciboVenda {
  loja: LojaReciboEntrada | null | undefined;
  cliente: ClienteReciboEntrada | null | undefined;
  itens: ItemReciboEntrada[];
  numeroVenda?: string | null;
  /** Data/hora da venda (ISO). */
  data: string;
  vendedorNome?: string | null;
  descontoManual: number;
  descontoCupom: number;
  cupomCodigo?: string | null;
  pagamento: PagamentoReciboEntrada;
  troca?: TrocaReciboEntrada | null;
  cancelamento?: { data?: string | null; motivo?: string | null } | null;
  termo?: { config?: TermoConfigEntrada | null; modelos?: ModeloTermoEntrada[] | null } | null;
  /** Origem do app para o link do catálogo (ex.: window.location.origin). */
  origemApp?: string;
}

// ── Saída ───────────────────────────────────────────────────────────────────

export type TipoContato = "endereco" | "telefone" | "whatsapp" | "email" | "site" | "instagram" | "facebook";
export type RedeSocial = "instagram" | "facebook" | "whatsapp";

export interface ContatoRecibo {
  tipo: TipoContato;
  texto: string;
}

export interface QrRecibo {
  url: string;
  legenda: string;
  origem: "instagram" | "site" | "catalogo" | "facebook" | "whatsapp";
  /** Ícones abaixo do QR: só as redes que a loja preencheu. */
  redes: RedeSocial[];
}

export interface ItemRecibo {
  numero: number;
  nome: string;
  detalhes: string[];
  /** Etiqueta "Produto vendido" (aparelhos). */
  etiqueta: string | null;
  quantidade: number;
  valorUnitario: string;
  total: string;
  fotoUrl: string | null;
}

export interface LinhaValorRecibo {
  rotulo: string;
  valor: string;
  negativo?: boolean;
  destaque?: boolean;
}

export interface TrocaRecibo extends BlocoTrocaRecibo {
  condicao: string | null;
  fotoUrl: string | null;
}

export type TomForma = "pago" | "pendente" | "troca";

export interface FormaRecibo {
  nome: string;
  /** Valor desta forma (só aparece no pagamento duplo). */
  valor: string | null;
  /** "3× de R$ 1.000,00", "Vencimento: 10/11/2026"... */
  detalhe: string | null;
  tom: TomForma;
  parcelas: { numero: number; valor: string; vencimento: string | null }[];
}

export interface ReciboVendaModelo {
  cabecalho: { nomeLoja: string; logoUrl: string | null; contatos: ContatoRecibo[] };
  qr: QrRecibo | null;
  titulo: { texto: string; numero: string | null; dataHora: string };
  situacao: { tipo: "finalizada" | "cancelada"; rotulo: string; frase: string };
  cliente: { nome: string; cpf: string | null; telefone: string | null; endereco: string | null; consumidorFinal: boolean };
  loja: { nome: string; cnpj: string | null };
  vendedor: string | null;
  itens: ItemRecibo[];
  tituloItens: string;
  mostrarFotoItens: boolean;
  resumo: LinhaValorRecibo[];
  troca: TrocaRecibo | null;
  faixaTotal: { rotulo: string; valor: string; valorCentavos: number; cancelada: boolean };
  pagamento: { formas: FormaRecibo[]; observacao: string | null };
  garantias: { titulo: string; produto: string; texto: string }[];
  assinaturas: { vendedor: string; comprador: string };
  rodape: { agradecimento: string; frase: string; contatos: ContatoRecibo[] };
}

// ── Utilidades ──────────────────────────────────────────────────────────────

const limpo = (v: string | null | undefined): string => (typeof v === "string" ? v.trim() : "");
const centavos = (v: number | null | undefined): number => Math.round((Number(v) || 0) * 100);
const moeda = (c: number): string => formatarMoedaRecibo(c / 100);
const somenteDigitos = (v: string): string => v.replace(/\D/g, "");

export const ROTULO_TOTAL_VENDA = "TOTAL DA VENDA";
export const ROTULO_VALOR_PAGO = "VALOR PAGO PELO CLIENTE";
export const ROTULO_VALOR_A_PAGAR = "VALOR A PAGAR";

const CONDICOES: Record<string, string> = { novo: "Novo", semi_novo: "Semi Novo", seminovo: "Seminovo", usado: "Usado" };
export const rotuloCondicao = (c: string | null | undefined): string | null => {
  const t = limpo(c);
  return t ? CONDICOES[t] ?? t : null;
};

const ehAReceber = (forma: string | null | undefined) => forma === "a_receber" || forma === "a_prazo";

const FUSO = "America/Sao_Paulo";
const fmtData = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric" });
const fmtHora = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit", hour12: false });

/** "24/10/2026 às 18:55" no horário de Brasília (o recibo sai igual em qualquer fuso). */
export function formatarDataHoraRecibo(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${fmtData.format(d)} às ${fmtHora.format(d)}`;
}

/** "YYYY-MM-DD" → "dd/MM/yyyy" sem passar por fuso; ISO com hora → data de Brasília. */
export function formatarDataRecibo(valor: string | null | undefined): string | null {
  const t = limpo(valor);
  if (!t) return null;
  const soData = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (soData) return `${soData[3]}/${soData[2]}/${soData[1]}`;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : fmtData.format(d);
}

/** Meses de garantia legíveis ("3 meses", "1 ano"), como o recibo do PDV. */
export function formatarMesesGarantia(meses: number): string {
  if (meses % 12 === 0 && meses >= 12) {
    const anos = meses / 12;
    return anos === 1 ? "1 ano" : `${anos} anos`;
  }
  return `${meses} ${meses === 1 ? "mês" : "meses"}`;
}

// ── Links (QR, rodapé) ──────────────────────────────────────────────────────

/** Só http(s); qualquer outro esquema (javascript:, data:...) é recusado. */
export function urlSegura(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Nome de usuário de rede social a partir de "@loja", "loja", "instagram.com/loja" ou URL. */
function usuarioRede(valor: string | null | undefined, dominio: string): string | null {
  let t = limpo(valor);
  if (!t) return null;
  const re = new RegExp(`^(?:https?://)?(?:www\\.|m\\.)?${dominio.replace(".", "\\.")}/`, "i");
  t = t.replace(re, "").replace(/^@+/, "").split(/[/?#\s]/)[0];
  return /^[A-Za-z0-9._-]{1,60}$/.test(t) ? t : null;
}

export function linkInstagram(valor: string | null | undefined): { url: string; usuario: string } | null {
  const u = usuarioRede(valor, "instagram.com");
  return u ? { url: `https://instagram.com/${u}`, usuario: `@${u}` } : null;
}

export function linkFacebook(valor: string | null | undefined): { url: string; usuario: string } | null {
  const u = usuarioRede(valor, "facebook.com");
  return u ? { url: `https://facebook.com/${u}`, usuario: u } : null;
}

export function linkSite(valor: string | null | undefined): { url: string; texto: string } | null {
  const t = limpo(valor);
  if (!t) return null;
  const url = urlSegura(/^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`);
  if (!url) return null;
  return { url, texto: t.replace(/^https?:\/\//i, "").replace(/\/$/, "") };
}

export function linkWhatsApp(valor: string | null | undefined): string | null {
  let d = somenteDigitos(limpo(valor));
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  return d.length >= 12 && d.length <= 13 ? `https://wa.me/${d}` : null;
}

export function linkCatalogo(loja: LojaReciboEntrada | null | undefined, origemApp = "https://appmec.in"): string | null {
  const slug = limpo(loja?.catalogo_slug);
  if (!loja?.catalogo_ativo || !/^[A-Za-z0-9_-]+$/.test(slug)) return null;
  return urlSegura(`${origemApp.replace(/\/$/, "")}/c/${slug}`);
}

/** QR: Instagram > site > catálogo online > Facebook > WhatsApp da loja; sem nenhum, sem QR. */
export function montarQrRecibo(loja: LojaReciboEntrada | null | undefined, origemApp?: string): QrRecibo | null {
  if (!loja) return null;
  const insta = linkInstagram(loja.instagram);
  const face = linkFacebook(loja.facebook);
  const wpp = linkWhatsApp(loja.whatsapp);
  const redes: RedeSocial[] = [
    ...(insta ? ["instagram" as const] : []),
    ...(face ? ["facebook" as const] : []),
    ...(wpp ? ["whatsapp" as const] : []),
  ];
  const site = linkSite(loja.site);
  const catalogo = linkCatalogo(loja, origemApp);
  if (insta) return { url: insta.url, legenda: "ACESSE NOSSAS REDES SOCIAIS", origem: "instagram", redes };
  if (site) return { url: site.url, legenda: "ACESSE NOSSO SITE", origem: "site", redes };
  if (catalogo) return { url: catalogo, legenda: "VEJA NOSSO CATÁLOGO", origem: "catalogo", redes };
  if (face) return { url: face.url, legenda: "ACESSE NOSSAS REDES SOCIAIS", origem: "facebook", redes };
  if (wpp) return { url: wpp, legenda: "FALE CONOSCO NO WHATSAPP", origem: "whatsapp", redes };
  return null;
}

function enderecoLoja(loja: LojaReciboEntrada): string {
  const direto = limpo(loja.endereco);
  if (direto) return direto;
  const rua = [limpo(loja.logradouro), limpo(loja.numero)].filter(Boolean).join(", ");
  const cidade = [limpo(loja.cidade), limpo(loja.estado)].filter(Boolean).join("/");
  const cep = limpo(loja.cep) ? `CEP: ${limpo(loja.cep)}` : "";
  return [rua, limpo(loja.bairro), cidade, cep].filter(Boolean).join(" - ");
}

// ── Garantia ────────────────────────────────────────────────────────────────

/** Termos padrão (os mesmos do recibo do PDV), com "Valor do produto" no lugar de "Valor pago". */
export const TERMOS_GARANTIA_PADRAO_NOVO = {
  com: `TERMO DE GARANTIA

Loja: {{loja}}
CNPJ: {{loja_cnpj}}

COMPRADOR
Nome: {{cliente}}

PRODUTO
Aparelho: {{dispositivo}}
IMEI: {{imei}}
Data da venda: {{data_venda}}
Valor do produto: {{valor}}

1. GARANTIA LEGAL (CDC - Lei 8.078/90)
   • Garantia legal de 90 (noventa) dias, conforme Art. 26, II do CDC.
   • Cobre defeitos de fabricação ou vícios que comprometam o funcionamento.

2. GARANTIA CONTRATUAL ({{garantia_meses}})
   • Garantia de {{garantia_meses}} a partir da data desta venda, já incluindo o prazo mínimo de garantia legal previsto no CDC (Art. 26, II).
   • Cobre defeitos de fabricação, excluindo mau uso, quedas ou oxidação.

3. DIREITOS DO CONSUMIDOR
   • Vício do produto: substituição, devolução ou abatimento (Art. 18 CDC).
   • Prazo suspenso durante reparo (Art. 26, §2º CDC).
   • Conserve este documento como comprovante.

4. EXCLUSÕES
   • Quedas, impactos, contato com líquidos, uso inadequado.
   • Violação de lacres ou reparo por terceiros não autorizados.
   • Desgaste natural de uso.

Para acionamento da garantia, apresente este termo na loja.`,
  sem: `DECLARAÇÃO DE VENDA SEM GARANTIA CONTRATUAL

Loja: {{loja}}
CNPJ: {{loja_cnpj}}

COMPRADOR
Nome: {{cliente}}

PRODUTO
Aparelho: {{dispositivo}}
IMEI: {{imei}}
Data da venda: {{data_venda}}
Valor do produto: {{valor}}

AVISO: Este produto é vendido sem garantia contratual adicional.
A garantia legal de 90 dias prevista no CDC (Art. 26, II) se aplica conforme a legislação.
O cliente declara estar ciente das condições do equipamento.`,
};

/**
 * Ajustes no texto do termo (padrão ou da loja) antes de trocar os campos:
 *  - {{valor}} é o preço do produto: "Valor pago: {{valor}}" vira "Valor do produto: {{valor}}";
 *  - {{garantia_meses}} já sai com a unidade ("3 meses", "1 ano"): "{{garantia_meses}} meses"
 *    perde o "meses" repetido (hoje sai "3 meses meses").
 */
export const ajustarTextoTermo = (texto: string): string =>
  texto
    .replace(/Valor pago(\s*):(\s*)\{\{valor\}\}/gi, "Valor do produto$1:$2{{valor}}")
    .replace(/\{\{garantia_meses\}\}\s+meses\b/gi, "{{garantia_meses}}");

function textoBaseTermo(item: ItemReciboEntrada, termo: EntradaReciboVenda["termo"]): string {
  const temGarantia = (item.tempoGarantiaMeses ?? 0) > 0;
  const modelo = item.modeloTermoId ? termo?.modelos?.find((m) => m.id === item.modeloTermoId) : null;
  if (modelo) {
    const secoes = temGarantia ? modelo.secoes_com_garantia : modelo.secoes_sem_garantia;
    return secoes.filter((s) => s.visivel).map((s) => s.conteudo.trim()).join("\n\n");
  }
  return resolverTextoTermoDispositivo(termo?.config, temGarantia, TERMOS_GARANTIA_PADRAO_NOVO.com, TERMOS_GARANTIA_PADRAO_NOVO.sem);
}

function imeisTermo(imei1?: string | null, imei2?: string | null): string | undefined {
  if (!limpo(imei2)) return limpo(imei1) || undefined;
  return `${limpo(imei1) || "—"}\nIMEI 2: ${limpo(imei2)}`;
}

// ── Montagem ────────────────────────────────────────────────────────────────

function detalhesItem(item: ItemReciboEntrada): string[] {
  if (item.tipo !== "dispositivo") return limpo(item.sku) ? [`SKU: ${limpo(item.sku)}`] : [];
  const cor = limpo(item.cor) ? `Cor: ${limpo(item.cor)}` : "";
  const cap = item.capacidadeGb ? `${item.capacidadeGb} GB` : "";
  const condicao = rotuloCondicao(item.condicao);
  return [
    [cor, cap].filter(Boolean).join(" | "),
    condicao ? `Condição: ${condicao}` : "",
    limpo(item.imei) ? `IMEI: ${limpo(item.imei)}` : "",
    limpo(item.imei2) ? `IMEI 2: ${limpo(item.imei2)}` : "",
    limpo(item.numeroSerie) ? `Nº de série: ${limpo(item.numeroSerie)}` : "",
  ].filter(Boolean);
}

function parcelasFormatadas(parcelas: ParcelaReciboEntrada[] | null | undefined) {
  return (parcelas ?? []).map((p, i) => ({ numero: i + 1, valor: moeda(centavos(p.valor)), vencimento: formatarDataRecibo(p.vencimento) }));
}

function montarForma(f: FormaReciboEntrada, valorC: number, mostrarValor: boolean): FormaRecibo {
  const parcelas = ehAReceber(f.forma) ? parcelasFormatadas(f.parcelasReceber) : [];
  let detalhe: string | null = null;
  if (f.forma === "credito_parcelado" && f.parcelasCartao && f.parcelasCartao > 1) {
    detalhe = `${f.parcelasCartao}× de ${moeda(Math.round(valorC / f.parcelasCartao))}`;
  } else if (ehAReceber(f.forma) && parcelas.length > 1) {
    detalhe = `${parcelas.length} parcelas`;
  } else if (ehAReceber(f.forma) && formatarDataRecibo(f.vencimento ?? f.parcelasReceber?.[0]?.vencimento)) {
    detalhe = `Vencimento: ${formatarDataRecibo(f.vencimento ?? f.parcelasReceber?.[0]?.vencimento)}`;
  }
  return {
    nome: f.nome,
    valor: mostrarValor ? moeda(valorC) : null,
    detalhe,
    tom: ehAReceber(f.forma) ? "pendente" : "pago",
    parcelas: parcelas.length > 1 ? parcelas : [],
  };
}

export function montarReciboVenda(e: EntradaReciboVenda): ReciboVendaModelo {
  const loja = e.loja ?? {};
  const nomeLoja = limpo(loja.nome_loja) || "Loja";
  const insta = linkInstagram(loja.instagram);
  const site = linkSite(loja.site);
  const telefone = limpo(loja.telefone);
  const whatsapp = limpo(loja.whatsapp);

  const contatosCabecalho: ContatoRecibo[] = [
    { tipo: "endereco" as const, texto: enderecoLoja(loja) },
    { tipo: "telefone" as const, texto: telefone },
    // WhatsApp igual ao telefone não repete a linha.
    { tipo: "whatsapp" as const, texto: whatsapp && somenteDigitos(whatsapp) !== somenteDigitos(telefone) ? whatsapp : "" },
    { tipo: "email" as const, texto: limpo(loja.email) },
    { tipo: "site" as const, texto: site?.texto ?? "" },
  ].filter((c) => c.texto);

  // Valores da venda (centavos).
  const subtotalC = e.itens.reduce((acc, i) => acc + centavos(i.bruto), 0);
  const descManualC = centavos(e.descontoManual);
  const descCupomC = centavos(e.descontoCupom);
  const totais = calcularTotaisComTroca({
    subtotal: subtotalC / 100,
    desconto: (descManualC + descCupomC) / 100,
    valorEntrada: e.troca?.valorEntrada ?? 0,
  });
  const totalVendaC = centavos(totais.totalVenda);
  const temTroca = totais.valorEntrada > 0;
  const aPagarC = temTroca ? centavos(totais.aPagar) : totalVendaC;
  const cancelada = !!e.cancelamento;

  const primeira = e.pagamento.primeira;
  const segunda = e.pagamento.segunda ?? null;
  const formaTroca = temTroca && aPagarC === 0;
  const algumaAReceber = !formaTroca && (ehAReceber(primeira.forma) || (!!segunda && ehAReceber(segunda.forma)));

  // Troca: valores e linhas da função da troca; sem a linha repetida quando
  // aparelho recebido = valor da troca, e "a pagar" quando a forma é a receber.
  const nomeFormas = segunda ? `${primeira.nome} + ${segunda.nome}` : primeira.nome;
  const bloco = montarBlocoTrocaRecibo({ troca: e.troca, totalVenda: totalVendaC / 100, formaPagamentoLabel: nomeFormas });
  let troca: TrocaRecibo | null = null;
  if (bloco && e.troca) {
    const entradaC = centavos(e.troca.valorEntrada);
    const linhas = bloco.linhas
      .filter((l, i) => !(i === 0 && entradaC === centavos(totais.trocaAplicada)))
      .map((l) => (l.destaque && l.rotulo.startsWith("Valor pago pelo cliente") && algumaAReceber
        ? { ...l, rotulo: l.rotulo.replace("Valor pago pelo cliente", "Valor a pagar") }
        : l));
    troca = { ...bloco, linhas, condicao: rotuloCondicao(e.troca.condicao), fotoUrl: limpo(e.troca.fotoUrl) || null };
  }

  const rotuloFaixa = algumaAReceber ? ROTULO_VALOR_A_PAGAR : temTroca ? ROTULO_VALOR_PAGO : ROTULO_TOTAL_VENDA;

  // Pagamento.
  const formas: FormaRecibo[] = [];
  if (formaTroca) {
    formas.push({ nome: NOME_FORMA_TROCA_TOTAL, valor: null, detalhe: "Pago integralmente com o aparelho recebido", tom: "troca", parcelas: [] });
  } else if (segunda) {
    const segundaC = Math.min(centavos(segunda.valor), aPagarC);
    formas.push(montarForma(primeira, aPagarC - segundaC, true));
    formas.push(montarForma(segunda, segundaC, true));
  } else {
    formas.push(montarForma(primeira, aPagarC, false));
  }
  const devolucao = troca?.linhas.find((l) => l.rotulo.startsWith("Diferença devolvida"));

  const itens: ItemRecibo[] = e.itens.map((item, i) => {
    const qtd = item.quantidade > 0 ? item.quantidade : 1;
    return {
      numero: i + 1,
      nome: limpo(item.nome) || "Produto",
      detalhes: detalhesItem(item),
      etiqueta: item.tipo === "dispositivo" ? "Produto vendido" : null,
      quantidade: qtd,
      valorUnitario: moeda(Math.round(centavos(item.bruto) / qtd)),
      total: moeda(centavos(item.bruto)),
      fotoUrl: limpo(item.fotoUrl) || null,
    };
  });

  const resumo: LinhaValorRecibo[] = [
    { rotulo: "Subtotal", valor: moeda(subtotalC) },
    ...(descManualC > 0 ? [{ rotulo: "Desconto", valor: moeda(descManualC), negativo: true }] : []),
    ...(descCupomC > 0
      ? [{ rotulo: limpo(e.cupomCodigo) ? `Cupom (${limpo(e.cupomCodigo)})` : "Cupom", valor: moeda(descCupomC), negativo: true }]
      : []),
  ];

  const dataHora = formatarDataHoraRecibo(e.data);
  const cliente = e.cliente ?? null;
  const nomeCliente = limpo(cliente?.nome);
  const garantias = e.itens
    .filter((i) => i.tipo === "dispositivo")
    .map((item) => {
      const meses = item.tempoGarantiaMeses ?? 0;
      const texto = formatarTermoDispositivo(ajustarTextoTermo(textoBaseTermo(item, e.termo)), {
        cliente: nomeCliente || undefined,
        cpf: limpo(cliente?.cpf) || undefined,
        telefone: limpo(cliente?.telefone) || undefined,
        dispositivo: limpo(item.nome),
        condicao: rotuloCondicao(item.condicao) ?? undefined,
        cor: limpo(item.cor) || undefined,
        capacidade: item.capacidadeGb ? `${item.capacidadeGb} GB` : undefined,
        numero_serie: limpo(item.numeroSerie) || undefined,
        imei: imeisTermo(item.imei, item.imei2),
        garantia_meses: meses > 0 ? formatarMesesGarantia(meses) : undefined,
        valor: moeda(centavos(item.bruto)),
        data_venda: dataHora,
        loja: limpo(loja.nome_loja) || undefined,
        loja_telefone: telefone || undefined,
        loja_cnpj: limpo(loja.cnpj) || undefined,
        loja_endereco: enderecoLoja(loja) || undefined,
      });
      return { titulo: meses > 0 ? "TERMO DE GARANTIA" : "TERMO DE VENDA", produto: limpo(item.nome), texto };
    });

  const dataCancelamento = formatarDataRecibo(e.cancelamento?.data);
  const motivo = limpo(e.cancelamento?.motivo);
  const vendedor = limpo(e.vendedorNome) || null;
  const qtdItens = itens.length;

  return {
    cabecalho: { nomeLoja, logoUrl: limpo(loja.logo_url) || null, contatos: contatosCabecalho },
    qr: montarQrRecibo(loja, e.origemApp),
    titulo: { texto: "RECIBO DE VENDA", numero: limpo(e.numeroVenda) || null, dataHora },
    situacao: cancelada
      ? {
          tipo: "cancelada",
          rotulo: "VENDA CANCELADA",
          frase: [dataCancelamento ? `Cancelada em ${dataCancelamento}` : "Venda cancelada", motivo ? `Motivo: ${motivo}` : ""].filter(Boolean).join(" · "),
        }
      : { tipo: "finalizada", rotulo: "VENDA FINALIZADA", frase: "Obrigado pela sua confiança!" },
    cliente: {
      nome: nomeCliente || "Consumidor Final",
      cpf: limpo(cliente?.cpf) || null,
      telefone: limpo(cliente?.telefone) || null,
      endereco: limpo(cliente?.endereco) || null,
      consumidorFinal: !nomeCliente,
    },
    loja: { nome: nomeLoja, cnpj: limpo(loja.cnpj) || null },
    vendedor,
    itens,
    tituloItens: `ITENS DA VENDA (${qtdItens} ${qtdItens === 1 ? "item" : "itens"})`,
    mostrarFotoItens: itens.some((i) => i.fotoUrl),
    resumo,
    troca,
    faixaTotal: { rotulo: rotuloFaixa, valor: moeda(aPagarC), valorCentavos: aPagarC, cancelada },
    pagamento: { formas, observacao: devolucao ? `${devolucao.rotulo}: ${devolucao.valor}` : null },
    garantias,
    assinaturas: { vendedor: vendedor ?? nomeLoja, comprador: nomeCliente || "Comprador" },
    rodape: {
      agradecimento: `Obrigado por escolher a ${nomeLoja}!`,
      frase: "Qualquer dúvida, entre em contato pelos nossos canais.",
      contatos: [
        { tipo: "whatsapp" as const, texto: whatsapp },
        { tipo: "instagram" as const, texto: insta?.usuario ?? "" },
        { tipo: "site" as const, texto: site?.texto ?? "" },
      ].filter((c) => c.texto),
    },
  };
}

// ── Adaptador do PDV ────────────────────────────────────────────────────────

/** Formato de DadosReciboPDV (src/components/pdv/DialogReciboPDV.tsx) usado aqui. */
export interface DadosPDVParaRecibo {
  itens: {
    id: string;
    tipo: TipoItemRecibo;
    nome: string;
    preco: number;
    quantidade: number;
    imei_dispositivo?: string;
    imei?: string;
    imei2?: string;
    condicao?: string;
    cor?: string;
    capacidade_gb?: number;
    numero_serie?: string;
    tempo_garantia?: number;
    modelo_termo_garantia_id?: string;
  }[];
  cliente: ClienteReciboEntrada | null;
  subtotal: number;
  descontoManual: number;
  descontoCupom: number;
  cupom?: { codigo: string } | null;
  troca?: DadosTrocaRecibo;
  total: number;
  formaPagamento: string;
  nomeFormaPagamento?: string;
  numeroParcelas?: number;
  data: string;
  numeroVenda?: string | null;
  pagamentoDuplo?: { valorPrimeira: number; segundaForma: string; nomeSegundaForma?: string; valorSegunda: number };
}

/** O que o PDV sabe além de DadosReciboPDV (a tela passa na integração). */
export interface ExtrasPDVParaRecibo {
  loja: LojaReciboEntrada | null | undefined;
  termo?: EntradaReciboVenda["termo"];
  vendedorNome?: string | null;
  /** Foto por id do item do carrinho. */
  fotos?: Record<string, string | null | undefined>;
  fotoTroca?: string | null;
  condicaoTroca?: string | null;
  /** Parcelas "a receber" como gravadas nas contas (valor e vencimento). */
  parcelasReceber?: ParcelaReciboEntrada[] | null;
  vencimentoAReceber?: string | null;
  parcelasReceberSegunda?: ParcelaReciboEntrada[] | null;
  vencimentoSegunda?: string | null;
  origemApp?: string;
}

const NOMES_FORMA_PDV: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  debito: "Cartão de Débito",
  credito: "Cartão de Crédito",
  credito_parcelado: "Crédito Parcelado",
  a_receber: "A Receber",
};

export function entradaDoPDV(dados: DadosPDVParaRecibo, extras: ExtrasPDVParaRecibo): EntradaReciboVenda {
  const nomeForma = (forma: string, nome?: string) => nome || NOMES_FORMA_PDV[forma] || forma;
  return {
    loja: extras.loja,
    cliente: dados.cliente,
    itens: dados.itens.map((i) => ({
      tipo: i.tipo,
      nome: i.nome,
      quantidade: i.quantidade,
      bruto: i.preco * i.quantidade,
      cor: i.cor,
      capacidadeGb: i.capacidade_gb,
      condicao: i.condicao,
      imei: i.imei_dispositivo || i.imei,
      imei2: i.imei2,
      numeroSerie: i.numero_serie,
      fotoUrl: extras.fotos?.[i.id] ?? null,
      tempoGarantiaMeses: i.tempo_garantia,
      modeloTermoId: i.modelo_termo_garantia_id,
    })),
    numeroVenda: dados.numeroVenda,
    data: dados.data,
    vendedorNome: extras.vendedorNome,
    descontoManual: dados.descontoManual,
    descontoCupom: dados.descontoCupom,
    cupomCodigo: dados.cupom?.codigo,
    pagamento: {
      primeira: {
        forma: dados.formaPagamento,
        nome: nomeForma(dados.formaPagamento, dados.nomeFormaPagamento),
        parcelasCartao: dados.formaPagamento === "credito_parcelado" ? dados.numeroParcelas : null,
        parcelasReceber: extras.parcelasReceber,
        vencimento: extras.vencimentoAReceber,
      },
      segunda: dados.pagamentoDuplo
        ? {
            forma: dados.pagamentoDuplo.segundaForma,
            nome: nomeForma(dados.pagamentoDuplo.segundaForma, dados.pagamentoDuplo.nomeSegundaForma),
            valor: dados.pagamentoDuplo.valorSegunda,
            parcelasReceber: extras.parcelasReceberSegunda,
            vencimento: extras.vencimentoSegunda,
          }
        : null,
    },
    troca: dados.troca ? { ...dados.troca, fotoUrl: extras.fotoTroca, condicao: extras.condicaoTroca } : null,
    cancelamento: null,
    termo: extras.termo,
    origemApp: extras.origemApp,
  };
}

// ── Adaptador das linhas de `vendas` (recibo reaberto) ──────────────────────

/** Linha de `vendas` como carregarReciboVenda lê (só os campos usados). */
export interface LinhaVendaRecibo {
  id: string;
  tipo: "produto" | "dispositivo";
  dispositivo_id?: string | null;
  produto_id?: string | null;
  peca_id?: string | null;
  quantidade: number;
  total: number;
  valor_desconto_manual?: number | null;
  valor_desconto_cupom?: number | null;
  cupom_codigo?: string | null;
  forma_pagamento: string | null;
  observacoes?: string | null;
  segunda_forma_pagamento?: string | null;
  valor_segunda_forma?: number | null;
  parcela_numero?: number | null;
  total_parcelas?: number | null;
  data: string;
  data_prevista_recebimento?: string | null;
  cancelada?: boolean | null;
  data_cancelamento?: string | null;
  motivo_cancelamento?: string | null;
  imei_dispositivo?: string | null;
  tempo_garantia?: number | null;
  numero_venda?: string | null;
  valor_troca?: number | null;
  funcionario_id?: string | null;
  /** Valor da conta a receber ligada à linha (contas.descricao = "venda_id:<id>"), quando lida. */
  valor_conta_receber?: number | null;
}

/** Dados do produto/peça/aparelho de cada item, lidos à parte. */
export interface ProdutoRecibo {
  nome?: string | null;
  sku?: string | null;
  marca?: string | null;
  modelo?: string | null;
  cor?: string | null;
  capacidade_gb?: number | null;
  condicao?: string | null;
  imei?: string | null;
  numero_serie?: string | null;
  fotoUrl?: string | null;
}

export interface ItemAgrupado {
  /** Linhas do item (1, ou N quando parcelado), em ordem de parcela. */
  linhas: LinhaVendaRecibo[];
}

export interface LinhasAgrupadas {
  itens: ItemAgrupado[];
  /** Linhas pagamento_duplo_secundario (só para a 2ª forma). */
  secundarias: LinhaVendaRecibo[];
}

const chaveItem = (l: Pick<LinhaVendaRecibo, "dispositivo_id" | "produto_id" | "peca_id" | "imei_dispositivo">) =>
  [l.dispositivo_id ?? "", l.produto_id ?? "", l.peca_id ?? "", l.imei_dispositivo ?? ""].join("|");

const ehParcela = (l: LinhaVendaRecibo) => !!l.parcela_numero && !!l.total_parcelas && l.total_parcelas > 1;

/**
 * Junta as linhas de parcela do mesmo item (mesmo aparelho/produto/peça/IMEI,
 * parcela 1..N) num item só e separa as linhas da 2ª forma. Linhas sem
 * parcela continuam uma por item, na ordem em que vieram.
 */
export function agruparLinhasVenda(linhas: LinhaVendaRecibo[]): LinhasAgrupadas {
  const secundarias = linhas.filter((l) => l.observacoes === MARCADOR_PAGAMENTO_DUPLO_SECUNDARIO);
  const principais = linhas.filter((l) => l.observacoes !== MARCADOR_PAGAMENTO_DUPLO_SECUNDARIO);
  const itens: ItemAgrupado[] = [];
  const abertos = new Map<string, ItemAgrupado>();
  const ordenadas = [...principais].sort((a, b) => (a.parcela_numero ?? 0) - (b.parcela_numero ?? 0));
  // Mantém a ordem original dos itens: posição da primeira linha de cada um.
  const posicao = new Map(principais.map((l, i) => [l.id, i]));
  for (const l of ordenadas) {
    if (!ehParcela(l)) {
      itens.push({ linhas: [l] });
      continue;
    }
    const chave = `${chaveItem(l)}#${l.total_parcelas}`;
    const aberto = abertos.get(chave);
    const jaTemEssaParcela = aberto?.linhas.some((x) => x.parcela_numero === l.parcela_numero);
    if (aberto && !jaTemEssaParcela) {
      aberto.linhas.push(l);
    } else {
      const novo = { linhas: [l] };
      abertos.set(chave, novo);
      itens.push(novo);
    }
  }
  const primeiraPos = (g: ItemAgrupado) => Math.min(...g.linhas.map((l) => posicao.get(l.id) ?? 0));
  itens.sort((a, b) => primeiraPos(a) - primeiraPos(b));
  return { itens, secundarias };
}

const descontoLinhaC = (l: LinhaVendaRecibo) => centavos(l.valor_desconto_manual) + centavos(l.valor_desconto_cupom);

/** Bruto do item: no pagamento duplo cada linha já traz o bruto inteiro; senão soma as parcelas. */
function brutoItemC(g: ItemAgrupado): number {
  const duplo = g.linhas.some((l) => !!l.segunda_forma_pagamento);
  return duplo ? centavos(g.linhas[0].total) : g.linhas.reduce((acc, l) => acc + centavos(l.total), 0);
}

/** Soma por número de parcela (1..N) dos valores de cada item; vencimento da primeira linha que tiver. */
function somarParcelas(porItem: { valoresC: number[]; vencimentos: (string | null)[] }[]): ParcelaReciboEntrada[] {
  const n = Math.max(0, ...porItem.map((p) => p.valoresC.length));
  return Array.from({ length: n }, (_, k) => ({
    valor: porItem.reduce((acc, p) => acc + (p.valoresC[k] ?? 0), 0) / 100,
    vencimento: porItem.map((p) => p.vencimentos[k]).find((v) => !!v) ?? null,
  }));
}

/**
 * Parcelas "a receber" da 1ª forma: o que o cliente paga em cada parcela.
 * Com troca (sem duplo): a conta a receber da linha, se lida; senão
 * valoresContaReceberComTroca. Sem troca: total − descontos da linha
 * (valorAReceberSemConta). Duplo: o que sobra da 2ª forma, rateado.
 */
function parcelasPrimeiraForma(grupos: ItemAgrupado[], aPagarPrimeiraC: number, duplo: boolean): ParcelaReciboEntrada[] {
  if (duplo) {
    const n = Math.max(...grupos.map((g) => g.linhas.length));
    const vencimentos = grupos[0]?.linhas.map((l) => l.data_prevista_recebimento ?? null) ?? [];
    return ratearPorPeso(aPagarPrimeiraC / 100, Array.from({ length: n }, () => 1)).map((v, k) => ({
      valor: v,
      vencimento: vencimentos[k] ?? null,
    }));
  }
  return somarParcelas(grupos.map((g) => {
    const comTroca = g.linhas.some((l) => l.valor_troca != null);
    const calculados = comTroca
      ? valoresContaReceberComTroca({
          bruto: brutoItemC(g) / 100,
          desconto: g.linhas.reduce((acc, l) => acc + descontoLinhaC(l), 0) / 100,
          trocaPorParcela: g.linhas.map((l) => Number(l.valor_troca) || 0),
          duplo: false,
        })
      : null;
    return {
      valoresC: g.linhas.map((l, k) =>
        comTroca && l.valor_conta_receber != null
          ? centavos(l.valor_conta_receber)
          : calculados
            ? centavos(calculados[k])
            : centavos(valorAReceberSemConta({ ...l, valor_troca: null }))),
      vencimentos: g.linhas.map((l) => l.data_prevista_recebimento ?? null),
    };
  }));
}

/** Parcelas da 2ª forma "a receber": linhas pagamento_duplo_secundario, somadas por número de parcela. */
function parcelasSegundaForma(secundarias: LinhaVendaRecibo[]): ParcelaReciboEntrada[] {
  const porItem = new Map<string, LinhaVendaRecibo[]>();
  for (const l of secundarias) porItem.set(chaveItem(l), [...(porItem.get(chaveItem(l)) ?? []), l]);
  return somarParcelas([...porItem.values()].map((ls) => {
    const ordenadas = [...ls].sort((a, b) => (a.parcela_numero ?? 0) - (b.parcela_numero ?? 0));
    return { valoresC: ordenadas.map((l) => centavos(l.total)), vencimentos: ordenadas.map((l) => l.data_prevista_recebimento ?? null) };
  }));
}

export interface DadosVendaCarregados {
  linhas: LinhaVendaRecibo[];
  cliente: ClienteReciboEntrada | null;
  /** Produto/peça/aparelho por id (dispositivo_id, produto_id ou peca_id). */
  produtos: Record<string, ProdutoRecibo>;
  troca: TrocaReciboEntrada | null;
  vendedorNome: string | null;
}

/** Recibo reaberto: monta a entrada a partir das linhas de `vendas` (e do que foi lido junto). */
export function entradaDasLinhas(
  dados: DadosVendaCarregados,
  ctx: { loja: LojaReciboEntrada | null | undefined; termo?: EntradaReciboVenda["termo"]; origemApp?: string },
): EntradaReciboVenda {
  const { itens: grupos, secundarias } = agruparLinhasVenda(dados.linhas);
  const primeira = grupos[0]?.linhas[0] ?? dados.linhas[0];
  const todas = grupos.flatMap((g) => g.linhas);

  const itens: ItemReciboEntrada[] = grupos.map((g) => {
    const l = g.linhas[0];
    const id = l.dispositivo_id || l.peca_id || l.produto_id || "";
    const p = dados.produtos[id] ?? {};
    const ehDispositivo = l.tipo === "dispositivo";
    const nomeObs = limpo(l.observacoes).replace(/\s*\[forma:.+?\]\s*$/, "");
    const nome = ehDispositivo
      ? [limpo(p.marca), limpo(p.modelo)].filter(Boolean).join(" ") || limpo(p.nome) || nomeObs || "Aparelho"
      : limpo(p.nome) || nomeObs || "Produto";
    return {
      tipo: ehDispositivo ? "dispositivo" : l.peca_id ? "peca" : "produto",
      nome,
      quantidade: Number(l.quantidade) || 1,
      bruto: brutoItemC(g) / 100,
      cor: p.cor,
      capacidadeGb: p.capacidade_gb,
      condicao: p.condicao,
      imei: l.imei_dispositivo || p.imei,
      numeroSerie: p.numero_serie,
      sku: p.sku,
      fotoUrl: p.fotoUrl,
      tempoGarantiaMeses: l.tempo_garantia,
    };
  });

  const descManualC = todas.reduce((acc, l) => acc + centavos(l.valor_desconto_manual), 0);
  const descCupomC = todas.reduce((acc, l) => acc + centavos(l.valor_desconto_cupom), 0);
  const duplo = !!primeira?.segunda_forma_pagamento;
  // Fatia da 2ª forma: uma por item (repetida nas parcelas do item).
  const segundaC = duplo ? grupos.reduce((acc, g) => acc + centavos(g.linhas[0].valor_segunda_forma), 0) : 0;

  const totais = calcularTotaisComTroca({
    subtotal: itens.reduce((acc, i) => acc + centavos(i.bruto), 0) / 100,
    desconto: (descManualC + descCupomC) / 100,
    valorEntrada: dados.troca?.valorEntrada ?? 0,
  });
  const aPagarC = centavos(totais.valorEntrada > 0 ? totais.aPagar : totais.totalVenda);
  const formaPrimeira = primeira?.forma_pagamento ?? "";
  const parcelasPrimeira = ehAReceber(formaPrimeira) ? parcelasPrimeiraForma(grupos, Math.max(0, aPagarC - segundaC), duplo) : [];
  const formaSegunda = primeira?.segunda_forma_pagamento ?? "";
  const parcelasSegunda = duplo && ehAReceber(formaSegunda) ? parcelasSegundaForma(secundarias) : [];
  const cancelada = todas.length > 0 && todas.every((l) => l.cancelada);

  return {
    loja: ctx.loja,
    cliente: dados.cliente,
    itens,
    numeroVenda: todas.find((l) => limpo(l.numero_venda))?.numero_venda ?? null,
    data: primeira?.data ?? "",
    vendedorNome: dados.vendedorNome,
    descontoManual: descManualC / 100,
    descontoCupom: descCupomC / 100,
    cupomCodigo: todas.find((l) => limpo(l.cupom_codigo))?.cupom_codigo ?? null,
    pagamento: {
      primeira: {
        forma: formaPrimeira,
        nome: nomeFormaPagamento(formaPrimeira, primeira?.observacoes),
        parcelasReceber: parcelasPrimeira,
        vencimento: parcelasPrimeira[0]?.vencimento ?? null,
      },
      segunda: duplo
        ? {
            forma: formaSegunda,
            nome: nomeFormaPagamento(formaSegunda),
            valor: segundaC / 100,
            parcelasReceber: parcelasSegunda,
            vencimento: parcelasSegunda[0]?.vencimento ?? null,
          }
        : null,
    },
    troca: dados.troca ? { ...dados.troca, cancelada: dados.troca.cancelada || cancelada } : null,
    cancelamento: cancelada
      ? { data: todas.find((l) => l.data_cancelamento)?.data_cancelamento ?? null, motivo: todas.find((l) => limpo(l.motivo_cancelamento))?.motivo_cancelamento ?? null }
      : null,
    termo: ctx.termo,
    origemApp: ctx.origemApp,
  };
}
