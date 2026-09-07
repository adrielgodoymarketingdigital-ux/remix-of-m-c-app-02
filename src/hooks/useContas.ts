import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Conta, FormularioConta, PagamentoConta } from "@/types/conta";
import { useToast } from "@/hooks/use-toast";
import { withRetry, classifyError, shouldSuppressToast } from "@/lib/supabase-retry";
import { useResolvedUserId, useEmpresaInfo } from "./useResolvedUserId";
import { excluirContaPorId } from "@/lib/contas/excluirContaPorId";
import { propagarStatusContaParaVenda } from "@/lib/vendas/reconhecerSegundaForma";

export function useContas(filtros?: { inicio?: Date; fim?: Date }) {
  const [contas, setContas] = useState<Conta[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const resolvedUserIdFromContext = useResolvedUserId();
  const { empresaId: empresaFiltro, isFilial } = useEmpresaInfo();

  const carregarContas = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        setLoading(false);
        return;
      }

      const targetUserId = resolvedUserIdFromContext ?? user.id;

      let query = supabase
        .from("contas")
        .select("*, cliente:clientes!contas_cliente_id_fkey(nome)")
        .eq("user_id", targetUserId)
        .order("data", { ascending: false });
      if (empresaFiltro) {
        query = isFilial
          ? query.eq("empresa_id", empresaFiltro)
          : query.or(`empresa_id.eq.${empresaFiltro},empresa_id.is.null`);
      }

      if (filtros?.inicio) {
        query = query.gte("data", filtros.inicio.toISOString().split("T")[0]);
      }
      if (filtros?.fim) {
        query = query.lte("data", filtros.fim.toISOString().split("T")[0]);
      }

      // Carregar contas, vendas a_receber e OS excluídas em paralelo com retry
      // Vendas virtuais não são incluídas quando há filtro de empresa (tabela vendas não tem empresa_id)
      const [contasResult, vendasResult, osExcluidasResult] = await Promise.all([
        withRetry(async () => {
          const r = await Promise.resolve(query);
          if (r.error) throw r.error;
          return r;
        }, 'useContas.queryContas'),
        empresaFiltro
          ? Promise.resolve({ data: [] })
          : withRetry(async () => {
              const r = await supabase
                .from("vendas")
                .select("id, data, total, forma_pagamento, data_prevista_recebimento, recebido, data_recebimento, parcela_numero, total_parcelas, cancelada, user_id, cliente_id, tipo, produto_id, dispositivo_id, peca_id, clientes!vendas_cliente_fkey(nome), produtos(nome), dispositivos(marca, modelo), pecas(nome)")
                .eq("user_id", targetUserId)
                .in("forma_pagamento", ["a_receber", "a_prazo"])
                .eq("cancelada", false);
              if (r.error) throw r.error;
              return r;
            }, 'useContas.queryVendasAReceber'),
        withRetry(async () => {
          const r = await supabase
            .from("ordens_servico")
            .select("numero_os")
            .eq("user_id", targetUserId)
            .not("deleted_at", "is", null);
          if (r.error) throw r.error;
          return r;
        }, 'useContas.queryOSExcluidas'),
      ]);

      // Normaliza o embed `cliente:{nome}` para o campo plano `cliente_nome`.
      const contasData = ((contasResult.data || []) as Array<Record<string, unknown>>).map((c) => {
        const { cliente, ...resto } = c as { cliente?: { nome?: string } | null };
        return { ...resto, cliente_nome: cliente?.nome ?? undefined } as Conta;
      });

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

        const dataVenda = v.recebido && v.data_recebimento
          ? v.data_recebimento.split("T")[0]
          : v.data_prevista_recebimento || (v.data ? v.data.split("T")[0] : new Date().toISOString().split("T")[0]);

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
          usa_historico_pagamentos: false,
          cliente_nome: v.clientes?.nome || undefined,
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
  }, [filtros, toast, resolvedUserIdFromContext, empresaFiltro]);

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

      const targetUserId = resolvedUserIdFromContext ?? user.id;
      // Toda conta criada a partir de agora usa o histórico de pagamentos
      // (recebimento parcial + recibo). Contas antigas seguem com a flag false.
      const insertData: Record<string, unknown> = {
        ...dados,
        user_id: targetUserId,
        usa_historico_pagamentos: true,
      };
      if (empresaFiltro) insertData.empresa_id = empresaFiltro;
      const { error } = await supabase.from("contas").insert(insertData);

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

      const targetUserId = resolvedUserIdFromContext ?? user.id;

      // Se é uma conta virtual de venda, atualizar a venda
      if (id.startsWith("venda_")) {
        const vendaId = id.replace("venda_", "");
        if (dados.status === "recebido") {
          const { error } = await supabase
            .from("vendas")
            .update({ recebido: true, data_recebimento: new Date().toISOString() })
            .eq("id", vendaId)
            .eq("user_id", targetUserId);
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
        .eq("user_id", targetUserId);

      if (error) throw error;

      // Se a conta é uma Conta a Receber vinculada a uma venda ("venda_id:" na
      // descricao) e mudou para recebido/pendente, propagar para a linha da
      // venda: reconhecimento diferido da 2ª forma de pagamento "a receber"
      // (pagamento duplo) e recebimento de vendas a_receber primárias.
      if (dados.status === "recebido" || dados.status === "pendente") {
        const { data: contaAtual } = await supabase
          .from("contas")
          .select("descricao, tipo, data_pagamento")
          .eq("id", id)
          .maybeSingle();
        if (contaAtual) {
          await propagarStatusContaParaVenda(
            {
              descricao: contaAtual.descricao,
              tipo: contaAtual.tipo,
              data_pagamento:
                (dados as { data_pagamento?: string | null }).data_pagamento ??
                contaAtual.data_pagamento,
            },
            dados.status,
            targetUserId,
          );
        }
      }

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

      const targetUserId = resolvedUserIdFromContext ?? user.id;

      // Contas virtuais de venda não podem ser excluídas
      if (id.startsWith("venda_")) {
        toast({
          title: "Não é possível excluir",
          description: "Esta conta é gerada automaticamente a partir de uma venda. Edite a venda para alterar.",
          variant: "destructive",
        });
        return false;
      }

      await excluirContaPorId(id, targetUserId);

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

  const listarPagamentos = async (contaId: string): Promise<PagamentoConta[]> => {
    const { data, error } = await supabase
      .from("pagamentos_contas")
      .select("*")
      .eq("conta_id", contaId)
      .order("data_pagamento", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) {
      console.error("Erro ao listar pagamentos:", error);
      return [];
    }
    return (data || []) as PagamentoConta[];
  };

  // Registra um recebimento/pagamento parcial numa conta do modelo novo.
  // O trigger sync_conta_from_pagamentos recalcula valor_pago/status.
  const registrarPagamentoParcial = async (
    contaId: string,
    dados: { valor: number; forma?: string; data: string; observacao?: string },
  ): Promise<{ ok: boolean; quitou: boolean }> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { ok: false, quitou: false };
      const targetUserId = resolvedUserIdFromContext ?? user.id;

      const { data: conta } = await supabase
        .from("contas")
        .select("user_id, empresa_id, tipo, descricao, valor, valor_pago")
        .eq("id", contaId)
        .maybeSingle();
      if (!conta) return { ok: false, quitou: false };

      const { error } = await supabase.from("pagamentos_contas").insert({
        conta_id: contaId,
        user_id: conta.user_id,
        empresa_id: conta.empresa_id ?? null,
        valor: dados.valor,
        data_pagamento: dados.data,
        forma_pagamento: dados.forma || null,
        observacao: dados.observacao || null,
      });
      if (error) throw error;

      // Relê a conta para ver se o trigger fechou o saldo.
      const { data: contaPos } = await supabase
        .from("contas")
        .select("status, data_pagamento, descricao, tipo")
        .eq("id", contaId)
        .maybeSingle();

      const quitou = contaPos?.status === "recebido" || contaPos?.status === "pago";
      if (quitou && contaPos) {
        await propagarStatusContaParaVenda(
          { descricao: contaPos.descricao, tipo: contaPos.tipo, data_pagamento: contaPos.data_pagamento },
          "recebido",
          targetUserId,
        );
      }

      window.dispatchEvent(new CustomEvent("conta-atualizada"));
      await carregarContas();
      toast({
        title: quitou ? "Conta quitada" : "Recebimento registrado",
        description: quitou ? "O saldo foi zerado." : "Pagamento parcial registrado. O saldo foi atualizado.",
      });
      return { ok: true, quitou };
    } catch (error) {
      console.error("Erro ao registrar pagamento parcial:", error);
      toast({
        title: "Erro ao registrar pagamento",
        description: "Não foi possível registrar o recebimento.",
        variant: "destructive",
      });
      return { ok: false, quitou: false };
    }
  };

  // Estorna (soft-delete) um pagamento. O trigger recalcula: se a conta estava
  // quitada e o estorno reabre saldo, ela volta para 'pendente'.
  const estornarPagamento = async (pagamentoId: string, motivo: string): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      const targetUserId = resolvedUserIdFromContext ?? user.id;

      const { data: pag } = await supabase
        .from("pagamentos_contas")
        .select("conta_id")
        .eq("id", pagamentoId)
        .maybeSingle();

      const { error } = await supabase
        .from("pagamentos_contas")
        .update({ estornado: true, estornado_em: new Date().toISOString(), estornado_motivo: motivo || null })
        .eq("id", pagamentoId);
      if (error) throw error;

      if (pag?.conta_id) {
        const { data: contaPos } = await supabase
          .from("contas")
          .select("status, descricao, tipo, data_pagamento")
          .eq("id", pag.conta_id)
          .maybeSingle();
        // Se voltou a ficar pendente, reverte o reconhecimento na venda vinculada.
        if (contaPos?.status === "pendente") {
          await propagarStatusContaParaVenda(
            { descricao: contaPos.descricao, tipo: contaPos.tipo, data_pagamento: contaPos.data_pagamento },
            "pendente",
            targetUserId,
          );
        }
      }

      window.dispatchEvent(new CustomEvent("conta-atualizada"));
      await carregarContas();
      toast({ title: "Pagamento estornado", description: "O saldo da conta foi recalculado." });
      return true;
    } catch (error) {
      console.error("Erro ao estornar pagamento:", error);
      toast({ title: "Erro ao estornar", description: "Não foi possível estornar o pagamento.", variant: "destructive" });
      return false;
    }
  };

  const marcarComoPaga = async (id: string, tipo: 'pagar' | 'receber', formaPagamento?: string) => {
    // Se é uma conta virtual de venda, marcar a venda como recebida
    if (id.startsWith("venda_") && tipo === "receber") {
      return await atualizarConta(id, { status: "recebido" });
    }

    // Conta do modelo novo: quitar = registrar um pagamento do valor do saldo.
    const contaAlvo = contas.find(c => c.id === id);
    if (contaAlvo?.usa_historico_pagamentos) {
      const saldo = Math.max(Number(contaAlvo.valor) - Number(contaAlvo.valor_pago || 0), 0);
      if (saldo <= 0.005) {
        toast({ title: "Conta já quitada", description: "Não há saldo a receber/pagar." });
        return true;
      }
      const res = await registrarPagamentoParcial(id, {
        valor: saldo,
        forma: formaPagamento,
        data: new Date().toISOString().slice(0, 10),
        observacao: "Quitação",
      });
      return res.ok;
    }

    const status = tipo === 'pagar' ? 'pago' : 'recebido';
    const hoje = new Date().toISOString().slice(0, 10);
    const sucesso = await atualizarConta(id, {
      status,
      data_pagamento: hoje,
      ...(formaPagamento ? { forma_pagamento: formaPagamento } : {}),
    });

    if (sucesso) {
      window.dispatchEvent(new CustomEvent("conta-atualizada"));
      const conta = contas.find(c => c.id === id);
      if (conta?.recorrente) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const targetUserId = resolvedUserIdFromContext ?? user.id;
            const dataAtual = new Date(conta.data);
            const proximoMes = new Date(dataAtual.getFullYear(), dataAtual.getMonth() + 1, dataAtual.getDate());
            const proximaData = `${proximoMes.getFullYear()}-${String(proximoMes.getMonth() + 1).padStart(2, '0')}-${String(proximoMes.getDate()).padStart(2, '0')}`;

            const { data: existente } = await supabase
              .from("contas")
              .select("id")
              .eq("user_id", targetUserId)
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
                user_id: targetUserId,
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

      const targetUserId = resolvedUserIdFromContext ?? user.id;

      const contasParaBaixa = contas.filter(c => ids.includes(c.id) && c.status === 'pendente');

      const hoje = new Date().toISOString().slice(0, 10);

      // Contas do modelo novo: quitar = 1 linha de "Quitação" (= saldo) por conta.
      const contasHistorico = contasParaBaixa.filter(c => c.usa_historico_pagamentos && !c.id.startsWith("venda_"));
      for (const conta of contasHistorico) {
        const saldo = Math.max(Number(conta.valor) - Number(conta.valor_pago || 0), 0);
        if (saldo > 0.005) {
          await registrarPagamentoParcial(conta.id, { valor: saldo, data: hoje, observacao: "Quitação" });
        }
      }

      // Contas do modelo antigo (comportamento inalterado)
      const contasAntigas = contasParaBaixa.filter(c => !c.usa_historico_pagamentos);
      const contasReaisPagar = contasAntigas.filter(c => c.tipo === 'pagar' && !c.id.startsWith("venda_")).map(c => c.id);
      const contasReaisReceber = contasAntigas.filter(c => c.tipo === 'receber' && !c.id.startsWith("venda_")).map(c => c.id);
      const vendasVirtuais = contasAntigas.filter(c => c.id.startsWith("venda_"));

      if (contasReaisPagar.length > 0) {
        const { error } = await supabase
          .from("contas")
          .update({ status: 'pago' as any, data_pagamento: hoje })
          .in("id", contasReaisPagar)
          .eq("user_id", targetUserId);
        if (error) throw error;
      }

      if (contasReaisReceber.length > 0) {
        const { error } = await supabase
          .from("contas")
          .update({ status: 'recebido' as any, data_pagamento: hoje })
          .in("id", contasReaisReceber)
          .eq("user_id", targetUserId);
        if (error) throw error;

        // Propagar recebimento para vendas vinculadas (2ª forma de pagamento
        // "a receber" / vendas a_receber primárias)
        const idsReais = new Set(contasReaisReceber);
        for (const conta of contasParaBaixa) {
          if (idsReais.has(conta.id)) {
            await propagarStatusContaParaVenda(
              { descricao: conta.descricao, tipo: conta.tipo, data_pagamento: hoje },
              "recebido",
              targetUserId,
            );
          }
        }
      }

      // Marcar vendas virtuais como recebidas
      if (vendasVirtuais.length > 0) {
        const vendaIds = vendasVirtuais.map(v => v.id.replace("venda_", ""));
        const { error } = await supabase
          .from("vendas")
          .update({ recebido: true, data_recebimento: new Date().toISOString() })
          .in("id", vendaIds)
          .eq("user_id", targetUserId);
        if (error) throw error;
      }

      toast({
        title: "Baixa realizada",
        description: `${contasParaBaixa.length} conta(s) marcada(s) como paga(s)/recebida(s).`,
      });

      window.dispatchEvent(new CustomEvent("conta-atualizada"));
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
    registrarPagamentoParcial,
    estornarPagamento,
    listarPagamentos,
    refetch: carregarContas,
  };
}
