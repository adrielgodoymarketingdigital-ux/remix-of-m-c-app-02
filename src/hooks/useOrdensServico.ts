import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { useFuncionarioPermissoes } from "./useFuncionarioPermissoes";
import { useEventDispatcher } from "./useEventDispatcher";
import { withRetry, classifyError, shouldSuppressToast } from "@/lib/supabase-retry";

export interface OrdemServico {
  id: string;
  numero_os: string;
  created_at: string;
  data_saida: string | null;
  defeito_relatado: string;
  total: number | null;
  status: string | null;
  dispositivo_modelo: string;
  dispositivo_imei: string | null;
  dispositivo_tipo: string;
  dispositivo_marca: string;
  dispositivo_cor: string | null;
  dispositivo_numero_serie: string | null;
  senha_desbloqueio?: string | null;
  avarias?: unknown;
  cliente_id: string;
  funcionario_id: string | null;
  tipo_servico_id: string | null;
  tempo_garantia: number | null;
  is_teste?: boolean;
  cliente?: {
    id: string;
    nome: string;
    telefone: string | null;
    cpf: string | null;
    endereco?: string | null;
    data_nascimento?: string | null;
  };
}

export interface ContadorOSMes {
  usadas: number;
  limite: number;
  percentual: number;
  ilimitado: boolean;
}

export const useOrdensServico = () => {
  const [ordensBase, setOrdensBase] = useState<OrdemServico[]>([]);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("todos");
  const [dataInicio, setDataInicio] = useState<Date | undefined>(() => startOfMonth(new Date()));
  const [dataFim, setDataFim] = useState<Date | undefined>(() => endOfMonth(new Date()));
  const [mesFiltro, setMesFiltro] = useState(() => format(new Date(), "yyyy-MM"));
  const [contadorOSMes, setContadorOSMes] = useState<ContadorOSMes>({
    usadas: 0,
    limite: -1,
    percentual: 0,
    ilimitado: true,
  });
  const [lucroOrdensEntregues, setLucroOrdensEntregues] = useState<number | null>(null);
  const { toast } = useToast();
  const { lojaUserId, isFuncionario, funcionarioId, permissoes } = useFuncionarioPermissoes();
  const { dispatchEvent } = useEventDispatcher();
  const resolvedUserIdRef = useRef<string | null>(null);
  const detalhesCacheRef = useRef<Record<string, OrdemServico>>({});

  const ordens = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return ordensBase;

    return ordensBase.filter((o: any) => {
      const nome = o.cliente?.nome?.toLowerCase() || '';
      const cpf = o.cliente?.cpf?.toLowerCase() || '';
      const imei = o.dispositivo_imei?.toLowerCase() || '';
      const modelo = o.dispositivo_modelo?.toLowerCase() || '';
      const marca = o.dispositivo_marca?.toLowerCase() || '';
      const numeroOs = o.numero_os?.toLowerCase() || '';
      const defeito = o.defeito_relatado?.toLowerCase() || '';

      return (
        nome.includes(termo) ||
        cpf.includes(termo) ||
        imei.includes(termo) ||
        modelo.includes(termo) ||
        marca.includes(termo) ||
        numeroOs.includes(termo) ||
        defeito.includes(termo)
      );
    });
  }, [busca, ordensBase]);

  const resolverUserId = useCallback(async (): Promise<string | null> => {
    if (resolvedUserIdRef.current) {
      return resolvedUserIdRef.current;
    }

    const { data, error } = await supabase.rpc('get_loja_owner_id');
    if (error) {
      console.error("Erro ao resolver userId via RPC:", error);
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return null;
      resolvedUserIdRef.current = (isFuncionario && lojaUserId) ? lojaUserId : user.id;
      return resolvedUserIdRef.current;
    }

    resolvedUserIdRef.current = data;
    return data;
  }, [isFuncionario, lojaUserId]);

  const aplicarFiltroMes = (mes: string) => {
    setMesFiltro(mes);
    if (mes === "todos") {
      setDataInicio(undefined);
      setDataFim(undefined);
    } else {
      const [ano, mesNum] = mes.split("-").map(Number);
      const dataReferencia = new Date(ano, mesNum - 1, 1);
      setDataInicio(startOfMonth(dataReferencia));
      setDataFim(endOfMonth(dataReferencia));
    }
  };

  const handleDataInicioChange = (data: Date | undefined) => {
    setDataInicio(data);
    setMesFiltro("todos");
  };

  const handleDataFimChange = (data: Date | undefined) => {
    setDataFim(data);
    setMesFiltro("todos");
  };

  const carregarContadorOS = useCallback(async (limite: number) => {
    try {
      const userId = await resolverUserId();
      if (!userId) return;

      const inicioMes = startOfMonth(new Date());
      const fimMes = endOfMonth(new Date());

      const { count, error } = await supabase
        .from("ordens_servico")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_teste", false)
        .is("deleted_at", null)
        .gte("created_at", inicioMes.toISOString())
        .lte("created_at", fimMes.toISOString());

      if (error) throw error;

      const usadas = count || 0;
      const ilimitado = limite === -1;
      const percentual = ilimitado ? 0 : Math.min(100, (usadas / limite) * 100);

      setContadorOSMes({
        usadas,
        limite,
        percentual,
        ilimitado,
      });
    } catch (error) {
      console.error("Erro ao carregar contador de OS:", error);
    }
  }, [resolverUserId]);

  const carregarOrdens = useCallback(async () => {
    try {
      setLoading(true);

      const userId = await resolverUserId();
      if (!userId) {
        setLoading(false);
        return;
      }

      const resultado = await withRetry(async () => {
        let query = supabase
          .from("ordens_servico")
          .select(`
            id,
            numero_os,
            created_at,
            data_saida,
            defeito_relatado,
            total,
            status,
            dispositivo_modelo,
            dispositivo_imei,
            dispositivo_tipo,
            dispositivo_marca,
            dispositivo_cor,
            dispositivo_numero_serie,
            cliente_id,
            funcionario_id,
            tipo_servico_id,
            tempo_garantia,
            is_teste,
            cliente:clientes!ordens_servico_cliente_fkey(id, nome, telefone, cpf)
          `)
          .eq("user_id", userId)
          .eq("is_teste", false)
          .is("deleted_at", null);

        // Se é funcionário e NÃO tem permissão de ver todas as OS, filtrar apenas as dele
        if (isFuncionario && !permissoes?.recursos?.ver_todas_os && funcionarioId) {
          query = query.eq("funcionario_id", funcionarioId);
        }

        query = query.order("created_at", { ascending: false });

        if (statusFiltro !== "todos") {
          query = query.eq("status", statusFiltro as any);
        }

        if (dataInicio) {
          const ano = dataInicio.getFullYear();
          const mes = String(dataInicio.getMonth() + 1).padStart(2, '0');
          const dia = String(dataInicio.getDate()).padStart(2, '0');
          query = query.gte("created_at", `${ano}-${mes}-${dia}T00:00:00`);
        }

        if (dataFim) {
          const ano = dataFim.getFullYear();
          const mes = String(dataFim.getMonth() + 1).padStart(2, '0');
          const dia = String(dataFim.getDate()).padStart(2, '0');
          query = query.lte("created_at", `${ano}-${mes}-${dia}T23:59:59`);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
      }, 'useOrdensServico.carregarOrdens');

      detalhesCacheRef.current = {};
      setOrdensBase(resultado as OrdemServico[]);
    } catch (error) {
      if (!shouldSuppressToast(error)) {
        const { userMessage } = classifyError(error);
        toast({
          title: "Erro ao carregar ordens",
          description: userMessage,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  }, [statusFiltro, dataInicio, dataFim, toast, resolverUserId, isFuncionario, permissoes, funcionarioId]);

  const buscarOrdemCompleta = useCallback(async (id: string): Promise<OrdemServico | null> => {
    if (detalhesCacheRef.current[id]) {
      return detalhesCacheRef.current[id];
    }

    try {
      const userId = await resolverUserId();
      if (!userId) return null;

      const { data, error } = await supabase
        .from("ordens_servico")
        .select(`
          *,
          cliente:clientes!ordens_servico_cliente_fkey(id, nome, telefone, cpf, endereco, data_nascimento)
        `)
        .eq("id", id)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .single();

      if (error) throw error;
      detalhesCacheRef.current[id] = data as OrdemServico;
      return data as OrdemServico;
    } catch (error) {
      if (!shouldSuppressToast(error)) {
        const { userMessage } = classifyError(error);
        toast({
          title: "Erro ao abrir ordem",
          description: userMessage,
          variant: "destructive",
        });
      }
      return null;
    }
  }, [resolverUserId, toast]);

  const carregarLucroOrdensEntregues = useCallback(async () => {
    try {
      const userId = await resolverUserId();
      if (!userId) return;

      let query = supabase
        .from("ordens_servico")
        .select("avarias")
        .eq("user_id", userId)
        .eq("status", "entregue")
        .eq("is_teste", false)
        .is("deleted_at", null);

      if (dataInicio) {
        const inicioISO = dataInicio.toISOString().split('T')[0];
        query = query.gte("created_at", inicioISO);
      }

      if (dataFim) {
        const fimISO = dataFim.toISOString().split('T')[0] + "T23:59:59";
        query = query.lte("created_at", fimISO);
      }

      const { data, error } = await query;
      if (error) throw error;

      const lucro = (data || []).reduce((acc, ordem: any) => {
        const servicos = ordem?.avarias?.servicos_realizados || [];
        return acc + servicos.reduce((sum: number, s: any) => sum + (Number(s.preco || 0) - Number(s.custo || 0)), 0);
      }, 0);

      setLucroOrdensEntregues(lucro);
    } catch (error) {
      console.error("Erro ao carregar lucro das ordens:", error);
      setLucroOrdensEntregues(null);
    }
  }, [resolverUserId, dataInicio, dataFim]);

  const excluirOrdem = async (id: string) => {
    try {
      const userId = await resolverUserId();
      
      if (!userId) {
        toast({
          title: "Erro de autenticação",
          description: "Por favor, faça login novamente.",
          variant: "destructive",
        });
        return;
      }

      // Soft delete: preencher deleted_at e deleted_by ao invés de excluir
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("ordens_servico")
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user?.id || userId,
        } as any)
        .eq("id", id)
        .eq("user_id", userId);

      if (error) throw error;

      toast({
        title: "Ordem excluída",
        description: "A ordem de serviço foi excluída com sucesso.",
      });

      await carregarOrdens();
      await carregarLucroOrdensEntregues();
    } catch (error) {
      console.error("Erro ao excluir ordem:", error);
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir a ordem de serviço.",
        variant: "destructive",
      });
    }
  };

  const atualizarStatus = async (id: string, novoStatus: string) => {
    try {
      // Resolver userId via função do banco (mais confiável que estado React)
      const userId = await resolverUserId();
      
      if (!userId) {
        toast({
          title: "Erro de autenticação",
          description: "Por favor, faça login novamente.",
          variant: "destructive",
        });
        return;
      }
      
      console.log("atualizarStatus - userId resolvido via RPC:", userId, "isFuncionario:", isFuncionario, "lojaUserId:", lojaUserId);

      // 2. Buscar a ordem completa (somente do usuário atual)
      const { data: ordem, error: ordemError } = await supabase
        .from("ordens_servico")
        .select(`
          *,
          cliente:clientes!ordens_servico_cliente_fkey(nome)
        `)
        .eq("id", id)
        .eq("user_id", userId)
        .single();

      if (ordemError) throw ordemError;
      if (!ordem) throw new Error("Ordem não encontrada");

      const statusAnterior = ordem.status;
      const valorOrdem = ordem.total || 0;

      // 3. Atualizar o status da ordem (somente do usuário atual)
      const updateData: any = { status: novoStatus as any };
      
      // Preencher data_saida quando status muda para "entregue"
      if (novoStatus === "entregue") {
        updateData.data_saida = new Date().toISOString();
      }
      // Limpar data_saida se sair de "entregue" para outro status
      if (statusAnterior === "entregue" && novoStatus !== "entregue") {
        updateData.data_saida = null;
      }

      const { error: updateError, data: updateResult } = await supabase
        .from("ordens_servico")
        .update(updateData)
        .eq("id", id)
        .eq("user_id", userId)
        .select("id");

      if (updateError) throw updateError;
      if (!updateResult || updateResult.length === 0) {
        console.error("atualizarStatus - Nenhuma linha atualizada. id:", id, "userId:", userId);
        throw new Error("Nenhuma ordem foi atualizada. Verifique as permissões.");
      }

      // Disparar evento de notificação automática IMEDIATAMENTE após update bem-sucedido
      // (antes de carregarOrdens e processamento financeiro para evitar cancelamento por re-render)
      dispatchEvent("SERVICE_ORDER_UPDATED", {
        numero_os: ordem.numero_os,
        status: novoStatus,
      });

      // Recarregar ordens e lucros após disparar notificação
      await carregarOrdens();
      await carregarLucroOrdensEntregues();

      // 4. Integração com o financeiro baseado no novo status (em try-catch separado para não bloquear a UI)
      try {
        // 4.1 Se mudou para "aguardando_retirada" ou "em_andamento" → criar conta a receber (pendente)
        const statusQueGeraConta = ["aguardando_retirada", "em_andamento"];
        const statusAnteriorNaoGerava = !statusQueGeraConta.includes(statusAnterior || "");
        if (statusQueGeraConta.includes(novoStatus) && statusAnteriorNaoGerava) {
          const { data: contaExistenteCheck } = await supabase
            .from("contas")
            .select("id")
            .eq("user_id", userId)
            .eq("os_numero", ordem.numero_os)
            .eq("tipo", "receber")
            .maybeSingle();

          if (!contaExistenteCheck) {
            const avariasParaConta = ordem.avarias as any;
            const entradaPaga = avariasParaConta?.dados_pagamento?.entrada || 0;
            const saldoAReceber = valorOrdem - entradaPaga;

            await supabase.from("contas").insert({
              nome: `OS ${ordem.numero_os} - ${ordem.cliente?.nome || 'Cliente'}`,
              tipo: "receber",
              valor: saldoAReceber > 0 ? saldoAReceber : valorOrdem,
              data: new Date().toISOString().split('T')[0],
              status: "pendente",
              recorrente: false,
              categoria: "Serviços",
              descricao: `Ordem de Serviço ${ordem.numero_os} - ${ordem.defeito_relatado}${entradaPaga > 0 ? ` (Entrada paga: R$ ${entradaPaga.toFixed(2)})` : ''}`,
              user_id: userId,
              os_numero: ordem.numero_os,
              valor_pago: entradaPaga > 0 ? entradaPaga : null,
            });
          }
        }

        // 4.2 Se mudou para "entregue" → criar/atualizar conta como recebida
        if (novoStatus === "entregue" && statusAnterior !== "entregue") {
          const avariasData = ordem.avarias as any;
          const formaPagamento = avariasData?.dados_pagamento?.forma;
          const deveMarcarRecebido = formaPagamento !== 'a_prazo';

          let contaExistente: { id: string } | null = null;
          
          const { data: contaPorNumero } = await supabase
            .from("contas")
            .select("id")
            .eq("user_id", userId)
            .eq("os_numero", ordem.numero_os)
            .eq("tipo", "receber")
            .eq("status", "pendente")
            .maybeSingle();
          
          contaExistente = contaPorNumero;
          
          if (!contaExistente) {
            const { data: contaPorNome } = await supabase
              .from("contas")
              .select("id")
              .eq("user_id", userId)
              .ilike("nome", `%OS ${ordem.numero_os}%`)
              .eq("tipo", "receber")
              .eq("status", "pendente")
              .maybeSingle();
            contaExistente = contaPorNome;
          }

          if (contaExistente) {
            if (deveMarcarRecebido) {
              await supabase
                .from("contas")
                .update({ status: "recebido" })
                .eq("id", contaExistente.id);
            }
          } else if (deveMarcarRecebido) {
            await supabase.from("contas").insert({
              nome: `OS ${ordem.numero_os} - ${ordem.cliente?.nome || 'Cliente'}`,
              tipo: "receber",
              valor: valorOrdem,
              data: new Date().toISOString().split('T')[0],
              status: "recebido",
              recorrente: false,
              categoria: "Serviços",
              descricao: `Ordem de Serviço ${ordem.numero_os} - ${ordem.defeito_relatado}`,
              user_id: userId,
              os_numero: ordem.numero_os,
            });
          }
        }

        // 4.2.1 Se saiu de "entregue" para outro status (exceto estornado) → reverter conta para pendente
        if (statusAnterior === "entregue" && novoStatus !== "entregue" && novoStatus !== "estornado") {
          const { data: contaRecebida } = await supabase
            .from("contas")
            .select("id")
            .eq("user_id", userId)
            .eq("os_numero", ordem.numero_os)
            .eq("tipo", "receber")
            .eq("status", "recebido")
            .maybeSingle();

          if (contaRecebida) {
            await supabase
              .from("contas")
              .update({ status: "pendente" })
              .eq("id", contaRecebida.id);
          }
        }

        // 4.3 Se mudou para "estornado" → reverter financeiro e devolver peças ao estoque
        if (novoStatus === "estornado" && statusAnterior !== "estornado") {
          await supabase
            .from("contas")
            .delete()
            .eq("user_id", userId)
            .ilike("nome", `%OS ${ordem.numero_os}%`)
            .eq("tipo", "receber");

          const avariasData = ordem.avarias as any;
          const produtosUtilizados = avariasData?.produtos_utilizados || [];

          for (const produto of produtosUtilizados) {
            if (produto.tipo === 'peca') {
              const { data: pecaAtual } = await supabase
                .from("pecas")
                .select("quantidade")
                .eq("id", produto.id)
                .eq("user_id", userId)
                .maybeSingle();

              if (pecaAtual) {
                await supabase
                  .from("pecas")
                  .update({ quantidade: (pecaAtual.quantidade || 0) + produto.quantidade })
                  .eq("id", produto.id)
                  .eq("user_id", userId);
              }
            } else if (produto.tipo === 'produto') {
              const { data: produtoAtual } = await supabase
                .from("produtos")
                .select("quantidade")
                .eq("id", produto.id)
                .eq("user_id", userId)
                .maybeSingle();

              if (produtoAtual) {
                await supabase
                  .from("produtos")
                  .update({ quantidade: (produtoAtual.quantidade || 0) + produto.quantidade })
                  .eq("id", produto.id)
                  .eq("user_id", userId);
              }
            }
          }

          toast({
            title: "Ordem estornada",
            description: "O valor foi removido dos relatórios e as peças foram devolvidas ao estoque.",
          });
        } else {
          toast({
            title: "Status atualizado",
            description: "O status da ordem foi atualizado com sucesso.",
          });
        }

      } catch (finError) {
        console.error("Erro na integração financeira (status já atualizado):", finError);
        toast({
          title: "Status atualizado",
          description: "Status alterado, mas houve um erro ao atualizar o financeiro.",
        });
      }
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível atualizar o status da ordem.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    carregarOrdens();
  }, [carregarOrdens]);

  useEffect(() => {
    carregarLucroOrdensEntregues();
  }, [carregarLucroOrdensEntregues]);

  const importarOSEmLote = async (ordens: Array<{
    cliente_nome: string;
    cliente_telefone?: string;
    dispositivo_tipo: string;
    dispositivo_marca: string;
    dispositivo_modelo: string;
    dispositivo_imei?: string;
    dispositivo_cor?: string;
    defeito_relatado: string;
    status?: string;
    total?: number;
    data_abertura?: string;
  }>): Promise<{ inseridas: number; clientesCriados: number; erros: number }> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Sessão expirada");

    const userId = (isFuncionario && lojaUserId) ? lojaUserId : session.user.id;

    let inseridas = 0;
    let clientesCriados = 0;
    let erros = 0;

    // Cache de clientes existentes
    const { data: clientesExistentes } = await supabase
      .from("clientes")
      .select("id, nome, telefone")
      .eq("user_id", userId);

    const cacheClientes = new Map<string, string>();
    clientesExistentes?.forEach(c => {
      cacheClientes.set(c.nome.toLowerCase().trim(), c.id);
    });

    for (const os of ordens) {
      try {
        // Buscar ou criar cliente
        const nomeNorm = os.cliente_nome.toLowerCase().trim();
        let clienteId = cacheClientes.get(nomeNorm);

        if (!clienteId) {
          const { data: novoCliente, error: errCliente } = await supabase
            .from("clientes")
            .insert({
              nome: os.cliente_nome,
              telefone: os.cliente_telefone || null,
              user_id: userId,
            })
            .select("id")
            .single();

          if (errCliente || !novoCliente) {
            erros++;
            continue;
          }
          clienteId = novoCliente.id;
          cacheClientes.set(nomeNorm, clienteId);
          clientesCriados++;
        }

        // Gerar número da OS
        const { data: numeroOS, error: numErr } = await supabase
          .rpc("generate_os_number", { p_user_id: userId });

        if (numErr || !numeroOS) {
          erros++;
          continue;
        }

        // Mapear status
        let statusFinal = 'aberta';
        if (os.status) {
          const s = os.status.toLowerCase().trim();
          const statusMap: Record<string, string> = {
            'aberta': 'aberta', 'aberto': 'aberta',
            'em_andamento': 'em_andamento', 'em andamento': 'em_andamento', 'andamento': 'em_andamento',
            'orcamento': 'orcamento', 'orçamento': 'orcamento',
            'aprovado': 'aprovado', 'aprovada': 'aprovado',
            'concluida': 'concluida', 'concluído': 'concluida', 'concluída': 'concluida', 'finalizada': 'concluida',
            'entregue': 'entregue',
            'cancelada': 'cancelada', 'cancelado': 'cancelada',
          };
          statusFinal = statusMap[s] || 'aberta';
        }

        const { error: insertErr } = await supabase.from("ordens_servico").insert([{
          numero_os: numeroOS,
          cliente_id: clienteId,
          user_id: userId,
          dispositivo_tipo: os.dispositivo_tipo || 'celular',
          dispositivo_marca: os.dispositivo_marca,
          dispositivo_modelo: os.dispositivo_modelo,
          dispositivo_imei: os.dispositivo_imei || null,
          dispositivo_cor: os.dispositivo_cor || null,
          defeito_relatado: os.defeito_relatado,
          status: statusFinal as any,
          total: os.total || null,
          created_at: os.data_abertura ? new Date(os.data_abertura).toISOString() : new Date().toISOString(),
        }]);

        if (insertErr) {
          console.error("Erro ao inserir OS:", insertErr);
          erros++;
        } else {
          inseridas++;
        }
      } catch (e) {
        console.error("Erro ao processar OS:", e);
        erros++;
      }
    }

    await carregarOrdens();
    return { inseridas, clientesCriados, erros };
  };

  return {
    ordens,
    loading,
    busca,
    setBusca,
    statusFiltro,
    setStatusFiltro,
    dataInicio,
    setDataInicio: handleDataInicioChange,
    dataFim,
    setDataFim: handleDataFimChange,
    mesFiltro,
    aplicarFiltroMes,
    carregarOrdens,
    buscarOrdemCompleta,
    excluirOrdem,
    atualizarStatus,
    contadorOSMes,
    carregarContadorOS,
    lucroOrdensEntregues,
    carregarLucroOrdensEntregues,
    importarOSEmLote,
  };
};
