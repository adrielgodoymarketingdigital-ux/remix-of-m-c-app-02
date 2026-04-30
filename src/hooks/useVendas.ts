import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Venda, ResumoVendas, VendasPorPeriodo, ResumoAReceber } from "@/types/venda";
import { useToast } from "@/hooks/use-toast";
import { useEventDispatcher } from "@/hooks/useEventDispatcher";
import { withRetry, shouldSuppressToast } from "@/lib/supabase-retry";

export const useVendas = () => {
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [todasVendas, setTodasVendas] = useState<Venda[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { dispatchEvent } = useEventDispatcher();

  const carregarVendas = async (dataInicio?: string, dataFim?: string) => {
    try {
      setLoading(true);


      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) { setLoading(false); return; }

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
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("data", { ascending: false });

      // Usar offset de timezone local para garantir que o filtro respeite o dia do usuário
      const tzOffset = new Date().getTimezoneOffset();
      const tzSign = tzOffset <= 0 ? "+" : "-";
      const tzHours = String(Math.floor(Math.abs(tzOffset) / 60)).padStart(2, "0");
      const tzMinutes = String(Math.abs(tzOffset) % 60).padStart(2, "0");
      const tzString = `${tzSign}${tzHours}:${tzMinutes}`;

      if (dataInicio) {
        queryVendas = queryVendas.gte("data", `${dataInicio}T00:00:00${tzString}`);
      }
      if (dataFim) {
        queryVendas = queryVendas.lte("data", `${dataFim}T23:59:59${tzString}`);
      }

      // Carregar ordens de serviço finalizadas (somente do usuário logado)
      // Usar data_saida como referência temporal, com fallback para updated_at
      let queryOrdens = supabase
        .from("ordens_servico")
        .select(`
          *,
          clientes!ordens_servico_cliente_fkey (nome, telefone),
          servicos (nome)
        `)
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .in("status", ["finalizado", "entregue"])
        .order("data_saida", { ascending: false, nullsFirst: false });

      if (dataInicio && dataFim) {
        queryOrdens = queryOrdens.or(
          `and(data_saida.not.is.null,data_saida.gte.${dataInicio}T00:00:00${tzString},data_saida.lte.${dataFim}T23:59:59${tzString}),and(data_saida.is.null,updated_at.gte.${dataInicio}T00:00:00${tzString},updated_at.lte.${dataFim}T23:59:59${tzString})`
        );
      } else if (dataInicio) {
        queryOrdens = queryOrdens.or(
          `and(data_saida.not.is.null,data_saida.gte.${dataInicio}T00:00:00${tzString}),and(data_saida.is.null,updated_at.gte.${dataInicio}T00:00:00${tzString})`
        );
      } else if (dataFim) {
        queryOrdens = queryOrdens.or(
          `and(data_saida.not.is.null,data_saida.lte.${dataFim}T23:59:59${tzString}),and(data_saida.is.null,updated_at.lte.${dataFim}T23:59:59${tzString})`
        );
      }

      // Executar ambas as queries em paralelo com retry individual
      const [vendasResult, ordensResult] = await Promise.allSettled([
        withRetry(async () => { const r = await Promise.resolve(queryVendas); if (r.error) throw r.error; return r; }, 'useVendas.queryVendas'),
        withRetry(async () => { const r = await Promise.resolve(queryOrdens); if (r.error) throw r.error; return r; }, 'useVendas.queryOrdens'),
      ]);

      let vendasData: any[] = [];
      let ordensData: any[] = [];

      if (vendasResult.status === "fulfilled") {
        const rawVendas = vendasResult.value.data || [];
        vendasData = rawVendas.map((v: any) => ({
          ...v,
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

      // Combinar vendas e ordens de serviço
      const todasAsVendas = [...vendasData, ...ordensComoVendas];
      todasAsVendas.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

      setVendas(todasAsVendas);

      // Se houve filtro de data, carregar também todas as vendas para o dashboard de recebíveis
      if (dataInicio || dataFim) {
        const { data: allVendasData } = await supabase
          .from("vendas")
          .select(`*, clientes!vendas_cliente_fkey (nome, telefone), dispositivos (tipo, marca, modelo), produtos (nome, sku), pecas (nome)`)
          .eq("user_id", user.id)
          .is("deleted_at", null)
          .order("data", { ascending: false });

        const { data: allOrdensData } = await supabase
          .from("ordens_servico")
          .select(`*, clientes!ordens_servico_cliente_fkey (nome, telefone), servicos (nome)`)
          .eq("user_id", user.id)
          .is("deleted_at", null)
          .in("status", ["finalizado", "entregue"])
          .order("updated_at", { ascending: false });

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

        const allVendasNormalizadas = (allVendasData || []).map((v: any) => ({
          ...v,
          total: Number(v.total || 0),
          quantidade: Number(v.quantidade || 1),
          custo_unitario: Number(v.custo_unitario || 0),
          valor_desconto_manual: Number(v.valor_desconto_manual || 0),
          valor_desconto_cupom: Number(v.valor_desconto_cupom || 0),
          parcela_numero: v.parcela_numero != null ? Number(v.parcela_numero) : null,
          total_parcelas: v.total_parcelas != null ? Number(v.total_parcelas) : null,
        }));
        const allCombined = [...allVendasNormalizadas, ...allOrdensComoVendas];
        allCombined.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
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
      const data = new Date(venda.data).toLocaleDateString("pt-BR");
      if (!acc[data]) {
        acc[data] = { data, total: 0, quantidade: 0 };
      }
      acc[data].total += Number(venda.total);
      acc[data].quantidade += 1;
      return acc;
    }, {} as Record<string, VendasPorPeriodo>);

    return Object.values(agrupadas).sort((a, b) => 
      new Date(a.data.split("/").reverse().join("-")).getTime() - 
      new Date(b.data.split("/").reverse().join("-")).getTime()
    );
  };

  const calcularResumoAReceber = (vendasFiltradas: Venda[]): ResumoAReceber => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const em3Dias = new Date(hoje);
    em3Dias.setDate(hoje.getDate() + 3);

    const vendasAReceber = vendasFiltradas.filter(
      (v) => v.forma_pagamento === "a_receber" && !v.recebido && !v.cancelada
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

      const updateData: any = {
        forma_pagamento: dados.forma_pagamento,
        data_prevista_recebimento: dados.data_prevista_recebimento || null,
        parcela_numero: dados.parcela_numero || null,
        total_parcelas: dados.total_parcelas || null,
      };

      // Se mudou de a_receber para outra forma, resetar recebido
      if (dados.forma_pagamento !== "a_receber") {
        updateData.recebido = false;
        updateData.data_recebimento = null;
      }

      const { error } = await supabase
        .from("vendas")
        .update(updateData)
        .eq("id", vendaId)
        .eq("user_id", vendaOriginal.user_id);

      if (error) throw error;

      // Gerenciar lançamento em Contas a Receber
      const eraAReceber = vendaOriginal.forma_pagamento === "a_receber";
      const agoraAReceber = dados.forma_pagamento === "a_receber";

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
          valor: vendaOriginal.total,
          data: dados.data_prevista_recebimento || new Date().toISOString().split('T')[0],
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
            data: dados.data_prevista_recebimento || new Date().toISOString().split('T')[0],
          })
          .eq("user_id", vendaOriginal.user_id)
          .ilike("descricao", `%venda_id:${vendaId}%`)
          .eq("status", "pendente");
      }

      toast({
        title: "Venda atualizada",
        description: "A forma de pagamento foi alterada com sucesso.",
      });

      await carregarVendas();
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
  }, []);

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
