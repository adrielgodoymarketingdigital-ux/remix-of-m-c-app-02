import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Caixa } from "@/types/caixa";
import { useFuncionarioPermissoes } from "./useFuncionarioPermissoes";

export function useCaixa() {
  const [caixaAtual, setCaixaAtual] = useState<Caixa | null>(null);
  const [loading, setLoading] = useState(true);
  const { lojaUserId } = useFuncionarioPermissoes();

  useEffect(() => {
    carregarCaixaAtual();
  }, []);

  const carregarCaixaAtual = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // proprietario_id da loja (dono ou dono do funcionário)
      const proprietarioId = lojaUserId ?? user.id;

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

    // Verificar se já existe caixa aberto para este usuário
    const { data: existente } = await supabase
      .from("caixas")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "aberto")
      .limit(1)
      .maybeSingle();

    if (existente) {
      const caixa = existente as Caixa;
      setCaixaAtual(caixa);
      return caixa;
    }

    // proprietario_id: ID do dono da loja (cujas vendas serão consultadas no fechamento)
    // Para funcionários, lojaUserId é o dono. Para o próprio dono, usa user.id.
    const proprietarioId = lojaUserId ?? user.id;

    const { data, error } = await supabase
      .from("caixas")
      .insert({
        user_id: user.id,
        saldo_inicial: saldoInicial,
        observacoes: observacoes || null,
        status: "aberto",
        empresa_id: null,
        proprietario_id: proprietarioId,
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
    // proprietario_id = dono da loja; lojaUserId = fallback para caixas antigos sem proprietario_id
    const userIdVendas = caixa.proprietario_id ?? lojaUserId ?? caixa.user_id;
    let vendasQuery = supabase
      .from("vendas")
      .select("forma_pagamento, total")
      .eq("user_id", userIdVendas)
      .gte("data", caixa.data_abertura)
      .lte("data", new Date().toISOString())
      .or("cancelada.is.null,cancelada.eq.false");

    if (caixa.empresa_id) {
      vendasQuery = vendasQuery.eq("empresa_id", caixa.empresa_id);
    }

    const { data: vendas, error: vendasError } = await vendasQuery;

    if (vendasError) throw vendasError;

    const formasCartao = ["debito", "credito", "credito_parcelado"];

    let total_dinheiro = 0;
    let total_pix = 0;
    let total_cartao = 0;
    let total_a_receber = 0;

    for (const venda of vendas ?? []) {
      const valor = Number(venda.total) || 0;
      if (venda.forma_pagamento === "dinheiro") total_dinheiro += valor;
      else if (venda.forma_pagamento === "pix") total_pix += valor;
      else if (formasCartao.includes(venda.forma_pagamento ?? "")) total_cartao += valor;
      else if (venda.forma_pagamento === "a_receber") total_a_receber += valor;
    }

    const total_vendas = total_dinheiro + total_pix + total_cartao + total_a_receber;
    const saldo_final = saldoFinalContado !== undefined ? saldoFinalContado : caixa.saldo_inicial + total_dinheiro;

    const { error: updateError } = await supabase
      .from("caixas")
      .update({
        status: "fechado",
        data_fechamento: new Date().toISOString(),
        total_dinheiro,
        total_pix,
        total_cartao,
        total_a_receber,
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

  return { caixaAtual, caixaEstaAberto, loading, abrirCaixa, fecharCaixa, carregarCaixaAtual };
}
