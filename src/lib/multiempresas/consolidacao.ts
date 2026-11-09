/**
 * Consolidado da tela Multi Empresas: soma cada loja UMA única vez.
 *
 * A função get-filiais-metricas devolve um card por loja; o card da matriz traz
 * só a matriz (mais os registros sem loja, na leitura), nunca as filiais. Aqui
 * o total é a soma dos cards — se a mesma loja vier repetida na lista, conta
 * uma vez só.
 */

export interface MetricasLojaBase {
  faturamento_mes: number;
  faturamento_os?: number;
  faturamento_vendas?: number;
  /** Serviços avulsos + vendas avulsas (função nova). */
  faturamento_avulsos?: number;
  os_mes: number;
  os_em_aberto: number;
  os_finalizadas: number;
  vendas_mes: number;
  /** OS que entraram no faturamento de OS (função nova; ausente na versão antiga). */
  os_faturadas?: number;
}

export interface LojaComMetricas {
  id: string;
  metricas: MetricasLojaBase;
}

export interface TotaisConsolidados {
  faturamento: number;
  faturamentoOS: number;
  faturamentoVendas: number;
  faturamentoAvulsos: number;
  os: number;
  osAbertas: number;
  osFinalizadas: number;
  vendas: number;
  osFaturadas: number;
  quantidadeLojas: number;
}

const num = (v: number | undefined | null): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** Lojas sem repetição (pelo id), mantendo a ordem da primeira aparição. */
export function lojasUnicas<T extends { id: string }>(lojas: T[]): T[] {
  const vistos = new Set<string>();
  const resultado: T[] = [];
  for (const loja of lojas) {
    if (vistos.has(loja.id)) continue;
    vistos.add(loja.id);
    resultado.push(loja);
  }
  return resultado;
}

export function consolidarLojas(lojas: LojaComMetricas[]): TotaisConsolidados {
  const totais: TotaisConsolidados = {
    faturamento: 0,
    faturamentoOS: 0,
    faturamentoVendas: 0,
    faturamentoAvulsos: 0,
    os: 0,
    osAbertas: 0,
    osFinalizadas: 0,
    vendas: 0,
    osFaturadas: 0,
    quantidadeLojas: 0,
  };
  for (const { metricas: m } of lojasUnicas(lojas)) {
    totais.faturamento += num(m.faturamento_mes);
    totais.faturamentoOS += num(m.faturamento_os);
    totais.faturamentoVendas += num(m.faturamento_vendas);
    totais.faturamentoAvulsos += num(m.faturamento_avulsos);
    totais.os += num(m.os_mes);
    totais.osAbertas += num(m.os_em_aberto);
    totais.osFinalizadas += num(m.os_finalizadas);
    totais.vendas += num(m.vendas_mes);
    totais.osFaturadas += num(m.os_faturadas);
    totais.quantidadeLojas += 1;
  }
  return totais;
}

/** "Part. %": fatia da loja no faturamento consolidado (0–100). */
export function participacaoNoTotal(faturamentoLoja: number, faturamentoTotal: number): number {
  if (!(faturamentoTotal > 0)) return 0;
  const pct = (num(faturamentoLoja) / faturamentoTotal) * 100;
  return Math.max(0, Math.min(100, pct));
}

// ── Ticket médio de OS e meta de OS ───────────────────────────────────────

/** A resposta já veio da função nova (tem os_faturadas)? */
const temOSFaturadas = (m: MetricasLojaBase): m is MetricasLojaBase & { os_faturadas: number } =>
  typeof m.os_faturadas === "number" && Number.isFinite(m.os_faturadas);

/**
 * Ticket médio de OS da loja: faturamento de OS ÷ OS faturadas (status
 * faturável, mês da entrega). Enquanto a função publicada for a antiga (sem
 * os_faturadas), mantém a conta de antes para a tela não zerar.
 */
export function ticketMedioOS(m: MetricasLojaBase): number {
  if (temOSFaturadas(m)) return m.os_faturadas > 0 ? num(m.faturamento_os) / m.os_faturadas : 0;
  return m.os_mes > 0 ? num(m.faturamento_mes) / m.os_mes : 0;
}

/** Ticket médio de OS de todas as lojas (cada loja uma vez). */
export function ticketMedioOSConsolidado(lojas: LojaComMetricas[]): number {
  const unicas = lojasUnicas(lojas);
  const t = consolidarLojas(unicas);
  if (unicas.length > 0 && unicas.every((l) => temOSFaturadas(l.metricas))) {
    return t.osFaturadas > 0 ? t.faturamentoOS / t.osFaturadas : 0;
  }
  return t.os > 0 ? t.faturamento / t.os : 0;
}

/** Número comparado com a meta de OS: OS faturadas (versão antiga: OS do período). */
export function osParaMeta(m: MetricasLojaBase): number {
  return temOSFaturadas(m) ? m.os_faturadas : num(m.os_mes);
}
