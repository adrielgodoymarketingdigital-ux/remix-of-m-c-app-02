import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  LucroPorItem,
  CustoOperacional,
  ContaPagaDetalhe,
  TaxaCartaoDetalhe,
  EvolucaoMensal,
  ResumoFinanceiro,
  FiltrosRelatorio,
} from "@/types/relatorio";
import { useToast } from "@/hooks/use-toast";
import { distribuirCustoParcelasGrupo, getFinancialQueryDateBounds, getVendaCustoTotal, getVendaDataCompetencia, getVendaReceitaLiquida, isVendaInOptionalFinancialPeriod } from "@/lib/vendasFinanceiras";

export const useRelatorios = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const parseFiltroDate = (date: string, endOfDay = false) => {
    const [year, month, day] = date.split("-").map(Number);
    return endOfDay
      ? new Date(year, month - 1, day, 23, 59, 59, 999)
      : new Date(year, month - 1, day, 0, 0, 0, 0);
  };

  const isContaReceitaManual = (conta: { os_numero?: string | null; descricao?: string | null }) => {
    const descricao = conta.descricao ?? "";
    const ehContaDeOS = Boolean(conta.os_numero);
    const ehContaVinculadaVenda = descricao.startsWith("venda_id:");

    return !ehContaDeOS && !ehContaVinculadaVenda;
  };

  const calcularLucroPorItem = async (
    filtros: FiltrosRelatorio
  ): Promise<LucroPorItem[]> => {
    try {
      setLoading(true);
      
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return [];

      const inicioPeriodo = filtros.dataInicio ? parseFiltroDate(filtros.dataInicio) : null;
      const fimPeriodo = filtros.dataFim ? parseFiltroDate(filtros.dataFim, true) : null;
      const { queryInicio, queryFim } = getFinancialQueryDateBounds(inicioPeriodo, fimPeriodo);

      // Buscar vendas NÃO canceladas de produtos e dispositivos (somente do usuário)
      // Excluir parcelas duplicadas: considerar apenas parcela_numero = 1 ou parcela_numero IS NULL
      let queryVendas = supabase
        .from("vendas")
        .select(
          `
          *,
          dispositivos (marca, modelo, preco, custo),
          produtos (nome, preco, custo)
        `
        )
        .eq("user_id", user.id)
        .neq("cancelada", true)
        .order("data", { ascending: false });

      if (queryInicio && queryFim) {
        queryVendas = queryVendas.or(
          `and(data.gte.${queryInicio},data.lte.${queryFim}T23:59:59),and(data_recebimento.not.is.null,data_recebimento.gte.${queryInicio},data_recebimento.lte.${queryFim}T23:59:59)`
        );
      } else if (queryInicio) {
        queryVendas = queryVendas.or(
          `data.gte.${queryInicio},and(data_recebimento.not.is.null,data_recebimento.gte.${queryInicio})`
        );
      } else if (queryFim) {
        queryVendas = queryVendas.or(
          `data.lte.${queryFim}T23:59:59,and(data_recebimento.not.is.null,data_recebimento.lte.${queryFim}T23:59:59)`
        );
      }
      if (filtros.tipo && filtros.tipo !== "todos") {
        queryVendas = queryVendas.eq("tipo", filtros.tipo);
      }

      // Buscar ordens de serviço finalizadas/entregues (somente do usuário)
      // Usar data_saida como data de referência, com fallback para updated_at
      let queryOrdens = supabase
        .from("ordens_servico")
        .select(`
          *,
          servico:servicos!ordens_servico_servico_id_fkey(id, nome, preco, custo)
        `)
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .in("status", ["finalizado", "entregue"])
        .order("data_saida", { ascending: false, nullsFirst: false });

      if (filtros.dataInicio && filtros.dataFim) {
        queryOrdens = queryOrdens.or(
          `and(data_saida.not.is.null,data_saida.gte.${filtros.dataInicio},data_saida.lte.${filtros.dataFim}T23:59:59),and(data_saida.is.null,updated_at.gte.${filtros.dataInicio},updated_at.lte.${filtros.dataFim}T23:59:59)`
        );
      } else if (filtros.dataInicio) {
        queryOrdens = queryOrdens.or(
          `and(data_saida.not.is.null,data_saida.gte.${filtros.dataInicio}),and(data_saida.is.null,updated_at.gte.${filtros.dataInicio})`
        );
      } else if (filtros.dataFim) {
        queryOrdens = queryOrdens.or(
          `and(data_saida.not.is.null,data_saida.lte.${filtros.dataFim}T23:59:59),and(data_saida.is.null,updated_at.lte.${filtros.dataFim}T23:59:59)`
        );
      }

      // Buscar todos os serviços (somente do usuário)
      const queryServicos = supabase
        .from("servicos")
        .select("id, nome, preco, custo")
        .eq("user_id", user.id);

      // Buscar serviços avulsos (apenas entregues ou finalizados)
      let queryAvulsos = supabase
        .from("servicos_avulsos")
        .select("*")
        .eq("user_id", user.id)
        .in("status", ["entregue", "finalizado"])
        .order("created_at", { ascending: false });

      if (filtros.dataInicio) {
        queryAvulsos = queryAvulsos.gte("created_at", filtros.dataInicio);
      }
      if (filtros.dataFim) {
        queryAvulsos = queryAvulsos.lte("created_at", filtros.dataFim + "T23:59:59");
      }

      const [
        { data: vendas, error: vendaError }, 
        { data: ordens, error: ordemError },
        { data: todosServicos, error: servicosError },
        { data: servicosAvulsos, error: avulsosError }
      ] = await Promise.all([
        queryVendas,
        queryOrdens,
        queryServicos,
        queryAvulsos
      ]);

      if (vendaError) throw vendaError;
      if (ordemError) throw ordemError;
      if (servicosError) throw servicosError;
      if (avulsosError) throw avulsosError;

      // Agrupar por item
      const itensMap = new Map<string, LucroPorItem>();

      // Distribuir custo das parcelas antes de processar
      const vendasDistribuidas = distribuirCustoParcelasGrupo(vendas || []);
      vendasDistribuidas.forEach((venda: any) => {
        if (!isVendaInOptionalFinancialPeriod(venda, inicioPeriodo, fimPeriodo)) return;

        // Ignorar vendas geradas automaticamente a partir de OS (produtos/peças utilizados)
        // pois o total da OS já inclui esses valores e são contabilizados via ordens_servico
        if (venda.observacoes && typeof venda.observacoes === 'string' && venda.observacoes.includes('utilizado na OS')) return;
        // Fallback: peças com peca_id são sempre de OS
        if (venda.peca_id) return;

        let itemId: string;
        let itemNome: string;
        let itemCusto: number;

        if (venda.tipo === "dispositivo") {
          itemId = venda.dispositivo_id || `dispositivo_venda_${venda.id}`;
          itemNome = [venda.dispositivos?.marca, venda.dispositivos?.modelo]
            .filter(Boolean)
            .join(" ") || `Dispositivo vendido ${String(itemId).slice(0, 8)}`;
          // Priorizar custo salvo na venda, fallback para custo atual do dispositivo
          itemCusto = venda.custo_unitario && venda.custo_unitario > 0 
            ? Number(venda.custo_unitario) 
            : Number(venda.dispositivos?.custo || 0);
        } else if (venda.tipo === "produto") {
          itemId = venda.produto_id || `produto_venda_${venda.id}`;
          itemNome = venda.produtos?.nome || `Produto vendido ${String(itemId).slice(0, 8)}`;
          // Priorizar custo salvo na venda, fallback para custo atual do produto
          itemCusto = venda.custo_unitario && venda.custo_unitario > 0 
            ? Number(venda.custo_unitario) 
            : Number(venda.produtos?.custo || 0);
        } else if (venda.tipo === "servico") {
          // Vendas de serviço direto (não via OS) — usar ID único por venda
          itemId = `servico_venda_${venda.id}`;
          itemNome = "Serviço";
          itemCusto = venda.custo_unitario && venda.custo_unitario > 0
            ? Number(venda.custo_unitario)
            : 0;
        } else {
          return;
        }

        // Calcular receita líquida (subtraindo descontos)
        const receitaVenda = getVendaReceitaLiquida(venda);

        if (!itensMap.has(itemId)) {
          itensMap.set(itemId, {
            id: itemId,
            nome: itemNome,
            tipo: venda.tipo,
            quantidadeVendida: 0,
            custoTotal: 0,
            receitaTotal: 0,
            lucroTotal: 0,
            margemLucro: 0,
          });
        }

        const item = itensMap.get(itemId)!;
        const quantidade = venda.quantidade || 1;
        // Para vendas parceladas a_receber/a_prazo, contar quantidade apenas na parcela 1
        const isParcelado = (venda.forma_pagamento === "a_receber" || venda.forma_pagamento === "a_prazo") && Number(venda.total_parcelas || 0) > 1;
        if (!isParcelado || Number(venda.parcela_numero || 1) === 1) {
          item.quantidadeVendida += quantidade;
        }
        item.custoTotal += venda.custo_unitario && venda.custo_unitario > 0
          ? getVendaCustoTotal(venda)
          : itemCusto * quantidade;
        item.receitaTotal += receitaVenda;

        if (
          (venda.forma_pagamento === "a_receber" || venda.forma_pagamento === "a_prazo") &&
          Number(venda.total_parcelas || 0) > 1
        ) {
          const detalhe = {
            formaPagamento: venda.forma_pagamento,
            parcelaNumero: venda.parcela_numero ?? null,
            totalParcelas: venda.total_parcelas ?? null,
            valorParcela: receitaVenda,
          } as const;

          const existeDetalhe = item.parcelamentoDetalhes?.some(
            (current) =>
              current.formaPagamento === detalhe.formaPagamento &&
              current.parcelaNumero === detalhe.parcelaNumero &&
              current.totalParcelas === detalhe.totalParcelas &&
              current.valorParcela === detalhe.valorParcela
          );

          if (!existeDetalhe) {
            item.parcelamentoDetalhes = [...(item.parcelamentoDetalhes || []), detalhe];
          }
        }
      });

      // Processar ordens de serviço (1 conserto por OS)
      ordens?.forEach((ordem: any) => {
        const avariasData = ordem.avarias || {};
        const servicosRealizados = avariasData.servicos_realizados || [];

        // Sempre consolidar em um item por OS para não contar 2+ serviços internos como 2+ consertos
        let itemCusto = 0;
        let itemNome = `OS ${ordem.numero_os}`;

        // Receita é sempre o total real da OS (valor cobrado do cliente)
        const itemPreco = Number(ordem.total || 0);

        if (servicosRealizados.length > 0) {
          itemCusto = servicosRealizados.reduce((acc: number, servico: any) => acc + Number(servico.custo || 0), 0);

          const nomes = servicosRealizados
            .map((servico: any) => String(servico.nome || "").trim())
            .filter(Boolean);

          if (nomes.length === 1) {
            itemNome = `${nomes[0]} (${ordem.numero_os})`;
          } else if (nomes.length > 1) {
            itemNome = `${nomes[0]} +${nomes.length - 1} serviço(s) (${ordem.numero_os})`;
          }
        } else {
          // Fallback para ordens antigas: buscar serviço vinculado
          if (ordem.servico?.custo && Number(ordem.servico.custo) > 0) {
            itemCusto = Number(ordem.servico.custo);
            itemNome = `${ordem.servico.nome} (${ordem.numero_os})`;
          } else if (ordem.servico_id) {
            const servicoEncontrado = todosServicos?.find(
              (s: any) => s.id === ordem.servico_id
            );
            if (servicoEncontrado) {
              itemCusto = Number(servicoEncontrado.custo || 0);
              itemNome = `${servicoEncontrado.nome} (${ordem.numero_os})`;
            }
          }
        }

        // Usar ID único da ordem para garantir 1 linha por conserto
        const itemId = `servico_ordem_${ordem.id}`;

        if (!itensMap.has(itemId)) {
          itensMap.set(itemId, {
            id: itemId,
            nome: itemNome,
            tipo: "servico" as const,
            quantidadeVendida: 0,
            custoTotal: 0,
            receitaTotal: 0,
            lucroTotal: 0,
            margemLucro: 0,
          });
        }

        const item = itensMap.get(itemId)!;
        item.quantidadeVendida += 1;
        item.custoTotal += itemCusto;
        item.receitaTotal += itemPreco;

        // Processar custos adicionais da OS
        const custosAdicionais = avariasData.custos_adicionais || [];
        custosAdicionais.forEach((custo: any) => {
          if (custo.valor > 0) {
            const custoId = `custo_adicional_${ordem.id}_${custo.id}`;
            const tipoLabel = custo.tipo === 'frete' ? 'Frete' : custo.tipo === 'brinde' ? 'Brinde' : 'Custo';
            const custoNome = custo.descricao 
              ? `${tipoLabel}: ${custo.descricao} (${ordem.numero_os})`
              : `${tipoLabel} (${ordem.numero_os})`;

            if (!itensMap.has(custoId)) {
              itensMap.set(custoId, {
                id: custoId,
                nome: custoNome,
                tipo: "servico" as const,
                quantidadeVendida: 1,
                custoTotal: 0,
                receitaTotal: 0,
                lucroTotal: 0,
                margemLucro: 0,
              });
            }

            const item = itensMap.get(custoId)!;
            if (custo.repassar_cliente) {
              // Cliente paga: aparece como receita e custo
              item.receitaTotal += Number(custo.valor);
              item.custoTotal += Number(custo.valor);
            } else {
              // Loja assume: apenas custo (reduz lucro)
              item.custoTotal += Number(custo.valor);
            }
          }
        });

        // Processar produtos/peças utilizados na OS
        const produtosUtilizados = avariasData.produtos_utilizados || [];
        produtosUtilizados.forEach((produto: any) => {
          if (produto.custo_unitario > 0) {
            const prodId = `produto_os_${ordem.id}_${produto.id}`;
            const prodNome = `${produto.nome} (${ordem.numero_os})`;

            if (!itensMap.has(prodId)) {
              itensMap.set(prodId, {
                id: prodId,
                nome: prodNome,
                tipo: "produto" as const,
                quantidadeVendida: 0,
                custoTotal: 0,
                receitaTotal: 0,
                lucroTotal: 0,
                margemLucro: 0,
              });
            }

            const item = itensMap.get(prodId)!;
            item.quantidadeVendida += produto.quantidade || 1;
            item.receitaTotal += Number(produto.preco_total || 0);
            item.custoTotal += Number(produto.custo_unitario || 0) * (produto.quantidade || 1);
          }
        });
      });

      // Processar serviços avulsos
      (servicosAvulsos as any[])?.forEach((sa: any) => {
        const itemId = `servico_avulso_${sa.id}`;
        if (!itensMap.has(itemId)) {
          itensMap.set(itemId, {
            id: itemId,
            nome: `${sa.nome} (Avulso)`,
            tipo: "servico" as const,
            quantidadeVendida: 1,
            custoTotal: Number(sa.custo || 0),
            receitaTotal: Number(sa.preco || 0),
            lucroTotal: 0,
            margemLucro: 0,
          });
        }
      });

      // Calcular lucro e margem
      const itens = Array.from(itensMap.values()).map((item) => ({
        ...item,
        lucroTotal: item.receitaTotal - item.custoTotal,
        margemLucro:
          item.receitaTotal > 0
            ? ((item.receitaTotal - item.custoTotal) / item.receitaTotal) * 100
            : 0,
      }));

      return itens.sort((a, b) => b.lucroTotal - a.lucroTotal);
    } catch (error: any) {
      console.error("Erro ao calcular lucro:", error);
      if (!error?.message?.includes("Auth") && !error?.message?.includes("JWT") && !error?.message?.includes("refresh_token") && !error?.message?.includes("Usuário não autenticado")) {
        toast({
          title: "Erro ao calcular lucro",
          description: error.message,
          variant: "destructive",
        });
      }
      return [];
    } finally {
      setLoading(false);
    }
  };

  const calcularCustosOperacionais = async (
    filtros: FiltrosRelatorio
  ): Promise<{ agrupados: CustoOperacional[]; detalhes: ContaPagaDetalhe[] }> => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return { agrupados: [], detalhes: [] };

      let query = supabase
        .from("contas")
        .select("*")
        .eq("user_id", user.id)
        .eq("tipo", "pagar")
        .eq("status", "pago")
        .neq("categoria", "Taxa de Cartão")
        .is("os_numero", null);

      if (filtros.dataInicio) {
        query = query.gte("data", filtros.dataInicio);
      }
      if (filtros.dataFim) {
        query = query.lte("data", filtros.dataFim);
      }

      const { data: contas, error } = await query;
      if (error) throw error;

      // Excluir peças de OS do custo operacional (já entram no custo total de produtos/peças)
      const contasOperacionais = (contas || []).filter((conta: any) => {
        const nome = String(conta.nome || "");
        const descricao = String(conta.descricao || "");

        const vinculadaOS = Boolean(conta.os_numero);
        const pecaPorNome = /^peça\s*:/i.test(nome);
        const pecaPorDescricao = /utilizada no servi[çc]o/i.test(descricao);
        const pecaPorPadraoOS = /\(OS\s*\d+/i.test(nome) && /peça/i.test(nome);

        return !(vinculadaOS || pecaPorNome || pecaPorDescricao || pecaPorPadraoOS);
      });

      // Store raw accounts for detail view
      const contasDetalhes: ContaPagaDetalhe[] = contasOperacionais.map((c: any) => ({
        id: c.id,
        nome: c.nome,
        categoria: c.categoria,
        valor: Number(c.valor || 0),
        data: c.data,
      }));

      // Agrupar por mês
      const custosMap = new Map<string, CustoOperacional>();

      contasOperacionais.forEach((conta: any) => {
        const data = new Date(conta.data);
        const mes = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;

        if (!custosMap.has(mes)) {
          custosMap.set(mes, {
            mes,
            contas: 0,
            total: 0,
          });
        }

        const custo = custosMap.get(mes)!;
        custo.contas += 1;
        custo.total += Number(conta.valor || 0);
      });

      return {
        agrupados: Array.from(custosMap.values()).sort((a, b) => a.mes.localeCompare(b.mes)),
        detalhes: contasDetalhes,
      };
    } catch (error: any) {
      console.error("Erro ao calcular custos:", error);
      if (!error?.message?.includes("Auth") && !error?.message?.includes("JWT") && !error?.message?.includes("refresh_token") && !error?.message?.includes("Usuário não autenticado")) {
        toast({
          title: "Erro ao calcular custos",
          description: error.message,
          variant: "destructive",
        });
      }
      return { agrupados: [], detalhes: [] };
    }
  };

  const calcularTaxasCartao = async (
    filtros: FiltrosRelatorio
  ): Promise<{ total: number; detalhes: TaxaCartaoDetalhe[] }> => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return { total: 0, detalhes: [] };

      let query = supabase
        .from("contas")
        .select("id, valor, nome, descricao, data")
        .eq("user_id", user.id)
        .eq("tipo", "pagar")
        .eq("status", "pago")
        .eq("categoria", "Taxa de Cartão");

      if (filtros.dataInicio) {
        query = query.gte("data", filtros.dataInicio);
      }
      if (filtros.dataFim) {
        query = query.lte("data", filtros.dataFim);
      }

      const { data, error } = await query;
      if (error) throw error;

      const detalhes: TaxaCartaoDetalhe[] = (data || []).map((c: any) => {
        // Extrair bandeira da descrição (formato: "Taxa X% da bandeira NOME sobre ...")
        let bandeira = "Não identificada";
        const match = c.descricao?.match(/bandeira\s+(.+?)\s+sobre/i);
        if (match) bandeira = match[1];
        
        return {
          id: c.id,
          nome: c.nome,
          bandeira,
          valor: Number(c.valor || 0),
          data: c.data,
          descricao: c.descricao || "",
        };
      });

      const total = detalhes.reduce((acc, t) => acc + t.valor, 0);
      return { total, detalhes };
    } catch (error: any) {
      console.error("Erro ao calcular taxas de cartão:", error);
      return { total: 0, detalhes: [] };
    }
  };


  const calcularEvolucaoMensal = async (
    filtros: FiltrosRelatorio
  ): Promise<EvolucaoMensal[]> => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return [];

      const inicioPeriodo = filtros.dataInicio ? parseFiltroDate(filtros.dataInicio) : null;
      const fimPeriodo = filtros.dataFim ? parseFiltroDate(filtros.dataFim, true) : null;
      const { queryInicio, queryFim } = getFinancialQueryDateBounds(inicioPeriodo, fimPeriodo);

      // Buscar vendas NÃO canceladas (somente do usuário)
      let queryVendas = supabase
        .from("vendas")
        .select(
          `
          *,
          dispositivos (custo),
          produtos (custo)
        `
        )
        .eq("user_id", user.id)
        .neq("cancelada", true);

      if (queryInicio && queryFim) {
        queryVendas = queryVendas.or(
          `and(data.gte.${queryInicio},data.lte.${queryFim}T23:59:59),and(data_recebimento.not.is.null,data_recebimento.gte.${queryInicio},data_recebimento.lte.${queryFim}T23:59:59)`
        );
      } else if (queryInicio) {
        queryVendas = queryVendas.or(
          `data.gte.${queryInicio},and(data_recebimento.not.is.null,data_recebimento.gte.${queryInicio})`
        );
      } else if (queryFim) {
        queryVendas = queryVendas.or(
          `data.lte.${queryFim}T23:59:59,and(data_recebimento.not.is.null,data_recebimento.lte.${queryFim}T23:59:59)`
        );
      }

      let queryOrdens = supabase
        .from("ordens_servico")
        .select(`
          *,
          servico:servicos!ordens_servico_servico_id_fkey(id, nome, preco, custo)
        `)
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .in("status", ["finalizado", "entregue"]);

      if (filtros.dataInicio && filtros.dataFim) {
        queryOrdens = queryOrdens.or(
          `and(data_saida.not.is.null,data_saida.gte.${filtros.dataInicio},data_saida.lte.${filtros.dataFim}T23:59:59),and(data_saida.is.null,updated_at.gte.${filtros.dataInicio},updated_at.lte.${filtros.dataFim}T23:59:59)`
        );
      } else if (filtros.dataInicio) {
        queryOrdens = queryOrdens.or(
          `and(data_saida.not.is.null,data_saida.gte.${filtros.dataInicio}),and(data_saida.is.null,updated_at.gte.${filtros.dataInicio})`
        );
      } else if (filtros.dataFim) {
        queryOrdens = queryOrdens.or(
          `and(data_saida.not.is.null,data_saida.lte.${filtros.dataFim}T23:59:59),and(data_saida.is.null,updated_at.lte.${filtros.dataFim}T23:59:59)`
        );
      }

      // Buscar todos os serviços (somente do usuário)
      const queryServicos = supabase
        .from("servicos")
        .select("id, nome, preco, custo")
        .eq("user_id", user.id);

      // Buscar serviços avulsos (apenas entregues ou finalizados)
      let queryAvulsos2 = supabase
        .from("servicos_avulsos")
        .select("*")
        .eq("user_id", user.id)
        .in("status", ["entregue", "finalizado"]);

      if (filtros.dataInicio) {
        queryAvulsos2 = queryAvulsos2.gte("created_at", filtros.dataInicio);
      }
      if (filtros.dataFim) {
        queryAvulsos2 = queryAvulsos2.lte("created_at", filtros.dataFim + "T23:59:59");
      }

      const [
        { data: vendas, error: vendaError }, 
        { data: ordens, error: ordemError },
        { data: todosServicos, error: servicosError },
        { data: avulsosEvolucao, error: avulsosError2 }
      ] = await Promise.all([
        queryVendas,
        queryOrdens,
        queryServicos,
        queryAvulsos2
      ]);

      if (vendaError) throw vendaError;
      if (ordemError) throw ordemError;
      if (servicosError) throw servicosError;
      if (avulsosError2) throw avulsosError2;

      // Buscar custos operacionais - contas "pagar/pago" (somente do usuário)
      // Excluir Taxa de Cartão (tratada separadamente) e contas vinculadas a OS (já contabilizadas nos custos diretos)
      let queryContasPagar = supabase
        .from("contas")
        .select("*")
        .eq("user_id", user.id)
        .eq("tipo", "pagar")
        .eq("status", "pago")
        .neq("categoria", "Taxa de Cartão")
        .is("os_numero", null);

      if (filtros.dataInicio) {
        queryContasPagar = queryContasPagar.gte("data", filtros.dataInicio);
      }
      if (filtros.dataFim) {
        queryContasPagar = queryContasPagar.lte("data", filtros.dataFim);
      }

      // Buscar receitas manuais - contas "receber/recebido" (somente do usuário)
      let queryContasReceber = supabase
        .from("contas")
        .select("*")
        .eq("user_id", user.id)
        .eq("tipo", "receber")
        .eq("status", "recebido");

      if (filtros.dataInicio) {
        queryContasReceber = queryContasReceber.gte("data", filtros.dataInicio);
      }
      if (filtros.dataFim) {
        queryContasReceber = queryContasReceber.lte("data", filtros.dataFim);
      }

      // Buscar taxas de cartão separadamente
      let queryTaxasCartao = supabase
        .from("contas")
        .select("*")
        .eq("user_id", user.id)
        .eq("tipo", "pagar")
        .eq("status", "pago")
        .eq("categoria", "Taxa de Cartão");

      if (filtros.dataInicio) {
        queryTaxasCartao = queryTaxasCartao.gte("data", filtros.dataInicio);
      }
      if (filtros.dataFim) {
        queryTaxasCartao = queryTaxasCartao.lte("data", filtros.dataFim);
      }

      const [
        { data: contasPagar, error: contaPagarError },
        { data: contasReceber, error: contaReceberError },
        { data: taxasCartao, error: taxasCartaoError }
      ] = await Promise.all([
        queryContasPagar,
        queryContasReceber,
        queryTaxasCartao,
      ]);
      if (contaPagarError) throw contaPagarError;
      if (contaReceberError) throw contaReceberError;
      if (taxasCartaoError) throw taxasCartaoError;

      // Filtrar contas operacionais (excluir peças de OS já contabilizadas nos custos diretos)
      const contasOperacionais = (contasPagar || []).filter((conta: any) => {
        const nome = String(conta.nome || "");
        const descricao = String(conta.descricao || "");
        const pecaPorNome = /^peça\s*:/i.test(nome);
        const pecaPorDescricao = /utilizada no servi[çc]o/i.test(descricao);
        const pecaPorPadraoOS = /\(OS\s*\d+/i.test(nome) && /peça/i.test(nome);
        return !(pecaPorNome || pecaPorDescricao || pecaPorPadraoOS);
      });

      // Agrupar por mês
      const evolucaoMap = new Map<string, EvolucaoMensal>();

      // Distribuir custo das parcelas antes de processar evolução
      const vendasEvolucaoDistribuidas = distribuirCustoParcelasGrupo(vendas || []);
      vendasEvolucaoDistribuidas.forEach((venda: any) => {
        if (!isVendaInOptionalFinancialPeriod(venda, inicioPeriodo, fimPeriodo)) return;

        // Ignorar vendas geradas automaticamente a partir de OS (produtos/peças utilizados)
        if (venda.observacoes && typeof venda.observacoes === 'string' && venda.observacoes.includes('utilizado na OS')) return;
        if (venda.peca_id) return;

        const dataCompetencia = getVendaDataCompetencia(venda);
        if (!dataCompetencia) return;

        const data = new Date(dataCompetencia);
        const mes = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;

        if (!evolucaoMap.has(mes)) {
          evolucaoMap.set(mes, {
            mes,
            receita: 0,
            custo: 0,
            lucro: 0,
          });
        }

        const evolucao = evolucaoMap.get(mes)!;
        // Para parcelado, somar o total real (valor da parcela × número de parcelas)
        evolucao.receita += getVendaReceitaLiquida(venda);

        // Priorizar custo salvo na venda, fallback para custo atual
        if (venda.custo_unitario && venda.custo_unitario > 0) {
          evolucao.custo += getVendaCustoTotal(venda);
        } else if (venda.tipo === "dispositivo" && venda.dispositivos) {
          const quantidade = venda.quantidade || 1;
          evolucao.custo += Number(venda.dispositivos.custo || 0) * quantidade;
        } else if (venda.tipo === "produto" && venda.produtos) {
          const quantidade = venda.quantidade || 1;
          evolucao.custo += Number(venda.produtos.custo || 0) * quantidade;
        }
      });

      // Processar ordens de serviço (usar data_saida como data de referência)
      ordens?.forEach((ordem: any) => {
        const data = new Date(ordem.data_saida || ordem.updated_at || ordem.created_at);
        const mes = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;

        if (!evolucaoMap.has(mes)) {
          evolucaoMap.set(mes, {
            mes,
            receita: 0,
            custo: 0,
            lucro: 0,
          });
        }

        const evolucao = evolucaoMap.get(mes)!;
        evolucao.receita += Number(ordem.total || 0);
        
        // Ler custos dos serviços salvos no campo avarias
        const avariasData = ordem.avarias || {};
        const servicosRealizados = avariasData.servicos_realizados || [];
        
        if (servicosRealizados.length > 0) {
          const custoServicos = servicosRealizados.reduce((acc: number, s: any) => acc + Number(s.custo || 0), 0);
          evolucao.custo += custoServicos;
        } else {
          // Fallback: usar custo do serviço vinculado
          if (ordem.servico?.custo && Number(ordem.servico.custo) > 0) {
            evolucao.custo += Number(ordem.servico.custo);
          } else if (ordem.servico_id) {
            const servicoEncontrado = todosServicos?.find(
              (s: any) => s.id === ordem.servico_id
            );
            if (servicoEncontrado && Number(servicoEncontrado.custo) > 0) {
              evolucao.custo += Number(servicoEncontrado.custo);
            }
          }
        }

        // Adicionar custos adicionais da OS
        const custosAdicionais = avariasData.custos_adicionais || [];
        custosAdicionais.forEach((custo: any) => {
          if (custo.valor > 0 && !custo.repassar_cliente) {
            // Custos assumidos pela loja: somam como custo
            evolucao.custo += Number(custo.valor);
          }
        });

        // Adicionar custos de produtos/peças utilizados na OS
        const produtosUtilizados = avariasData.produtos_utilizados || [];
        produtosUtilizados.forEach((produto: any) => {
          if (produto.custo_unitario > 0) {
            evolucao.custo += Number(produto.custo_unitario || 0) * (produto.quantidade || 1);
          }
        });
      });

      // Processar serviços avulsos na evolução mensal
      (avulsosEvolucao as any[])?.forEach((sa: any) => {
        const data = new Date(sa.created_at);
        const mes = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;

        if (!evolucaoMap.has(mes)) {
          evolucaoMap.set(mes, { mes, receita: 0, custo: 0, lucro: 0 });
        }

        const evolucao = evolucaoMap.get(mes)!;
        evolucao.receita += Number(sa.preco || 0);
        evolucao.custo += Number(sa.custo || 0);
      });

      // Adicionar custos operacionais (contas filtradas, sem duplicidade)
      contasOperacionais.forEach((conta: any) => {
        const data = new Date(conta.data);
        const mes = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;

        if (!evolucaoMap.has(mes)) {
          evolucaoMap.set(mes, { mes, receita: 0, custo: 0, lucro: 0 });
        }

        const evolucao = evolucaoMap.get(mes)!;
        evolucao.custo += Number(conta.valor || 0);
      });

      // Adicionar taxas de cartão
      taxasCartao?.forEach((taxa: any) => {
        const data = new Date(taxa.data);
        const mes = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;

        if (!evolucaoMap.has(mes)) {
          evolucaoMap.set(mes, { mes, receita: 0, custo: 0, lucro: 0 });
        }

        const evolucao = evolucaoMap.get(mes)!;
        evolucao.custo += Number(taxa.valor || 0);
      });

      // Adicionar receitas manuais (contas a receber/recebidas)
      contasReceber?.forEach((conta: any) => {
        if (!isContaReceitaManual(conta)) return;

        const data = new Date(conta.data);
        const mes = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;

        if (!evolucaoMap.has(mes)) {
          evolucaoMap.set(mes, {
            mes,
            receita: 0,
            custo: 0,
            lucro: 0,
          });
        }

        const evolucao = evolucaoMap.get(mes)!;
        evolucao.receita += Number(conta.valor || 0);
      });

      // Calcular lucro
      const evolucao = Array.from(evolucaoMap.values()).map((item) => ({
        ...item,
        lucro: item.receita - item.custo,
      }));

      return evolucao.sort((a, b) => a.mes.localeCompare(b.mes));
    } catch (error: any) {
      console.error("Erro ao calcular evolução:", error);
      if (!error?.message?.includes("Auth") && !error?.message?.includes("JWT") && !error?.message?.includes("refresh_token") && !error?.message?.includes("Usuário não autenticado")) {
        toast({
          title: "Erro ao calcular evolução",
          description: error.message,
          variant: "destructive",
        });
      }
      return [];
    }
  };

  const calcularReceitaManual = async (
    filtros: FiltrosRelatorio
  ): Promise<number> => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return 0;

      let query = supabase
        .from("contas")
        .select("valor, descricao, os_numero")
        .eq("user_id", user.id)
        .eq("tipo", "receber")
        .eq("status", "recebido");

      if (filtros.dataInicio) {
        query = query.gte("data", filtros.dataInicio);
      }
      if (filtros.dataFim) {
        query = query.lte("data", filtros.dataFim);
      }

      const { data, error } = await query;
      if (error) throw error;

      const receitasManuais = (data || []).filter((conta) => isContaReceitaManual(conta as any));

      return receitasManuais.reduce((acc, c: any) => acc + Number(c.valor || 0), 0);
    } catch {
      return 0;
    }
  };

  const calcularResumo = async (
    filtros: FiltrosRelatorio
  ): Promise<ResumoFinanceiro> => {
    try {
      const [lucros, custos, receitaManual, taxasCartao] = await Promise.all([
        calcularLucroPorItem(filtros),
        calcularCustosOperacionais(filtros),
        calcularReceitaManual(filtros),
        calcularTaxasCartao(filtros),
      ]);

      const receitaVendasOS = lucros.reduce((acc, item) => acc + item.receitaTotal, 0);
      const receitaTotal = receitaVendasOS + receitaManual;
      
      console.log('[Financeiro Debug] Breakdown receita:', {
        receitaVendasOS,
        receitaManual,
        receitaTotal,
        itensCount: lucros.length,
        itensPorTipo: {
          dispositivos: lucros.filter(i => i.tipo === 'dispositivo').reduce((a, i) => a + i.receitaTotal, 0),
          produtos: lucros.filter(i => i.tipo === 'produto').reduce((a, i) => a + i.receitaTotal, 0),
          servicos: lucros.filter(i => i.tipo === 'servico').reduce((a, i) => a + i.receitaTotal, 0),
        }
      });

      const custoProdutosServicos = lucros.reduce((acc, item) => acc + item.custoTotal, 0);
      const custoTotal = custoProdutosServicos + taxasCartao.total;
      const custoOperacional = custos.agrupados.reduce((acc, custo) => acc + custo.total, 0);
      
      // Lucro bruto = receita total (vendas/OS + receitas manuais) - custo total (produtos/serviços + taxas cartão)
      const lucroTotal = receitaTotal - custoTotal;
      
      // Lucro líquido = lucro bruto - custos operacionais
      const lucroLiquido = lucroTotal - custoOperacional;
      
      const margemLucroMedia =
        receitaTotal > 0 ? (lucroTotal / receitaTotal) * 100 : 0;

      console.log('[Financeiro Debug] Breakdown completo:', {
        receitaTotal,
        custoProdutosServicos,
        taxasCartao: taxasCartao.total,
        custoTotal,
        lucroTotal_bruto: lucroTotal,
        custoOperacional,
        lucroLiquido,
        lucroPorTipo: {
          dispositivos_lucro: lucros.filter(i => i.tipo === 'dispositivo').reduce((a, i) => a + (i.receitaTotal - i.custoTotal), 0),
          produtos_lucro: lucros.filter(i => i.tipo === 'produto').reduce((a, i) => a + (i.receitaTotal - i.custoTotal), 0),
          servicos_lucro: lucros.filter(i => i.tipo === 'servico').reduce((a, i) => a + (i.receitaTotal - i.custoTotal), 0),
        },
        contasOperacionais: custos.detalhes.map(d => ({ nome: d.nome, valor: d.valor, cat: d.categoria })),
        taxasDetalhes: taxasCartao.detalhes.map(d => ({ bandeira: d.bandeira, valor: d.valor })),
      });

      return {
        receitaTotal,
        custoTotal,
        lucroTotal,
        margemLucroMedia,
        custoOperacional,
        lucroLiquido,
        taxasCartao: taxasCartao.total,
        taxasCartaoDetalhes: taxasCartao.detalhes,
        contasPagasDetalhes: custos.detalhes,
      };
    } catch (error: any) {
      console.error("Erro ao calcular resumo:", error);
      return {
        receitaTotal: 0,
        custoTotal: 0,
        lucroTotal: 0,
        margemLucroMedia: 0,
        custoOperacional: 0,
        lucroLiquido: 0,
        taxasCartao: 0,
      };
    }
  };

  return {
    loading,
    calcularLucroPorItem,
    calcularCustosOperacionais,
    calcularEvolucaoMensal,
    calcularResumo,
  };
};
