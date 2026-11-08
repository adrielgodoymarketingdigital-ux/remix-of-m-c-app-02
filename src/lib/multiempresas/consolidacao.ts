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
  os_mes: number;
  os_em_aberto: number;
  os_finalizadas: number;
  vendas_mes: number;
}

export interface LojaComMetricas {
  id: string;
  metricas: MetricasLojaBase;
}

export interface TotaisConsolidados {
  faturamento: number;
  faturamentoOS: number;
  faturamentoVendas: number;
  os: number;
  osAbertas: number;
  osFinalizadas: number;
  vendas: number;
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
    os: 0,
    osAbertas: 0,
    osFinalizadas: 0,
    vendas: 0,
    quantidadeLojas: 0,
  };
  for (const { metricas: m } of lojasUnicas(lojas)) {
    totais.faturamento += num(m.faturamento_mes);
    totais.faturamentoOS += num(m.faturamento_os);
    totais.faturamentoVendas += num(m.faturamento_vendas);
    totais.os += num(m.os_mes);
    totais.osAbertas += num(m.os_em_aberto);
    totais.osFinalizadas += num(m.os_finalizadas);
    totais.vendas += num(m.vendas_mes);
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
