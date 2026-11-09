/**
 * Cálculo das métricas por loja da tela Multi Empresas — PURO (sem banco).
 *
 * calcularMetricasLoja: mesmas regras do Dashboard (Dashboard.tsx → loadMetrics),
 * usando as funções de ../_shared/vendasFinanceiras.ts (cópia byte a byte de
 * src/lib/vendasFinanceiras.ts, travada por teste):
 * - venda a receber/a prazo só conta recebida, no mês do recebimento;
 * - venda cancelada ou apagada não conta;
 * - pagamento duplo: secundário só a parte a receber já recebida; a principal
 *   desconta a 2ª forma ainda a receber (getVendaReceitaLiquida);
 * - OS: status faturável, mês da entrega (data_saida; sem ela, criação), valor
 *   por getValorFaturavelOS com o status da conta a receber;
 * - serviços avulsos e vendas avulsas entram (sem loja = matriz, nunca em duas);
 * - dias de Brasília, não UTC.
 *
 * calcularMetricasLegado: a conta de ANTES (cópia fiel), devolvida à parte no
 * campo `legado` por um período, só para comparação. A tela não mostra.
 */
import {
  deveContarSecundarioNoLucro,
  diaBrasiliaDaData,
  getValorFaturavelOS,
  getVendaDataCompetencia,
  getVendaReceitaLiquida,
  isPagamentoDuploSecundario,
  shouldIncludeVendaInFinancialTotals,
  type VendaFinanceiraLike,
} from "../_shared/vendasFinanceiras.ts";
import { dataBrasiliaISO, limitesDiaBrasilia } from "../_shared/dataBrasilia.ts";
import { ehMatriz, filtrarRegistrosDaLoja, type LojaLeitura } from "./lojas.ts";

/**
 * Status de OS (e serviço avulso) que entram no faturamento — a MESMA lista do
 * Dashboard na main hoje. Quando a regra "só entregue/garantia" for publicada,
 * a troca é só esta linha.
 */
export const STATUS_OS_FATURAVEL_METRICAS: readonly string[] = ["finalizado", "entregue", "garantia"];

/** Contadores "OS finalizadas / em aberto" (não é faturamento): mesma lista de antes. */
const STATUS_OS_FINALIZADA = ["finalizado", "entregue"];

const TIPOS_LABEL: Record<string, string> = {
  produto: "Produto",
  peca: "Peça",
  servico: "Serviço",
  dispositivo: "Dispositivo",
  servico_avulso: "Serviço Avulso",
};

const FORMA_LABEL: Record<string, string> = {
  dinheiro: "Dinheiro", pix: "Pix", cartao_credito: "Crédito",
  cartao_debito: "Débito", a_receber: "A receber", a_prazo: "A prazo",
};

// ── Tipos das linhas lidas ────────────────────────────────────────────────

export interface VendaMetrica extends VendaFinanceiraLike {
  id: string;
  empresa_id: string | null;
  tipo: string;
  peca_id: string | null;
  produto_id: string | null;
  cliente_id?: string | null;
  deleted_at?: string | null;
}

export interface OSMetrica {
  id: string;
  empresa_id: string | null;
  numero_os: string | null;
  total: number | null;
  status: string | null;
  is_teste: boolean | null;
  created_at: string;
  data_saida: string | null;
  deleted_at: string | null;
  forma_pagamento?: string | null;
  avarias?: { dados_pagamento?: { entrada?: number | string | null; saldo_cancelado?: boolean; forma?: string | null } | null } | null;
}

export interface ServicoAvulsoMetrica {
  empresa_id: string | null;
  preco: number | null;
  status: string | null;
  created_at: string;
}

export interface VendaAvulsaMetrica {
  valor: number | null;
  created_at: string;
  deleted_at: string | null;
}

export interface DadosLoja {
  vendas: VendaMetrica[];
  os: OSMetrica[];
  /** Status da conta a receber por número de OS (já com o filtro de loja). */
  statusContaPorOS: Record<string, string | null>;
  servicosAvulsos: ServicoAvulsoMetrica[];
  /** Vendas avulsas não têm loja: só a matriz recebe esta lista. */
  vendasAvulsas: VendaAvulsaMetrica[];
}

// ── Período ───────────────────────────────────────────────────────────────

/** Período em dias de Brasília ("AAAA-MM-DD") e os limites UTC exatos. */
export interface JanelaBrasilia {
  inicioDia: string;
  fimDia: string;
  inicioISO: string;
  fimISO: string;
}

const DIA = /^\d{4}-\d{2}-\d{2}$/;

/** Dias de Brasília → limites UTC. Sem datas válidas: mês atual de Brasília até hoje. */
export function janelaBrasilia(dataInicio?: string | null, dataFim?: string | null, agora: Date = new Date()): JanelaBrasilia {
  let inicioDia = typeof dataInicio === "string" ? dataInicio.slice(0, 10) : "";
  let fimDia = typeof dataFim === "string" ? dataFim.slice(0, 10) : "";
  if (!DIA.test(inicioDia) || !DIA.test(fimDia)) {
    fimDia = dataBrasiliaISO(agora);
    inicioDia = `${fimDia.slice(0, 8)}01`;
  }
  return {
    inicioDia,
    fimDia,
    inicioISO: limitesDiaBrasilia(inicioDia).inicioISO,
    fimISO: limitesDiaBrasilia(fimDia).fimISO,
  };
}

/** Período da conta ANTIGA (cópia fiel: datas lidas em UTC pelo runtime). */
export interface JanelaLegado {
  inicioISO: string;
  fimISO: string;
}

export function janelaLegado(dataInicio?: string | null, dataFim?: string | null, agora: Date = new Date()): JanelaLegado {
  let ini: Date;
  let fim: Date;
  if (dataInicio && dataFim) {
    ini = new Date(dataInicio);
    fim = new Date(dataFim);
    fim.setUTCHours(23, 59, 59, 999);
  } else {
    ini = new Date(agora);
    ini.setUTCDate(1);
    ini.setUTCHours(0, 0, 0, 0);
    fim = new Date(agora);
    fim.setUTCHours(23, 59, 59, 999);
  }
  return { inicioISO: ini.toISOString(), fimISO: fim.toISOString() };
}

/**
 * Limites da LEITURA no banco: um superconjunto que atende a conta nova
 * (competência de recebimento, dias de Brasília) e a antiga (campo legado).
 * O corte exato é feito depois, nas funções puras.
 * - vendas por `data`: período novo com 1 dia de folga de cada lado (como o
 *   Dashboard) unido ao período antigo;
 * - vendas por `data_recebimento`: dias de Brasília com 1 dia de folga;
 * - OS por `created_at`: união dos dois períodos.
 */
export interface JanelaConsulta {
  dataDeISO: string;
  dataAteISO: string;
  recebimentoDe: string;
  recebimentoAte: string;
  criacaoDeISO: string;
  criacaoAteISO: string;
}

const UM_DIA_MS = 24 * 60 * 60 * 1000;
const menorISO = (a: string, b: string) => (Date.parse(a) <= Date.parse(b) ? a : b);
const maiorISO = (a: string, b: string) => (Date.parse(a) >= Date.parse(b) ? a : b);
const somarDias = (dia: string, n: number) => {
  const [y, m, d] = dia.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * UM_DIA_MS).toISOString().slice(0, 10);
};

export function janelaConsulta(nova: JanelaBrasilia, antiga: JanelaLegado): JanelaConsulta {
  const novaDe = new Date(Date.parse(nova.inicioISO) - UM_DIA_MS).toISOString();
  const novaAte = new Date(Date.parse(nova.fimISO) + UM_DIA_MS).toISOString();
  return {
    dataDeISO: menorISO(novaDe, antiga.inicioISO),
    dataAteISO: maiorISO(novaAte, antiga.fimISO),
    recebimentoDe: somarDias(nova.inicioDia, -1),
    recebimentoAte: somarDias(nova.fimDia, 1),
    criacaoDeISO: menorISO(nova.inicioISO, antiga.inicioISO),
    criacaoAteISO: maiorISO(nova.fimISO, antiga.fimISO),
  };
}

const instante = (v: string | null | undefined): number => (v ? Date.parse(v) : Number.NaN);
const dentro = (v: string | null | undefined, inicioISO: string, fimISO: string): boolean => {
  const t = instante(v);
  return !Number.isNaN(t) && t >= Date.parse(inicioISO) && t <= Date.parse(fimISO);
};
const num = (v: number | string | null | undefined): number => Number(v || 0);
const statusNorm = (s: string | null | undefined) => (s || "").toLowerCase();

// ── Regras (iguais às do Dashboard) ───────────────────────────────────────

/** Fora do faturamento: peça, item usado na OS, secundário de pagamento duplo não reconhecido (Dashboard: excluirItemOS). */
export function vendaExcluidaDoFaturamento(v: VendaMetrica): boolean {
  if (v.peca_id) return true;
  if (typeof v.observacoes === "string" && v.observacoes.includes("utilizado na OS")) return true;
  if (isPagamentoDuploSecundario(v) && !deveContarSecundarioNoLucro(v)) return true;
  return false;
}

/** A venda conta no período (dias de Brasília), pela competência (recebimento ou data da venda). */
export function vendaNoPeriodo(v: VendaMetrica, janela: JanelaBrasilia): boolean {
  if (v.deleted_at) return false;
  // Dashboard consulta com cancelada = false: null também fica de fora.
  if (v.cancelada !== false) return false;
  if (!shouldIncludeVendaInFinancialTotals(v)) return false;
  const dia = diaBrasiliaDaData(getVendaDataCompetencia(v));
  return dia !== null && dia >= janela.inicioDia && dia <= janela.fimDia;
}

/** OS faturável no período: status da lista e mês da entrega (sem data_saida, a criação). */
export function osFaturavelNoPeriodo(o: OSMetrica, janela: JanelaBrasilia): boolean {
  if (o.deleted_at) return false;
  if (!STATUS_OS_FATURAVEL_METRICAS.includes(statusNorm(o.status))) return false;
  return o.data_saida
    ? dentro(o.data_saida, janela.inicioISO, janela.fimISO)
    : dentro(o.created_at, janela.inicioISO, janela.fimISO);
}

/** OS que entra na contagem do período (criadas no período, sem teste e sem apagadas). */
export function osContadaNoPeriodo(o: OSMetrica, janela: JanelaBrasilia): boolean {
  if (o.deleted_at) return false;
  if (o.is_teste === true) return false;
  return dentro(o.created_at, janela.inicioISO, janela.fimISO);
}

// ── Resultado ─────────────────────────────────────────────────────────────

export interface ItemAgrupado { total: number; quantidade: number }

export interface MetricasCalculadas {
  faturamento_mes: number;
  faturamento_os: number;
  faturamento_vendas: number;
  faturamento_avulsos: number;
  os_mes: number;
  os_em_aberto: number;
  os_finalizadas: number;
  /** OS que entraram no faturamento de OS (base do ticket médio de OS). */
  os_faturadas: number;
  vendas_mes: number;
  vendas_por_tipo: Array<{ tipo: string; label: string } & ItemAgrupado>;
  vendas_por_forma: Array<{ forma: string; label: string } & ItemAgrupado>;
  /** Top por produto/peça (ids; os nomes são resolvidos na função). */
  top_ids: Array<{ id: string; tipo: string } & ItemAgrupado>;
}

export interface MetricasLegado {
  faturamento_mes: number;
  faturamento_os: number;
  faturamento_vendas: number;
  os_mes: number;
  os_em_aberto: number;
  os_finalizadas: number;
  vendas_mes: number;
}

export function calcularMetricasLoja(dados: DadosLoja, janela: JanelaBrasilia, loja: LojaLeitura): MetricasCalculadas {
  const vendas = filtrarRegistrosDaLoja(dados.vendas, loja)
    .filter((v) => !vendaExcluidaDoFaturamento(v))
    .filter((v) => vendaNoPeriodo(v, janela));
  const faturamentoVendas = vendas.reduce((s, v) => s + getVendaReceitaLiquida(v), 0);

  const osDaLoja = filtrarRegistrosDaLoja(dados.os, loja);
  const osFaturaveis = osDaLoja.filter((o) => osFaturavelNoPeriodo(o, janela));
  const faturamentoOS = osFaturaveis.reduce(
    (s, o) => s + getValorFaturavelOS(o, o.numero_os ? dados.statusContaPorOS[o.numero_os] : undefined),
    0,
  );
  const osContadas = osDaLoja.filter((o) => osContadaNoPeriodo(o, janela));
  const osFinalizadas = osContadas.filter((o) => STATUS_OS_FINALIZADA.includes(statusNorm(o.status))).length;

  const servicosAvulsos = filtrarRegistrosDaLoja(dados.servicosAvulsos, loja)
    .filter((a) => STATUS_OS_FATURAVEL_METRICAS.includes(statusNorm(a.status)))
    .filter((a) => dentro(a.created_at, janela.inicioISO, janela.fimISO));
  // Vendas avulsas não têm loja: contam só na matriz (sem loja = matriz).
  const vendasAvulsas = ehMatriz(loja)
    ? dados.vendasAvulsas.filter((a) => !a.deleted_at && dentro(a.created_at, janela.inicioISO, janela.fimISO))
    : [];
  const faturamentoAvulsos =
    servicosAvulsos.reduce((s, a) => s + num(a.preco), 0) + vendasAvulsas.reduce((s, a) => s + num(a.valor), 0);

  const porTipo: Record<string, { tipo: string; label: string } & ItemAgrupado> = {};
  const porForma: Record<string, { forma: string; label: string } & ItemAgrupado> = {};
  const top: Record<string, { id: string; tipo: string } & ItemAgrupado> = {};
  for (const v of vendas) {
    const valor = getVendaReceitaLiquida(v);
    const tipo = v.tipo || "outros";
    porTipo[tipo] ??= { tipo, label: TIPOS_LABEL[tipo] || tipo, total: 0, quantidade: 0 };
    porTipo[tipo].total += valor;
    porTipo[tipo].quantidade += 1;
    const forma = v.forma_pagamento || "outros";
    porForma[forma] ??= { forma, label: FORMA_LABEL[forma] || forma, total: 0, quantidade: 0 };
    porForma[forma].total += valor;
    porForma[forma].quantidade += 1;
    const chave = v.produto_id || v.peca_id;
    if (chave) {
      top[chave] ??= { id: chave, tipo: v.tipo, total: 0, quantidade: 0 };
      top[chave].total += valor;
      top[chave].quantidade += num(v.quantidade) || 1;
    }
  }

  return {
    faturamento_mes: faturamentoVendas + faturamentoOS + faturamentoAvulsos,
    faturamento_os: faturamentoOS,
    faturamento_vendas: faturamentoVendas,
    faturamento_avulsos: faturamentoAvulsos,
    os_mes: osContadas.length,
    os_em_aberto: osContadas.length - osFinalizadas,
    os_finalizadas: osFinalizadas,
    os_faturadas: osFaturaveis.length,
    vendas_mes: vendas.length,
    vendas_por_tipo: Object.values(porTipo),
    vendas_por_forma: Object.values(porForma).sort((a, b) => b.total - a.total),
    top_ids: Object.values(top).sort((a, b) => b.total - a.total).slice(0, 10),
  };
}

// ── Conta ANTIGA (cópia fiel de antes, só para o campo `legado`) ──────────

const STATUS_FINAIS_LEGADO = ["finalizado", "entregue"];

const isItemOSLegado = (v: VendaMetrica) => {
  if (v.peca_id != null) return true;
  if (v.tipo === "servico") return true;
  const obs = typeof v.observacoes === "string" ? v.observacoes : "";
  if (obs.includes("utilizado na OS")) return true;
  if (obs === "pagamento_duplo_secundario") return true;
  return false;
};

const vendaLiquidaLegado = (v: VendaMetrica) =>
  num(v.total) - num(v.valor_desconto_manual) - num(v.valor_desconto_cupom);

export function calcularMetricasLegado(dados: Pick<DadosLoja, "vendas" | "os">, janela: JanelaLegado, loja: LojaLeitura): MetricasLegado {
  // Consulta antiga: cancelada = false (null não entrava), data no período UTC, apagadas incluídas.
  const vendas = filtrarRegistrosDaLoja(dados.vendas, loja)
    .filter((v) => v.cancelada === false && dentro(v.data, janela.inicioISO, janela.fimISO))
    .filter((v) => !isItemOSLegado(v));
  const os = filtrarRegistrosDaLoja(dados.os, loja)
    .filter((o) => !o.deleted_at && dentro(o.created_at, janela.inicioISO, janela.fimISO));
  const finais = os.filter((o) => STATUS_FINAIS_LEGADO.includes(statusNorm(o.status)));
  const faturamentoVendas = vendas.reduce((s, v) => s + vendaLiquidaLegado(v), 0);
  const faturamentoOS = finais.reduce((s, o) => s + num(o.total), 0);
  return {
    faturamento_mes: faturamentoVendas + faturamentoOS,
    faturamento_os: faturamentoOS,
    faturamento_vendas: faturamentoVendas,
    os_mes: os.length,
    os_em_aberto: os.length - finais.length,
    os_finalizadas: finais.length,
    vendas_mes: vendas.length,
  };
}
