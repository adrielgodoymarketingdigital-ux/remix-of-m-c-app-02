import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Venda, ResumoVendas, VendasPorPeriodo, ResumoAReceber } from "@/types/venda";
import { useToast } from "@/hooks/use-toast";
import { useEventDispatcher } from "@/hooks/useEventDispatcher";
import { withRetry, shouldSuppressToast } from "@/lib/supabase-retry";
import { dataHoje, extrairDataLocal } from "@/lib/formatters";
import { limitesDiaBrasilia } from "@/lib/dataBrasilia";
import { useFuncionarioPermissoes } from "./useFuncionarioPermissoes";
import { useIdentidade } from "./useResolvedUserId";
import { useFormasPagamentoCustomizadas } from "./useFormasPagamentoCustomizadas";
import { excluirContaPorId } from "@/lib/contas/excluirContaPorId";
import { isVendaDeItemOS } from "@/lib/caixa/servicosCaixa";
import { cancelarSecundariasEmCascata, type ResultadoCascata } from "@/lib/vendas/cancelarSecundariasEmCascata";
import { AcaoAparelhoTroca, bloqueioEditarVendaComTroca, decidirCancelamentoTroca, MENSAGEM_APARELHO_TROCA_VENDIDO, MENSAGEM_EDITAR_VENDA_COM_TROCA } from "@/lib/vendas/trocaPDV";
import i18n from "@/lib/i18n/instancia";
import { carregarTrocaDaVenda, marcarTrocaCancelada, tirarAparelhoDaTrocaDoEstoque } from "@/lib/vendas/cancelamentoTroca";

/** Campos de uma linha de venda que o cancelamento usa (estorno de estoque e cascata). */
interface LinhaCancelamento {
  id: string;
  tipo: string;
  user_id: string | null;
  grupo_venda?: string | null;
  observacoes?: string | null;
  dispositivo_id: string | null;
  produto_id: string | null;
  peca_id: string | null;
  quantidade: number;
}
import { reconhecerRecebimentoVendaVinculada } from "@/lib/vendas/reconhecerSegundaForma";
import { alterarDataVenda as alterarDataVendaNoBanco } from "@/lib/vendas/alterarDataVenda";
import { SELECT_VENDA_COM_ITENS } from "@/lib/vendas/itensVenda";

const ehAReceber = (forma: string | null | undefined) => forma === "a_receber" || forma === "a_prazo";

/**
 * Venda com troca "a receber": anexa a cada linha o valor da sua conta a
 * receber (o que o cliente paga), para a tela de Vendas. Sem linhas assim,
 * não consulta nada e devolve a mesma lista.
 */
async function anexarContasDaTroca(lista: Venda[], userId: string): Promise<Venda[]> {
  const ids = lista.filter((v) => v.valor_troca != null && ehAReceber(v.forma_pagamento)).map((v) => v.id);
  if (ids.length === 0) return lista;
  const valorPorVenda = new Map<string, number>();
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await supabase
      .from("contas")
      .select("descricao, valor")
      .eq("user_id", userId)
      .eq("tipo", "receber")
      .in("descricao", ids.slice(i, i + 100).map((id) => `venda_id:${id}`));
    if (error) {
      console.error("[useVendas] etapa=contas das vendas com troca", error);
      return lista;
    }
    for (const c of data ?? []) {
      if (c.descricao) valorPorVenda.set(c.descricao.replace("venda_id:", ""), Number(c.valor));
    }
  }
  return lista.map((v) => (valorPorVenda.has(v.id) ? { ...v, valor_conta_receber: valorPorVenda.get(v.id) } : v));
}

// Toasts e erros mostrados na tela: lidos na hora (saem depois de um await; ver convencoes.md, item 10).
const tV = (chave: string, opcoes?: Record<string, unknown>) => i18n.t(chave, { ns: "vendas", ...opcoes });

export const useVendas = () => {
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [todasVendas, setTodasVendas] = useState<Venda[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { dispatchEvent } = useEventDispatcher();
  const { lojaUserId, isFuncionario } = useFuncionarioPermissoes();
  const { userId: resolvedUserIdFromContext, empresaId: empresaFiltro, carregando: identidadeCarregando, isFilial } = useIdentidade();
  const { formas: formasCustomizadas } = useFormasPagamentoCustomizadas(empresaFiltro);

  const resolverFormaPagamentoBanco = (forma: string): string =>
    forma.startsWith("custom_") ? "outro" : forma;

  const getLabelFormaCustomizada = (forma: string): string | null => {
    if (!forma.startsWith("custom_")) return null;
    const id = forma.replace("custom_", "");
    return formasCustomizadas.find((f) => f.id === id)?.nome || null;
  };

  const carregarVendas = async (dataInicio?: string, dataFim?: string) => {
    if (identidadeCarregando) return;
    try {
      setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) { setLoading(false); return; }

      // Limites do período em instantes UTC exatos do dia de Brasília (mesmo
      // helper dos Relatórios, ecf7401) — não depende do fuso do navegador.
      const inicioISO = dataInicio ? limitesDiaBrasilia(dataInicio).inicioISO : null;
      const fimISO = dataFim ? limitesDiaBrasilia(dataFim).fimISO : null;

      // Usa || em vez de ?? para que null (estado de carregamento) também acione o fallback.
      // ?? só ignora undefined; || ignora null e undefined — necessário porque selfId
      // começa como null no useIdentidade antes de resolver o auth.getUser().
      const resolvedUserId = resolvedUserIdFromContext || (isFuncionario && lojaUserId ? lojaUserId : user.id);

      // Carregar vendas normais (somente do usuário logado)
      let queryVendas = supabase
        .from("vendas")
        .select(SELECT_VENDA_COM_ITENS)
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

      // `data` em vendas é TIMESTAMPTZ — comparar com instantes UTC do dia de Brasília.
      if (inicioISO) queryVendas = queryVendas.gte("data", inicioISO);
      if (fimISO) queryVendas = queryVendas.lte("data", fimISO);

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
        .in("status", ["finalizado", "entregue", "garantia"])
        .order("data_saida", { ascending: false, nullsFirst: false });

      if (empresaFiltro) {
        queryOrdens = isFilial
          ? queryOrdens.eq("empresa_id", empresaFiltro)
          : queryOrdens.or(`empresa_id.eq.${empresaFiltro},empresa_id.is.null`);
      } else if (!isFilial) {
        queryOrdens = queryOrdens.is("empresa_id", null);
      }

      // OS: data_saida (entregue) ou, sem ela, created_at — instantes UTC do dia de Brasília.
      // Valores entre aspas: o ISO tem "." e ":" dentro do filtro or() do PostgREST.
      if (inicioISO && fimISO) {
        queryOrdens = queryOrdens.or(
          `and(data_saida.not.is.null,data_saida.gte."${inicioISO}",data_saida.lte."${fimISO}"),and(data_saida.is.null,created_at.gte."${inicioISO}",created_at.lte."${fimISO}")`
        );
      } else if (inicioISO) {
        queryOrdens = queryOrdens.or(
          `and(data_saida.not.is.null,data_saida.gte."${inicioISO}"),and(data_saida.is.null,created_at.gte."${inicioISO}")`
        );
      } else if (fimISO) {
        queryOrdens = queryOrdens.or(
          `and(data_saida.not.is.null,data_saida.lte."${fimISO}"),and(data_saida.is.null,created_at.lte."${fimISO}")`
        );
      }

      // Query vendas avulsas com o mesmo filtro de data
      let queryVendasAvulsas = supabase
        .from("vendas_avulsas" as any)
        .select("id, descricao, valor, forma_pagamento, observacao, created_at, user_id")
        .eq("user_id", resolvedUserId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (inicioISO) queryVendasAvulsas = queryVendasAvulsas.gte("created_at", inicioISO);
      if (fimISO) queryVendasAvulsas = queryVendasAvulsas.lte("created_at", fimISO);

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
          valor_troca: v.valor_troca != null ? Number(v.valor_troca) : null,
        }));
        vendasData = await anexarContasDaTroca(vendasData, resolvedUserId);
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

      // Buscar contas a receber pendentes (saldo a prazo) vinculadas às OS exibidas
      const numerosOsExibidas = [...new Set(
        ordensData.map((o: any) => o.numero_os).filter(Boolean)
      )] as string[];

      const contaAPrazoPorOsMap = new Map<string, { id: string; valor: number; data_vencimento: string | null }>();
      if (numerosOsExibidas.length > 0) {
        const { data: contasAPrazo } = await supabase
          .from("contas")
          .select("id, valor, data_vencimento, os_numero")
          .eq("user_id", resolvedUserId)
          .eq("tipo", "receber")
          .eq("status", "pendente")
          .in("os_numero", numerosOsExibidas);

        (contasAPrazo || []).forEach((c: any) => {
          if (c.os_numero) {
            contaAPrazoPorOsMap.set(c.os_numero, { id: c.id, valor: Number(c.valor || 0), data_vencimento: c.data_vencimento });
          }
        });
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

        const dadosPagamento = avarias?.dados_pagamento;
        const entradaOS = Number(dadosPagamento?.entrada || 0);
        const saldoCancelado = dadosPagamento?.saldo_cancelado === true
          ? { valor: Number(ordem.total || 0) - entradaOS, canceladoEm: dadosPagamento?.saldo_cancelado_em ?? null }
          : null;

        return {
          id: ordem.id,
          // Mesma data usada no filtro (data_saida, senão created_at). Antes era
          // updated_at: OS editada depois aparecia com o dia da edição.
          data: ordem.data_saida || ordem.created_at,
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
          data_prevista_recebimento: contaAPrazoPorOsMap.get(ordem.numero_os)?.data_vencimento ?? null,
          contaAPrazoPendente: contaAPrazoPorOsMap.get(ordem.numero_os) ?? null,
          saldoCancelado,
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
          .in("status", ["finalizado", "entregue", "garantia"])
          .order("updated_at", { ascending: false });
        if (empresaFiltro) {
          allOrdensQuery = isFilial
            ? allOrdensQuery.eq("empresa_id", empresaFiltro)
            : allOrdensQuery.or(`empresa_id.eq.${empresaFiltro},empresa_id.is.null`);
        } else if (!isFilial) {
          allOrdensQuery = allOrdensQuery.is("empresa_id", null);
        }
        const { data: allOrdensData } = await allOrdensQuery;

        const numerosAllOsExibidas = [...new Set(
          (allOrdensData || []).map((o: any) => o.numero_os).filter(Boolean)
        )] as string[];

        const contaAPrazoPorAllOsMap = new Map<string, { id: string; valor: number; data_vencimento: string | null }>();
        if (numerosAllOsExibidas.length > 0) {
          const { data: allContasAPrazo } = await supabase
            .from("contas")
            .select("id, valor, data_vencimento, os_numero")
            .eq("user_id", resolvedUserId)
            .eq("tipo", "receber")
            .eq("status", "pendente")
            .in("os_numero", numerosAllOsExibidas);

          (allContasAPrazo || []).forEach((c: any) => {
            if (c.os_numero) {
              contaAPrazoPorAllOsMap.set(c.os_numero, { id: c.id, valor: Number(c.valor || 0), data_vencimento: c.data_vencimento });
            }
          });
        }

        const allOrdensComoVendas: Venda[] = (allOrdensData || []).map((ordem) => {
          const avarias = ordem.avarias as any;
          let custoTotal = 0;
          if (avarias?.servicos_realizados) {
            custoTotal += (avarias.servicos_realizados as any[]).reduce((acc: number, s: any) => acc + (s.custo || 0), 0);
          }
          if (avarias?.produtos_utilizados) {
            custoTotal += (avarias.produtos_utilizados as any[]).reduce((acc: number, p: any) => acc + ((p.custo_unitario || 0) * (p.quantidade || 1)), 0);
          }

          const dadosPagamento = avarias?.dados_pagamento;
          const entradaOS = Number(dadosPagamento?.entrada || 0);
          const saldoCancelado = dadosPagamento?.saldo_cancelado === true
            ? { valor: Number(ordem.total || 0) - entradaOS, canceladoEm: dadosPagamento?.saldo_cancelado_em ?? null }
            : null;

          return {
            id: ordem.id,
            // Mesma data usada no filtro (data_saida, senão created_at). Antes era
          // updated_at: OS editada depois aparecia com o dia da edição.
          data: ordem.data_saida || ordem.created_at,
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
            data_prevista_recebimento: contaAPrazoPorAllOsMap.get(ordem.numero_os)?.data_vencimento ?? null,
            contaAPrazoPendente: contaAPrazoPorAllOsMap.get(ordem.numero_os) ?? null,
            saldoCancelado,
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
            valor_troca: v.valor_troca != null ? Number(v.valor_troca) : null,
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

        const allCombined = [...await anexarContasDaTroca(allVendasNormalizadas, resolvedUserId), ...allOrdensComoVendas, ...allAvulsasComoVendas];
        allCombined.sort((a, b) => extrairDataLocal(b.data).localeCompare(extrairDataLocal(a.data)));
        setTodasVendas(allCombined);
      } else {
        setTodasVendas(todasAsVendas);
      }
    } catch (error) {
      if (!shouldSuppressToast(error)) {
        console.error("[useVendas.carregarVendas]", { error, timestamp: new Date().toISOString() });
        toast({
          title: tV("avisos.erroCarregarTitulo"),
          description: tV("avisos.erroCarregarDescricao"),
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const cancelarContaAPrazoOS = async (contaId: string, ordemId: string): Promise<boolean> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return false;

      const resolvedUserId = resolvedUserIdFromContext || (isFuncionario && lojaUserId ? lojaUserId : user.id);

      await excluirContaPorId(contaId, resolvedUserId);

      const { data: ordemAtual, error: fetchError } = await supabase
        .from("ordens_servico")
        .select("avarias")
        .eq("id", ordemId)
        .eq("user_id", resolvedUserId)
        .single();
      if (fetchError) throw fetchError;

      const avariasAtuais = (ordemAtual?.avarias as any) || {};
      const novasAvarias = {
        ...avariasAtuais,
        dados_pagamento: {
          ...(avariasAtuais.dados_pagamento || {}),
          saldo_cancelado: true,
          saldo_cancelado_em: new Date().toISOString(),
        },
      };

      const { error: updateError } = await supabase
        .from("ordens_servico")
        .update({ avarias: novasAvarias })
        .eq("id", ordemId)
        .eq("user_id", resolvedUserId);
      if (updateError) throw updateError;

      toast({
        title: tV("avisos.saldoCanceladoTitulo"),
        description: tV("avisos.saldoCanceladoDescricao"),
      });

      window.dispatchEvent(new CustomEvent("conta-atualizada"));
      await carregarVendas();
      return true;
    } catch (error) {
      console.error("Erro ao cancelar saldo a prazo:", error);
      toast({
        title: tV("avisos.erroCancelarSaldoTitulo"),
        description: tV("avisos.erroCancelarSaldoDescricao"),
        variant: "destructive",
      });
      return false;
    }
  };

  const cancelarVenda = async (
    vendaId: string,
    estornarEstoque: boolean,
    motivo?: string,
    /** O que fazer com o aparelho recebido na troca (venda com troca é cancelada inteira). */
    acaoAparelhoTroca: AcaoAparelhoTroca | null = null,
  ): Promise<boolean> => {
    try {
      // Buscar dados da venda
      const vendaOriginal = vendas.find((v) => v.id === vendaId);
      if (!vendaOriginal) {
        throw new Error(tV("avisos.vendaNaoEncontrada"));
      }

      // Serviços não podem ser cancelados por aqui (são ordens de serviço)
      if (vendaOriginal.tipo === "servico") {
        toast({
          title: tV("avisos.servicoCancelarTitulo"),
          description: tV("avisos.servicoCancelarDescricao"),
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
        toast({ title: tV("avisos.avulsaCancelada") });
        await carregarVendas();
        return true;
      }

      // Troca: decide ANTES de mexer em qualquer coisa (aparelho já vendido bloqueia "tirar do estoque").
      const troca = await carregarTrocaDaVenda(vendaOriginal);
      const decisaoTroca = decidirCancelamentoTroca(troca, acaoAparelhoTroca);
      if (decisaoTroca.bloqueio) {
        toast({ title: tV("avisos.naoFoiPossivelCancelar"), description: decisaoTroca.bloqueio === MENSAGEM_APARELHO_TROCA_VENDIDO ? tV("cancelar.aparelhoJaVendido") : decisaoTroca.bloqueio, variant: "destructive" });
        return false;
      }

      // Venda com troca: cancelada INTEIRA (todas as linhas principais ativas,
      // estoque estornado 1× por item); sem troca, só a linha escolhida.
      const linhasACancelar: { linha: LinhaCancelamento; estornar: boolean }[] = decisaoTroca.cancelarVendaInteira
        ? troca.linhasParaCancelar
        : [{ linha: vendaOriginal, estornar: true }];
      const cascatas: ResultadoCascata[] = [];

      for (const { linha, estornar } of linhasACancelar) {
        // Estornar estoque se solicitado
        if (estornarEstoque && estornar) {
          if (linha.tipo === "dispositivo" && linha.dispositivo_id) {
            // Buscar quantidade atual do dispositivo
            const { data: dispositivo, error: fetchError } = await supabase
              .from("dispositivos")
              .select("quantidade")
              .eq("id", linha.dispositivo_id)
              .eq("user_id", linha.user_id)
              .single();

            if (fetchError) throw fetchError;

            const novaQuantidade = (dispositivo?.quantidade || 0) + linha.quantidade;

            const { error: estoqueError } = await supabase
              .from("dispositivos")
              .update({
                quantidade: novaQuantidade,
                vendido: false,
              })
              .eq("id", linha.dispositivo_id)
              .eq("user_id", linha.user_id);

            if (estoqueError) throw estoqueError;
          } else if (linha.tipo === "produto" && linha.produto_id) {
            // Buscar quantidade atual do produto
            const { data: produto, error: fetchError } = await supabase
              .from("produtos")
              .select("quantidade")
              .eq("id", linha.produto_id)
              .eq("user_id", linha.user_id)
              .single();

            if (fetchError) throw fetchError;

            const novaQuantidade = (produto?.quantidade || 0) + linha.quantidade;

            const { error: estoqueError } = await supabase
              .from("produtos")
              .update({
                quantidade: novaQuantidade,
              })
              .eq("id", linha.produto_id)
              .eq("user_id", linha.user_id);

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
          .eq("id", linha.id)
          .eq("user_id", linha.user_id);

        if (updateError) throw updateError;

        // Pagamento duplo: cancela junto as parcelas da 2ª forma (linhas secundárias)
        // e suas contas a receber pendentes. Se alguma parcela já foi recebida, não
        // mexe em nada — exige estorno manual (só avisa).
        cascatas.push(await cancelarSecundariasEmCascata(linha, {
          motivo: motivo ? `${motivo} (cancelamento da venda principal)` : null,
        }));
      }

      // Troca da venda: desfeita junto com a venda inteira (ver decidirCancelamentoTroca).
      if (decisaoTroca.marcarTrocaCancelada && troca.trocaId) {
        try {
          await marcarTrocaCancelada(troca.trocaId);
          if (decisaoTroca.removerAparelho && troca.dispositivoId) {
            await tirarAparelhoDaTrocaDoEstoque(troca.dispositivoId);
          }
        } catch (erroTroca) {
          console.error("[cancelamento] etapa=desfazer troca", { trocaId: troca.trocaId, erro: erroTroca });
          toast({
            title: tV("avisos.trocaNaoAtualizadaTitulo"),
            description: tV("avisos.trocaNaoAtualizadaDescricao"),
            variant: "destructive",
            duration: 15000,
          });
        }
      }

      const itensCancelados = linhasACancelar.filter((l) => l.estornar).length;
      toast({
        title: tV("avisos.canceladaTitulo"),
        description: decisaoTroca.cancelarVendaInteira
          ? `${tV("avisos.canceladaTrocaInteira", { count: itensCancelados })}${estornarEstoque ? tV("avisos.eEstoqueEstornado") : tV("avisos.ponto")}`
          : estornarEstoque
            ? tV("avisos.canceladaEstornada")
            : tV("avisos.canceladaSucesso"),
      });

      for (const cascata of cascatas) {
        if (cascata.status === "cancelado" && cascata.parcelasRecebidasParaRevisao === 0) {
          toast({
            title: tV("avisos.cascataTitulo"),
            description: tV("avisos.cascataDescricao", {
              linhas: cascata.secundariasCanceladas,
              contas: cascata.contasExcluidas > 0 ? tV("avisos.cascataContas", { contas: cascata.contasExcluidas }) : "",
            }),
          });
        } else if (cascata.status === "cancelado") {
          toast({
            title: tV("avisos.cascataParcialTitulo"),
            description: tV("avisos.cascataParcialDescricao", {
              pendentes: cascata.secundariasCanceladas,
              contas: cascata.contasExcluidas > 0 ? tV("avisos.cascataParcialContas", { contas: cascata.contasExcluidas }) : "",
              recebidas: cascata.parcelasRecebidasParaRevisao,
            }),
            variant: "destructive",
            duration: 15000,
          });
        } else if (cascata.status === "bloqueado_parcela_recebida") {
          toast({
            title: tV("avisos.cascataBloqueadaTitulo"),
            description: tV("avisos.cascataBloqueadaDescricao", { recebidas: cascata.parcelasRecebidas }),
            variant: "destructive",
            duration: 15000,
          });
        } else if (cascata.status === "erro") {
          console.error("❌ Erro na cascata do cancelamento:", cascata.mensagem);
          toast({
            title: tV("avisos.cascataErroTitulo"),
            description: tV("avisos.cascataErroDescricao", { mensagem: cascata.mensagem }),
            variant: "destructive",
            duration: 15000,
          });
        }
      }

      // Recarregar vendas
      await carregarVendas();
      return true;
    } catch (error: any) {
      console.error("❌ Erro ao cancelar venda:", error);
      toast({
        title: tV("avisos.erroCancelarTitulo"),
        description: error.message || tV("avisos.erroCancelarDescricao"),
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
      if (!vendaOriginal) throw new Error(tV("avisos.vendaNaoEncontrada"));

      // Mesmo reconhecimento de todos os caminhos de baixa (custo proporcional
      // em parcelas de pagamento duplo, "custo não confirmado" etc.)
      const reconhecimento = await reconhecerRecebimentoVendaVinculada(
        vendaId,
        new Date().toISOString(),
        vendaOriginal.user_id as string,
      );
      if (reconhecimento.status === "erro") throw new Error(reconhecimento.mensagem);
      if (reconhecimento.status === "ignorado") {
        throw new Error(tV("avisos.naoConfirmouRecebimento"));
      }
      if (reconhecimento.status === "custo_nao_confirmado") {
        toast({
          title: tV("avisos.custoNaoConfirmado"),
          description: tV(`avisos.custoMotivo.${reconhecimento.motivo}`),
          variant: "destructive",
          duration: 15000,
        });
      }

      // Marcar conta correspondente como recebida
      let totalRecebido = vendaOriginal.total;
      if (vendaOriginal.valor_troca != null) {
        // Venda com troca: o cliente pagou o valor da conta (sem a troca), não o total da linha.
        const { data: contasDaVenda, error: erroContas } = await supabase.from("contas")
          .select("id, valor")
          .eq("user_id", vendaOriginal.user_id)
          .ilike("descricao", `%venda_id:${vendaId}%`)
          .eq("status", "pendente");
        if (erroContas) throw erroContas;
        totalRecebido = 0;
        for (const conta of contasDaVenda ?? []) {
          const { error: erroBaixa } = await supabase.from("contas")
            .update({ status: "recebido", valor_pago: conta.valor })
            .eq("id", conta.id)
            .eq("status", "pendente");
          if (erroBaixa) throw erroBaixa;
          totalRecebido += Number(conta.valor);
        }
      } else {
        await supabase.from("contas")
          .update({
            status: "recebido",
            valor_pago: vendaOriginal.total,
          })
          .eq("user_id", vendaOriginal.user_id)
          .ilike("descricao", `%venda_id:${vendaId}%`)
          .eq("status", "pendente");
      }

      toast({
        title: tV("avisos.pagamentoConfirmadoTitulo"),
        description: tV("avisos.pagamentoConfirmadoDescricao"),
      });

      // Disparar evento de notificação automática
      dispatchEvent("PAYMENT_CONFIRMED", {
        total: totalRecebido?.toString() || "0",
      });

      await carregarVendas();
      return true;
    } catch (error: any) {
      console.error("❌ Erro ao marcar como recebido:", error);
      toast({
        title: tV("avisos.erroConfirmarTitulo"),
        description: error.message || tV("avisos.erroConfirmarDescricao"),
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
      if (!vendaOriginal) throw new Error(tV("avisos.vendaNaoEncontrada"));

      if (vendaOriginal.tipo === "servico") {
        toast({
          title: tV("avisos.servicoEditarTitulo"),
          description: tV("avisos.servicoEditarDescricao"),
          variant: "destructive",
        });
        return false;
      }

      if (vendaOriginal.cancelada) {
        toast({
          title: tV("avisos.canceladaEditarTitulo"),
          description: tV("avisos.canceladaEditarDescricao"),
          variant: "destructive",
        });
        return false;
      }

      // Venda com troca: valor e forma não mudam por aqui (a troca e as contas não seriam refeitas).
      const bloqueioTroca = bloqueioEditarVendaComTroca({
        temTroca: vendaOriginal.valor_troca != null,
        mudaValor: dados.total !== undefined && Number(dados.total) !== Number(vendaOriginal.total),
        mudaForma: dados.forma_pagamento !== vendaOriginal.forma_pagamento,
      });
      if (bloqueioTroca) {
        toast({ title: tV("avisos.naoFoiPossivelEditar"), description: bloqueioTroca === MENSAGEM_EDITAR_VENDA_COM_TROCA ? tV("avisos.editarComTroca") : bloqueioTroca, variant: "destructive" });
        return false;
      }

      if (dados.total !== undefined && (!Number.isFinite(dados.total) || dados.total <= 0)) {
        toast({
          title: tV("avisos.valorInvalidoTitulo"),
          description: tV("avisos.valorInvalidoDescricao"),
          variant: "destructive",
        });
        return false;
      }

      // Vendas avulsas vivem em vendas_avulsas, não em vendas — sem parcelamento/contas a receber.
      if (vendaOriginal.tipo === "avulsa") {
        const updateAvulsa: { forma_pagamento: string; valor?: number } = {
          forma_pagamento: dados.forma_pagamento,
        };
        if (dados.total !== undefined && Number(dados.total) !== Number(vendaOriginal.total)) {
          updateAvulsa.valor = dados.total;
        }

        const { error: erroAvulsa } = await supabase
          .from("vendas_avulsas" as any)
          .update(updateAvulsa)
          .eq("id", vendaId)
          .eq("user_id", vendaOriginal.user_id);

        if (erroAvulsa) throw erroAvulsa;

        toast({
          title: tV("avisos.atualizadaTitulo"),
          description: tV("avisos.avulsaAtualizada"),
        });

        setVendas(prev => prev.map(v =>
          v.id === vendaId
            ? {
                ...v,
                forma_pagamento: dados.forma_pagamento as Venda["forma_pagamento"],
                total: updateAvulsa.valor ?? v.total,
              }
            : v
        ));
        return true;
      }

      const nomeFormaCustomizada = getLabelFormaCustomizada(dados.forma_pagamento);
      const updateData: any = {
        forma_pagamento: resolverFormaPagamentoBanco(dados.forma_pagamento),
        data_prevista_recebimento: dados.data_prevista_recebimento || null,
        parcela_numero: dados.parcela_numero || null,
        total_parcelas: dados.total_parcelas || null,
      };

      if (nomeFormaCustomizada) {
        // Preserva o nome do item (se houver) e anexa o nome da forma customizada,
        // já que o banco só aceita "outro" — mesmo padrão usado no PDV.
        const nomeBase = (vendaOriginal.observacoes || "").replace(/\s*\[forma:.*\]\s*$/, "").trim();
        updateData.observacoes = `${nomeBase} [forma:${nomeFormaCustomizada}]`.trim();
      }

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
        // Linhas "utilizado na OS" NÃO entram no caixa por si (o valor da OS
        // inteira entra via total_servicos / ajustarCaixasFechadosOS pelo fluxo
        // da OS) — ajustá-las aqui corromperia o total do caixa.
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

          // Linhas "utilizado na OS" não entram no caixa por si só (o valor da OS
          // inteira entra via total_servicos / ajustarCaixasFechadosOS pelo fluxo
          // da OS) — ajustá-las aqui corromperia o total do caixa.
          const coluna = isVendaDeItemOS(vendaOriginal.observacoes)
            ? null
            : colunaPorForma(vendaOriginal.forma_pagamento);

          if (coluna) {
            for (const caixa of caixasAfetados ?? []) {
              const atualizacao: any = {
                [coluna]: Number((caixa as any)[coluna] || 0) + diferenca,
                total_vendas: Number((caixa as any).total_vendas || 0) + diferenca,
              };
              // saldo_final = saldo_inicial + DINHEIRO + suprimentos - sangrias
              // (fórmula do fecharCaixa): só muda quando a diferença é em
              // dinheiro — cartão/PIX/a receber não entram na gaveta.
              if (coluna === "total_dinheiro") {
                atualizacao.saldo_final = Number((caixa as any).saldo_final || 0) + diferenca;
              }
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
        title: tV("avisos.atualizadaTitulo"),
        description: totalMudou
          ? tV("avisos.valorFormaAtualizados")
          : tV("avisos.formaAlterada"),
      });

      if (avisoFinanceiro) {
        toast({
          title: tV("avisos.verifiqueFinanceiroTitulo"),
          description: tV("avisos.verifiqueFinanceiroDescricao"),
          variant: "destructive",
        });
      }

      // Atualiza localmente sem precisar recarregar (preserva filtro de data ativo)
      setVendas(prev => prev.map(v =>
        v.id === vendaId
          ? {
              ...v,
              forma_pagamento: dados.forma_pagamento as Venda["forma_pagamento"],
              observacoes: updateData.observacoes ?? v.observacoes,
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
        title: tV("avisos.erroEditarTitulo"),
        description: error.message || tV("avisos.erroEditarDescricao"),
        variant: "destructive",
      });
      return false;
    }
  };

  // Corrige a data de uma venda já lançada (venda inteira: todas as linhas do
  // grupo) e ajusta caixas fechados — ver src/lib/vendas/alterarDataVenda.ts.
  const alterarDataVenda = async (vendaId: string, novaDataISO: string): Promise<boolean> => {
    const venda = vendas.find((v) => v.id === vendaId);
    if (!venda?.user_id) {
      toast({ title: tV("avisos.vendaNaoEncontrada"), variant: "destructive" });
      return false;
    }
    try {
      const resultado = await alterarDataVendaNoBanco({
        vendaId,
        tipo: venda.tipo,
        userId: venda.user_id,
        novaDataISO,
      });
      if (!resultado.ok) {
        toast({ title: tV("avisos.naoAlterouData"), description: resultado.erro, variant: "destructive" });
        return false;
      }

      const qtdLinhas = Object.keys(resultado.novasDatas).length;
      toast({
        title: tV("avisos.dataAlteradaTitulo"),
        description: [
          qtdLinhas > 1 ? tV("avisos.itensMovidos", { quantidade: qtdLinhas }) : null,
          resultado.caixasAjustados > 0
            ? (resultado.caixasAjustados === 1 ? tV("avisos.umCaixaAjustado") : tV("avisos.caixasAjustados"))
            : null,
        ].filter(Boolean).join(" ") || undefined,
      });
      if (resultado.avisoCaixa) {
        toast({
          title: tV("avisos.verifiqueCaixaTitulo"),
          description: tV("avisos.verifiqueCaixaDescricao"),
          variant: "destructive",
        });
      }
      if (!resultado.historicoGravado) {
        toast({
          title: tV("avisos.historicoTitulo"),
          description: tV("avisos.historicoDescricao"),
          variant: "destructive",
        });
      }

      const aplicar = (lista: Venda[]) =>
        lista.map((v) => (resultado.novasDatas[v.id] ? { ...v, data: resultado.novasDatas[v.id] } : v));
      setVendas(aplicar);
      setTodasVendas(aplicar);
      return true;
    } catch (error) {
      console.error("❌ Erro ao alterar data da venda:", error);
      toast({
        title: tV("avisos.erroAlterarDataTitulo"),
        description: error instanceof Error ? error.message : tV("avisos.erroAlterarDataDescricao"),
        variant: "destructive",
      });
      return false;
    }
  };

  const excluirVenda = async (vendaId: string): Promise<boolean> => {
    try {
      const vendaOriginal = vendas.find((v) => v.id === vendaId);
      if (!vendaOriginal) throw new Error(tV("avisos.vendaNaoEncontrada"));

      // Apenas vendas canceladas podem ser excluídas
      if (!vendaOriginal.cancelada) {
        toast({
          title: tV("avisos.naoExcluirTitulo"),
          description: tV("avisos.naoExcluirDescricao"),
          variant: "destructive",
        });
        return false;
      }

      // Serviços não podem ser excluídos por aqui
      if (vendaOriginal.tipo === "servico") {
        toast({
          title: tV("avisos.servicoExcluirTitulo"),
          description: tV("avisos.servicoExcluirDescricao"),
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
        title: tV("avisos.excluidaTitulo"),
        description: tV("avisos.excluidaDescricao"),
      });

      await carregarVendas();
      return true;
    } catch (error: any) {
      console.error("❌ Erro ao excluir venda:", error);
      toast({
        title: tV("avisos.erroExcluirTitulo"),
        description: error.message || tV("avisos.erroExcluirDescricao"),
        variant: "destructive",
      });
      return false;
    }
  };

  const marcarComoPendente = async (vendaId: string): Promise<boolean> => {
    try {
      const vendaOriginal = vendas.find((v) => v.id === vendaId);
      if (!vendaOriginal) throw new Error(tV("avisos.vendaNaoEncontrada"));

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
        title: tV("avisos.statusAlteradoTitulo"),
        description: tV("avisos.statusAlteradoDescricao"),
      });

      await carregarVendas();
      return true;
    } catch (error: any) {
      console.error("❌ Erro ao marcar como pendente:", error);
      toast({
        title: tV("avisos.erroStatusTitulo"),
        description: error.message || tV("avisos.erroStatusDescricao"),
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
    alterarDataVenda,
    calcularResumo,
    agruparVendasPorPeriodo,
    calcularResumoAReceber,
    marcarComoRecebido,
    marcarComoPendente,
    excluirVenda,
    cancelarContaAPrazoOS,
  };
};
