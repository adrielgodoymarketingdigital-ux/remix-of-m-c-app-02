import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIdentidadeLeitura } from "@/hooks/useResolvedUserId";

const STATUS_FECHADOS = ["entregue", "finalizado", "garantia", "cancelada"];

export interface DashboardResumo {
  osAbertas: number;
  totalClientes: number;
  totalProdutos: number;
  pagamentosPendentes: number;
  alertasUrgentes: number;
  carregando: boolean;
}

const excluirItemOS = (v: any) => {
  if (v.peca_id) return true;
  if (v.observacoes && typeof v.observacoes === "string" && v.observacoes.includes("utilizado na OS")) return true;
  if (v.observacoes === "pagamento_duplo_secundario") return true;
  return false;
};

/**
 * Resumo de contadores do Dashboard: OS abertas, total de clientes, total de
 * produtos, pagamentos pendentes do mês selecionado e alertas urgentes
 * (OS paradas há mais de 3 dias). Nenhum desses contadores existia pronto —
 * useOrdensServico/useClientes/useProdutos só expõem listas cruas.
 */
export const useDashboardResumo = (inicioMes: Date, fimMes: Date) => {
  const { userId, empresaId, isFilial, carregando: carregandoIdentidade } = useIdentidadeLeitura();
  const [resumo, setResumo] = useState<DashboardResumo>({
    osAbertas: 0,
    totalClientes: 0,
    totalProdutos: 0,
    pagamentosPendentes: 0,
    alertasUrgentes: 0,
    carregando: true,
  });

  useEffect(() => {
    if (carregandoIdentidade || !userId) return;

    let cancelado = false;

    const carregar = async () => {
      const tresDiasAtras = new Date();
      tresDiasAtras.setDate(tresDiasAtras.getDate() - 3);

      const inicioMesISO = new Date(inicioMes.getFullYear(), inicioMes.getMonth(), inicioMes.getDate(), 0, 0, 0, 0).toISOString();
      const fimMesISO = new Date(fimMes.getFullYear(), fimMes.getMonth(), fimMes.getDate(), 23, 59, 59, 999).toISOString();

      // Loja (filtroLeituraLoja): filial escolhida/gerente/funcionário de filial =
      // só a loja; matriz = matriz + registros sem loja.
      let qOrdens = supabase
        .from("ordens_servico")
        .select("id, status, created_at")
        .eq("user_id", userId)
        .eq("is_teste", false)
        .is("deleted_at", null);
      if (empresaId) qOrdens = isFilial ? qOrdens.eq("empresa_id", empresaId) : qOrdens.or(`empresa_id.eq.${empresaId},empresa_id.is.null`);

      let qClientes = supabase
        .from("clientes")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("deleted_at", null);
      if (empresaId) qClientes = isFilial ? qClientes.eq("empresa_id", empresaId) : qClientes.or(`empresa_id.eq.${empresaId},empresa_id.is.null`);

      let qProdutos = supabase
        .from("produtos")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("deleted_at", null);
      if (empresaId) qProdutos = isFilial ? qProdutos.eq("empresa_id", empresaId) : qProdutos.or(`empresa_id.eq.${empresaId},empresa_id.is.null`);

      let qVendasPendentes = supabase
        .from("vendas")
        .select("id, forma_pagamento, recebido, observacoes, peca_id, data, data_recebimento")
        .eq("user_id", userId)
        .eq("cancelada", false)
        .is("deleted_at", null)
        .eq("recebido", false)
        .gte("data", inicioMesISO)
        .lte("data", fimMesISO);
      if (empresaId) qVendasPendentes = isFilial ? qVendasPendentes.eq("empresa_id", empresaId) : qVendasPendentes.or(`empresa_id.eq.${empresaId},empresa_id.is.null`);

      const [
        { data: ordens },
        { count: totalClientes },
        { count: totalProdutos },
        { data: vendasPendentes },
      ] = await Promise.all([qOrdens, qClientes, qProdutos, qVendasPendentes]);

      if (cancelado) return;

      const osAbertas = (ordens || []).filter((o: any) => !STATUS_FECHADOS.includes(o.status)).length;
      const alertasUrgentes = (ordens || []).filter((o: any) => {
        if (STATUS_FECHADOS.includes(o.status)) return false;
        return new Date(o.created_at) < tresDiasAtras;
      }).length;
      const pagamentosPendentes = (vendasPendentes || []).filter((v: any) => !excluirItemOS(v)).length;

      setResumo({
        osAbertas,
        totalClientes: totalClientes || 0,
        totalProdutos: totalProdutos || 0,
        pagamentosPendentes,
        alertasUrgentes,
        carregando: false,
      });
    };

    carregar();
    return () => {
      cancelado = true;
    };
  }, [userId, empresaId, isFilial, carregandoIdentidade, inicioMes.getTime(), fimMes.getTime()]);

  return resumo;
};
