import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  RelatorioDispositivo,
  RelatorioProduto,
  RelatorioServico,
  FiltrosRelatorioVendas,
} from "@/types/relatorio-vendas";
import { useToast } from "@/hooks/use-toast";

export const useRelatoriosVendas = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const buscarRelatorioDispositivos = async (
    filtros: FiltrosRelatorioVendas
  ): Promise<RelatorioDispositivo[]> => {
    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      let query = supabase
        .from("vendas")
        .select(
          `
          *,
          dispositivos (tipo, marca, modelo, custo, preco)
        `
        )
        .eq("user_id", user.id)
        .eq("tipo", "dispositivo");

      if (filtros.dataInicio) {
        query = query.gte("data", filtros.dataInicio);
      }
      if (filtros.dataFim) {
        query = query.lte("data", filtros.dataFim);
      }

      const { data: vendas, error } = await query;
      if (error) throw error;

      const dispositivosMap = new Map<string, RelatorioDispositivo>();

      vendas?.forEach((venda: any) => {
        if (!venda.dispositivos) return;

        const key = `${venda.dispositivos.tipo}-${venda.dispositivos.marca}-${venda.dispositivos.modelo}`;
        
        if (!dispositivosMap.has(key)) {
          dispositivosMap.set(key, {
            id: key,
            tipo: venda.dispositivos.tipo,
            marca: venda.dispositivos.marca,
            modelo: venda.dispositivos.modelo,
            quantidadeVendida: 0,
            receitaTotal: 0,
            custoTotal: 0,
            lucroTotal: 0,
            ticketMedio: 0,
          });
        }

        const item = dispositivosMap.get(key)!;
        const quantidade = venda.quantidade || 1;
        const custo = Number(venda.dispositivos.custo || 0);
        const receita = Number(venda.total || 0);

        item.quantidadeVendida += quantidade;
        item.receitaTotal += receita;
        item.custoTotal += custo * quantidade;
      });

      const dispositivos = Array.from(dispositivosMap.values()).map((item) => ({
        ...item,
        lucroTotal: item.receitaTotal - item.custoTotal,
        ticketMedio: item.quantidadeVendida > 0 ? item.receitaTotal / item.quantidadeVendida : 0,
      }));

      return dispositivos.sort((a, b) => b.receitaTotal - a.receitaTotal);
    } catch (error: any) {
      console.error("Erro ao buscar relatório de dispositivos:", error);
      toast({
        title: "Erro ao buscar relatório",
        description: error.message,
        variant: "destructive",
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  const buscarRelatorioProdutos = async (
    filtros: FiltrosRelatorioVendas
  ): Promise<RelatorioProduto[]> => {
    try {
      setLoading(true);
      
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Buscar vendas de produtos (somente do usuário)
      let queryVendas = supabase
        .from("vendas")
        .select(
          `
          *,
          produtos (nome, sku, custo, preco, quantidade)
        `
        )
        .eq("user_id", user.id)
        .eq("tipo", "produto");

      if (filtros.dataInicio) {
        queryVendas = queryVendas.gte("data", filtros.dataInicio);
      }
      if (filtros.dataFim) {
        queryVendas = queryVendas.lte("data", filtros.dataFim);
      }

      const { data: vendas, error } = await queryVendas;
      if (error) throw error;

      const produtosMap = new Map<string, RelatorioProduto>();

      vendas?.forEach((venda: any) => {
        if (!venda.produtos) return;

        const produtoId = venda.produto_id;

        if (!produtosMap.has(produtoId)) {
          produtosMap.set(produtoId, {
            id: produtoId,
            nome: venda.produtos.nome,
            sku: venda.produtos.sku,
            quantidadeVendida: 0,
            estoqueAtual: venda.produtos.quantidade || 0,
            receitaTotal: 0,
            custoTotal: 0,
            lucroTotal: 0,
            ticketMedio: 0,
          });
        }

        const item = produtosMap.get(produtoId)!;
        const quantidade = venda.quantidade || 1;
        const custo = Number(venda.produtos.custo || 0);
        const receita = Number(venda.total || 0);

        item.quantidadeVendida += quantidade;
        item.receitaTotal += receita;
        item.custoTotal += custo * quantidade;
      });

      const produtos = Array.from(produtosMap.values()).map((item) => ({
        ...item,
        lucroTotal: item.receitaTotal - item.custoTotal,
        ticketMedio: item.quantidadeVendida > 0 ? item.receitaTotal / item.quantidadeVendida : 0,
      }));

      return produtos.sort((a, b) => b.quantidadeVendida - a.quantidadeVendida);
    } catch (error: any) {
      console.error("Erro ao buscar relatório de produtos:", error);
      toast({
        title: "Erro ao buscar relatório",
        description: error.message,
        variant: "destructive",
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  const buscarRelatorioServicos = async (
    filtros: FiltrosRelatorioVendas
  ): Promise<RelatorioServico[]> => {
    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      let query = supabase
        .from("ordens_servico")
        .select(
          `
          *,
          servicos (nome, preco)
        `
        )
        .eq("user_id", user.id)
        .in("status", ["finalizado", "entregue", "concluida"]);

      if (filtros.dataInicio) {
        query = query.gte("updated_at", filtros.dataInicio);
      }
      if (filtros.dataFim) {
        query = query.lte("updated_at", filtros.dataFim);
      }

      const { data: ordens, error } = await query;
      if (error) throw error;

      console.log("🔍 Ordens de serviço finalizadas encontradas:", ordens?.length || 0);
      console.log("📦 Dados das ordens:", ordens);

      const servicosMap = new Map<string, RelatorioServico>();

      ordens?.forEach((ordem: any) => {
        const servicoNome = ordem.servicos?.nome || `OS ${ordem.numero_os}`;
        const servicoId = ordem.servico_id || ordem.id;

        if (!servicosMap.has(servicoId)) {
          servicosMap.set(servicoId, {
            id: servicoId,
            nomeServico: servicoNome,
            quantidadeRealizada: 0,
            receitaTotal: 0,
            tempoMedioConclusao: 0,
            statusDistribuicao: {
              pendente: 0,
              em_andamento: 0,
              concluido: 0,
            },
          });
        }

        const item = servicosMap.get(servicoId)!;
        item.quantidadeRealizada += 1;
        item.receitaTotal += Number(ordem.total || 0);

        // Todos os status que chegam aqui são finalizados
        item.statusDistribuicao.concluido += 1;

        // Calcular tempo médio de conclusão (em dias)
        const inicio = new Date(ordem.created_at);
        const fim = new Date(ordem.updated_at);
        const dias = Math.ceil((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
        item.tempoMedioConclusao += dias;
      });

      const servicos = Array.from(servicosMap.values()).map((item) => ({
        ...item,
        tempoMedioConclusao:
          item.statusDistribuicao.concluido > 0
            ? item.tempoMedioConclusao / item.statusDistribuicao.concluido
            : 0,
      }));

      console.log("✅ Serviços agrupados:", servicos.length);
      return servicos.sort((a, b) => b.quantidadeRealizada - a.quantidadeRealizada);
    } catch (error: any) {
      console.error("❌ Erro ao buscar relatório de serviços:", error);
      toast({
        title: "Erro ao buscar relatório",
        description: error.message,
        variant: "destructive",
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    buscarRelatorioDispositivos,
    buscarRelatorioProdutos,
    buscarRelatorioServicos,
  };
};
