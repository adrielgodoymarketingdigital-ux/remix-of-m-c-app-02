import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Conta, FormularioConta } from "@/types/conta";
import { useToast } from "@/hooks/use-toast";
import { withRetry, classifyError, shouldSuppressToast } from "@/lib/supabase-retry";

export function useContas(filtros?: { inicio?: Date; fim?: Date }) {
  const [contas, setContas] = useState<Conta[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const carregarContas = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        setLoading(false);
        return;
      }

      let query = supabase
        .from("contas")
        .select("*")
        .eq("user_id", user.id)
        .order("data", { ascending: false });

      if (filtros?.inicio) {
        query = query.gte("data", filtros.inicio.toISOString().split("T")[0]);
      }
      if (filtros?.fim) {
        query = query.lte("data", filtros.fim.toISOString().split("T")[0]);
      }

      // Carregar contas, vendas a_receber e OS excluídas em paralelo com retry
      const [contasResult, vendasResult, osExcluidasResult] = await Promise.all([
        withRetry(async () => {
          const r = await Promise.resolve(query);
          if (r.error) throw r.error;
          return r;
        }, 'useContas.queryContas'),
        withRetry(async () => {
          const r = await supabase
            .from("vendas")
            .select("id, data, total, forma_pagamento, data_prevista_recebimento, recebido, data_recebimento, parcela_numero, total_parcelas, cancelada, user_id, cliente_id, tipo, produto_id, dispositivo_id, peca_id, clientes!vendas_cliente_id_fkey(nome), produtos(nome), dispositivos!vendas_dispositivo_id_fkey(marca, modelo), pecas(nome)")
            .eq("user_id", user.id)
            .eq("forma_pagamento", "a_receber")
            .eq("cancelada", false);
          if (r.error) throw r.error;
          return r;
        }, 'useContas.queryVendasAReceber'),
        withRetry(async () => {
          const r = await supabase
            .from("ordens_servico")
            .select("numero_os")
            .eq("user_id", user.id)
            .not("deleted_at", "is", null);
          if (r.error) throw r.error;
          return r;
        }, 'useContas.queryOSExcluidas'),
      ]);

      const contasData = (contasResult.data || []) as Conta[];

      // Identificar vendas que já têm conta vinculada (via descricao com venda_id:)
      const vendasComConta = new Set<string>();
      // Filtrar contas vinculadas a OS excluídas
      const osExcluidas = new Set(
        (osExcluidasResult.data || []).map((os: any) => os.numero_os)
      );
      const contasSemOSExcluida = contasData.filter(
        (c) => !c.os_numero || !osExcluidas.has(c.os_numero)
      );

      contasSemOSExcluida.forEach(c => {
        if (c.descricao && c.descricao.startsWith("venda_id:")) {
          vendasComConta.add(c.descricao.replace("venda_id:", ""));
        }
      });

      // Criar contas virtuais para vendas a_receber sem conta correspondente
      const vendasSemConta = (vendasResult.data || []).filter(
        (v: any) => !vendasComConta.has(v.id)
      );

      const contasVirtuais: Conta[] = vendasSemConta.map((v: any) => {
        const nomeCliente = v.clientes?.nome || "Cliente";
        let nomeItem = "";
        if (v.tipo === "dispositivo" && v.dispositivos) {
          nomeItem = `${v.dispositivos.marca} ${v.dispositivos.modelo}`;
        } else if (v.tipo === "produto" && v.produtos) {
          nomeItem = v.produtos.nome;
        } else if (v.pecas) {
          nomeItem = v.pecas.nome;
        } else {
          nomeItem = "Venda";
        }

        const sufixoParcela = v.parcela_numero && v.total_parcelas
          ? ` (${v.parcela_numero}/${v.total_parcelas})`
          : "";

        const dataVenda = v.data_prevista_recebimento || (v.data ? v.data.split("T")[0] : new Date().toISOString().split("T")[0]);

        return {
          id: `venda_${v.id}`,
          nome: `Venda - ${nomeItem} - ${nomeCliente}${sufixoParcela}`,
          tipo: "receber" as const,
          valor: Number(v.total),
          data: dataVenda,
          status: v.recebido ? ("recebido" as const) : ("pendente" as const),
          recorrente: false,
          categoria: "Vendas",
          descricao: `venda_id:${v.id}`,
          user_id: v.user_id,
          created_at: v.data || new Date().toISOString(),
        };
      });

      // Mesclar contas reais + virtuais e ordenar por data desc
      const todasContas = [...contasSemOSExcluida, ...contasVirtuais].sort(
        (a, b) => String(b.data).localeCompare(String(a.data))
      );

      setContas(todasContas);
    } catch (error: unknown) {
      if (!shouldSuppressToast(error)) {
        const { userMessage } = classifyError(error);
        toast({
          title: "Erro ao carregar contas",
          description: userMessage,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  }, [filtros, toast]);

  const criarConta = async (dados: FormularioConta) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Erro de autenticação",
          description: "Por favor, faça login novamente.",
          variant: "destructive",
        });
        return false;
      }

      const { error } = await supabase.from("contas").insert({
        ...dados,
        user_id: user.id,
      });

      if (error) throw error;

      toast({
        title: "Conta cadastrada",
        description: "A conta foi cadastrada com sucesso.",
      });

      await carregarContas();
      return true;
    } catch (error) {
      console.error("Erro ao cadastrar conta:", error);
      toast({
        title: "Erro ao cadastrar conta",
        description: "Não foi possível cadastrar a conta.",
        variant: "destructive",
      });
      return false;
    }
  };

  const atualizarConta = async (id: string, dados: Partial<FormularioConta>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      // Se é uma conta virtual de venda, atualizar a venda
      if (id.startsWith("venda_")) {
        const vendaId = id.replace("venda_", "");
        if (dados.status === "recebido") {
          const { error } = await supabase
            .from("vendas")
            .update({ recebido: true, data_recebimento: new Date().toISOString() })
            .eq("id", vendaId)
            .eq("user_id", user.id);
          if (error) throw error;
        }
        toast({
          title: "Conta atualizada",
          description: "A conta foi atualizada com sucesso.",
        });
        await carregarContas();
        return true;
      }

      const { error } = await supabase
        .from("contas")
        .update(dados)
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;

      toast({
        title: "Conta atualizada",
        description: "A conta foi atualizada com sucesso.",
      });

      await carregarContas();
      return true;
    } catch (error) {
      console.error("Erro ao atualizar conta:", error);
      toast({
        title: "Erro ao atualizar conta",
        description: "Não foi possível atualizar a conta.",
        variant: "destructive",
      });
      return false;
    }
  };

  const excluirConta = async (id: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      // Contas virtuais de venda não podem ser excluídas
      if (id.startsWith("venda_")) {
        toast({
          title: "Não é possível excluir",
          description: "Esta conta é gerada automaticamente a partir de uma venda. Edite a venda para alterar.",
          variant: "destructive",
        });
        return false;
      }

      const { error } = await supabase
        .from("contas")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;

      toast({
        title: "Conta excluída",
        description: "A conta foi excluída com sucesso.",
      });

      await carregarContas();
      return true;
    } catch (error) {
      console.error("Erro ao excluir conta:", error);
      toast({
        title: "Erro ao excluir conta",
        description: "Não foi possível excluir a conta.",
        variant: "destructive",
      });
      return false;
    }
  };

  const marcarComoPaga = async (id: string, tipo: 'pagar' | 'receber') => {
    // Se é uma conta virtual de venda, marcar a venda como recebida
    if (id.startsWith("venda_") && tipo === "receber") {
      return await atualizarConta(id, { status: "recebido" });
    }

    const status = tipo === 'pagar' ? 'pago' : 'recebido';
    const sucesso = await atualizarConta(id, { status });

    if (sucesso) {
      const conta = contas.find(c => c.id === id);
      if (conta?.recorrente) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const dataAtual = new Date(conta.data);
            const proximoMes = new Date(dataAtual.getFullYear(), dataAtual.getMonth() + 1, dataAtual.getDate());
            const proximaData = `${proximoMes.getFullYear()}-${String(proximoMes.getMonth() + 1).padStart(2, '0')}-${String(proximoMes.getDate()).padStart(2, '0')}`;

            const { data: existente } = await supabase
              .from("contas")
              .select("id")
              .eq("user_id", user.id)
              .eq("nome", conta.nome)
              .eq("data", proximaData)
              .eq("recorrente", true)
              .maybeSingle();

            if (!existente) {
              await supabase.from("contas").insert({
                nome: conta.nome,
                tipo: conta.tipo,
                valor: conta.valor,
                data: proximaData,
                status: "pendente",
                recorrente: true,
                categoria: conta.categoria || null,
                descricao: conta.descricao || null,
                fornecedor_id: conta.fornecedor_id || null,
                user_id: user.id,
              });

              toast({
                title: "Conta recorrente gerada",
                description: `A próxima parcela de "${conta.nome}" foi criada para ${proximoMes.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}.`,
              });

              await carregarContas();
            }
          }
        } catch (error) {
          console.error("Erro ao criar conta recorrente:", error);
        }
      }
    }

    return sucesso;
  };

  const marcarVariasComoPaga = async (ids: string[]) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const contasParaBaixa = contas.filter(c => ids.includes(c.id) && c.status === 'pendente');
      
      // Separar contas reais de virtuais (vendas)
      const contasReaisPagar = contasParaBaixa.filter(c => c.tipo === 'pagar' && !c.id.startsWith("venda_")).map(c => c.id);
      const contasReaisReceber = contasParaBaixa.filter(c => c.tipo === 'receber' && !c.id.startsWith("venda_")).map(c => c.id);
      const vendasVirtuais = contasParaBaixa.filter(c => c.id.startsWith("venda_"));

      if (contasReaisPagar.length > 0) {
        const { error } = await supabase
          .from("contas")
          .update({ status: 'pago' as any })
          .in("id", contasReaisPagar)
          .eq("user_id", user.id);
        if (error) throw error;
      }

      if (contasReaisReceber.length > 0) {
        const { error } = await supabase
          .from("contas")
          .update({ status: 'recebido' as any })
          .in("id", contasReaisReceber)
          .eq("user_id", user.id);
        if (error) throw error;
      }

      // Marcar vendas virtuais como recebidas
      if (vendasVirtuais.length > 0) {
        const vendaIds = vendasVirtuais.map(v => v.id.replace("venda_", ""));
        const { error } = await supabase
          .from("vendas")
          .update({ recebido: true, data_recebimento: new Date().toISOString() })
          .in("id", vendaIds)
          .eq("user_id", user.id);
        if (error) throw error;
      }

      toast({
        title: "Baixa realizada",
        description: `${contasParaBaixa.length} conta(s) marcada(s) como paga(s)/recebida(s).`,
      });

      await carregarContas();
      return true;
    } catch (error) {
      console.error("Erro ao dar baixa em massa:", error);
      toast({
        title: "Erro ao dar baixa",
        description: "Não foi possível dar baixa nas contas selecionadas.",
        variant: "destructive",
      });
      return false;
    }
  };

  useEffect(() => {
    carregarContas();
  }, [carregarContas]);

  return {
    contas,
    loading,
    criarConta,
    atualizarConta,
    excluirConta,
    marcarComoPaga,
    marcarVariasComoPaga,
    refetch: carregarContas,
  };
}
