import { useState, useEffect, useMemo, useRef, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, Package, Smartphone, Wrench, TrendingUp, Crown, Sparkles, AlertTriangle, Percent, TrendingDown, Wallet, Moon, Sun, CalendarIcon, CreditCard, Activity, Zap } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAssinatura } from "@/hooks/useAssinatura";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TrialBanner } from "@/components/trial/TrialBanner";
import { FreeTrialTimer } from "@/components/trial/FreeTrialTimer";
import { BannerAtivarNotificacoes } from "@/components/dashboard/BannerAtivarNotificacoes";
import { formatCurrency } from "@/lib/formatters";
import { ValorMonetario } from "@/components/ui/valor-monetario";
const GraficosDashboard = lazy(() => import("@/components/dashboard/GraficosDashboard").then(m => ({ default: m.GraficosDashboard })));
import { CardAvisosSistema } from "@/components/dashboard/CardAvisosSistema";
import { CardFeedback } from "@/components/dashboard/CardFeedback";
import { CardCotacaoDolar } from "@/components/dashboard/CardCotacaoDolar";

import { CardAniversariantes, CardAniversariantesBloqueado } from "@/components/clientes/CardAniversariantes";
import { useClientes } from "@/hooks/useClientes";
import { TutorialAutoStart } from "@/components/tutorial/TutorialAutoStart";
import { useRelatorios } from "@/hooks/useRelatorios";
import { distribuirCustoParcelasGrupo, getFinancialQueryDateBounds, getVendaCustoTotal, getVendaReceitaLiquida, isVendaInFinancialPeriod } from "@/lib/vendasFinanceiras";
import { useCoresPersonalizadas } from "@/hooks/useCoresPersonalizadas";
import { useIdentidade } from "@/hooks/useResolvedUserId";

interface ProdutoVendido {
  nome: string;
  quantidade: number;
  total: number;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [nomeUsuario, setNomeUsuario] = useState<string>("");
  const { assinatura, carregando: carregandoAssinatura, trialExpirado, migracaoNecessaria } = useAssinatura();
  const { isFuncionario, temAcessoModulo, carregando: carregandoPermissoes } = useFuncionarioPermissoes();
  const dashboardBloqueado = isFuncionario && !temAcessoModulo('dashboard');
  const { clientes, loading: loadingClientes } = useClientes();
  const { calcularResumo } = useRelatorios();
  const { cores } = useCoresPersonalizadas();
  const { userId: resolvedUserId, empresaId: empresaFiltro } = useIdentidade();
  const empresaFiltroRef = useRef(empresaFiltro);
  const resolvedUserIdRef = useRef(resolvedUserId);
  useEffect(() => { empresaFiltroRef.current = empresaFiltro; }, [empresaFiltro]);
  useEffect(() => { resolvedUserIdRef.current = resolvedUserId; }, [resolvedUserId]);

  // Verificar se tem plano profissional
  const temPlanoProfissional = useMemo(() => {
    if (!assinatura) return false;
    const planosProfissionais = ['profissional_mensal', 'profissional_anual', 'profissional_ultra_mensal', 'profissional_ultra_anual', 'admin', 'trial'];
    return planosProfissionais.includes(assinatura.plano_tipo);
  }, [assinatura]);

  // Evita hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const buscarNomeUsuario = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("nome")
        .eq("id", user.id)
        .single();
      if (data?.nome) {
        setNomeUsuario(data.nome.split(" ")[0]);
      }
    };
    buscarNomeUsuario();
  }, []);

  const [metrics, setMetrics] = useState({
    faturamentoServicos: 0,
    faturamentoProdutos: 0,
    faturamentoDispositivos: 0,
    faturamentoAvulsos: 0,
    numServicos: 0,
    numProdutos: 0,
    numDispositivos: 0,
    numAvulsos: 0,
    custoServicos: 0,
    custoProdutos: 0,
    custoDispositivos: 0,
    custoAvulsos: 0,
    margemServicos: 0,
    margemProdutos: 0,
    margemDispositivos: 0,
  });
  const [financeiroData, setFinanceiroData] = useState({
    contasHojeTotal: 0,
    contasHojeQtd: 0,
    margemLucro: 0,
    custoTotal: 0,
    lucroTotal: 0,
    taxasCartao: 0,
  });
  const [hojeData, setHojeData] = useState({
    faturamento: 0,
    lucro: 0,
    faturamentoAssistencia: 0,
    lucroAssistencia: 0,
    faturamentoProdutosPecas: 0,
    lucroProdutosPecas: 0,
    faturamentoDispositivos: 0,
    lucroDispositivos: 0,
    carregando: true,
  });
  const [produtosMaisVendidos, setProdutosMaisVendidos] = useState<ProdutoVendido[]>([]);
  const [produtosMenosVendidos, setProdutosMenosVendidos] = useState<ProdutoVendido[]>([]);
  
  // Estado para filtro de mês - formato "YYYY-MM" ou "atual" para mês corrente
  const [mesSelecionado, setMesSelecionado] = useState<string>("atual");

  // Funcionários não veem banner de trial expirado
  const isTrialExpirado = !isFuncionario && assinatura?.plano_tipo === "trial" && trialExpirado;

  // Gerar lista de meses (últimos 12 meses)
  const gerarOpçõesMeses = () => {
    const meses = [];
    const hoje = new Date();
    for (let i = 0; i < 12; i++) {
      const data = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const valor = format(data, "yyyy-MM");
      const label = format(data, "MMMM 'de' yyyy", { locale: ptBR });
      meses.push({ valor, label });
    }
    return meses;
  };

  const opçõesMeses = gerarOpçõesMeses();

  // Calcular início e fim do mês selecionado
  const getDatasMesSelecionado = (mes?: string) => {
    const mesRef = mes || mesSelecionado;
    if (mesRef === "atual") {
      return { inicio: startOfMonth(new Date()), fim: endOfMonth(new Date()) };
    }
    const [ano, mesNum] = mesRef.split("-").map(Number);
    const data = new Date(ano, mesNum - 1, 1);
    return { inicio: startOfMonth(data), fim: endOfMonth(data) };
  };

  useEffect(() => {
    checkAuth();
  }, []);

  // Carregar dados de hoje separadamente, sem depender de dashboardBloqueado
  useEffect(() => {
    loadHojeData();
  }, [empresaFiltro]);

  // Recarregar dados quando o mês selecionado mudar (pular se dashboard bloqueado para funcionário)
  useEffect(() => {
    if (dashboardBloqueado) return;
    const datas = getDatasMesSelecionado(mesSelecionado);
    loadMetrics(datas.inicio, datas.fim);
    loadFinanceiroData(datas.inicio, datas.fim);
    loadProdutosVendidos(datas.inicio, datas.fim);
    loadHojeData();
  }, [mesSelecionado, dashboardBloqueado, empresaFiltro]);

  // Recarregar quando uma OS for criada ou editada
  useEffect(() => {
    if (dashboardBloqueado) return;
    const handler = () => {
      const datas = getDatasMesSelecionado(mesSelecionado);
      loadMetrics(datas.inicio, datas.fim);
      loadFinanceiroData(datas.inicio, datas.fim);
      loadHojeData();
    };
    window.addEventListener("os-salva", handler);
    return () => window.removeEventListener("os-salva", handler);
  }, [mesSelecionado, dashboardBloqueado]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
    setLoading(false);
  };

  const loadMetrics = async (inicio: Date, fim: Date) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const userId = resolvedUserIdRef.current ?? user.id;

    const inicioStr = format(inicio, "yyyy-MM-dd");
    const fimStr = format(fim, "yyyy-MM-dd");
    const { queryInicio, queryFim } = getFinancialQueryDateBounds(inicio, fim);
    // ISO completo para filtros de created_at (timestamptz) — evita ambiguidade de fuso
    const inicioISO = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate(), 0, 0, 0, 0).toISOString();
    const fimISO = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate(), 23, 59, 59, 999).toISOString();

    const ef = empresaFiltroRef.current;

    // Buscar TODAS as ordens de serviço do mês do usuário logado (excluindo testes e deletadas)
    let qTodasOrdens = supabase
      .from("ordens_servico")
      .select("id")
      .eq("user_id", userId)
      .eq("is_teste", false)
      .is("deleted_at", null)
      .gte("created_at", inicioISO)
      .lte("created_at", fimISO);
    if (ef) qTodasOrdens = qTodasOrdens.eq("empresa_id", ef);
    const { data: todasOrdens } = await qTodasOrdens;

    // Buscar apenas finalizadas/entregues para cálculo de faturamento
    // data_saida preenchida apenas em "entregue". Fallback: created_at (nunca muda),
    // jamais updated_at (muda a cada edição e traz OS antigas para o mês errado)
    let qVendasServicos = supabase
      .from("ordens_servico")
      .select("total, servico_id, avarias")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .in("status", ["finalizado", "entregue"])
      .or(
        `and(data_saida.not.is.null,data_saida.gte.${inicioStr},data_saida.lte.${fimStr}T23:59:59),and(data_saida.is.null,created_at.gte.${inicioISO},created_at.lte.${fimISO})`
      );
    if (ef) qVendasServicos = qVendasServicos.eq("empresa_id", ef);
    const { data: vendasServicos } = await qVendasServicos;

    // Buscar custos dos serviços (somente por vínculo servico_id)
    const servicoIds = Array.from(
      new Set((vendasServicos || []).map(v => v.servico_id).filter(Boolean) as string[])
    );

    const servicosCustoMapById: Record<string, number> = {};
    if (servicoIds.length > 0) {
      const { data: servicos } = await supabase
        .from("servicos")
        .select("id, custo")
        .eq("user_id", userId)
        .in("id", servicoIds);

      servicos?.forEach(s => {
        servicosCustoMapById[s.id] = Number(s.custo || 0);
      });
    }

    // Buscar vendas de produtos com custo
    // Buscar por data OU data_recebimento para capturar vendas "a_receber" recebidas no período
    let qVendasProdutos = supabase
      .from("vendas")
      .select("data, data_recebimento, total, custo_unitario, quantidade, valor_desconto_manual, valor_desconto_cupom, parcela_numero, total_parcelas, forma_pagamento, recebido, grupo_venda, peca_id, observacoes")
      .eq("user_id", userId)
      .eq("tipo", "produto")
      .eq("cancelada", false)
      .is("deleted_at", null)
      .or(`and(data.gte.${queryInicio},data.lte.${queryFim}T23:59:59),and(data_recebimento.not.is.null,data_recebimento.gte.${queryInicio},data_recebimento.lte.${queryFim}T23:59:59)`);
    if (ef) qVendasProdutos = qVendasProdutos.eq("empresa_id", ef);
    const { data: vendasProdutos } = await qVendasProdutos;

    // Buscar vendas de dispositivos com custo
    let qVendasDispositivos = supabase
      .from("vendas")
      .select("data, data_recebimento, total, custo_unitario, quantidade, valor_desconto_manual, valor_desconto_cupom, parcela_numero, total_parcelas, forma_pagamento, recebido, grupo_venda, peca_id, observacoes")
      .eq("user_id", userId)
      .eq("tipo", "dispositivo")
      .eq("cancelada", false)
      .is("deleted_at", null)
      .or(`and(data.gte.${queryInicio},data.lte.${queryFim}T23:59:59),and(data_recebimento.not.is.null,data_recebimento.gte.${queryInicio},data_recebimento.lte.${queryFim}T23:59:59)`);
    if (ef) qVendasDispositivos = qVendasDispositivos.eq("empresa_id", ef);
    const { data: vendasDispositivos } = await qVendasDispositivos;

    // Calcular serviços (custo pelo servico_id + custos adicionais assumidos pela loja)
    const faturamentoServicos = vendasServicos?.reduce((acc, v) => acc + Number(v.total || 0), 0) || 0;
    let custoServicos = vendasServicos?.reduce(
      (acc, v) => acc + (v.servico_id ? (servicosCustoMapById[v.servico_id] || 0) : 0),
      0
    ) || 0;

    // Somar custos adicionais assumidos pela loja e custos de peças das OS
    vendasServicos?.forEach((v: any) => {
      const avariasData = v.avarias || {};
      
      // Custos dos serviços realizados (priorizar sobre servico_id)
      const servicosRealizados = avariasData.servicos_realizados || [];
      if (servicosRealizados.length > 0) {
        const custoSR = servicosRealizados.reduce((acc: number, srv: any) => acc + Number(srv.custo || 0), 0);
        // Substituir custo do servico_id pelo custo real dos serviços realizados
        const custoServicoId = v.servico_id ? (servicosCustoMapById[v.servico_id] || 0) : 0;
        custoServicos += custoSR - custoServicoId;
      }

      // Custos adicionais assumidos pela loja
      const custosAdicionais = avariasData.custos_adicionais || [];
      custosAdicionais.forEach((custo: any) => {
        if (custo.valor > 0 && !custo.repassar_cliente) {
          custoServicos += Number(custo.valor);
        }
      });

      // Custos de produtos/peças utilizados
      const produtosUtilizados = avariasData.produtos_utilizados || [];
      produtosUtilizados.forEach((produto: any) => {
        if (produto.custo_unitario > 0) {
          custoServicos += Number(produto.custo_unitario || 0) * (produto.quantidade || 1);
        }
      });
    });

    // Margem de serviços será calculada após incluir avulsos

    // Excluir peças/itens de OS (mesmo critério de useVendas e useRelatorios)
    const excluirItemOS = (v: any) => {
      if (v.peca_id) return true;
      if (v.observacoes && typeof v.observacoes === "string" && v.observacoes.includes("utilizado na OS")) return true;
      return false;
    };

    // Distribuir custo das parcelas antes de calcular totais
    const vendasProdutosDistribuidas = distribuirCustoParcelasGrupo((vendasProdutos || []).filter((v: any) => !excluirItemOS(v)));
    const vendasProdutosFiltradas = vendasProdutosDistribuidas.filter((v: any) => isVendaInFinancialPeriod(v, inicio, fim));
    const faturamentoProdutos = vendasProdutosFiltradas.reduce((acc, v: any) => acc + getVendaReceitaLiquida(v), 0);
    const custoProdutos = vendasProdutosFiltradas.reduce((acc, v: any) => acc + getVendaCustoTotal(v), 0);
    const margemProdutos = faturamentoProdutos > 0 ? ((faturamentoProdutos - custoProdutos) / faturamentoProdutos) * 100 : 0;

    // Calcular dispositivos (valor líquido com desconto) - ignorar parcelas duplicadas
    const vendasDispositivosDistribuidas = distribuirCustoParcelasGrupo((vendasDispositivos || []).filter((v: any) => !excluirItemOS(v)));
    const vendasDispositivosFiltradas = vendasDispositivosDistribuidas.filter((v: any) => isVendaInFinancialPeriod(v, inicio, fim));
    const faturamentoDispositivos = vendasDispositivosFiltradas.reduce((acc, v: any) => acc + getVendaReceitaLiquida(v), 0);
    const custoDispositivos = vendasDispositivosFiltradas.reduce((acc, v: any) => acc + getVendaCustoTotal(v), 0);

    const margemDispositivos = faturamentoDispositivos > 0 ? ((faturamentoDispositivos - custoDispositivos) / faturamentoDispositivos) * 100 : 0;

    // Buscar serviços avulsos do mês (apenas entregues ou finalizados)
    const avulsosInicioISO = inicio.toISOString();
    const avulsosFimISO = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate(), 23, 59, 59, 999).toISOString();
    let qAvulsosMes = supabase
      .from("servicos_avulsos")
      .select("preco, custo, status")
      .eq("user_id", userId)
      .in("status", ["entregue", "finalizado"])
      .gte("created_at", avulsosInicioISO)
      .lte("created_at", avulsosFimISO);
    if (ef) qAvulsosMes = qAvulsosMes.eq("empresa_id", ef);
    const { data: avulsosMes } = await qAvulsosMes;

    const faturamentoAvulsos = avulsosMes?.reduce((acc, a) => acc + Number(a.preco || 0), 0) || 0;
    const custoAvulsos = avulsosMes?.reduce((acc, a) => acc + Number(a.custo || 0), 0) || 0;

    // Calcular margem de serviços incluindo avulsos
    const faturamentoServicosTotal = faturamentoServicos + faturamentoAvulsos;
    const custoServicosTotal = custoServicos + custoAvulsos;
    const margemServicos = faturamentoServicosTotal > 0 ? ((faturamentoServicosTotal - custoServicosTotal) / faturamentoServicosTotal) * 100 : 0;

    setMetrics({
      faturamentoServicos,
      faturamentoProdutos,
      faturamentoDispositivos,
      faturamentoAvulsos,
      numServicos: todasOrdens?.length || 0,
      numProdutos: vendasProdutosFiltradas.length,
      numDispositivos: vendasDispositivosFiltradas.length,
      numAvulsos: avulsosMes?.length || 0,
      custoServicos,
      custoProdutos,
      custoDispositivos,
      custoAvulsos,
      margemServicos,
      margemProdutos,
      margemDispositivos,
    });
  };

  const loadFinanceiroData = async (inicio: Date, fim: Date) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const userId = resolvedUserIdRef.current ?? user.id;

    const hoje = format(new Date(), "yyyy-MM-dd");

    // Buscar contas a pagar do dia do usuário logado
    const ef = empresaFiltroRef.current;
    let qContasHoje = supabase
      .from("contas")
      .select("valor")
      .eq("user_id", userId)
      .eq("tipo", "pagar")
      .eq("status", "pendente")
      .eq("data", hoje);
    if (ef) qContasHoje = qContasHoje.eq("empresa_id", ef);
    const { data: contasHoje } = await qContasHoje;

    // Calcular totais
    const totalContasHoje = contasHoje?.reduce((acc, c) => acc + Number(c.valor || 0), 0) || 0;
    const qtdContasHoje = contasHoje?.length || 0;

    const resumo = await calcularResumo({
      dataInicio: format(inicio, "yyyy-MM-dd"),
      dataFim: format(fim, "yyyy-MM-dd"),
    });

    setFinanceiroData({
      contasHojeTotal: totalContasHoje,
      contasHojeQtd: qtdContasHoje,
      margemLucro: resumo.margemLucroMedia,
      custoTotal: resumo.custoTotal,
      lucroTotal: resumo.lucroTotal,
      taxasCartao: resumo.taxasCartao,
    });

  };

  const loadHojeData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const userId = resolvedUserIdRef.current ?? user.id;

    const hoje = format(new Date(), "yyyy-MM-dd");
    // data_saida é salvo em UTC via toISOString(). Para cobrir o dia local corretamente,
    // usamos meia-noite e 23:59:59 no fuso local, convertidos para ISO UTC.
    const agora = new Date();
    const inicioDia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 0, 0, 0, 0);
    const fimDia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59, 999);
    const inicioDiaISO = inicioDia.toISOString();
    const fimDiaISO = fimDia.toISOString();

    console.log('[HojeDebug] hoje =', hoje, '| inicioDiaISO =', inicioDiaISO, '| fimDiaISO =', fimDiaISO);

    const ef = empresaFiltroRef.current;

    let qOrdensHoje = supabase
      .from("ordens_servico")
      .select("total, avarias")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .in("status", ["finalizado", "entregue"])
      .gte("data_saida", inicioDiaISO)
      .lte("data_saida", fimDiaISO);
    if (ef) qOrdensHoje = qOrdensHoje.eq("empresa_id", ef);

    let qVendasHoje = supabase
      .from("vendas")
      .select("total, custo_unitario, quantidade, valor_desconto_manual, valor_desconto_cupom, parcela_numero, total_parcelas, forma_pagamento, recebido, data, data_recebimento, observacoes, peca_id, tipo")
      .eq("user_id", userId)
      .eq("cancelada", false)
      .or(`and(data.gte.${inicioDiaISO},data.lte.${fimDiaISO}),and(data_recebimento.not.is.null,data_recebimento.gte.${inicioDiaISO},data_recebimento.lte.${fimDiaISO})`);
    if (ef) qVendasHoje = qVendasHoje.eq("empresa_id", ef);

    let qAvulsosHoje = supabase
      .from("servicos_avulsos")
      .select("preco, custo")
      .eq("user_id", userId)
      .in("status", ["entregue", "finalizado"])
      .gte("created_at", inicioDiaISO)
      .lte("created_at", fimDiaISO);
    if (ef) qAvulsosHoje = qAvulsosHoje.eq("empresa_id", ef);

    const [{ data: ordensHoje }, { data: vendasHoje }, { data: avulsosHoje }] = await Promise.all([
      qOrdensHoje,
      qVendasHoje,
      qAvulsosHoje,
    ]);

    console.log('[HojeDebug] hoje =', hoje);
    console.log('[HojeDebug] ordensHoje count =', ordensHoje?.length, ordensHoje);
    console.log('[HojeDebug] vendasHoje count =', vendasHoje?.length, vendasHoje);
    console.log('[HojeDebug] avulsosHoje count =', avulsosHoje?.length, avulsosHoje);

    const receitaOS = (ordensHoje || []).reduce((acc, o) => acc + Number(o.total || 0), 0);
    const custoOS = (ordensHoje || []).reduce((acc, o) => {
      const avarias = (o.avarias || {}) as Record<string, any>;
      const servicosRealizados: any[] = avarias.servicos_realizados || [];
      const custo = servicosRealizados.reduce((s: number, sv: any) => s + Number(sv.custo || 0), 0);
      return acc + custo;
    }, 0);

    const vendasFiltradas = (vendasHoje || []).filter((v) => {
      if (v.observacoes && typeof v.observacoes === "string" && v.observacoes.includes("utilizado na OS")) return false;
      if (v.peca_id) return false;
      const dataRef = (v.forma_pagamento === "a_receber" || v.forma_pagamento === "a_prazo") && v.recebido
        ? v.data_recebimento || v.data
        : v.data;
      if (!dataRef) return false;
      const dataKey = dataRef.slice(0, 10);
      return dataKey === hoje;
    });

    const vendasProdutosHoje = vendasFiltradas.filter(v => (v as any).tipo === "produto");
    const vendasDispositivosHoje = vendasFiltradas.filter(v => (v as any).tipo === "dispositivo");

    const receitaVendas = vendasFiltradas.reduce((acc, v) => acc + getVendaReceitaLiquida(v as any), 0);
    const custoVendas = vendasFiltradas.reduce((acc, v) => {
      const custo = Number(v.custo_unitario || 0) * Number(v.quantidade || 1);
      return acc + custo;
    }, 0);

    const receitaProdutosHoje = vendasProdutosHoje.reduce((acc, v) => acc + getVendaReceitaLiquida(v as any), 0);
    const custoProdutosHoje = vendasProdutosHoje.reduce((acc, v) => Number(v.custo_unitario || 0) * Number(v.quantidade || 1) + acc, 0);

    const receitaDispositivosHoje = vendasDispositivosHoje.reduce((acc, v) => acc + getVendaReceitaLiquida(v as any), 0);
    const custoDispositivosHoje = vendasDispositivosHoje.reduce((acc, v) => Number(v.custo_unitario || 0) * Number(v.quantidade || 1) + acc, 0);

    const receitaAvulsos = (avulsosHoje || []).reduce((acc, a) => acc + Number(a.preco || 0), 0);
    const custoAvulsos = (avulsosHoje || []).reduce((acc, a) => acc + Number(a.custo || 0), 0);

    const faturamento = receitaOS + receitaVendas + receitaAvulsos;
    const lucro = (receitaOS - custoOS) + (receitaVendas - custoVendas) + (receitaAvulsos - custoAvulsos);

    console.log('[HojeDebug] receitaOS =', receitaOS, '| receitaVendas =', receitaVendas, '| receitaAvulsos =', receitaAvulsos);
    console.log('[HojeDebug] faturamento =', faturamento, '| lucro =', lucro);

    setHojeData({
      faturamento,
      lucro,
      faturamentoAssistencia: receitaOS + receitaAvulsos,
      lucroAssistencia: (receitaOS - custoOS) + (receitaAvulsos - custoAvulsos),
      faturamentoProdutosPecas: receitaProdutosHoje,
      lucroProdutosPecas: receitaProdutosHoje - custoProdutosHoje,
      faturamentoDispositivos: receitaDispositivosHoje,
      lucroDispositivos: receitaDispositivosHoje - custoDispositivosHoje,
      carregando: false,
    });
  };

  const loadProdutosVendidos = async (inicio: Date, fim: Date) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const userId = resolvedUserIdRef.current ?? user.id;

    const inicioStr = format(inicio, "yyyy-MM-dd");
    const fimStr = format(fim, "yyyy-MM-dd");

    // Buscar vendas de produtos do mês do usuário logado
    const { data: vendasProdutos } = await supabase
      .from("vendas")
      .select("produto_id, quantidade, total")
      .eq("user_id", userId)
      .eq("tipo", "produto")
      .eq("cancelada", false)
      .gte("data", inicioStr)
      .lte("data", `${fimStr}T23:59:59`);

    if (!vendasProdutos || vendasProdutos.length === 0) {
      setProdutosMaisVendidos([]);
      setProdutosMenosVendidos([]);
      return;
    }

    // Agrupar por produto_id
    const produtosAgrupados: Record<string, { quantidade: number; total: number }> = {};
    vendasProdutos.forEach(v => {
      const id = v.produto_id || 'sem_id';
      if (!produtosAgrupados[id]) {
        produtosAgrupados[id] = { quantidade: 0, total: 0 };
      }
      produtosAgrupados[id].quantidade += Number(v.quantidade || 1);
      produtosAgrupados[id].total += Number(v.total || 0);
    });

    // Buscar nomes dos produtos
    const produtoIds = Object.keys(produtosAgrupados).filter(id => id !== 'sem_id');
    const { data: produtos } = await supabase
      .from("produtos")
      .select("id, nome")
      .in("id", produtoIds);

    const produtosMap: Record<string, string> = {};
    produtos?.forEach(p => {
      produtosMap[p.id] = p.nome;
    });

    // Criar lista de produtos vendidos
    const listaProdutos: ProdutoVendido[] = Object.entries(produtosAgrupados)
      .filter(([id]) => id !== 'sem_id' && produtosMap[id])
      .map(([id, dados]) => ({
        nome: produtosMap[id] || 'Produto',
        quantidade: dados.quantidade,
        total: dados.total,
      }));

    // Ordenar por quantidade
    const ordenadosPorQtd = [...listaProdutos].sort((a, b) => b.quantidade - a.quantidade);
    
    // Top 5 mais vendidos
    setProdutosMaisVendidos(ordenadosPorQtd.slice(0, 5));
    
    // Top 5 menos vendidos (invertendo a ordem)
    const menosVendidos = [...listaProdutos]
      .sort((a, b) => a.quantidade - b.quantidade)
      .slice(0, 5);
    setProdutosMenosVendidos(menosVendidos);
  };

  const getSaudacao = () => {
    const hora = new Date().getHours();
    if (hora >= 5 && hora < 12) return "Bom dia";
    if (hora >= 12 && hora < 18) return "Boa tarde";
    return "Boa noite";
  };

  const FRASES = [
    "Cada cliente atendido é uma oportunidade de fazer a diferença.",
    "O sucesso é a soma de pequenos esforços repetidos dia após dia.",
    "Qualidade no serviço é o melhor marketing que existe.",
    "Cada desafio superado é uma vitória que nos torna mais fortes.",
    "Um cliente satisfeito vale mais do que mil propagandas.",
    "A persistência é o caminho do êxito.",
    "Faça o que você faz tão bem que eles vão querer voltar.",
    "O trabalho duro vence o talento quando o talento não trabalha duro.",
    "Pequenos progressos ainda são progressos.",
    "A excelência não é um destino, é uma jornada contínua.",
    "Cada reparo bem feito constrói uma reputação sólida.",
    "Confie no processo e nos resultados que virão.",
    "A dedicação de hoje é o sucesso de amanhã.",
    "Quem trabalha com amor nunca trabalha em vão.",
    "O diferencial está nos detalhes que os outros ignoram.",
    "Grandes resultados vêm de pequenas ações consistentes.",
    "Seu trabalho importa mais do que você imagina.",
    "Cada dia é uma nova chance de ser melhor do que ontem.",
    "A confiança dos seus clientes é o seu maior ativo.",
    "Trabalhe com propósito e os resultados virão naturalmente.",
  ];

  const getFraseDiaria = () => {
    const inicio = new Date(new Date().getFullYear(), 0, 0);
    const diff = Number(new Date()) - Number(inicio);
    const diaDoAno = Math.floor(diff / (1000 * 60 * 60 * 24));
    return FRASES[diaDoAno % FRASES.length];
  };

  if (loading || carregandoAssinatura) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  const totalFaturamento = metrics.faturamentoServicos + metrics.faturamentoProdutos + metrics.faturamentoDispositivos + metrics.faturamentoAvulsos;

  return (
    <AppLayout>
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
      <TutorialAutoStart />
      {/* Mobile: saudação em cima, filtro + tema embaixo ocupando largura toda */}
      {/* Desktop: saudação à esquerda, data + filtro + tema à direita na mesma linha */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div data-tutorial="dashboard-title">
          <h1 className="text-2xl sm:text-3xl font-semibold mb-1">
            {nomeUsuario
              ? <>{getSaudacao()}, <span className="text-primary">{nomeUsuario}</span>!</>
              : <>{getSaudacao()}, <span className="text-primary">Bem Vindo</span>!</>
            }
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base italic">
            {getFraseDiaria()}
          </p>
        </div>
        <div className="flex flex-col items-stretch sm:items-end gap-2">
          <p className="text-muted-foreground text-sm font-medium sm:text-right">
            {mesSelecionado === "atual"
              ? format(new Date(), "MMMM 'de' yyyy", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase())
              : (opçõesMeses.find(m => m.valor === mesSelecionado)?.label || "").replace(/^\w/, c => c.toUpperCase())}
          </p>
          <div className="flex items-center gap-3">
            <CardCotacaoDolar />
            <Select value={mesSelecionado} onValueChange={setMesSelecionado}>
              <SelectTrigger className="flex-1 sm:flex-none sm:w-[200px]">
                <CalendarIcon className="h-4 w-4 mr-2 shrink-0" />
                <SelectValue placeholder="Selecione o mês" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="atual">Mês atual</SelectItem>
                {opçõesMeses.map((mes) => (
                  <SelectItem key={mes.valor} value={mes.valor}>
                    {mes.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {mounted && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                title={theme === "dark" ? "Modo claro" : "Modo escuro"}
                data-tutorial="theme-toggle"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Banner de Ativação de Notificações */}
      <BannerAtivarNotificacoes />

      {/* Banners de trial agora ficam no AppLayout */}

      {/* Avisos do Sistema */}
      <CardAvisosSistema />

      {/* Dashboard bloqueado para funcionário - mostra layout sem dados */}
      {dashboardBloqueado && (
        <Alert className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Acesso restrito</AlertTitle>
          <AlertDescription>
            O acesso aos dados do Dashboard está desabilitado para o seu perfil. Entre em contato com o dono da loja para mais informações.
          </AlertDescription>
        </Alert>
      )}

      

      {!dashboardBloqueado && (
        <>
          {/* Card de Aniversariantes do Mês (Plano Profissional) */}
          {!loadingClientes && (
            <div className="mb-4">
              {temPlanoProfissional ? (
                <CardAniversariantes clientes={clientes} />
              ) : (
                <CardAniversariantesBloqueado />
              )}
            </div>
          )}


          {/* Banner de Trial Expirado */}
          {!migracaoNecessaria && isTrialExpirado && (
            <Alert className="mb-6 border-2 border-primary bg-gradient-to-r from-primary/10 via-primary/5 to-background">
              <Sparkles className="h-5 w-5 text-primary" />
              <AlertTitle className="text-lg font-bold flex items-center gap-2">
                Trial Expirado
              </AlertTitle>
              <AlertDescription className="space-y-3">
                <p className="text-sm">
                  Seu período de teste expirou. Assine um plano para continuar usando o sistema!
                </p>
                <Button onClick={() => navigate("/plano")} className="w-full sm:w-auto">
                  <Crown className="mr-2 h-4 w-4" />
                  Ver Planos Disponíveis
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Card de Resumo Total */}
          <div className="relative mb-6 rounded-2xl overflow-hidden border border-blue-500/30 dark:border-blue-400/20 shadow-[0_0_60px_-15px_rgba(59,130,246,0.4)] dark:shadow-[0_0_60px_-15px_rgba(59,130,246,0.3)]">
            {/* fundo gradiente — usa cores personalizadas das configurações */}
            <div
              className="absolute inset-0"
              style={{ background: `linear-gradient(135deg, ${cores.card_faturamento_from}, ${cores.card_faturamento_via}, ${cores.card_faturamento_to})` }}
            />
            {/* grade decorativa */}
            <div className="absolute inset-0 opacity-10 [background-image:linear-gradient(rgba(255,255,255,.15)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.15)_1px,transparent_1px)] [background-size:32px_32px]" />
            {/* brilho no canto */}
            <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-8 -left-8 w-36 h-36 bg-indigo-400/20 rounded-full blur-2xl pointer-events-none" />
            {/* scanline sutil dark */}
            <div className="absolute inset-0 hidden dark:block bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.05)_50%)] bg-[length:100%_4px] pointer-events-none opacity-20 z-0" />

            <div className="relative z-10 p-5 sm:p-7">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-mono text-blue-200/80 tracking-widest uppercase">Faturamento Total</span>
                    <span className="h-px flex-1 bg-blue-400/30 hidden sm:block" />
                  </div>
                  <div className="flex items-baseline gap-3">
                    <h2 className="text-3xl sm:text-5xl font-bold font-mono tracking-tight text-white">
                      <ValorMonetario valor={totalFaturamento} />
                    </h2>
                  </div>
                  <p className="text-[11px] text-blue-200/60 font-mono mt-2 uppercase tracking-wider">
                    {mesSelecionado === "atual"
                      ? format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })
                      : (opçõesMeses.find(m => m.valor === mesSelecionado)?.label || "")}
                  </p>
                </div>

                {/* mini breakdown por categoria */}
                <div className="flex flex-col gap-2 sm:items-end">
                  <div className="flex items-center gap-3 text-xs font-mono text-blue-100/80">
                    <Wrench className="h-3.5 w-3.5 text-blue-300" />
                    <span className="text-blue-200/60 uppercase tracking-wider">Assistência</span>
                    <span className="font-semibold text-white"><ValorMonetario valor={metrics.faturamentoServicos + metrics.faturamentoAvulsos} /></span>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-mono text-blue-100/80">
                    <Package className="h-3.5 w-3.5 text-blue-300" />
                    <span className="text-blue-200/60 uppercase tracking-wider">Produtos</span>
                    <span className="font-semibold text-white"><ValorMonetario valor={metrics.faturamentoProdutos} /></span>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-mono text-blue-100/80">
                    <Smartphone className="h-3.5 w-3.5 text-blue-300" />
                    <span className="text-blue-200/60 uppercase tracking-wider">Dispositivos</span>
                    <span className="font-semibold text-white"><ValorMonetario valor={metrics.faturamentoDispositivos} /></span>
                  </div>
                  <div className="h-px w-full bg-blue-400/30 my-1" />
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-300" />
                    <span className="text-xs font-mono text-blue-200/70 uppercase tracking-wider">Lucro do mês</span>
                    <span className={`text-sm font-bold font-mono ${financeiroData.lucroTotal >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                      <ValorMonetario valor={financeiroData.lucroTotal} />
                    </span>
                  </div>
                </div>
              </div>

              {/* barra de progresso por categoria */}
              {totalFaturamento > 0 && (
                <div className="mt-5">
                  <div className="flex h-1.5 rounded-full overflow-hidden gap-0.5">
                    <div
                      className="bg-blue-300/80 rounded-full transition-all"
                      style={{ width: `${((metrics.faturamentoServicos + metrics.faturamentoAvulsos) / totalFaturamento) * 100}%` }}
                    />
                    <div
                      className="bg-violet-300/80 rounded-full transition-all"
                      style={{ width: `${(metrics.faturamentoProdutos / totalFaturamento) * 100}%` }}
                    />
                    <div
                      className="bg-cyan-300/80 rounded-full transition-all"
                      style={{ width: `${(metrics.faturamentoDispositivos / totalFaturamento) * 100}%` }}
                    />
                  </div>
                  <div className="flex gap-4 mt-2">
                    <span className="flex items-center gap-1 text-[9px] font-mono text-blue-200/50 uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-300/80 inline-block" />Assistência
                    </span>
                    <span className="flex items-center gap-1 text-[9px] font-mono text-blue-200/50 uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-300/80 inline-block" />Produtos
                    </span>
                    <span className="flex items-center gap-1 text-[9px] font-mono text-blue-200/50 uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-300/80 inline-block" />Dispositivos
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Card Duplo — Faturamento Hoje + Lucro Hoje */}
          <div className="grid grid-cols-2 gap-0 mb-4 rounded-xl overflow-hidden border border-blue-100 dark:border-white/10 shadow-[0_0_40px_-10px_rgba(59,130,246,0.15)] dark:shadow-[0_0_40px_-10px_rgba(59,130,246,0.25)] relative">
            {/* scanline sutil — só no dark */}
            <div className="absolute inset-0 hidden dark:block bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.04)_50%)] bg-[length:100%_4px] pointer-events-none opacity-20 z-0" />

            {/* Faturamento Hoje */}
            <div className="relative bg-gradient-to-br from-white via-blue-50 to-white dark:from-slate-900 dark:via-blue-950/60 dark:to-slate-900 p-4 sm:p-5 flex flex-col gap-3 border-r border-blue-100 dark:border-white/10 overflow-hidden">
              <div className="absolute -top-6 -right-6 w-24 h-24 bg-blue-400/10 dark:bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-60" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500" />
                  </span>
                  <span className="text-[10px] font-mono text-blue-500/70 dark:text-blue-400/70 tracking-widest uppercase">LIVE</span>
                </div>
                <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/20 flex items-center justify-center">
                  <Activity className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <div>
                <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500 tracking-wider uppercase mb-1">Faturamento Hoje</p>
                {hojeData.carregando ? (
                  <div className="h-7 w-32 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                ) : (
                  <p className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white font-mono tracking-tight">
                    <ValorMonetario valor={hojeData.faturamento} />
                  </p>
                )}
              </div>
              <div className="h-[1px] bg-gradient-to-r from-blue-400/40 via-blue-300/10 to-transparent dark:from-blue-500/30 dark:via-blue-400/10" />
              <p className="text-[10px] text-slate-400 dark:text-slate-600 font-mono">receita bruta do dia</p>
            </div>

            {/* Lucro Hoje */}
            <div className="relative bg-gradient-to-br from-white via-emerald-50 to-white dark:from-slate-900 dark:via-emerald-950/40 dark:to-slate-900 p-4 sm:p-5 flex flex-col gap-3 overflow-hidden">
              <div className="absolute -top-6 -left-6 w-24 h-24 bg-emerald-400/10 dark:bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                  </span>
                  <span className="text-[10px] font-mono text-emerald-600/70 dark:text-emerald-400/70 tracking-widest uppercase">LIVE</span>
                </div>
                <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center">
                  <Zap className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
              <div>
                <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500 tracking-wider uppercase mb-1">Lucro Hoje</p>
                {hojeData.carregando ? (
                  <div className="h-7 w-32 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                ) : (
                  <p className={`text-xl sm:text-2xl font-bold font-mono tracking-tight ${hojeData.lucro >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                    <ValorMonetario valor={hojeData.lucro} />
                  </p>
                )}
              </div>
              <div className="h-[1px] bg-gradient-to-r from-emerald-400/40 via-emerald-300/10 to-transparent dark:from-emerald-500/30 dark:via-emerald-400/10" />
              <p className="text-[10px] text-slate-400 dark:text-slate-600 font-mono">receita − custo do dia</p>
            </div>
          </div>

          {/* Cards Hoje por Categoria */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            {/* Assistência */}
            <div className="rounded-xl overflow-hidden border border-blue-100 dark:border-white/10 shadow-[0_0_30px_-10px_rgba(59,130,246,0.15)] dark:shadow-[0_0_30px_-10px_rgba(59,130,246,0.2)] relative">
              <div className="absolute inset-0 hidden dark:block bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.04)_50%)] bg-[length:100%_4px] pointer-events-none opacity-20 z-0" />
              {/* header */}
              <div className="relative bg-gradient-to-r from-blue-50 to-white dark:from-slate-800/80 dark:to-slate-900 px-4 py-2.5 flex items-center gap-2 border-b border-blue-100 dark:border-white/10">
                <div className="h-6 w-6 rounded-md bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
                  <Wrench className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-[11px] font-mono font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-widest">Assistência</span>
              </div>
              <div className="grid grid-cols-2 gap-0">
                {/* Faturamento */}
                <div className="relative bg-gradient-to-br from-white via-blue-50/50 to-white dark:from-slate-900 dark:via-blue-950/40 dark:to-slate-900 p-3 sm:p-4 flex flex-col gap-2 border-r border-blue-100 dark:border-white/10 overflow-hidden">
                  <div className="absolute -top-4 -right-4 w-16 h-16 bg-blue-400/10 rounded-full blur-xl pointer-events-none" />
                  <div className="flex items-center justify-between">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-60" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500" />
                    </span>
                    <Activity className="h-3.5 w-3.5 text-blue-500/60" />
                  </div>
                  <div>
                    <p className="text-[9px] font-mono text-slate-400 dark:text-slate-500 tracking-wider uppercase mb-0.5">Fat. Hoje</p>
                    {hojeData.carregando ? (
                      <div className="h-5 w-20 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                    ) : (
                      <p className="text-sm sm:text-base font-bold text-slate-800 dark:text-white font-mono">
                        <ValorMonetario valor={hojeData.faturamentoAssistencia} />
                      </p>
                    )}
                  </div>
                </div>
                {/* Lucro */}
                <div className="relative bg-gradient-to-br from-white via-emerald-50/50 to-white dark:from-slate-900 dark:via-emerald-950/30 dark:to-slate-900 p-3 sm:p-4 flex flex-col gap-2 overflow-hidden">
                  <div className="absolute -top-4 -left-4 w-16 h-16 bg-emerald-400/10 rounded-full blur-xl pointer-events-none" />
                  <div className="flex items-center justify-between">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                    </span>
                    <Zap className="h-3.5 w-3.5 text-emerald-500/60" />
                  </div>
                  <div>
                    <p className="text-[9px] font-mono text-slate-400 dark:text-slate-500 tracking-wider uppercase mb-0.5">Lucro Hoje</p>
                    {hojeData.carregando ? (
                      <div className="h-5 w-20 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                    ) : (
                      <p className={`text-sm sm:text-base font-bold font-mono ${hojeData.lucroAssistencia >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                        <ValorMonetario valor={hojeData.lucroAssistencia} />
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Produtos e Peças */}
            <div className="rounded-xl overflow-hidden border border-violet-100 dark:border-white/10 shadow-[0_0_30px_-10px_rgba(139,92,246,0.15)] dark:shadow-[0_0_30px_-10px_rgba(139,92,246,0.2)] relative">
              <div className="absolute inset-0 hidden dark:block bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.04)_50%)] bg-[length:100%_4px] pointer-events-none opacity-20 z-0" />
              <div className="relative bg-gradient-to-r from-violet-50 to-white dark:from-slate-800/80 dark:to-slate-900 px-4 py-2.5 flex items-center gap-2 border-b border-violet-100 dark:border-white/10">
                <div className="h-6 w-6 rounded-md bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center">
                  <Package className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                </div>
                <span className="text-[11px] font-mono font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-widest">Produtos & Peças</span>
              </div>
              <div className="grid grid-cols-2 gap-0">
                <div className="relative bg-gradient-to-br from-white via-violet-50/50 to-white dark:from-slate-900 dark:via-violet-950/30 dark:to-slate-900 p-3 sm:p-4 flex flex-col gap-2 border-r border-violet-100 dark:border-white/10 overflow-hidden">
                  <div className="absolute -top-4 -right-4 w-16 h-16 bg-violet-400/10 rounded-full blur-xl pointer-events-none" />
                  <div className="flex items-center justify-between">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-500 opacity-60" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-violet-500" />
                    </span>
                    <Activity className="h-3.5 w-3.5 text-violet-500/60" />
                  </div>
                  <div>
                    <p className="text-[9px] font-mono text-slate-400 dark:text-slate-500 tracking-wider uppercase mb-0.5">Fat. Hoje</p>
                    {hojeData.carregando ? (
                      <div className="h-5 w-20 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                    ) : (
                      <p className="text-sm sm:text-base font-bold text-slate-800 dark:text-white font-mono">
                        <ValorMonetario valor={hojeData.faturamentoProdutosPecas} />
                      </p>
                    )}
                  </div>
                </div>
                <div className="relative bg-gradient-to-br from-white via-emerald-50/50 to-white dark:from-slate-900 dark:via-emerald-950/30 dark:to-slate-900 p-3 sm:p-4 flex flex-col gap-2 overflow-hidden">
                  <div className="absolute -top-4 -left-4 w-16 h-16 bg-emerald-400/10 rounded-full blur-xl pointer-events-none" />
                  <div className="flex items-center justify-between">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                    </span>
                    <Zap className="h-3.5 w-3.5 text-emerald-500/60" />
                  </div>
                  <div>
                    <p className="text-[9px] font-mono text-slate-400 dark:text-slate-500 tracking-wider uppercase mb-0.5">Lucro Hoje</p>
                    {hojeData.carregando ? (
                      <div className="h-5 w-20 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                    ) : (
                      <p className={`text-sm sm:text-base font-bold font-mono ${hojeData.lucroProdutosPecas >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                        <ValorMonetario valor={hojeData.lucroProdutosPecas} />
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Dispositivos */}
            <div className="rounded-xl overflow-hidden border border-cyan-100 dark:border-white/10 shadow-[0_0_30px_-10px_rgba(6,182,212,0.15)] dark:shadow-[0_0_30px_-10px_rgba(6,182,212,0.2)] relative">
              <div className="absolute inset-0 hidden dark:block bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.04)_50%)] bg-[length:100%_4px] pointer-events-none opacity-20 z-0" />
              <div className="relative bg-gradient-to-r from-cyan-50 to-white dark:from-slate-800/80 dark:to-slate-900 px-4 py-2.5 flex items-center gap-2 border-b border-cyan-100 dark:border-white/10">
                <div className="h-6 w-6 rounded-md bg-cyan-100 dark:bg-cyan-500/20 flex items-center justify-center">
                  <Smartphone className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
                </div>
                <span className="text-[11px] font-mono font-semibold text-cyan-600 dark:text-cyan-400 uppercase tracking-widest">Dispositivos</span>
              </div>
              <div className="grid grid-cols-2 gap-0">
                <div className="relative bg-gradient-to-br from-white via-cyan-50/50 to-white dark:from-slate-900 dark:via-cyan-950/30 dark:to-slate-900 p-3 sm:p-4 flex flex-col gap-2 border-r border-cyan-100 dark:border-white/10 overflow-hidden">
                  <div className="absolute -top-4 -right-4 w-16 h-16 bg-cyan-400/10 rounded-full blur-xl pointer-events-none" />
                  <div className="flex items-center justify-between">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-500 opacity-60" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan-500" />
                    </span>
                    <Activity className="h-3.5 w-3.5 text-cyan-500/60" />
                  </div>
                  <div>
                    <p className="text-[9px] font-mono text-slate-400 dark:text-slate-500 tracking-wider uppercase mb-0.5">Fat. Hoje</p>
                    {hojeData.carregando ? (
                      <div className="h-5 w-20 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                    ) : (
                      <p className="text-sm sm:text-base font-bold text-slate-800 dark:text-white font-mono">
                        <ValorMonetario valor={hojeData.faturamentoDispositivos} />
                      </p>
                    )}
                  </div>
                </div>
                <div className="relative bg-gradient-to-br from-white via-emerald-50/50 to-white dark:from-slate-900 dark:via-emerald-950/30 dark:to-slate-900 p-3 sm:p-4 flex flex-col gap-2 overflow-hidden">
                  <div className="absolute -top-4 -left-4 w-16 h-16 bg-emerald-400/10 rounded-full blur-xl pointer-events-none" />
                  <div className="flex items-center justify-between">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                    </span>
                    <Zap className="h-3.5 w-3.5 text-emerald-500/60" />
                  </div>
                  <div>
                    <p className="text-[9px] font-mono text-slate-400 dark:text-slate-500 tracking-wider uppercase mb-0.5">Lucro Hoje</p>
                    {hojeData.carregando ? (
                      <div className="h-5 w-20 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                    ) : (
                      <p className={`text-sm sm:text-base font-bold font-mono ${hojeData.lucroDispositivos >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                        <ValorMonetario valor={hojeData.lucroDispositivos} />
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Cards Financeiros */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
            <Card className="p-4 sm:p-6 shadow-md border-l-4 border-l-primary">
              <div className="flex items-center justify-between mb-3">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-1">Faturamento Total</p>
              <p className="text-lg sm:text-xl font-semibold text-primary">
                <ValorMonetario valor={totalFaturamento} />
              </p>
            </Card>

            <Card className="p-4 sm:p-6 shadow-md border-l-4 border-l-red-500">
              <div className="flex items-center justify-between mb-3">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-red-600 dark:text-red-400" />
                </div>
                <div className="text-right">
                  <p className="text-xl sm:text-2xl font-semibold">{financeiroData.contasHojeQtd}</p>
                  <p className="text-xs text-muted-foreground">contas</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-1">Contas a Pagar Hoje</p>
              <p className="text-lg sm:text-xl font-semibold text-red-600 dark:text-red-400">
                <ValorMonetario valor={financeiroData.contasHojeTotal} />
              </p>
            </Card>

            <Card className="p-4 sm:p-6 shadow-md border-l-4 border-l-orange-500">
              <div className="flex items-center justify-between mb-3">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                  <TrendingDown className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-1">Custo Total do Mês</p>
              <p className="text-lg sm:text-xl font-semibold text-orange-600 dark:text-orange-400">
                <ValorMonetario valor={financeiroData.custoTotal} />
              </p>
            </Card>

            <Card className="p-4 sm:p-6 shadow-md border-l-4 border-l-green-500">
              <div className="flex items-center justify-between mb-3">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Wallet className="h-5 w-5 sm:h-6 sm:w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-1">Lucro do Mês</p>
              <p className={`text-lg sm:text-xl font-semibold ${financeiroData.lucroTotal >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                <ValorMonetario valor={financeiroData.lucroTotal} />
              </p>
            </Card>

            <Card className="p-4 sm:p-6 shadow-md border-l-4 border-l-blue-500">
              <div className="flex items-center justify-between mb-3">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Percent className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-1">Margem de Lucro</p>
              <p className={`text-lg sm:text-xl font-semibold ${financeiroData.margemLucro >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                {financeiroData.margemLucro.toFixed(1)}%
              </p>
            </Card>

            <Card className="p-4 sm:p-6 shadow-md border-l-4 border-l-purple-500">
              <div className="flex items-center justify-between mb-3">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <CreditCard className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-1">Taxas de Cartão</p>
              <p className="text-lg sm:text-xl font-semibold text-purple-600 dark:text-purple-400">
                <ValorMonetario valor={financeiroData.taxasCartao} />
              </p>
            </Card>

          </div>

          {/* Métricas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
            <Card className="p-6 shadow-md hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center">
                  <Wrench className="h-6 w-6 text-success" />
                </div>
                <div className="text-right">
                  <p className="text-2xl font-semibold">{metrics.numServicos}</p>
                  <p className="text-xs text-muted-foreground">serviços</p>
                </div>
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-sm text-muted-foreground">Faturamento OS</p>
                  <p className="text-xl font-semibold"><ValorMonetario valor={metrics.faturamentoServicos} /></p>
                </div>
                {metrics.numAvulsos > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground">Serviços Avulsos ({metrics.numAvulsos})</p>
                    <p className="text-lg font-semibold text-violet-600 dark:text-violet-400"><ValorMonetario valor={metrics.faturamentoAvulsos} /></p>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground">Custo</p>
                    <p className="text-sm font-medium text-orange-600 dark:text-orange-400"><ValorMonetario valor={metrics.custoServicos + metrics.custoAvulsos} /></p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Margem</p>
                    <p className={`text-sm font-semibold ${metrics.margemServicos >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {metrics.margemServicos.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6 shadow-md hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 rounded-xl bg-accent flex items-center justify-center">
                  <Package className="h-6 w-6 text-foreground" />
                </div>
                <div className="text-right">
                  <p className="text-2xl font-semibold">{metrics.numProdutos}</p>
                  <p className="text-xs text-muted-foreground">produtos</p>
                </div>
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-sm text-muted-foreground">Faturamento</p>
                  <p className="text-xl font-semibold"><ValorMonetario valor={metrics.faturamentoProdutos} /></p>
                </div>
                <div className="flex justify-between items-center pt-2 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground">Custo</p>
                    <p className="text-sm font-medium text-orange-600 dark:text-orange-400"><ValorMonetario valor={metrics.custoProdutos} /></p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Margem</p>
                    <p className={`text-sm font-semibold ${metrics.margemProdutos >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {metrics.margemProdutos.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6 shadow-md hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Smartphone className="h-6 w-6 text-primary" />
                </div>
                <div className="text-right">
                  <p className="text-2xl font-semibold">{metrics.numDispositivos}</p>
                  <p className="text-xs text-muted-foreground">dispositivos</p>
                </div>
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-sm text-muted-foreground">Faturamento</p>
                  <p className="text-xl font-semibold"><ValorMonetario valor={metrics.faturamentoDispositivos} /></p>
                </div>
                <div className="flex justify-between items-center pt-2 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground">Custo</p>
                    <p className="text-sm font-medium text-orange-600 dark:text-orange-400"><ValorMonetario valor={metrics.custoDispositivos} /></p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Margem</p>
                    <p className={`text-sm font-semibold ${metrics.margemDispositivos >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {metrics.margemDispositivos.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Gráficos de Análise */}
          <div className="mb-6">
            <Suspense fallback={<div className="h-48 rounded-xl bg-muted/40 animate-pulse" />}>
              <GraficosDashboard
                metricas={{
                  faturamentoServicos: metrics.faturamentoServicos,
                  faturamentoProdutos: metrics.faturamentoProdutos,
                  faturamentoDispositivos: metrics.faturamentoDispositivos,
                  custoServicos: metrics.custoServicos,
                  custoProdutos: metrics.custoProdutos,
                  custoDispositivos: metrics.custoDispositivos,
                }}
                produtosMaisVendidos={produtosMaisVendidos}
                produtosMenosVendidos={produtosMenosVendidos}
                isDemoMode={isTrialExpirado}
              />
            </Suspense>
          </div>

          {/* Ações Rápidas */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            <Button
              size="lg"
              className="h-auto py-4 sm:py-6"
              onClick={() => navigate("/os")}
            >
              <div className="flex flex-col items-center gap-1 sm:gap-2">
                <Wrench className="h-5 w-5 sm:h-6 sm:w-6" />
                <span className="text-xs sm:text-sm">Nova OS</span>
              </div>
            </Button>

            <Button
              size="lg"
              variant="secondary"
              className="h-auto py-4 sm:py-6"
              onClick={() => navigate("/pdv")}
            >
              <div className="flex flex-col items-center gap-1 sm:gap-2">
                <DollarSign className="h-5 w-5 sm:h-6 sm:w-6" />
                <span className="text-xs sm:text-sm">PDV</span>
              </div>
            </Button>

            <Button
              size="lg"
              variant="outline"
              className="h-auto py-4 sm:py-6 col-span-2 sm:col-span-1"
              onClick={() => navigate("/produtos")}
            >
              <div className="flex flex-col items-center gap-1 sm:gap-2">
                <Package className="h-5 w-5 sm:h-6 sm:w-6" />
                <span className="text-xs sm:text-sm">Estoque</span>
              </div>
            </Button>
          </div>

          {/* Card de Feedback */}
          <div className="mt-6">
            <CardFeedback />
          </div>
        </>
      )}
      
    </main>
  </AppLayout>
  );
};

export default Dashboard;
