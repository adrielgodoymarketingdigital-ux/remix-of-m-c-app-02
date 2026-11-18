import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Caixa } from "@/types/caixa";
import { useFuncionarioPermissoes } from "./useFuncionarioPermissoes";
import { BreakdownFormaPagamento, calcularDinheiroEsperado } from "@/lib/formaPagamento";
import { COLUNAS_VENDAS_CAIXA, somarVendasNoCaixa } from "@/lib/caixa/vendasDoCaixa";
import {
  agregarServicosNoCaixa,
  derivarEventosRecebimentoOS,
  isVendaDeItemOS,
  type OrdemParaCaixa,
} from "@/lib/caixa/servicosCaixa";
import { carregarDevolucoesDoCaixa } from "@/lib/caixa/carregarDevolucoesTroca";
import { mapaStatusContaPorOS } from "@/lib/ordemServico/quitarContaReceberDaOS";
import { limiteSuperiorDaSoma } from "@/lib/caixa/janelaFechamento";
import { relogioServidor } from "@/lib/horaBrasilia/relogioServidor";
import i18n from "@/lib/i18n/instancia";

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

  /**
   * Totais do caixa desde a abertura (vendas, vendas avulsas, OS entregues,
   * sangrias, suprimentos e devoluções de troca) — a mesma conta do fechamento.
   * null = caixa não encontrado.
   */
  const calcularTotaisDoCaixa = async (caixaId: string) => {
    // Buscar o caixa para obter data_abertura e saldo_inicial
    const { data: caixaData, error: caixaError } = await supabase
      .from("caixas")
      .select("*")
      .eq("id", caixaId)
      .single();

    if (caixaError || !caixaData) return null;

    const caixa = caixaData as Caixa;

    // Caixa aberto soma sem limite superior: o relógio do aparelho não corta
    // lançamentos. Caixa fechado nunca passa do próprio data_fechamento.
    await relogioServidor.sincronizar();
    const agoraISO = relogioServidor.agoraISO();
    const limiteSoma = limiteSuperiorDaSoma(caixa, agoraISO);

    // Buscar vendas do período (desde data_abertura)
    // proprietario_id = dono da loja; usa ref para garantir valor atual
    const userIdVendas = caixa.proprietario_id ?? lojaUserIdRef.current ?? caixa.user_id;
    let vendasQuery = supabase
      .from("vendas")
      .select(COLUNAS_VENDAS_CAIXA)
      .eq("user_id", userIdVendas)
      .gte("data", caixa.data_abertura)
      .or("cancelada.is.null,cancelada.eq.false");

    if (limiteSoma) vendasQuery = vendasQuery.lte("data", limiteSoma);

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
    let vendasAvulsasQuery = supabase
      .from("vendas_avulsas" as any)
      .select("valor, forma_pagamento")
      .eq("user_id", userIdVendas)
      .is("deleted_at", null)
      .gte("created_at", caixa.data_abertura);

    if (limiteSoma) vendasAvulsasQuery = vendasAvulsasQuery.lte("created_at", limiteSoma);

    const { data: vendasAvulsas, error: vendasAvulsasError } = await vendasAvulsasQuery;

    if (vendasAvulsasError) throw vendasAvulsasError;

    const formasCartao = ["debito", "credito", "credito_parcelado"];

    // Mesma soma da prévia do fechamento (somarVendasNoCaixa): rateia o pagamento
    // duplo (sem contar 2x) e abate o desconto da 1ª forma (vendas.total é bruto).
    const somaVendas = somarVendasNoCaixa(vendas ?? []);
    const breakdown = somaVendas.breakdown;

    let total_dinheiro = somaVendas.total_dinheiro;
    let total_pix = somaVendas.total_pix;
    let total_cartao = somaVendas.total_cartao;
    let total_a_receber = somaVendas.total_a_receber;

    (vendasAvulsas || []).forEach((v: any) => {
      const forma = v.forma_pagamento;
      const valor = Number(v.valor || 0);
      if (forma === "dinheiro") total_dinheiro += valor;
      else if (forma === "pix") total_pix += valor;
      else if (formasCartao.includes(forma)) total_cartao += valor;
      else if (forma === "a_receber" || forma === "a_prazo") total_a_receber += valor;
    });

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
    // Filtra por data_caixa (coluna DATE, sem ambiguidade de fuso) e não por
    // data_saida — data_saida é gravada como string de hora local sem timezone
    // e, lida como UTC, cai "antes" da abertura do caixa, escondendo a OS.
    const janelaFimISO = limiteSoma ?? agoraISO;
    const janelaIniData = String(caixa.data_abertura).slice(0, 10);
    const janelaFimData = janelaFimISO.slice(0, 10);
    let osQuery = supabase
      .from("ordens_servico")
      .select("numero_os, total, forma_pagamento, avarias, created_at, data_caixa, data_saida, status, clientes(nome)")
      .eq("user_id", userIdVendas)
      .eq("status", "entregue")
      .is("deleted_at", null)
      .gte("data_caixa", janelaIniData)
      .lte("data_caixa", janelaFimData);
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
      // OS com contas duplicadas: vale a quitada (antes vencia a última lida).
      mapaStatusContaPorOS(contasOs ?? []).forEach((status, numero) => statusContaPorOs.set(numero, status));
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

    // Devoluções da diferença da troca feitas neste caixa (vendas_trocas.caixa_id):
    // em dinheiro saem da gaveta; em Pix são só informação.
    const devolucoes = await carregarDevolucoesDoCaixa(caixaId);

    return { caixa, breakdown, total_dinheiro, total_pix, total_cartao, total_a_receber, total_servicos, totalSangrias, totalSuprimentos, devolucoes };
  };

  /**
   * Dinheiro estimado na gaveta agora: o dinheiro esperado do fechamento (já
   * com as devoluções de troca em dinheiro deste caixa). Usado só para avisar
   * quando uma devolução em dinheiro passa disso (não bloqueia). null = não deu
   * para calcular (aí o PDV não avisa).
   */
  const estimarDinheiroNaGaveta = async (caixaId: string): Promise<number | null> => {
    try {
      const totais = await calcularTotaisDoCaixa(caixaId);
      if (!totais) return null;
      return calcularDinheiroEsperado({
        saldoInicial: totais.caixa.saldo_inicial,
        totalDinheiro: totais.total_dinheiro,
        suprimentos: totais.totalSuprimentos,
        sangrias: totais.totalSangrias,
        devolucoesDinheiro: totais.devolucoes.dinheiro,
      });
    } catch (erro) {
      console.error("[caixa] etapa=estimar dinheiro na gaveta", erro);
      return null;
    }
  };

  const fecharCaixa = async (caixaId: string, observacoes?: string, saldoFinalContado?: number): Promise<boolean> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // Hora do servidor atualizada antes da conta e da gravação do fechamento.
    await relogioServidor.sincronizar({ forcar: true });

    const totais = await calcularTotaisDoCaixa(caixaId);
    if (!totais) return false;

    // Fechado em outro aparelho ou aba: nada é recalculado nem regravado.
    const avisarJaFechado = async () => {
      await carregarCaixaAtual();
      return new Error(i18n.t("caixa.fechamento.jaFechado", { ns: "pdv" }));
    };
    if (totais.caixa.status !== "aberto") throw await avisarJaFechado();

    const { caixa, breakdown, total_dinheiro, total_pix, total_cartao, total_a_receber, total_servicos, totalSangrias, totalSuprimentos, devolucoes } = totais;
    setUltimoBreakdownFormaPagamento(breakdown);

    const total_vendas = total_dinheiro + total_pix + total_cartao + total_a_receber;
    const saldo_final = saldoFinalContado !== undefined
      ? saldoFinalContado
      : calcularDinheiroEsperado({ saldoInicial: caixa.saldo_inicial, totalDinheiro: total_dinheiro, suprimentos: totalSuprimentos, sangrias: totalSangrias, devolucoesDinheiro: devolucoes.dinheiro });

    const { data: caixasFechados, error: updateError } = await supabase
      .from("caixas")
      .update({
        status: "fechado",
        // Hora do servidor; o gatilho do banco tem a palavra final. Sem a migration, é a hora do aparelho, como antes.
        data_fechamento: relogioServidor.agoraISO(),
        total_dinheiro,
        total_pix,
        total_cartao,
        total_a_receber,
        total_servicos,
        total_vendas,
        saldo_final,
        // Foto das devoluções em dinheiro abatidas do esperado (migration 2B).
        total_devolucoes_troca: devolucoes.dinheiro,
        observacoes: observacoes || caixa.observacoes,
      })
      .eq("id", caixaId)
      .eq("status", "aberto")
      .select("id");

    if (updateError) throw updateError;
    if (!caixasFechados?.length) throw await avisarJaFechado();

    await carregarCaixaAtual();
    return true;
  };

  const caixaEstaAberto = caixaAtual?.status === "aberto";

  return { caixaAtual, caixaEstaAberto, loading, abrirCaixa, fecharCaixa, carregarCaixaAtual, ultimoBreakdownFormaPagamento, estimarDinheiroNaGaveta };
}
