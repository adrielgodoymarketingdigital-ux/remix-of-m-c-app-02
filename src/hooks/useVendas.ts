import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Venda, ResumoVendas, VendasPorPeriodo, ResumoAReceber } from "@/types/venda";
import { useToast } from "@/hooks/use-toast";
import { useEventDispatcher } from "@/hooks/useEventDispatcher";
import { withRetry, shouldSuppressToast } from "@/lib/supabase-retry";
import { dataHoje, extrairDataLocal } from "@/lib/formatters";
import { useFuncionarioPermissoes } from "./useFuncionarioPermissoes";
import { useIdentidade } from "./useResolvedUserId";

export const useVendas = () => {
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [todasVendas, setTodasVendas] = useState<Venda[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { dispatchEvent } = useEventDispatcher();
  const { lojaUserId, isFuncionario } = useFuncionarioPermissoes();
  const { userId: resolvedUserIdFromContext, empresaId: empresaFiltro, carregando: identidadeCarregando, isFilial } = useIdentidade();

  const carregarVendas = async (dataInicio?: string, dataFim?: string) => {
    if (identidadeCarregando) return;
    try {
      setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) { setLoading(false); return; }

      // Usa || em vez de ?? para que null (estado de carregamento) também acione o fallback.
      // ?? só ignora undefined; || ignora null e undefined — necessário porque selfId
      // começa como null no useIdentidade antes de resolver o auth.getUser().
      const resolvedUserId = resolvedUserIdFromContext || (isFuncionario && lojaUserId ? lojaUserId : user.id);

      // Carregar vendas normais (somente do usuário logado)
      let queryVendas = supabase
        .from("vendas")
        .select(`
          *,
          clientes!vendas_cliente_fkey (nome, telefone),
          dispositivos (tipo, marca, modelo),
          produtos (nome, sku),
          pecas (nome)
        `)
        .eq("user_id", resolvedUserId)
        .is("deleted_at", null)
        .order("data", { ascending: false });

      if (empresaFiltro) {
        queryVendas = isFilial
          ? queryVendas.eq("empresa_id", empresaFiltro)
          : queryVendas.or(`empresa_id.eq.${empresaFiltro},empresa_id.is.null`);
      } else if (!isFilial) {
        // Sem contexto de empresa: exclui registros de filiais (empresa_id preenchido)
        queryVendas = queryVendas.is("empresa_id", null);
      }

      // O campo `data` em vendas é TIMESTAMP WITH TIME ZONE — usar offset local para filtrar corretamente.
      if (dataInicio || dataFim) {
        const tzOffset = new Date().getTimezoneOffset();
        const tzSign = tzOffset <= 0 ? "+" : "-";
        const tzHh = String(Math.floor(Math.abs(tzOffset) / 60)).padStart(2, "0");
        const tzMm = String(Math.abs(tzOffset) % 60).padStart(2, "0");
        const tz = `${tzSign}${tzHh}:${tzMm}`;
        if (dataInicio) queryVendas = queryVendas.gte("data", `${dataInicio}T00:00:00${tz}`);
        if (dataFim) queryVendas = queryVendas.lte("data", `${dataFim}T23:59:59${tz}`);
      }

      // Carregar ordens de serviço finalizadas (somente do usuário logado)
      // data_saida preenchida apenas em "entregue". Fallback: created_at (nunca muda),
      // jamais updated_at (muda a cada edição e traz OS antigas para o mês errado)
      let queryOrdens = supabase
        .from("ordens_servico")
        .select(`
          *,
          clientes!ordens_servico_cliente_fkey (nome, telefone),
          servicos (nome)
        `)
        .eq("user_id", resolvedUserId)
        .is("deleted_at", null)
        .in("status", ["finalizado", "entregue"])
        .order("data_saida", { ascending: false, nullsFirst: false });

      if (empresaFiltro) {
        queryOrdens = isFilial
          ? queryOrdens.eq("empresa_id", empresaFiltro)
          : queryOrdens.or(`empresa_id.eq.${empresaFiltro},empresa_id.is.null`);
      } else if (!isFilial) {
        queryOrdens = queryOrdens.is("empresa_id", null);
      }

      // OS usam timestamps (data_saida, created_at) — manter offset local para comparação correta
      if (dataInicio || dataFim) {
        const tzOffset = new Date().getTimezoneOffset();
        const tzSign = tzOffset <= 0 ? "+" : "-";
        const tzHh = String(Math.floor(Math.abs(tzOffset) / 60)).padStart(2, "0");
        const tzMm = String(Math.abs(tzOffset) % 60).padStart(2, "0");
        const tz = `${tzSign}${tzHh}:${tzMm}`;

        if (dataInicio && dataFim) {
          queryOrdens = queryOrdens.or(
            `and(data_saida.not.is.null,data_saida.gte.${dataInicio}T00:00:00${tz},data_saida.lte.${dataFim}T23:59:59${tz}),and(data_saida.is.null,created_at.gte.${dataInicio}T00:00:00${tz},created_at.lte.${dataFim}T23:59:59${tz})`
          );
        } else if (dataInicio) {
          queryOrdens = queryOrdens.or(
            `and(data_saida.not.is.null,data_saida.gte.${dataInicio}T00:00:00${tz}),and(data_saida.is.null,created_at.gte.${dataInicio}T00:00:00${tz})`
          );
        } else if (dataFim) {
          queryOrdens = queryOrdens.or(
            `and(data_saida.not.is.null,data_saida.lte.${dataFim}T23:59:59${tz}),and(data_saida.is.null,created_at.lte.${dataFim}T23:59:59${tz})`
          );
        }
      }

      // Query vendas avulsas com o mesmo filtro de data
      let queryVendasAvulsas = supabase
        .from("vendas_avulsas" as any)
        .select("id, descricao, valor, forma_pagamento, observacao, created_at, user_id")
        .eq("user_id", resolvedUserId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (dataInicio || dataFim) {
        const tzOffset = new Date().getTimezoneOffset();
        const tzSign = tzOffset <= 0 ? "+" : "-";
        const tzHh = String(Math.floor(Math.abs(tzOffset) / 60)).padStart(2, "0");
        const tzMm = String(Math.abs(tzOffset) % 60).padStart(2, "0");
        const tz = `${tzSign}${tzHh}:${tzMm}`;
        if (dataInicio) queryVendasAvulsas = queryVendasAvulsas.gte("created_at", `${dataInicio}T00:00:00${tz}`);
        if (dataFim) queryVendasAvulsas = queryVendasAvulsas.lte("created_at", `${dataFim}T23:59:59${tz}`);
      }

      // Executar queries em paralelo com retry individual
      const [vendasResult, ordensResult, avulsasResult] = await Promise.allSettled([
        withRetry(async () => { const r = await Promise.resolve(queryVendas); if (r.error) throw r.error; return r; }, 'useVendas.queryVendas'),
        withRetry(async () => { const r = await Promise.resolve(queryOrdens); if (r.error) throw r.error; return r; }, 'useVendas.queryOrdens'),
        (async () => { const r = await queryVendasAvulsas; return r; })(),
      ]);

      let vendasData: any[] = [];
      let ordensData: any[] = [];

      if (vendasResult.status === "fulfilled") {
        const rawVendas = (vendasResult.value.data || [])
          .filter((v: any) => v.observacoes !== "pagamento_duplo_secundario");

        // Buscar dispositivos separadamente para contornar RLS no join
        const dispositivoIds = [...new Set(
          rawVendas.map((v: any) => v.dispositivo_id).filter(Boolean)
        )] as string[];

        let dispMap = new Map<string, { tipo: string; marca: string; modelo: string }>();
        if (dispositivoIds.length > 0) {
          const { data: disps } = await supabase
            .from("dispositivos")
            .select("id, tipo, marca, modelo")
            .in("id", dispositivoIds);
          if (disps) {
            disps.forEach((d: any) => dispMap.set(d.id, { tipo: d.tipo, marca: d.marca, modelo: d.modelo }));
          }
        }

        vendasData = rawVendas.map((v: any) => ({
          ...v,
          // Sobrescreve o join (que pode ter retornado null por RLS) com dados buscados separadamente
          dispositivos: dispMap.get(v.dispositivo_id) ?? v.dispositivos ?? null,
          total: Number(v.total || 0),
          quantidade: Number(v.quantidade || 1),
          custo_unitario: Number(v.custo_unitario || 0),
          valor_desconto_manual: Number(v.valor_desconto_manual || 0),
          valor_desconto_cupom: Number(v.valor_desconto_cupom || 0),
          parcela_numero: v.parcela_numero != null ? Number(v.parcela_numero) : null,
          total_parcelas: v.total_parcelas != null ? Number(v.total_parcelas) : null,
        }));
      } else {
        console.error("[useVendas] Vendas query failed after retries:", vendasResult.reason);
      }

      if (ordensResult.status === "fulfilled") {
        ordensData = ordensResult.value.data || [];
      } else {
        console.error("[useVendas] Ordens query failed after retries:", ordensResult.reason);
      }

      let avulsasData: any[] = [];
      if (avulsasResult.status === "fulfilled") {
        avulsasData = (avulsasResult.value as any).data || [];
      }

      const avulsasComoVendas: Venda[] = avulsasData.map((va: any) => ({
        id: va.id,
        data: va.created_at,
        tipo: "avulsa" as const,
        cliente_id: null,
        dispositivo_id: null,
        produto_id: null,
        peca_id: null,
        quantidade: 1,
        total: Number(va.valor || 0),
        custo_unitario: 0,
        forma_pagamento: va.forma_pagamento as Venda["forma_pagamento"],
        user_id: va.user_id,
        clientes: null,
        dispositivos: null,
        produtos: { nome: va.descricao, sku: null },
        pecas: null,
        ordens_servico: null,
        grupo_venda: null,
      }));

      // Converter ordens de serviço para o formato de vendas
      const ordensComoVendas: Venda[] = ordensData.map((ordem) => {
        // Calcular custo total a partir dos dados de avarias
        const avarias = ordem.avarias as any;
        let custoTotal = 0;
        if (avarias?.servicos_realizados) {
          custoTotal += (avarias.servicos_realizados as any[]).reduce((acc: number, s: any) => acc + (s.custo || 0), 0);
        }
        if (avarias?.produtos_utilizados) {
          custoTotal += (avarias.produtos_utilizados as any[]).reduce((acc: number, p: any) => acc + ((p.custo_unitario || 0) * (p.quantidade || 1)), 0);
        }

        return {
          id: ordem.id,
          data: ordem.updated_at || ordem.created_at,
          tipo: "servico" as const,
          cliente_id: ordem.cliente_id,
          dispositivo_id: null,
          produto_id: null,
          peca_id: null,
          quantidade: 1,
          total: Number(ordem.total || 0),
          custo_unitario: custoTotal,
          forma_pagamento: ordem.forma_pagamento || "dinheiro",
          user_id: ordem.user_id,
          clientes: ordem.clientes,
          dispositivos: null,
          produtos: null,
          pecas: null,
          ordens_servico: {
            numero_os: ordem.numero_os,
            servico_id: ordem.servico_id,
            servicos: ordem.servicos,
          },
        };
      });

      // Combinar vendas, ordens de serviço e vendas avulsas
      const todasAsVendas = [...vendasData, ...ordensComoVendas, ...avulsasComoVendas];
      todasAsVendas.sort((a, b) => extrairDataLocal(b.data).localeCompare(extrairDataLocal(a.data)));

      setVendas(todasAsVendas);

      // Se houve filtro de data, carregar também todas as vendas para o dashboard de recebíveis
      if (dataInicio || dataFim) {
        let allVendasQuery = supabase
          .from("vendas")
          .select(`*, clientes!vendas_cliente_fkey (nome, telefone), dispositivos (tipo, marca, modelo), produtos (nome, sku), pecas (nome)`)
          .eq("user_id", resolvedUserId)
          .is("deleted_at", null)
          .order("data", { ascending: false });
        if (empresaFiltro) {
          allVendasQuery = isFilial
            ? allVendasQuery.eq("empresa_id", empresaFiltro)
            : allVendasQuery.or(`empresa_id.eq.${empresaFiltro},empresa_id.is.null`);
        } else if (!isFilial) {
          allVendasQuery = allVendasQuery.is("empresa_id", null);
        }
        const { data: allVendasData } = await allVendasQuery;

        let allOrdensQuery = supabase
          .from("ordens_servico")
          .select(`*, clientes!ordens_servico_cliente_fkey (nome, telefone), servicos (nome)`)
          .eq("user_id", resolvedUserId)
          .is("deleted_at", null)
          .in("status", ["finalizado", "entregue"])
          .order("updated_at", { ascending: false });
        if (empresaFiltro) {
          allOrdensQuery = isFilial
            ? allOrdensQuery.eq("empresa_id", empresaFiltro)
            : allOrdensQuery.or(`empresa_id.eq.${empresaFiltro},empresa_id.is.null`);
        } else if (!isFilial) {
          allOrdensQuery = allOrdensQuery.is("empresa_id", null);
        }
        const { data: allOrdensData } = await allOrdensQuery;

        const allOrdensComoVendas: Venda[] = (allOrdensData || []).map((ordem) => {
          const avarias = ordem.avarias as any;
          let custoTotal = 0;
          if (avarias?.servicos_realizados) {
            custoTotal += (avarias.servicos_realizados as any[]).reduce((acc: number, s: any) => acc + (s.custo || 0), 0);
          }
          if (avarias?.produtos_utilizados) {
            custoTotal += (avarias.produtos_utilizados as any[]).reduce((acc: number, p: any) => acc + ((p.custo_unitario || 0) * (p.quantidade || 1)), 0);
          }

          return {
            id: ordem.id,
            data: ordem.updated_at || ordem.created_at,
            tipo: "servico" as const,
            cliente_id: ordem.cliente_id,
            dispositivo_id: null,
            produto_id: null,
            peca_id: null,
            quantidade: 1,
            total: Number(ordem.total || 0),
            custo_unitario: custoTotal,
            forma_pagamento: ordem.forma_pagamento || "dinheiro",
            user_id: ordem.user_id,
            clientes: ordem.clientes,
            dispositivos: null,
            produtos: null,
            pecas: null,
            ordens_servico: {
              numero_os: ordem.numero_os,
              servico_id: ordem.servico_id,
              servicos: ordem.servicos,
            },
          };
        });

        const allVendasNormalizadas = (allVendasData || [])
          .filter((v: any) => v.observacoes !== "pagamento_duplo_secundario")
          .map((v: any) => ({
            ...v,
            total: Number(v.total || 0),
            quantidade: Number(v.quantidade || 1),
            custo_unitario: Number(v.custo_unitario || 0),
            valor_desconto_manual: Number(v.valor_desconto_manual || 0),
            valor_desconto_cupom: Number(v.valor_desconto_cupom || 0),
            parcela_numero: v.parcela_numero != null ? Number(v.parcela_numero) : null,
            total_parcelas: v.total_parcelas != null ? Number(v.total_parcelas) : null,
          }));

        const { data: allAvulsasData } = await supabase
          .from("vendas_avulsas" as any)
          .select("id, descricao, valor, forma_pagamento, created_at, user_id")
          .eq("user_id", resolvedUserId)
          .is("deleted_at", null)
          .order("created_at", { ascending: false });

        const allAvulsasComoVendas: Venda[] = ((allAvulsasData ?? []) as any[]).map((va: any) => ({
          id: va.id,
          data: va.created_at,
          tipo: "avulsa" as const,
          cliente_id: null,
          dispositivo_id: null,
          produto_id: null,
          peca_id: null,
          quantidade: 1,
          total: Number(va.valor || 0),
          custo_unitario: 0,
          forma_pagamento: va.forma_pagamento as Venda["forma_pagamento"],
          user_id: va.user_id,
          clientes: null,
          dispositivos: null,
          produtos: { nome: va.descricao, sku: null },
          pecas: null,
          ordens_servico: null,
          grupo_venda: null,
        }));

        const allCombined = [...allVendasNormalizadas, ...allOrdensComoVendas, ...allAvulsasComoVendas];
        allCombined.sort((a, b) => extrairDataLocal(b.data).localeCompare(extrairDataLocal(a.data)));
        setTodasVendas(allCombined);
      } else {
        setTodasVendas(todasAsVendas);
      }
    } catch (error) {
      if (!shouldSuppressToast(error)) {
        console.error("[useVendas.carregarVendas]", { error, timestamp: new Date().toISOString() });
        toast({
          title: "Erro ao carregar vendas",
          description: "Não foi possível carregar as vendas. Tente novamente.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const cancelarVenda = async (
    vendaId: string,
    estornarEstoque: boolean,
    motivo?: string
  ): Promise<boolean> => {
    try {
      // Buscar dados da venda
      const vendaOriginal = vendas.find((v) => v.id === vendaId);
      if (!vendaOriginal) {
        throw new Error("Venda não encontrada");
      }

      // Serviços não podem ser cancelados por aqui (são ordens de serviço)
      if (vendaOriginal.tipo === "servico") {
        toast({
          title: "Não é possível cancelar serviços",
          description: "Serviços devem ser cancelados através das Ordens de Serviço.",
          variant: "destructive",
        });
        return false;
      }

      // Vendas avulsas usam soft delete direto na tabela vendas_avulsas
      if (vendaOriginal.tipo === "avulsa") {
        const { error } = await supabase
          .from("vendas_avulsas" as any)
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", vendaId);
        if (error) throw error;
        toast({ title: "Venda avulsa cancelada com sucesso." });
        await carregarVendas();
        return true;
      }

      // Estornar estoque se solicitado
      if (estornarEstoque) {
        if (vendaOriginal.tipo === "dispositivo" && vendaOriginal.dispositivo_id) {
          // Buscar quantidade atual do dispositivo
          const { data: dispositivo, error: fetchError } = await supabase
            .from("dispositivos")
            .select("quantidade")
            .eq("id", vendaOriginal.dispositivo_id)
            .eq("user_id", vendaOriginal.user_id)
            .single();

          if (fetchError) throw fetchError;

          const novaQuantidade = (dispositivo?.quantidade || 0) + vendaOriginal.quantidade;

          const { error: estoqueError } = await supabase
            .from("dispositivos")
            .update({
              quantidade: novaQuantidade,
              vendido: false,
            })
            .eq("id", vendaOriginal.dispositivo_id)
            .eq("user_id", vendaOriginal.user_id);

          if (estoqueError) throw estoqueError;
        } else if (vendaOriginal.tipo === "produto" && vendaOriginal.produto_id) {
          // Buscar quantidade atual do produto
          const { data: produto, error: fetchError } = await supabase
            .from("produtos")
            .select("quantidade")
            .eq("id", vendaOriginal.produto_id)
            .eq("user_id", vendaOriginal.user_id)
            .single();

          if (fetchError) throw fetchError;

          const novaQuantidade = (produto?.quantidade || 0) + vendaOriginal.quantidade;

          const { error: estoqueError } = await supabase
            .from("produtos")
            .update({
              quantidade: novaQuantidade,
            })
            .eq("id", vendaOriginal.produto_id)
            .eq("user_id", vendaOriginal.user_id);

          if (estoqueError) throw estoqueError;
        }
      }

      // Atualizar a venda como cancelada (somente do usuário dono)
      const { error: updateError } = await supabase
        .from("vendas")
        .update({
          cancelada: true,
          data_cancelamento: new Date().toISOString(),
          motivo_cancelamento: motivo || null,
          estorno_estoque: estornarEstoque,
        })
        .eq("id", vendaId)
        .eq("user_id", vendaOriginal.user_id);

      if (updateError) throw updateError;

      toast({
        title: "Venda cancelada",
        description: estornarEstoque
          ? "Venda cancelada e estoque estornado com sucesso."
          : "Venda cancelada com sucesso.",
      });

      // Recarregar vendas
      await carregarVendas();
      return true;
    } catch (error: any) {
      console.error("❌ Erro ao cancelar venda:", error);
      toast({
        title: "Erro ao cancelar venda",
        description: error.message || "Não foi possível cancelar a venda.",
        variant: "destructive",
      });
      return false;
    }
  };

  const calcularResumo = (vendasFiltradas: Venda[]): ResumoVendas => {
    // Excluir vendas canceladas dos cálculos
    const vendasAtivas = vendasFiltradas.filter((v) => !v.cancelada);
    
    const vendasDispositivos = vendasAtivas.filter((v) => v.tipo === "dispositivo").length;
    const vendasProdutos = vendasAtivas.filter((v) => v.tipo === "produto").length;
    const vendasServicos = vendasAtivas.filter((v) => v.tipo === "servico").length;
    // Calcular total faturado subtraindo descontos
    const totalFaturado = vendasAtivas.reduce((acc, v) => {
      const total = Number(v.total);
      const descontoManual = Number(v.valor_desconto_manual || 0);
      const descontoCupom = Number(v.valor_desconto_cupom || 0);
      return acc + (total - descontoManual - descontoCupom);
    }, 0);

    return {
      totalVendas: vendasAtivas.length,
      vendasDispositivos,
      vendasProdutos,
      vendasServicos,
      totalFaturado,
    };
  };

  const agruparVendasPorPeriodo = (vendasFiltradas: Venda[]): VendasPorPeriodo[] => {
    // Excluir vendas canceladas do agrupamento
    const vendasAtivas = vendasFiltradas.filter((v) => !v.cancelada);
    
    const agrupadas = vendasAtivas.reduce((acc, venda) => {
      // Normaliza para YYYY-MM-DD independente de venda.data ser DATE ou TIMESTAMP
      const iso = extrairDataLocal(venda.data);
      const [y, m, d] = iso.split("-");
      const data = `${d}/${m}/${y}`;
      if (!acc[data]) {
        acc[data] = { data, total: 0, quantidade: 0 };
      }
      acc[data].total += Number(venda.total);
      acc[data].quantidade += 1;
      return acc;
    }, {} as Record<string, VendasPorPeriodo>);

    return Object.values(agrupadas).sort((a, b) => {
      const toISO = (s: string) => s.split("/").reverse().join("-");
      return toISO(a.data).localeCompare(toISO(b.data));
    });
  };

  const calcularResumoAReceber = (vendasFiltradas: Venda[]): ResumoAReceber => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const em3Dias = new Date(hoje);
    em3Dias.setDate(hoje.getDate() + 3);

    const vendasAReceber = vendasFiltradas.filter(
      (v) => (v.forma_pagamento === "a_receber" || v.forma_pagamento === "a_prazo") && !v.recebido && !v.cancelada
    );

    const vendasVencidas = vendasAReceber.filter((v) => {
      if (!v.data_prevista_recebimento) return false;
      const dataVencimento = new Date(v.data_prevista_recebimento);
      dataVencimento.setHours(0, 0, 0, 0);
      return dataVencimento < hoje;
    });

    const vendasVencendo = vendasAReceber.filter((v) => {
      if (!v.data_prevista_recebimento) return false;
      const dataVencimento = new Date(v.data_prevista_recebimento);
      dataVencimento.setHours(0, 0, 0, 0);
      return dataVencimento >= hoje && dataVencimento <= em3Dias;
    });

    return {
      totalAReceber: vendasAReceber.reduce((acc, v) => {
        const total = Number(v.total);
        const descontoManual = Number(v.valor_desconto_manual || 0);
        const descontoCupom = Number(v.valor_desconto_cupom || 0);
        return acc + (total - descontoManual - descontoCupom);
      }, 0),
      quantidadeVendas: vendasAReceber.length,
      vendasVencidas: vendasVencidas.length,
      vendasVencendo: vendasVencendo.length,
    };
  };

  const marcarComoRecebido = async (vendaId: string): Promise<boolean> => {
    try {
      const vendaOriginal = vendas.find((v) => v.id === vendaId);
      if (!vendaOriginal) throw new Error("Venda não encontrada");

      const { error } = await supabase
        .from("vendas")
        .update({
          recebido: true,
          data_recebimento: new Date().toISOString(),
        })
        .eq("id", vendaId)
        .eq("user_id", vendaOriginal.user_id);

      if (error) throw error;

      // Marcar conta correspondente como recebida
      await supabase.from("contas")
        .update({
          status: "recebido",
          valor_pago: vendaOriginal.total,
        })
        .eq("user_id", vendaOriginal.user_id)
        .ilike("descricao", `%venda_id:${vendaId}%`)
        .eq("status", "pendente");

      toast({
        title: "Pagamento confirmado",
        description: "A venda foi marcada como recebida.",
      });

      // Disparar evento de notificação automática
      dispatchEvent("PAYMENT_CONFIRMED", {
        total: vendaOriginal.total?.toString() || "0",
      });

      await carregarVendas();
      return true;
    } catch (error: any) {
      console.error("❌ Erro ao marcar como recebido:", error);
      toast({
        title: "Erro ao confirmar recebimento",
        description: error.message || "Não foi possível confirmar o recebimento.",
        variant: "destructive",
      });
      return false;
    }
  };

  const editarVenda = async (vendaId: string, dados: {
    forma_pagamento: string;
    data_prevista_recebimento?: string | null;
    parcela_numero?: number | null;
    total_parcelas?: number | null;
    total?: number;
  }): Promise<boolean> => {
    try {
      const vendaOriginal = vendas.find((v) => v.id === vendaId);
      if (!vendaOriginal) throw new Error("Venda não encontrada");

      if (vendaOriginal.tipo === "servico") {
        toast({
          title: "Não é possível editar serviços",
          description: "Serviços devem ser editados através das Ordens de Serviço.",
          variant: "destructive",
        });
        return false;
      }

      if (vendaOriginal.cancelada) {
        toast({
          title: "Não é possível editar venda cancelada",
          description: "Vendas canceladas não podem ter seus dados alterados.",
          variant: "destructive",
        });
        return false;
      }

      if (dados.total !== undefined && (!Number.isFinite(dados.total) || dados.total <= 0)) {
        toast({
          title: "Valor inválido",
          description: "O valor da venda deve ser maior que zero.",
          variant: "destructive",
        });
        return false;
      }

      const updateData: any = {
        forma_pagamento: dados.forma_pagamento,
        data_prevista_recebimento: dados.data_prevista_recebimento || null,
        parcela_numero: dados.parcela_numero || null,
        total_parcelas: dados.total_parcelas || null,
      };

      // Se mudou de a_receber/a_prazo para outra forma, resetar recebido
      if (dados.forma_pagamento !== "a_receber" && dados.forma_pagamento !== "a_prazo") {
        updateData.recebido = false;
        updateData.data_recebimento = null;
      }

      const totalAntigo = Number(vendaOriginal.total);
      const totalMudou = dados.total !== undefined && Number(dados.total) !== totalAntigo;
      if (totalMudou) {
        updateData.total = dados.total;
      }

      const { error } = await supabase
        .from("vendas")
        .update(updateData)
        .eq("id", vendaId)
        .eq("user_id", vendaOriginal.user_id);

      if (error) throw error;

      let avisoFinanceiro = false;

      if (totalMudou) {
        const novoTotal = Number(dados.total);
        const diferenca = novoTotal - totalAntigo;

        // Conta real (financeiro) vinculada à venda — contas.valor é sempre cópia
        // direta do total da venda na criação, então sobrescrevemos com o novo valor.
        try {
          const { data: contaVinculada } = await supabase
            .from("contas")
            .select("id")
            .eq("user_id", vendaOriginal.user_id)
            .ilike("descricao", `%venda_id:${vendaId}%`)
            .maybeSingle();

          if (contaVinculada) {
            const { error: erroConta } = await supabase
              .from("contas")
              .update({ valor: novoTotal })
              .eq("id", contaVinculada.id);
            if (erroConta) throw erroConta;
          }
        } catch (erroConta) {
          console.error("❌ Erro ao sincronizar conta da venda:", erroConta);
          avisoFinanceiro = true;
        }

        // Caixa(s) já fechado(s) que englobam a data da venda — ajustar os totais
        // congelados no fechamento pela diferença de valor.
        try {
          const userIdCaixa = vendaOriginal.user_id;
          const caixasQuery = supabase
            .from("caixas")
            .select("*")
            .eq("status", "fechado")
            .or(`proprietario_id.eq.${userIdCaixa},user_id.eq.${userIdCaixa}`)
            .lte("data_abertura", vendaOriginal.data)
            .gte("data_fechamento", vendaOriginal.data);

          const { data: caixasEncontrados, error: erroBuscaCaixa } = await caixasQuery;
          if (erroBuscaCaixa) throw erroBuscaCaixa;

          // Mesmo critério condicional de empresa_id usado em fecharCaixa
          // (useCaixa.ts): só filtra quando o caixa tem empresa_id preenchido.
          const caixasAfetados = (caixasEncontrados ?? []).filter((c: any) =>
            !c.empresa_id || c.empresa_id === vendaOriginal.empresa_id
          );

          const formasCartao = ["debito", "credito", "credito_parcelado"];
          const colunaPorForma = (forma: string | null) => {
            if (forma === "dinheiro") return "total_dinheiro";
            if (forma === "pix") return "total_pix";
            if (forma && formasCartao.includes(forma)) return "total_cartao";
            if (forma === "a_receber" || forma === "a_prazo") return "total_a_receber";
            return null;
          };

          const coluna = colunaPorForma(vendaOriginal.forma_pagamento);

          if (coluna) {
            for (const caixa of caixasAfetados ?? []) {
              const atualizacao: any = {
                [coluna]: Number((caixa as any)[coluna] || 0) + diferenca,
                total_vendas: Number((caixa as any).total_vendas || 0) + diferenca,
                saldo_final: Number((caixa as any).saldo_final || 0) + diferenca,
              };
              const { error: erroCaixa } = await supabase
                .from("caixas")
                .update(atualizacao)
                .eq("id", (caixa as any).id);
              if (erroCaixa) throw erroCaixa;
            }
          }
        } catch (erroCaixa) {
          console.error("❌ Erro ao sincronizar caixa fechado:", erroCaixa);
          avisoFinanceiro = true;
        }
      }

      // Gerenciar lançamento em Contas a Receber
      const eraAReceber = vendaOriginal.forma_pagamento === "a_receber" || vendaOriginal.forma_pagamento === "a_prazo";
      const agoraAReceber = dados.forma_pagamento === "a_receber" || dados.forma_pagamento === "a_prazo";

      if (agoraAReceber && !eraAReceber) {
        // Mudou para a_receber: criar conta
        const nomeItem = vendaOriginal.tipo === "dispositivo" && vendaOriginal.dispositivos
          ? `${vendaOriginal.dispositivos.marca} ${vendaOriginal.dispositivos.modelo}`
          : vendaOriginal.produtos?.nome || vendaOriginal.pecas?.nome || "Item";
        const nomeCliente = vendaOriginal.clientes?.nome || "Cliente avulso";
        const sufixoParcela = dados.parcela_numero && dados.total_parcelas
          ? ` (${dados.parcela_numero}/${dados.total_parcelas})` : "";

        await supabase.from("contas").insert({
          nome: `Venda - ${nomeItem} - ${nomeCliente}${sufixoParcela}`,
          tipo: "receber",
          valor: totalMudou ? Number(dados.total) : vendaOriginal.total,
          data: dados.data_prevista_recebimento || dataHoje(),
          data_vencimento: dados.data_prevista_recebimento || null,
          status: "pendente",
          recorrente: false,
          categoria: "Vendas",
          descricao: `venda_id:${vendaId}`,
          user_id: vendaOriginal.user_id,
        });
      } else if (!agoraAReceber && eraAReceber) {
        // Mudou de a_receber para outra forma: remover conta pendente
        await supabase.from("contas")
          .delete()
          .eq("user_id", vendaOriginal.user_id)
          .ilike("descricao", `%venda_id:${vendaId}%`)
          .eq("status", "pendente");
      } else if (agoraAReceber && eraAReceber) {
        // Continua a_receber mas pode ter mudado data/parcelas: atualizar conta
        await supabase.from("contas")
          .update({
            data_vencimento: dados.data_prevista_recebimento || null,
            data: dados.data_prevista_recebimento || dataHoje(),
          })
          .eq("user_id", vendaOriginal.user_id)
          .ilike("descricao", `%venda_id:${vendaId}%`)
          .eq("status", "pendente");
      }

      toast({
        title: "Venda atualizada",
        description: totalMudou
          ? "O valor e a forma de pagamento foram atualizados com sucesso."
          : "A forma de pagamento foi alterada com sucesso.",
      });

      if (avisoFinanceiro) {
        toast({
          title: "Verifique o financeiro",
          description: "A venda foi atualizada, mas não foi possível sincronizar automaticamente a conta ou o caixa vinculado. Verifique manualmente.",
          variant: "destructive",
        });
      }

      // Atualiza localmente sem precisar recarregar (preserva filtro de data ativo)
      setVendas(prev => prev.map(v =>
        v.id === vendaId
          ? {
              ...v,
              forma_pagamento: dados.forma_pagamento as Venda["forma_pagamento"],
              data_prevista_recebimento: dados.data_prevista_recebimento ?? v.data_prevista_recebimento,
              parcela_numero: dados.parcela_numero ?? v.parcela_numero,
              total_parcelas: dados.total_parcelas ?? v.total_parcelas,
              recebido: dados.forma_pagamento !== "a_receber" && dados.forma_pagamento !== "a_prazo" ? false : v.recebido,
              total: totalMudou ? Number(dados.total) : v.total,
            }
          : v
      ));
      return true;
    } catch (error: any) {
      console.error("❌ Erro ao editar venda:", error);
      toast({
        title: "Erro ao editar venda",
        description: error.message || "Não foi possível editar a venda.",
        variant: "destructive",
      });
      return false;
    }
  };

  const excluirVenda = async (vendaId: string): Promise<boolean> => {
    try {
      const vendaOriginal = vendas.find((v) => v.id === vendaId);
      if (!vendaOriginal) throw new Error("Venda não encontrada");

      // Apenas vendas canceladas podem ser excluídas
      if (!vendaOriginal.cancelada) {
        toast({
          title: "Não é possível excluir",
          description: "Apenas vendas canceladas podem ser excluídas.",
          variant: "destructive",
        });
        return false;
      }

      // Serviços não podem ser excluídos por aqui
      if (vendaOriginal.tipo === "servico") {
        toast({
          title: "Não é possível excluir serviços",
          description: "Serviços devem ser gerenciados através das Ordens de Serviço.",
          variant: "destructive",
        });
        return false;
      }

      const { error } = await supabase
        .from("vendas")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", vendaId)
        .eq("user_id", vendaOriginal.user_id);

      if (error) throw error;

      toast({
        title: "Venda excluída",
        description: "A venda cancelada foi removida do sistema.",
      });

      await carregarVendas();
      return true;
    } catch (error: any) {
      console.error("❌ Erro ao excluir venda:", error);
      toast({
        title: "Erro ao excluir venda",
        description: error.message || "Não foi possível excluir a venda.",
        variant: "destructive",
      });
      return false;
    }
  };

  const marcarComoPendente = async (vendaId: string): Promise<boolean> => {
    try {
      const vendaOriginal = vendas.find((v) => v.id === vendaId);
      if (!vendaOriginal) throw new Error("Venda não encontrada");

      const { error } = await supabase
        .from("vendas")
        .update({
          recebido: false,
          data_recebimento: null,
        })
        .eq("id", vendaId)
        .eq("user_id", vendaOriginal.user_id);

      if (error) throw error;

      // Reverter conta correspondente para pendente
      await supabase.from("contas")
        .update({
          status: "pendente",
          valor_pago: 0,
        })
        .eq("user_id", vendaOriginal.user_id)
        .ilike("descricao", `%venda_id:${vendaId}%`)
        .eq("status", "recebido");

      toast({
        title: "Status alterado",
        description: "A venda voltou para pendente.",
      });

      await carregarVendas();
      return true;
    } catch (error: any) {
      console.error("❌ Erro ao marcar como pendente:", error);
      toast({
        title: "Erro ao alterar status",
        description: error.message || "Não foi possível alterar o status.",
        variant: "destructive",
      });
      return false;
    }
  };

  useEffect(() => {
    carregarVendas();
  }, [resolvedUserIdFromContext, empresaFiltro, identidadeCarregando]);

  return {
    vendas,
    todasVendas,
    loading,
    carregarVendas,
    cancelarVenda,
    editarVenda,
    calcularResumo,
    agruparVendasPorPeriodo,
    calcularResumoAReceber,
    marcarComoRecebido,
    marcarComoPendente,
    excluirVenda,
  };
};
