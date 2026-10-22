/**
 * Painel Marketing — cálculos puros das campanhas Meta Ads (etapa 1).
 *
 * Sem rede, sem Supabase e sem imports de alias (@/) para rodar também no
 * deno test (scripts/testes-marketing-meta-ads). Cobre:
 *   - leitura de actions/action_values da API de Insights;
 *   - dinheiro em CENTAVOS INTEIROS (a Meta devolve "123.45" como texto);
 *   - custo por lead/cadastro, CTR, CPC e ROAS sem Infinity/NaN;
 *   - agrupamento por campanha e por dia, com comparação ao período
 *     anterior no mesmo formato de cadastrosPorDia.ts;
 *   - validade do cache (tabela meta_ads_sync) e limite de 90 dias;
 *   - tradução dos erros da Meta para mensagens em pt-BR.
 *
 * Datas são strings YYYY-MM-DD. O "hoje" é o de Brasília (dataBrasiliaISO);
 * o "dia" das linhas é o do fuso da conta de anúncios, como a Meta devolve.
 */

import { formatDistanceStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import { dataBrasiliaISO } from "../dataBrasilia.ts";
import {
  calcularVariacao,
  diasNoIntervalo,
  somarDias,
  type IntervaloDatas,
  type Variacao,
} from "./cadastrosPorDia.ts";

// ---------------------------------------------------------------------------
// Dinheiro e números vindos como texto
// ---------------------------------------------------------------------------

const RE_DECIMAL = /^(\d+)(?:\.(\d+))?$/;

function numeroParaTexto(valor: number): string | null {
  if (!Number.isFinite(valor) || valor < 0) return null;
  // toFixed(6) recupera o decimal "pretendido" de um float vindo do JSON
  // (ex.: 1.005 -> "1.005000") sem notação exponencial.
  return valor.toFixed(6);
}

/**
 * "123.45" -> 12345 centavos. Da 3ª casa em diante arredonda meio para cima,
 * como o numeric(14,2) do Postgres. Negativo, vazio ou inválido -> null.
 */
export function decimalParaCentavos(valor: string | number | null | undefined): number | null {
  if (valor === null || valor === undefined) return null;
  const texto = typeof valor === "number" ? numeroParaTexto(valor) : valor.trim();
  if (texto === null) return null;
  const m = RE_DECIMAL.exec(texto);
  if (!m) return null;
  const casas = (m[2] ?? "").padEnd(3, "0");
  let centavos = BigInt(m[1]) * 100n + BigInt(casas.slice(0, 2));
  if (Number(casas[2]) >= 5) centavos += 1n;
  if (centavos > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(centavos);
}

/** 12345 -> "123.45", pronto para gravar em numeric(14,2). */
export function centavosParaDecimal(centavos: number): string {
  const inteiro = Math.trunc(centavos / 100);
  return `${inteiro}.${String(centavos % 100).padStart(2, "0")}`;
}

/** Contagem que a Meta devolve como texto ("42"). Inválido -> null. */
export function textoParaInteiro(valor: string | number | null | undefined): number | null {
  const centavos = decimalParaCentavos(valor);
  return centavos === null ? null : Math.round(centavos / 100);
}

// ---------------------------------------------------------------------------
// actions / action_values
// ---------------------------------------------------------------------------

export interface AcaoMeta {
  action_type: string;
  value: string | number;
}

// Em cada lista, o primeiro tipo é o agregado da Meta, que já inclui o
// evento do pixel: usa-se o primeiro presente, nunca a soma dos dois.
export const TIPOS_LEAD = ["lead", "offsite_conversion.fb_pixel_lead"];
export const TIPOS_CADASTRO = ["complete_registration", "offsite_conversion.fb_pixel_complete_registration"];
export const TIPOS_COMPRA = ["purchase", "offsite_conversion.fb_pixel_purchase"];

function ehAcao(item: unknown): item is AcaoMeta {
  if (typeof item !== "object" || item === null) return false;
  const { action_type, value } = item as Record<string, unknown>;
  return typeof action_type === "string" && (typeof value === "string" || typeof value === "number");
}

/** Normaliza o campo actions/action_values (pode faltar ou vir malformado). */
export function lerAcoes(bruto: unknown): AcaoMeta[] {
  return Array.isArray(bruto) ? bruto.filter(ehAcao) : [];
}

function acaoPorPrioridade(acoes: AcaoMeta[], tipos: string[]): AcaoMeta | undefined {
  for (const tipo of tipos) {
    const acao = acoes.find((a) => a.action_type === tipo);
    if (acao) return acao;
  }
  return undefined;
}

export interface ConversoesMeta {
  leads: number;
  cadastros: number;
  compras: number;
  valorComprasCentavos: number;
}

/** Leads, cadastros e compras (com valor) de uma linha de insights. Ausente = 0. */
export function extrairConversoes(actions: unknown, actionValues: unknown): ConversoesMeta {
  const acoes = lerAcoes(actions);
  const valores = lerAcoes(actionValues);
  const contar = (tipos: string[]) => textoParaInteiro(acaoPorPrioridade(acoes, tipos)?.value) ?? 0;

  // O valor das compras vem do mesmo tipo usado na contagem, para não
  // misturar "purchase" com "fb_pixel_purchase".
  const tipoCompra = acaoPorPrioridade(acoes, TIPOS_COMPRA)?.action_type;
  const valorCompra = (tipoCompra && valores.find((v) => v.action_type === tipoCompra))
    || acaoPorPrioridade(valores, TIPOS_COMPRA);

  return {
    leads: contar(TIPOS_LEAD),
    cadastros: contar(TIPOS_CADASTRO),
    compras: contar(TIPOS_COMPRA),
    valorComprasCentavos: decimalParaCentavos(valorCompra?.value) ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Linha da API -> linha do cache
// ---------------------------------------------------------------------------

/** Uma linha de GET act_{id}/insights com level=campaign e time_increment=1. */
export interface InsightMetaBruto {
  campaign_id?: string;
  campaign_name?: string;
  objective?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  inline_link_clicks?: string;
  actions?: unknown;
  action_values?: unknown;
  account_currency?: string;
  date_start?: string;
  date_stop?: string;
}

export interface LinhaInsightDia extends ConversoesMeta {
  campaign_id: string;
  campaign_name: string | null;
  objetivo: string | null;
  dia: string;
  gastoCentavos: number;
  moeda: string | null;
  impressoes: number;
  alcance: number;
  cliques: number;
  cliquesLink: number;
  acoes: AcaoMeta[] | null;
}

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;

/** Sem campaign_id ou date_start válido -> null (linha descartada). */
export function normalizarInsightMeta(bruto: InsightMetaBruto): LinhaInsightDia | null {
  if (!bruto.campaign_id || !bruto.date_start || !RE_DATA.test(bruto.date_start)) return null;
  const acoes = lerAcoes(bruto.actions);
  return {
    campaign_id: bruto.campaign_id,
    campaign_name: bruto.campaign_name ?? null,
    objetivo: bruto.objective ?? null,
    dia: bruto.date_start,
    gastoCentavos: decimalParaCentavos(bruto.spend) ?? 0,
    moeda: bruto.account_currency ?? null,
    impressoes: textoParaInteiro(bruto.impressions) ?? 0,
    alcance: textoParaInteiro(bruto.reach) ?? 0,
    cliques: textoParaInteiro(bruto.clicks) ?? 0,
    cliquesLink: textoParaInteiro(bruto.inline_link_clicks) ?? 0,
    acoes: acoes.length ? acoes : null,
    ...extrairConversoes(bruto.actions, bruto.action_values),
  };
}

/** Linha de meta_ads_insights_dia como chega do PostgREST (numeric/bigint podem vir como string). */
export interface LinhaCacheMeta {
  campaign_id: string;
  campaign_name: string | null;
  objetivo: string | null;
  dia: string;
  gasto: number | string;
  moeda: string | null;
  impressoes: number | string | null;
  alcance: number | string | null;
  cliques: number | string | null;
  cliques_link: number | string | null;
  leads: number | string | null;
  cadastros: number | string | null;
  compras: number | string | null;
  valor_compras: number | string | null;
  acoes?: unknown;
}

export function deLinhaCache(l: LinhaCacheMeta): LinhaInsightDia {
  const acoes = lerAcoes(l.acoes);
  return {
    campaign_id: l.campaign_id,
    campaign_name: l.campaign_name,
    objetivo: l.objetivo,
    dia: l.dia.slice(0, 10),
    gastoCentavos: decimalParaCentavos(l.gasto) ?? 0,
    moeda: l.moeda,
    impressoes: textoParaInteiro(l.impressoes) ?? 0,
    alcance: textoParaInteiro(l.alcance) ?? 0,
    cliques: textoParaInteiro(l.cliques) ?? 0,
    cliquesLink: textoParaInteiro(l.cliques_link) ?? 0,
    leads: textoParaInteiro(l.leads) ?? 0,
    cadastros: textoParaInteiro(l.cadastros) ?? 0,
    compras: textoParaInteiro(l.compras) ?? 0,
    valorComprasCentavos: decimalParaCentavos(l.valor_compras) ?? 0,
    acoes: acoes.length ? acoes : null,
  };
}

/** Registro para o upsert em meta_ads_insights_dia (dinheiro como texto decimal exato). */
export function paraLinhaBanco(l: LinhaInsightDia, adAccountId: string, atualizadoEm: string) {
  return {
    ad_account_id: adAccountId,
    campaign_id: l.campaign_id,
    dia: l.dia,
    campaign_name: l.campaign_name,
    objetivo: l.objetivo,
    gasto: centavosParaDecimal(l.gastoCentavos),
    moeda: l.moeda,
    impressoes: l.impressoes,
    alcance: l.alcance,
    cliques: l.cliques,
    cliques_link: l.cliquesLink,
    leads: l.leads,
    cadastros: l.cadastros,
    compras: l.compras,
    valor_compras: centavosParaDecimal(l.valorComprasCentavos),
    acoes: l.acoes,
    atualizado_em: atualizadoEm,
  };
}

// ---------------------------------------------------------------------------
// Métricas
// ---------------------------------------------------------------------------

/** Somáveis entre dias e campanhas. Alcance fica de fora: não é somável. */
export interface TotaisMeta {
  gastoCentavos: number;
  impressoes: number;
  cliques: number;
  cliquesLink: number;
  leads: number;
  cadastros: number;
  compras: number;
  valorComprasCentavos: number;
}

export interface MetricasMeta {
  custoPorLeadCentavos: number | null;
  custoPorCadastroCentavos: number | null;
  /** Percentual: 1.5 = 1,5%. */
  ctr: number | null;
  cpcCentavos: number | null;
  /** Receita ÷ gasto: 2 = R$ 2 de compras por R$ 1 gasto. */
  roas: number | null;
}

const ZERO: TotaisMeta = {
  gastoCentavos: 0,
  impressoes: 0,
  cliques: 0,
  cliquesLink: 0,
  leads: 0,
  cadastros: 0,
  compras: 0,
  valorComprasCentavos: 0,
};

/** Divisão que devolve null em vez de Infinity/NaN. */
export function dividir(numerador: number, denominador: number): number | null {
  if (!denominador) return null;
  const r = numerador / denominador;
  return Number.isFinite(r) ? r : null;
}

function centavosPor(gastoCentavos: number, quantidade: number): number | null {
  const r = dividir(gastoCentavos, quantidade);
  return r === null ? null : Math.round(r);
}

export function calcularMetricas(t: TotaisMeta): MetricasMeta {
  const ctr = dividir(t.cliques, t.impressoes);
  return {
    custoPorLeadCentavos: centavosPor(t.gastoCentavos, t.leads),
    custoPorCadastroCentavos: centavosPor(t.gastoCentavos, t.cadastros),
    ctr: ctr === null ? null : ctr * 100,
    cpcCentavos: centavosPor(t.gastoCentavos, t.cliques),
    roas: dividir(t.valorComprasCentavos, t.gastoCentavos),
  };
}

function somar(t: TotaisMeta, l: TotaisMeta): TotaisMeta {
  return {
    gastoCentavos: t.gastoCentavos + l.gastoCentavos,
    impressoes: t.impressoes + l.impressoes,
    cliques: t.cliques + l.cliques,
    cliquesLink: t.cliquesLink + l.cliquesLink,
    leads: t.leads + l.leads,
    cadastros: t.cadastros + l.cadastros,
    compras: t.compras + l.compras,
    valorComprasCentavos: t.valorComprasCentavos + l.valorComprasCentavos,
  };
}

const noIntervalo = (dia: string, { inicio, fim }: IntervaloDatas) => dia >= inicio && dia <= fim;

export function somarTotaisMeta(linhas: TotaisMeta[]): TotaisMeta {
  return linhas.reduce(somar, { ...ZERO });
}

// ---------------------------------------------------------------------------
// Agrupamentos
// ---------------------------------------------------------------------------

export interface CampanhaMeta extends TotaisMeta {
  campaign_id: string;
  campaign_name: string | null;
  objetivo: string | null;
  metricas: MetricasMeta;
}

/** Uma linha por campanha no intervalo, maior gasto primeiro. Nome = o do dia mais recente. */
export function agruparPorCampanha(linhas: LinhaInsightDia[], intervalo: IntervaloDatas): CampanhaMeta[] {
  const grupos = new Map<string, { ultimoDia: string; nome: string | null; objetivo: string | null; totais: TotaisMeta }>();
  for (const l of linhas) {
    if (!noIntervalo(l.dia, intervalo)) continue;
    const g = grupos.get(l.campaign_id);
    if (!g) {
      grupos.set(l.campaign_id, { ultimoDia: l.dia, nome: l.campaign_name, objetivo: l.objetivo, totais: somar(ZERO, l) });
      continue;
    }
    g.totais = somar(g.totais, l);
    if (l.dia >= g.ultimoDia) {
      g.ultimoDia = l.dia;
      g.nome = l.campaign_name ?? g.nome;
      g.objetivo = l.objetivo ?? g.objetivo;
    }
  }
  return [...grupos.entries()]
    .map(([campaign_id, g]) => ({
      campaign_id,
      campaign_name: g.nome,
      objetivo: g.objetivo,
      ...g.totais,
      metricas: calcularMetricas(g.totais),
    }))
    .sort((a, b) => b.gastoCentavos - a.gastoCentavos || (a.campaign_name ?? "").localeCompare(b.campaign_name ?? ""));
}

export interface DiaMeta extends TotaisMeta {
  dia: string;
}

/** Um item por dia do intervalo (zeros nos dias sem linha), somando as campanhas. */
export function agruparPorDia(linhas: LinhaInsightDia[], intervalo: IntervaloDatas): DiaMeta[] {
  const porDia = new Map<string, TotaisMeta>();
  for (const l of linhas) {
    if (!noIntervalo(l.dia, intervalo)) continue;
    porDia.set(l.dia, somar(porDia.get(l.dia) ?? ZERO, l));
  }
  const dias: DiaMeta[] = [];
  for (let i = 0; i < diasNoIntervalo(intervalo); i++) {
    const dia = somarDias(intervalo.inicio, i);
    dias.push({ dia, ...(porDia.get(dia) ?? ZERO) });
  }
  return dias;
}

export interface ResumoPeriodoMeta {
  totais: TotaisMeta;
  metricas: MetricasMeta;
}

export interface ComparacaoMeta {
  atual: ResumoPeriodoMeta;
  anterior: ResumoPeriodoMeta;
  variacao: {
    gasto: Variacao;
    impressoes: Variacao;
    cliques: Variacao;
    leads: Variacao;
    cadastros: Variacao;
    compras: Variacao;
    valorCompras: Variacao;
    custoPorLead: Variacao;
    custoPorCadastro: Variacao;
  };
}

function resumir(linhas: LinhaInsightDia[], intervalo: IntervaloDatas): ResumoPeriodoMeta {
  const totais = somarTotaisMeta(linhas.filter((l) => noIntervalo(l.dia, intervalo)));
  return { totais, metricas: calcularMetricas(totais) };
}

/** Variação de métrica que pode não existir (ex.: custo por lead sem leads). */
export function variacaoOpcional(atual: number | null, anterior: number | null): Variacao {
  if (atual === null) return { tipo: "sem_dados" };
  if (anterior === null) return { tipo: "novo" };
  return calcularVariacao(atual, anterior);
}

/** Totais do período e do anterior (calcularPeriodos em cadastrosPorDia.ts) com a variação de cada um. */
export function compararPeriodos(
  linhas: LinhaInsightDia[],
  periodos: { atual: IntervaloDatas; anterior: IntervaloDatas },
): ComparacaoMeta {
  const atual = resumir(linhas, periodos.atual);
  const anterior = resumir(linhas, periodos.anterior);
  const a = atual.totais;
  const b = anterior.totais;
  return {
    atual,
    anterior,
    variacao: {
      gasto: calcularVariacao(a.gastoCentavos, b.gastoCentavos),
      impressoes: calcularVariacao(a.impressoes, b.impressoes),
      cliques: calcularVariacao(a.cliques, b.cliques),
      leads: calcularVariacao(a.leads, b.leads),
      cadastros: calcularVariacao(a.cadastros, b.cadastros),
      compras: calcularVariacao(a.compras, b.compras),
      valorCompras: calcularVariacao(a.valorComprasCentavos, b.valorComprasCentavos),
      custoPorLead: variacaoOpcional(atual.metricas.custoPorLeadCentavos, anterior.metricas.custoPorLeadCentavos),
      custoPorCadastro: variacaoOpcional(
        atual.metricas.custoPorCadastroCentavos,
        anterior.metricas.custoPorCadastroCentavos,
      ),
    },
  };
}

// ---------------------------------------------------------------------------
// Período pedido
// ---------------------------------------------------------------------------

export const LIMITE_DIAS_PERIODO = 90;

export type ValidacaoPeriodo =
  | { ok: true }
  | { ok: false; codigo: "data_invalida" | "periodo_invertido" | "periodo_futuro" | "periodo_longo"; mensagem: string };

const dataValida = (d: string) => RE_DATA.test(d) && somarDias(d, 0) === d;

export function validarPeriodo({ inicio, fim }: IntervaloDatas, hojeISO: string): ValidacaoPeriodo {
  if (!dataValida(inicio) || !dataValida(fim)) {
    return { ok: false, codigo: "data_invalida", mensagem: "Data inválida." };
  }
  if (inicio > fim) {
    return { ok: false, codigo: "periodo_invertido", mensagem: "A data inicial é depois da final." };
  }
  if (fim > hojeISO) {
    return { ok: false, codigo: "periodo_futuro", mensagem: "O período não pode terminar depois de hoje." };
  }
  if (diasNoIntervalo({ inicio, fim }) > LIMITE_DIAS_PERIODO) {
    return { ok: false, codigo: "periodo_longo", mensagem: `O período máximo é de ${LIMITE_DIAS_PERIODO} dias.` };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Validade do cache (meta_ads_sync)
// ---------------------------------------------------------------------------

const MIN_MS = 60 * 1000;
export const TRAVA_EM_ANDAMENTO_MIN = 2;
export const INTERVALO_MINIMO_MIN = 5;

/**
 * Validade de um dia conforme a idade (hoje = 0). Dias recentes ainda
 * recebem conversões atribuídas; depois de 28 dias o número não muda mais.
 * 8 a 28 dias: 24 h (a janela de atribuição de 28 dias ainda pode mexer).
 */
export function validadeDoDiaMin(dia: string, hojeISO: string): number {
  const idade = diasNoIntervalo({ inicio: dia, fim: hojeISO }) - 1;
  if (idade <= 1) return 60;
  if (idade <= 6) return 6 * 60;
  if (idade <= 28) return 24 * 60;
  return Infinity;
}

/** Linha de meta_ads_sync como chega do banco. */
export interface EstadoSyncMeta {
  status: "ok" | "erro" | "em_andamento";
  ultima_atualizacao: string | null;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  em_andamento_desde: string | null;
  pausado_ate: string | null;
}

/** Menor atualizado_em de cada dia que tem linha em meta_ads_insights_dia. */
export interface DiaEmCache {
  dia: string;
  atualizado_em: string;
}

export interface PedidoCache {
  sync: EstadoSyncMeta | null;
  diasEmCache: DiaEmCache[];
  intervalo: IntervaloDatas;
  agora: Date;
  forcar?: boolean;
}

export type DecisaoCache =
  | {
      acao: "usar_cache";
      motivo: "valido" | "em_andamento" | "pausado" | "intervalo_minimo" | "erro_recente";
      /** Quando vale a pena tentar de novo (null = o cache não vence). */
      proximaTentativaEm: Date | null;
    }
  | { acao: "atualizar"; motivo: "sem_historico" | "faltam_dias" | "expirado" | "forcado"; intervalo: IntervaloDatas }
  | { acao: "periodo_invalido"; codigo: string; mensagem: string };

const instante = (iso: string | null) => (iso ? new Date(iso).getTime() : null);

/**
 * "usar_cache" ou "atualizar" (com o menor trecho de dias a buscar) para o
 * período pedido. Ordem: período válido -> trava em_andamento (2 min) ->
 * pausa por limite da Meta -> forçado (mínimo 5 min desde a última
 * tentativa) -> erro há menos de 5 min -> validade de cada dia.
 */
export function decidirAtualizacao({ sync, diasEmCache, intervalo, agora, forcar = false }: PedidoCache): DecisaoCache {
  const hoje = dataBrasiliaISO(agora);
  const validacao = validarPeriodo(intervalo, hoje);
  if (validacao.ok === false) return { acao: "periodo_invalido", codigo: validacao.codigo, mensagem: validacao.mensagem };

  const t = agora.getTime();
  const desde = instante(sync?.em_andamento_desde ?? null);
  if (sync?.status === "em_andamento" && desde !== null && t - desde < TRAVA_EM_ANDAMENTO_MIN * MIN_MS) {
    return { acao: "usar_cache", motivo: "em_andamento", proximaTentativaEm: new Date(desde + TRAVA_EM_ANDAMENTO_MIN * MIN_MS) };
  }

  const pausa = instante(sync?.pausado_ate ?? null);
  if (pausa !== null && pausa > t) {
    return { acao: "usar_cache", motivo: "pausado", proximaTentativaEm: new Date(pausa) };
  }

  const ultimaOk = instante(sync?.ultima_atualizacao ?? null);
  const ultimaTentativa = Math.max(ultimaOk ?? -Infinity, desde ?? -Infinity);
  const liberaEm = ultimaTentativa + INTERVALO_MINIMO_MIN * MIN_MS;
  const recente = t < liberaEm;

  if (forcar && !recente) return { acao: "atualizar", motivo: "forcado", intervalo };
  if (sync?.status === "erro" && recente) {
    return { acao: "usar_cache", motivo: "erro_recente", proximaTentativaEm: new Date(liberaEm) };
  }

  // Quando cada dia foi buscado: pela linha gravada ou, se o dia não tem
  // linha (nenhuma campanha veiculou), pela última atualização que o cobriu.
  const buscadoEm = new Map(diasEmCache.map((d) => [d.dia.slice(0, 10), new Date(d.atualizado_em).getTime()]));
  const cobertoPeloSync = (dia: string) =>
    ultimaOk !== null && !!sync?.periodo_inicio && !!sync?.periodo_fim &&
    dia >= sync.periodo_inicio && dia <= sync.periodo_fim;

  const vencidos: string[] = [];
  let faltaDia = false;
  let proximoVencimento = Infinity;
  for (let i = 0; i < diasNoIntervalo(intervalo); i++) {
    const dia = somarDias(intervalo.inicio, i);
    const quando = buscadoEm.get(dia) ?? (cobertoPeloSync(dia) ? ultimaOk : null);
    if (quando === null) {
      faltaDia = true;
      vencidos.push(dia);
      continue;
    }
    const vence = quando + validadeDoDiaMin(dia, hoje) * MIN_MS;
    if (vence <= t) vencidos.push(dia);
    else proximoVencimento = Math.min(proximoVencimento, vence);
  }

  if (vencidos.length === 0) {
    // Forçado dentro dos 5 min e nada vencido: segura a chamada.
    return {
      acao: "usar_cache",
      motivo: forcar ? "intervalo_minimo" : "valido",
      proximaTentativaEm: forcar ? new Date(liberaEm) : Number.isFinite(proximoVencimento) ? new Date(proximoVencimento) : null,
    };
  }
  const semHistorico = ultimaOk === null && diasEmCache.length === 0;
  return {
    acao: "atualizar",
    motivo: semHistorico ? "sem_historico" : faltaDia ? "faltam_dias" : "expirado",
    intervalo: { inicio: vencidos[0], fim: vencidos[vencidos.length - 1] },
  };
}

/** "12 minutos", "1 hora"; "" se faz menos de 1 min; null sem data válida. */
function tempoDesde(ultima: string | Date | null | undefined, agora: Date): string | null {
  if (!ultima) return null;
  const quando = new Date(ultima);
  if (Number.isNaN(quando.getTime())) return null;
  if (agora.getTime() - quando.getTime() < MIN_MS) return "";
  return formatDistanceStrict(quando, agora, { locale: ptBR, roundingMethod: "floor" });
}

/** "Atualizado há 12 minutos" (pt-BR). */
export function formatarAtualizadoHa(ultima: string | Date | null, agora: Date): string {
  const tempo = tempoDesde(ultima, agora);
  if (tempo === null) return "Ainda não atualizado";
  return tempo ? `Atualizado há ${tempo}` : "Atualizado agora";
}

// ---------------------------------------------------------------------------
// Uso da API e erros da Meta
// ---------------------------------------------------------------------------

/**
 * Cabeçalho X-Business-Use-Case-Usage: {"<business>": [{type, call_count,
 * total_cputime, total_time, estimated_time_to_regain_access}]}.
 * Devolve o maior percentual e o maior tempo de espera (min).
 */
export function lerUsoApiMeta(cabecalho: string | null): { usoPct: number | null; minutosParaRecuperarAcesso: number | null } {
  const vazio = { usoPct: null, minutosParaRecuperarAcesso: null };
  if (!cabecalho) return vazio;
  let dados: unknown;
  try {
    dados = JSON.parse(cabecalho);
  } catch {
    return vazio;
  }
  if (typeof dados !== "object" || dados === null) return vazio;
  let uso: number | null = null;
  let espera: number | null = null;
  const maior = (a: number | null, b: unknown) => (typeof b === "number" && Number.isFinite(b) && b >= 0 ? Math.max(a ?? 0, b) : a);
  for (const lista of Object.values(dados)) {
    if (!Array.isArray(lista)) continue;
    for (const item of lista) {
      if (typeof item !== "object" || item === null) continue;
      const r = item as Record<string, unknown>;
      uso = maior(maior(maior(uso, r.call_count), r.total_cputime), r.total_time);
      espera = maior(espera, r.estimated_time_to_regain_access);
    }
  }
  return { usoPct: uso, minutosParaRecuperarAcesso: espera };
}

export type CodigoErroMeta =
  | "token_invalido"
  | "limite_atingido"
  | "sem_permissao"
  | "conta_invalida"
  | "nao_configurado"
  | "meta_indisponivel"
  | "erro_desconhecido";

export interface ErroMetaTraduzido {
  codigo: CodigoErroMeta;
  mensagemPtBr: string;
  /** A tela continua mostrando o cache antigo (com aviso). */
  mantemCache: boolean;
  /** Minutos sem chamar a Meta (vai para meta_ads_sync.pausado_ate). */
  pausaMinutos: number;
}

export type FalhaMeta =
  | { tipo: "segredo_ausente" }
  | { tipo: "rede" }
  | { tipo: "resposta"; corpo: unknown; minutosParaRecuperarAcesso?: number | null };

const CODIGOS_LIMITE = [4, 17, 613, 80000, 80004];
const CODIGOS_PERMISSAO = [10, 200, 294, 272];
const PAUSA_LIMITE_MIN = 15;
const PAUSA_MAXIMA_MIN = 24 * 60;

function lerErroDoCorpo(corpo: unknown): { code: number | null; transitorio: boolean } {
  const erro = typeof corpo === "object" && corpo !== null ? (corpo as Record<string, unknown>).error : null;
  if (typeof erro !== "object" || erro === null) return { code: null, transitorio: false };
  const r = erro as Record<string, unknown>;
  const code = typeof r.code === "number" ? r.code : typeof r.code === "string" ? Number(r.code) : NaN;
  return { code: Number.isFinite(code) ? code : null, transitorio: r.is_transient === true };
}

/**
 * Traduz a falha para a tela. Nunca devolve texto da Meta: a mensagem bruta
 * pode conter IDs internos e não serve ao usuário.
 */
export function traduzirErroMeta(
  falha: FalhaMeta,
  contexto: { ultimaAtualizacao?: string | Date | null; agora?: Date } = {},
): ErroMetaTraduzido {
  if (falha.tipo === "segredo_ausente") {
    return { codigo: "nao_configurado", mensagemPtBr: "Conta de anúncios não conectada.", mantemCache: false, pausaMinutos: 0 };
  }
  const indisponivel: ErroMetaTraduzido = {
    codigo: "meta_indisponivel",
    mensagemPtBr: "Meta indisponível, tente em instantes.",
    mantemCache: true,
    pausaMinutos: 0,
  };
  if (falha.tipo === "rede") return indisponivel;

  const { code, transitorio } = lerErroDoCorpo(falha.corpo);
  if (code === 190) {
    return { codigo: "token_invalido", mensagemPtBr: "Conexão com a Meta expirou: gere um novo token.", mantemCache: true, pausaMinutos: 0 };
  }
  if (code !== null && CODIGOS_LIMITE.includes(code)) {
    const estimado = falha.minutosParaRecuperarAcesso;
    const pausaMinutos = estimado && estimado > 0 ? Math.min(Math.ceil(estimado), PAUSA_MAXIMA_MIN) : PAUSA_LIMITE_MIN;
    const tempo = tempoDesde(contexto.ultimaAtualizacao, contexto.agora ?? new Date());
    const complemento = tempo === null
      ? `tente de novo em ${pausaMinutos} min.`
      : `dados de ${tempo || "menos de 1 minuto"} atrás.`;
    return { codigo: "limite_atingido", mensagemPtBr: `Limite da Meta atingido; ${complemento}`, mantemCache: true, pausaMinutos };
  }
  if (code !== null && CODIGOS_PERMISSAO.includes(code)) {
    return {
      codigo: "sem_permissao",
      mensagemPtBr: "O usuário do sistema não tem acesso à conta de anúncios.",
      mantemCache: true,
      pausaMinutos: 0,
    };
  }
  if (code === 100) {
    return { codigo: "conta_invalida", mensagemPtBr: "ID da conta de anúncios inválido.", mantemCache: true, pausaMinutos: 0 };
  }
  if (code === 1 || code === 2 || transitorio) return indisponivel;
  return {
    codigo: "erro_desconhecido",
    mensagemPtBr: "Não foi possível atualizar os dados da Meta.",
    mantemCache: true,
    pausaMinutos: 0,
  };
}

/** Falhas que merecem uma nova tentativa imediata antes de desistir (rede, códigos 1 e 2). */
export function erroTemporario(e: ErroMetaTraduzido): boolean {
  return e.codigo === "meta_indisponivel";
}
