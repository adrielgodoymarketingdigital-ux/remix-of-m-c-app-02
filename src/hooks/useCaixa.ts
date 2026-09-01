import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Caixa } from "@/types/caixa";
import { useFuncionarioPermissoes } from "./useFuncionarioPermissoes";
import { agruparVendasPorFormaPagamento, BreakdownFormaPagamento } from "@/lib/formaPagamento";
import {
  agregarServicosNoCaixa,
  derivarEventosRecebimentoOS,
  isVendaDeItemOS,
  type OrdemParaCaixa,
} from "@/lib/caixa/servicosCaixa";

export function useCaixa() {
  const [caixaAtual, setCaixaAtual] = useState<Caixa | null>(null);
  const [loading, setLoading] = useState(true);
  const [ultimoBreakdownFormaPagamento, setUltimoBreakdownFormaPagamento] = useState<BreakdownFormaPagamento[]>([]);
  const { lojaUserId, carregando: permissoesCarregando } = useFuncionarioPermissoes();

  // Ref para sempre ter o lojaUserId mais atualizado dentro de callbacks assíncronos
  const lojaUserIdRef = useRef<string | null>(lojaUserId);
  useEffect(() => {
    lojaUserIdRef.current = lojaUserId;
  }, [lojaUserId]);

  // Recarregar caixa quando as permissões terminarem de carregar (lojaUserId disponível)
  useEffect(() => {
    if (!permissoesCarregando) {
      carregarCaixaAtual();
    }
  }, [permissoesCarregando]);

  const carregarCaixaAtual = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // proprietario_id da loja — usa ref para garantir valor atual mesmo em callbacks
      const proprietarioId = lojaUserIdRef.current ?? user.id;

      // Tentar caixa aberto da loja toda (pelo proprietario_id)
      // Busca sem filtro de empresa para capturar caixas com ou sem empresa_id preenchido
      const { data: aberto, error: erroAberto } = await supabase
        .from("caixas")
        .select("*")
        .eq("proprietario_id", proprietarioId)
        .eq("status", "aberto")
        .order("data_abertura", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (erroAberto) throw erroAberto;

      if (aberto) {
        setCaixaAtual(aberto as Caixa);
        return;
      }

      // Se não houver aberto, buscar o mais recente fechado da loja
      const { data: fechado, error: erroFechado } = await supabase
        .from("caixas")
        .select("*")
        .eq("proprietario_id", proprietarioId)
        .eq("status", "fechado")
        .order("data_abertura", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (erroFechado) throw erroFechado;
      setCaixaAtual(fechado as Caixa | null);
    } finally {
      setLoading(false);
    }
  };

  const abrirCaixa = async (saldoInicial: number, observacoes?: string): Promise<Caixa | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // proprietario_id: ID do dono da loja — usa ref para valor atual
    const proprietarioId = lojaUserIdRef.current ?? user.id;

    // Verificar se já existe caixa aberto para este proprietario_id (toda a loja)
    const { data: existente } = await supabase
      .from("caixas")
      .select("*")
      .eq("proprietario_id", proprietarioId)
      .eq("status", "aberto")
      .limit(1)
      .maybeSingle();

    if (existente) {
      const caixa = existente as Caixa;
      setCaixaAtual(caixa);
      return caixa;
    }

    const { data, error } = await supabase
      .from("caixas")
      .insert({
        user_id: user.id,
        saldo_inicial: saldoInicial,
        observacoes: observacoes || null,
        status: "aberto",
        empresa_id: null,
        proprietario_id: proprietarioId, // sempre o dono da loja
      })
      .select()
      .single();

    if (error) throw error;

    const caixa = data as Caixa;
    setCaixaAtual(caixa);
    return caixa;
  };

  const fecharCaixa = async (caixaId: string, observacoes?: string, saldoFinalContado?: number): Promise<boolean> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // Buscar o caixa para obter data_abertura e saldo_inicial
    const { data: caixaData, error: caixaError } = await supabase
      .from("caixas")
      .select("*")
      .eq("id", caixaId)
      .single();

    if (caixaError || !caixaData) return false;

    const caixa = caixaData as Caixa;

    // Buscar vendas do período (data_abertura até agora)
    // proprietario_id = dono da loja; usa ref para garantir valor atual
    const userIdVendas = caixa.proprietario_id ?? lojaUserIdRef.current ?? caixa.user_id;
    let vendasQuery = supabase
      .from("vendas")
      .select("forma_pagamento, total, observacoes, segunda_forma_pagamento, valor_segunda_forma")
      .eq("user_id", userIdVendas)
      .gte("data", caixa.data_abertura)
      .lte("data", new Date().toISOString())
      .or("cancelada.is.null,cancelada.eq.false");

    if (caixa.empresa_id) {
      vendasQuery = vendasQuery.eq("empresa_id", caixa.empresa_id);
    }

    const { data: vendasRaw, error: vendasError } = await vendasQuery;

    if (vendasError) throw vendasError;

    // Produtos/peças consumidos numa OS geram linha em `vendas` (marcada com
    // "utilizado na OS"). O valor desses itens JÁ está no total da OS e será
    // contabilizado via total_servicos — removê-los aqui evita contar 2x.
    const vendas = (vendasRaw ?? []).filter(
      (v: { observacoes?: string | null }) => !isVendaDeItemOS(v.observacoes),
    );

    // Vendas avulsas (tabela separada de vendas, sem empresa_id/cancelada — usa soft delete)
    const { data: vendasAvulsas, error: vendasAvulsasError } = await supabase
      .from("vendas_avulsas" as any)
      .select("valor, forma_pagamento")
      .eq("user_id", userIdVendas)
      .is("deleted_at", null)
      .gte("created_at", caixa.data_abertura)
      .lte("created_at", new Date().toISOString());

    if (vendasAvulsasError) throw vendasAvulsasError;

    const formasCartao = ["debito", "credito", "credito_parcelado"];

    // Usa o mesmo agrupador do preview de fechamento de caixa, que já rateia
    // corretamente vendas com 2 formas de pagamento (evita contar o valor 2x)
    const breakdown = agruparVendasPorFormaPagamento(vendas ?? []);

    let total_dinheiro = 0;
    let total_pix = 0;
    let total_cartao = 0;
    let total_a_receber = 0;

    for (const item of breakdown) {
      if (item.chave === "dinheiro") total_dinheiro += item.total;
      else if (item.chave === "pix") total_pix += item.total;
      else if (formasCartao.includes(item.chave)) total_cartao += item.total;
      else if (item.chave === "a_receber" || item.chave === "a_prazo") total_a_receber += item.total;
    }

    (vendasAvulsas || []).forEach((v: any) => {
      const forma = v.forma_pagamento;
      const valor = Number(v.valor || 0);
      if (forma === "dinheiro") total_dinheiro += valor;
      else if (forma === "pix") total_pix += valor;
      else if (formasCartao.includes(forma)) total_cartao += valor;
      else if (forma === "a_receber" || forma === "a_prazo") total_a_receber += valor;
    });

    setUltimoBreakdownFormaPagamento(breakdown);

    // Buscar movimentações (sangrias e suprimentos)
    const { data: movimentacoes } = await supabase
      .from("caixa_movimentacoes")
      .select("tipo, valor")
      .eq("caixa_id", caixaId);

    const totalSangrias = (movimentacoes ?? [])
      .filter(m => m.tipo === "sangria")
      .reduce((acc, m) => acc + Number(m.valor), 0);

    const totalSuprimentos = (movimentacoes ?? [])
      .filter(m => m.tipo === "suprimento")
      .reduce((acc, m) => acc + Number(m.valor), 0);

    // ── Serviços (OS entregues) recebidos na janela do caixa ──────────────────
    // Associação por DATA: "Data no caixa" (ordens_servico.data_caixa) para o
    // saldo; data de abertura da OS para a entrada. O valor de cada OS entra
    // TAMBÉM nos totais por forma (dinheiro/pix/cartão), e é gravado somado em
    // total_servicos para a seção visual separada.
    const janelaFimISO = new Date().toISOString();
    let osQuery = supabase
      .from("ordens_servico")
      .select("numero_os, total, forma_pagamento, avarias, created_at, data_caixa, data_saida, status, clientes(nome)")
      .eq("user_id", userIdVendas)
      .eq("status", "entregue")
      .is("deleted_at", null)
      .gte("data_saida", caixa.data_abertura);
    if (caixa.empresa_id) {
      osQuery = osQuery.eq("empresa_id", caixa.empresa_id);
    }
    const { data: osEntregues, error: osError } = await osQuery;
    if (osError) throw osError;

    type OSRow = OrdemParaCaixa & { numero_os: string | null };
    const osRows = (osEntregues ?? []) as unknown as OSRow[];
    const numerosOs = Array.from(
      new Set(osRows.map((o) => o.numero_os).filter((n): n is string => !!n)),
    );
    const statusContaPorOs = new Map<string, string>();
    if (numerosOs.length > 0) {
      let contasQuery = supabase
        .from("contas")
        .select("os_numero, status")
        .eq("user_id", userIdVendas)
        .eq("tipo", "receber")
        .in("os_numero", numerosOs);
      if (caixa.empresa_id) {
        contasQuery = contasQuery.or(`empresa_id.eq.${caixa.empresa_id},empresa_id.is.null`);
      }
      const { data: contasOs } = await contasQuery;
      (contasOs ?? []).forEach((c: { os_numero: string | null; status: string | null }) => {
        if (c.os_numero && c.status) statusContaPorOs.set(c.os_numero, c.status);
      });
    }

    const eventosOS = osRows.flatMap((o) =>
      derivarEventosRecebimentoOS(o, statusContaPorOs.get(o.numero_os ?? "")),
    );
    const servicosAgg = agregarServicosNoCaixa(eventosOS, caixa.data_abertura, janelaFimISO);

    total_dinheiro += servicosAgg.total_dinheiro;
    total_pix += servicosAgg.total_pix;
    total_cartao += servicosAgg.total_cartao;
    total_a_receber += servicosAgg.total_a_receber;
    const total_servicos = servicosAgg.total_servicos;

    const total_vendas = total_dinheiro + total_pix + total_cartao + total_a_receber;
    const saldo_final = saldoFinalContado !== undefined
      ? saldoFinalContado
      : caixa.saldo_inicial + total_dinheiro + totalSuprimentos - totalSangrias;

    const { error: updateError } = await supabase
      .from("caixas")
      .update({
        status: "fechado",
        data_fechamento: new Date().toISOString(),
        total_dinheiro,
        total_pix,
        total_cartao,
        total_a_receber,
        total_servicos,
        total_vendas,
        saldo_final,
        observacoes: observacoes || caixa.observacoes,
      })
      .eq("id", caixaId);

    if (updateError) throw updateError;

    await carregarCaixaAtual();
    return true;
  };

  const caixaEstaAberto = caixaAtual?.status === "aberto";

  return { caixaAtual, caixaEstaAberto, loading, abrirCaixa, fecharCaixa, carregarCaixaAtual, ultimoBreakdownFormaPagamento };
}
