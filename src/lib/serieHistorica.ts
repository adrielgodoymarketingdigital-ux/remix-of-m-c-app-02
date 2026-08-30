import { supabase } from "@/integrations/supabase/client";
import {
  deveContarSecundarioNoLucro,
  distribuirCustoParcelasGrupo,
  getValorFaturavelOS,
  getVendaCustoTotal,
  getVendaReceitaLiquida,
  isPagamentoDuploSecundario,
  isVendaInFinancialPeriod,
} from "@/lib/vendasFinanceiras";

export interface PontoSerieDiaria {
  data: string; // yyyy-MM-dd
  faturamento: number;
  lucro: number;
  faturamentoAssistencia: number;
  lucroAssistencia: number;
  faturamentoProdutos: number;
  lucroProdutos: number;
  faturamentoDispositivos: number;
  lucroDispositivos: number;
}

const excluirItemOS = (v: any) => {
  if (v.peca_id) return true;
  if (v.observacoes && typeof v.observacoes === "string" && v.observacoes.includes("utilizado na OS")) return true;
  // Linha secundária de pagamento duplo: só entra quando é a parte "a receber"
  // já recebida (custo proporcional já gravado em custo_unitario).
  if (isPagamentoDuploSecundario(v) && !deveContarSecundarioNoLucro(v)) return true;
  return false;
};

const formatDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/**
 * Retorna a série diária dos últimos `dias` dias COMPLETOS, terminando ontem
 * (hoje fica de fora de propósito: o dia corrente está sempre parcial —
 * comparar um dia em andamento com dias inteiros distorce a tendência do
 * sparkline, fazendo-o parecer cair no fim mesmo em dias de alta). O valor de
 * "hoje" continua exibido normalmente nos cards via hojeData, calculado à parte.
 * Reaproveita as mesmas regras financeiras usadas em loadHojeData/loadMetrics
 * do Dashboard: exclui pagamento_duplo_secundario e itens de OS, considera
 * a_receber/a_prazo só quando recebido=true, distribui custo de parcelas por
 * grupo_venda.
 */
export const getSerieHistorica7Dias = (
  userId: string,
  empresaId: string | null,
  dias = 7
): Promise<PontoSerieDiaria[]> => {
  const hoje = new Date();
  const fim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 1, 23, 59, 59, 999);
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - dias, 0, 0, 0, 0);
  return getSerieHistoricaPeriodo(userId, empresaId, inicio, fim);
};

/** Soma os pontos de uma série num único total (faturamento/lucro do período). */
export const somarSeriePeriodo = (pontos: PontoSerieDiaria[]) =>
  pontos.reduce(
    (acc, p) => ({
      faturamento: acc.faturamento + p.faturamento,
      lucro: acc.lucro + p.lucro,
    }),
    { faturamento: 0, lucro: 0 }
  );

/**
 * Núcleo compartilhado: gera a série diária para um período arbitrário
 * (inicio/fim inclusive). getSerieHistorica7Dias é um wrapper fino sobre
 * esta função ancorado nos últimos N dias a partir de hoje.
 */
export const getSerieHistoricaPeriodo = async (
  userId: string,
  empresaId: string | null,
  inicio: Date,
  fim: Date
): Promise<PontoSerieDiaria[]> => {
  const dias = Math.round((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const inicioISO = inicio.toISOString();
  const fimISO = fim.toISOString();

  let qOrdens = supabase
    .from("ordens_servico")
    .select("total, avarias, numero_os, data_saida, created_at")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .in("status", ["finalizado", "entregue", "garantia"])
    .or(
      `and(data_saida.not.is.null,data_saida.gte.${inicioISO},data_saida.lte.${fimISO}),and(data_saida.is.null,created_at.gte.${inicioISO},created_at.lte.${fimISO})`
    );
  if (empresaId) qOrdens = qOrdens.or(`empresa_id.eq.${empresaId},empresa_id.is.null`);

  let qVendas = supabase
    .from("vendas")
    .select("total, custo_unitario, quantidade, valor_desconto_manual, valor_desconto_cupom, parcela_numero, total_parcelas, forma_pagamento, recebido, data, data_recebimento, observacoes, peca_id, tipo, cancelada, grupo_venda, segunda_forma_pagamento, valor_segunda_forma")
    .eq("user_id", userId)
    .eq("cancelada", false)
    .is("deleted_at", null)
    .or(`and(data.gte.${inicioISO},data.lte.${fimISO}),and(data_recebimento.not.is.null,data_recebimento.gte.${inicioISO},data_recebimento.lte.${fimISO})`);
  if (empresaId) qVendas = qVendas.or(`empresa_id.eq.${empresaId},empresa_id.is.null`);

  let qAvulsos = supabase
    .from("servicos_avulsos")
    .select("preco, custo, status, created_at")
    .eq("user_id", userId)
    .in("status", ["finalizado", "entregue", "garantia"])
    .gte("created_at", inicioISO)
    .lte("created_at", fimISO);
  if (empresaId) qAvulsos = qAvulsos.or(`empresa_id.eq.${empresaId},empresa_id.is.null`);

  const qVendasAvulsas = supabase
    .from("vendas_avulsas" as any)
    .select("valor, created_at")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .gte("created_at", inicioISO)
    .lte("created_at", fimISO);

  const [{ data: ordens }, { data: vendas }, { data: avulsos }, { data: vendasAvulsas }] = await Promise.all([
    qOrdens,
    qVendas,
    qAvulsos,
    qVendasAvulsas,
  ]);

  // status das contas a receber vinculadas às OS (mesma lógica de getValorFaturavelOS)
  const numerosOs = Array.from(new Set((ordens || []).map((o: any) => o.numero_os).filter(Boolean))) as string[];
  const statusContaPorOs = new Map<string, string>();
  if (numerosOs.length > 0) {
    let qContas = supabase
      .from("contas")
      .select("os_numero, status")
      .eq("user_id", userId)
      .eq("tipo", "receber")
      .in("os_numero", numerosOs);
    if (empresaId) qContas = qContas.or(`empresa_id.eq.${empresaId},empresa_id.is.null`);
    const { data: contas } = await qContas;
    (contas || []).forEach((c: any) => {
      if (c.os_numero) statusContaPorOs.set(c.os_numero, c.status);
    });
  }

  const vendasDistribuidas = distribuirCustoParcelasGrupo(
    (vendas || []).filter((v: any) => !excluirItemOS(v))
  );

  const pontos: PontoSerieDiaria[] = [];
  for (let i = 0; i < dias; i++) {
    const diaRef = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i);
    const diaKey = formatDateKey(diaRef);
    const diaFim = new Date(diaRef.getFullYear(), diaRef.getMonth(), diaRef.getDate(), 23, 59, 59, 999);

    const ordensDoDia = (ordens || []).filter((o: any) => {
      const dataRef = o.data_saida || o.created_at;
      return dataRef && formatDateKey(new Date(dataRef)) === diaKey;
    });
    const receitaOS = ordensDoDia.reduce(
      (acc: number, o: any) => acc + getValorFaturavelOS(o, statusContaPorOs.get(o.numero_os)),
      0
    );
    const custoOS = ordensDoDia.reduce((acc: number, o: any) => {
      const avarias = o.avarias || {};
      const servicosRealizados: any[] = avarias.servicos_realizados || [];
      return acc + servicosRealizados.reduce((s: number, sv: any) => s + Number(sv.custo || 0), 0);
    }, 0);

    const vendasDoDia = vendasDistribuidas.filter((v: any) => isVendaInFinancialPeriod(v, diaRef, diaFim));
    const vendasProdutosDoDia = vendasDoDia.filter((v: any) => v.tipo === "produto");
    const vendasDispositivosDoDia = vendasDoDia.filter((v: any) => v.tipo === "dispositivo");

    const receitaProdutos = vendasProdutosDoDia.reduce((acc: number, v: any) => acc + getVendaReceitaLiquida(v), 0);
    const custoProdutos = vendasProdutosDoDia.reduce((acc: number, v: any) => acc + getVendaCustoTotal(v), 0);
    const receitaDispositivos = vendasDispositivosDoDia.reduce((acc: number, v: any) => acc + getVendaReceitaLiquida(v), 0);
    const custoDispositivos = vendasDispositivosDoDia.reduce((acc: number, v: any) => acc + getVendaCustoTotal(v), 0);

    const avulsosDoDia = (avulsos || []).filter(
      (a: any) => a.created_at && formatDateKey(new Date(a.created_at)) === diaKey
    );
    const receitaAvulsosServicos = avulsosDoDia.reduce((acc: number, a: any) => acc + Number(a.preco || 0), 0);
    const custoAvulsos = avulsosDoDia.reduce((acc: number, a: any) => acc + Number(a.custo || 0), 0);

    const vendasAvulsasDoDia = ((vendasAvulsas ?? []) as any[]).filter(
      (a) => a.created_at && formatDateKey(new Date(a.created_at)) === diaKey
    );
    const receitaVendasAvulsas = vendasAvulsasDoDia.reduce((acc: number, a: any) => acc + Number(a.valor || 0), 0);

    const receitaAvulsos = receitaAvulsosServicos + receitaVendasAvulsas;
    const faturamentoAssistencia = receitaOS + receitaAvulsos;
    const lucroAssistencia = (receitaOS - custoOS) + (receitaAvulsos - custoAvulsos);

    pontos.push({
      data: diaKey,
      faturamento: faturamentoAssistencia + receitaProdutos + receitaDispositivos,
      lucro: lucroAssistencia + (receitaProdutos - custoProdutos) + (receitaDispositivos - custoDispositivos),
      faturamentoAssistencia,
      lucroAssistencia,
      faturamentoProdutos: receitaProdutos,
      lucroProdutos: receitaProdutos - custoProdutos,
      faturamentoDispositivos: receitaDispositivos,
      lucroDispositivos: receitaDispositivos - custoDispositivos,
    });
  }

  return pontos;
};
