import { Suspense, lazy, useEffect, useState, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Plus, FileText, Settings, Hash, MessageCircle, Layout, ClipboardList, Palette, Wrench, Trash2, Upload, CreditCard, List, Columns3, CalendarIcon, X, Tag, RadioTower, Copy, Eye, ChevronUp, ChevronDown } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TerceirizadaTab } from "@/components/ordens/tiny/TerceirizadaTab";
import { useTinyIntegration } from "@/hooks/useTinyIntegration";
import { checkTinyAccess } from "@/lib/checkTinyAccess";
import { OSGerencialCards } from "@/components/ordens/OSGerencialCards";
import { OSBannerParadas, OSChipsGerenciais, OSGerencialSnapshot } from "@/components/ordens/OSResumoBarra";
import { useOSGerencial } from "@/hooks/useOSGerencial";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useOrdensServico, type OrdemServico } from "@/hooks/useOrdensServico";
import { useAssinatura } from "@/hooks/useAssinatura";
import { useOSStatusConfig } from "@/hooks/useOSStatusConfig";
import { useOSTracking } from "@/hooks/useOSTracking";
import { BuscaOrdemServico } from "@/components/ordens/BuscaOrdemServico";
import { TabelaOrdensServico } from "@/components/ordens/TabelaOrdensServico";
import { useConfiguracaoLoja } from "@/hooks/useConfiguracaoLoja";
import { DashboardOrdensServico } from "@/components/ordens/DashboardOrdensServico";
import { AppLayout } from "@/components/layout/AppLayout";
import { TermoResponsabilidadeConfig } from "@/types/configuracao-loja";
import { supabase } from "@/integrations/supabase/client";
import { useServicosAvulsos } from "@/hooks/useServicosAvulsos";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { KanbanOrdensServico } from "@/components/ordens/KanbanOrdensServico";

const DialogOrdemServico = lazy(() => import("@/components/ordens/DialogOrdemServico").then((m) => ({ default: m.DialogOrdemServico })));
const DialogVisualizacaoOrdem = lazy(() => import("@/components/ordens/DialogVisualizacaoOrdem").then((m) => ({ default: m.DialogVisualizacaoOrdem })));
const DialogAssinaturaSaida = lazy(() => import("@/components/ordens/DialogAssinaturaSaida").then((m) => ({ default: m.DialogAssinaturaSaida })));
const DialogEnviarWhatsApp = lazy(() => import("@/components/ordens/DialogEnviarWhatsApp").then((m) => ({ default: m.DialogEnviarWhatsApp })));
const DialogConfiguracaoMensagensWhatsApp = lazy(() => import("@/components/ordens/DialogConfiguracaoMensagensWhatsApp").then((m) => ({ default: m.DialogConfiguracaoMensagensWhatsApp })));
const DialogConfiguracaoTermoGarantia = lazy(() => import("@/components/ordens/DialogConfiguracaoTermoGarantia").then((m) => ({ default: m.DialogConfiguracaoTermoGarantia })));
const DialogConfiguracaoLayoutOS = lazy(() => import("@/components/ordens/DialogConfiguracaoLayoutOS").then((m) => ({ default: m.DialogConfiguracaoLayoutOS })));
const DialogConfiguracaoTermoResponsabilidade = lazy(() => import("@/components/ordens/DialogConfiguracaoTermoResponsabilidade").then((m) => ({ default: m.DialogConfiguracaoTermoResponsabilidade })));
const DialogPopupStatusConta = lazy(() => import("@/components/ordens/DialogPopupStatusConta").then((m) => ({ default: m.DialogPopupStatusConta })));
const ImpressaoOrdemServico = lazy(() => import("@/components/ordens/ImpressaoOrdemServico").then((m) => ({ default: m.ImpressaoOrdemServico })));
const ImpressaoTermoResponsabilidade = lazy(() => import("@/components/ordens/ImpressaoTermoResponsabilidade").then((m) => ({ default: m.ImpressaoTermoResponsabilidade })));
const ConfiguracaoNumeracaoOS = lazy(() => import("@/components/configuracoes/ConfiguracaoNumeracaoOS").then((m) => ({ default: m.ConfiguracaoNumeracaoOS })));
const ConfiguracaoTaxasCartao = lazy(() => import("@/components/configuracoes/ConfiguracaoTaxasCartao").then((m) => ({ default: m.ConfiguracaoTaxasCartao })));
const ConfiguracaoStatusOS = lazy(() => import("@/components/configuracoes/ConfiguracaoStatusOS").then((m) => ({ default: m.ConfiguracaoStatusOS })));
const DialogLimiteAtingido = lazy(() => import("@/components/planos/DialogLimiteAtingido").then((m) => ({ default: m.DialogLimiteAtingido })));
const DialogServicoAvulso = lazy(() => import("@/components/ordens/DialogServicoAvulso").then((m) => ({ default: m.DialogServicoAvulso })));
const DialogImportarOS = lazy(() => import("@/components/ordens/DialogImportarOS").then((m) => ({ default: m.DialogImportarOS })));
const DialogConfiguracaoEtiqueta = lazy(() => import("@/components/ordens/DialogConfiguracaoEtiqueta").then((m) => ({ default: m.DialogConfiguracaoEtiqueta })));
const ImpressaoEtiqueta = lazy(() => import("@/components/ordens/ImpressaoEtiqueta").then((m) => ({ default: m.ImpressaoEtiqueta })));
const DialogPersonalizarColunas = lazy(() => import("@/components/ordens/DialogPersonalizarColunas").then((m) => ({ default: m.DialogPersonalizarColunas })));
const DialogConfiguracaoTracking = lazy(() => import("@/components/ordens/DialogConfiguracaoTracking").then((m) => ({ default: m.DialogConfiguracaoTracking })));

export default function OrdemServicoPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [temAcessoTiny, setTemAcessoTiny] = useState(false);
  const [checandoAcessoTiny, setChecandoAcessoTiny] = useState(true);
  const [chipsExpandido, setChipsExpandido] = useState(() => {
    const salvo = localStorage.getItem("os_chips_gerenciais_expandido");
    return salvo === null ? false : salvo === "true";
  });

  function toggleChipsExpandido() {
    setChipsExpandido((prev) => {
      const proximo = !prev;
      localStorage.setItem("os_chips_gerenciais_expandido", String(proximo));
      return proximo;
    });
  }
  const [abaAtiva, setAbaAtiva] = useState<"minhas" | "terceirizada">(
    tabParam === "terceirizada" ? "terceirizada" : "minhas"
  );

  useEffect(() => {
    checkTinyAccess().then((acesso) => {
      setTemAcessoTiny(acesso);
      setChecandoAcessoTiny(false);
      if (!acesso && abaAtiva === "terceirizada") {
        setAbaAtiva("minhas");
        setSearchParams({});
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    integration,
    loading: integrationLoading,
    iniciarOAuth,
    desconectar,
    atualizarIntervalo,
  } = useTinyIntegration();

  const handleMudarAba = (aba: string) => {
    setAbaAtiva(aba as "minhas" | "terceirizada");
    if (aba === "terceirizada") {
      setSearchParams({ tab: "terceirizada" });
    } else {
      setSearchParams({});
    }
  };

  // Sync URL → aba quando conectar via OAuth callback (?connected=true)
  useEffect(() => {
    if (searchParams.get("connected") === "true") {
      setAbaAtiva("terceirizada");
      setSearchParams({ tab: "terceirizada" });
    }
  }, []);

  const [dialogAberto, setDialogAberto] = useState(false);
  const [dialogVisualizacao, setDialogVisualizacao] = useState(false);
  const [ordemSelecionada, setOrdemSelecionada] = useState<OrdemServico | null>(null);
  const [ordemParaExcluir, setOrdemParaExcluir] = useState<OrdemServico | null>(null);
  const [ordemParaImprimir, setOrdemParaImprimir] = useState<OrdemServico | null>(null);
  const [ordemParaImprimirTermo, setOrdemParaImprimirTermo] = useState<OrdemServico | null>(null);
  const [dialogAssinaturaSaida, setDialogAssinaturaSaida] = useState(false);
  const [ordemParaAssinatura, setOrdemParaAssinatura] = useState<OrdemServico | null>(null);
  const [dialogWhatsApp, setDialogWhatsApp] = useState(false);
  const [ordemParaWhatsApp, setOrdemParaWhatsApp] = useState<OrdemServico | null>(null);
  const [dialogLimiteAtingido, setDialogLimiteAtingido] = useState(false);
  const [dialogNumeracao, setDialogNumeracao] = useState(false);
  const [dialogMensagensWhatsApp, setDialogMensagensWhatsApp] = useState(false);
  const [dialogTermoGarantia, setDialogTermoGarantia] = useState(false);
  const [dialogLayoutOS, setDialogLayoutOS] = useState(false);
  const [dialogTermoResponsabilidade, setDialogTermoResponsabilidade] = useState(false);
  const [dialogStatusOS, setDialogStatusOS] = useState(false);
  const [dialogTaxasCartao, setDialogTaxasCartao] = useState(false);
  const [contadorOS, setContadorOS] = useState({ usadas: 0, limite: -1, percentual: 0, ilimitado: true, restantes: Infinity });
  const [dialogPopupConta, setDialogPopupConta] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<{ id: string; slug: string; nome: string } | null>(null);
  const [dialogServicoAvulso, setDialogServicoAvulso] = useState(false);
  const [avulsoParaExcluir, setAvulsoParaExcluir] = useState<string | null>(null);
  const [dialogImportarOS, setDialogImportarOS] = useState(false);
  const [visualizacao, setVisualizacao] = useState<"tabela" | "kanban">("tabela");
  const [dialogEtiqueta, setDialogEtiqueta] = useState(false);
  const [ordemParaEtiqueta, setOrdemParaEtiqueta] = useState<OrdemServico | null>(null);
  const [dialogPersonalizarColunas, setDialogPersonalizarColunas] = useState(false);
  const [dialogTracking, setDialogTracking] = useState(false);
  const etiquetaPrintWindowRef = useRef<Window | null>(null);
  const osGerencialRef = useRef<HTMLDivElement | null>(null);
  const [usoCompartilhamentos, setUsoCompartilhamentos] = useState({ usado: 0, limite: 0, plano: '' });
  const [dialogCompartilharAberto, setDialogCompartilharAberto] = useState(false);
  const [linkCompartilhamento, setLinkCompartilhamento] = useState('');
  const [ordemCompartilhar, setOrdemCompartilhar] = useState<OrdemServico | null>(null);
  const { config: configuracaoLoja, refetch: refetchConfig } = useConfiguracaoLoja();
  const { obterContagemOSMes, abrirPaginaPagamento, limites } = useAssinatura();
  const { statusList, getStatusBySlug } = useOSStatusConfig();
  const { servicosAvulsos, criarServicoAvulso, atualizarStatusAvulso, excluirServicoAvulso } = useServicosAvulsos();
  const { compartilharWhatsApp, gerarLink } = useOSTracking();

  useEffect(() => {
    const buscarUso = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const agora = new Date();
      const [{ data: uso }, { data: assinatura }] = await Promise.all([
        supabase
          .from('os_tracking_uso')
          .select('total_compartilhamentos')
          .eq('user_id', user.id)
          .eq('mes', agora.getMonth() + 1)
          .eq('ano', agora.getFullYear())
          .maybeSingle(),
        supabase
          .from('assinaturas')
          .select('plano_tipo')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle(),
      ]);

      const LIMITES: Record<string, number> = {
        basico_mensal: 0, basico_anual: 0,
        intermediario_mensal: 10, intermediario_anual: 10,
        profissional_mensal: 50, profissional_anual: 50,
        profissional_ultra_mensal: -1, profissional_ultra_anual: -1,
      };

      const plano = assinatura?.plano_tipo || 'free';
      const limite = LIMITES[plano] ?? 0;

      setUsoCompartilhamentos({
        usado: uso?.total_compartilhamentos || 0,
        limite,
        plano,
      });
    };
    buscarUso();
  }, []);

  const {
    ordens,
    loading,
    busca,
    setBusca,
    statusFiltro,
    setStatusFiltro,
    dataInicio,
    setDataInicio,
    dataFim,
    setDataFim,
    mesFiltro,
    aplicarFiltroMes,
    carregarOrdens,
    buscarOrdemCompleta,
    excluirOrdem,
    atualizarStatus,
    lucroOrdensEntregues,
    carregarLucroOrdensEntregues,
    importarOSEmLote,
  } = useOrdensServico();

  // ── Dados gerenciais (instanciado após useOrdensServico para ter dataInicio/dataFim) ──
  const { data: gerencialData, diasUteis: gerencialDiasUteis, meta: gerencialMeta, carregando: gerencialCarregando, salvarMeta: gerencialSalvarMeta } =
    useOSGerencial(dataInicio, dataFim);
  const gerencialSnapshot = useMemo((): OSGerencialSnapshot => {
    const { diasUteisMes, diasUteisPassados } = gerencialDiasUteis;
    const valorRealizado = gerencialData?.valorRealizado ?? 0;
    const metaValor = gerencialMeta ?? 0;
    const pctMeta = metaValor > 0 ? Math.min((valorRealizado / metaValor) * 100, 100) : 0;
    const pctEsperado = diasUteisMes > 0 ? (diasUteisPassados / diasUteisMes) * 100 : 0;
    const pctReal = metaValor > 0 ? (valorRealizado / metaValor) * 100 : 0;
    const ritmoDiario = diasUteisPassados > 0 ? valorRealizado / diasUteisPassados : 0;
    const projecao = ritmoDiario * diasUteisMes;
    const corMeta = metaValor > 0 ? (pctMeta >= 80 ? "#22c55e" : pctMeta >= 50 ? "#eab308" : "#ef4444") : "#6b7280";
    const ratioSemaforo = pctEsperado > 0 ? pctReal / pctEsperado : 0;
    const corSemaforo = metaValor > 0 ? (ratioSemaforo >= 1 ? "#22c55e" : ratioSemaforo >= 0.7 ? "#eab308" : "#ef4444") : "#6b7280";
    const labelSemaforo = ratioSemaforo >= 1 ? "No ritmo" : ratioSemaforo >= 0.7 ? "Atenção" : "Crítico";
    const corRitmo = metaValor > 0 ? (ritmoDiario * diasUteisMes >= metaValor ? "#22c55e" : ritmoDiario * diasUteisMes >= metaValor * 0.8 ? "#eab308" : "#ef4444") : "#6b7280";
    const corProjecao = metaValor > 0 ? (projecao >= metaValor ? "#22c55e" : projecao >= metaValor * 0.8 ? "#eab308" : "#ef4444") : "#6b7280";
    return {
      valorRealizado, metaValor, osParadasCount: gerencialData?.osParadasCount ?? 0,
      osParadas: gerencialData?.osParadas ?? [], pctMeta, pctEsperado, pctReal,
      ritmoDiario, projecao, diasUteisMes, diasUteisPassados,
      corMeta, corSemaforo, corRitmo, corProjecao, labelSemaforo,
      carregando: gerencialCarregando, salvarMeta: gerencialSalvarMeta,
    };
  }, [gerencialData, gerencialDiasUteis, gerencialMeta, gerencialCarregando, gerencialSalvarMeta]);

  // Carregar contador de OS do mês
  const carregarContador = async () => {
    const dados = await obterContagemOSMes();
    setContadorOS(dados);
  };

  // Recarregar contador quando limites mudam (ex: assinatura carregou) ou ordens mudam
  useEffect(() => {
    carregarContador();
  }, [limites.ordens_servico_mes, ordens.length]);

  const handleNovaOrdem = async () => {
    // Verificar se pode criar nova OS
    if (!contadorOS.ilimitado && contadorOS.usadas >= contadorOS.limite) {
      setDialogLimiteAtingido(true);
      return;
    }
    setOrdemSelecionada(null);
    setDialogAberto(true);
  };

  const servicosAvulsosFiltrados = useMemo(() => {
    return servicosAvulsos.filter((sa) => {
      const saDate = new Date(sa.created_at);
      if (dataInicio && saDate < dataInicio) return false;
      if (dataFim) {
        const fimDia = new Date(dataFim);
        fimDia.setHours(23, 59, 59, 999);
        if (saDate > fimDia) return false;
      }
      return true;
    });
  }, [servicosAvulsos, dataInicio, dataFim]);

  const handleEditar = async (ordem: OrdemServico) => {
    const ordemCompleta = await buscarOrdemCompleta(ordem.id);
    if (!ordemCompleta) return;
    setOrdemSelecionada(ordemCompleta);
    setDialogAberto(true);
  };

  const handleVisualizar = async (ordem: OrdemServico) => {
    const ordemCompleta = await buscarOrdemCompleta(ordem.id);
    if (!ordemCompleta) return;
    setOrdemSelecionada(ordemCompleta);
    setDialogVisualizacao(true);
  };

  const handleImprimir = async (ordem: OrdemServico) => {
    const ordemCompleta = await buscarOrdemCompleta(ordem.id);
    if (!ordemCompleta) return;
    await refetchConfig();
    setOrdemParaImprimir(ordemCompleta);
  };

  const handleFecharImpressao = () => {
    setOrdemParaImprimir(null);
  };

  const handleImprimirTermo = async (ordem: OrdemServico) => {
    const ordemCompleta = await buscarOrdemCompleta(ordem.id);
    if (!ordemCompleta) return;
    setOrdemParaImprimirTermo(ordemCompleta);
  };

  const handleFecharImpressaoTermo = () => {
    setOrdemParaImprimirTermo(null);
  };

  const handleExcluirClick = (ordem: OrdemServico) => {
    setOrdemParaExcluir(ordem);
  };

  const handleConfirmarExclusao = async () => {
    if (ordemParaExcluir) {
      await excluirOrdem(ordemParaExcluir.id);
      setOrdemParaExcluir(null);
    }
  };

  // Interceptar mudança de status para "entregue" - abrir dialog de assinatura
  const handleAtualizarStatus = async (id: string, novoStatus: string) => {
    // Verificar se é um serviço avulso
    const isAvulso = servicosAvulsos.some(sa => sa.id === id);
    if (isAvulso) {
      await atualizarStatusAvulso(id, novoStatus);
      return;
    }

    if (novoStatus === "entregue") {
      const ordemCompleta = await buscarOrdemCompleta(id);
      if (ordemCompleta) {
        setOrdemParaAssinatura(ordemCompleta);
        setDialogAssinaturaSaida(true);
        return;
      }
    }

    const statusConfig = getStatusBySlug(novoStatus);
    if (statusConfig?.gera_conta && statusConfig?.pedir_data_vencimento) {
      setPendingStatusChange({ id, slug: novoStatus, nome: statusConfig.nome });
      setDialogPopupConta(true);
      return;
    }
    
    await atualizarStatus(id, novoStatus);

    if (statusConfig?.gera_conta && !statusConfig?.pedir_data_vencimento) {
      await criarContaParaStatus(id, novoStatus, null, false);
    }
  };

  const criarContaParaStatus = async (ordemId: string, _status: string, dataVencimento: Date | null, semPrazo: boolean) => {
    try {
      const ordem = await buscarOrdemCompleta(ordemId);
      if (!ordem) return;
      
      const { data } = await supabase.rpc('get_loja_owner_id');
      if (!data) return;

      const valorOrdem = ordem.total || 0;
      if (valorOrdem <= 0) return;

      const avariasData = ordem.avarias as any;
      const entradaPaga = avariasData?.dados_pagamento?.entrada || 0;
      const saldoAReceber = valorOrdem - entradaPaga;

      // Check if account already exists
      const { data: existing } = await supabase
        .from("contas")
        .select("id")
        .eq("user_id", data)
        .eq("os_numero", ordem.numero_os)
        .eq("tipo", "receber")
        .maybeSingle();

      if (existing) return; // Already exists

      await supabase.from("contas").insert({
        nome: `OS ${ordem.numero_os} - ${ordem.cliente?.nome || 'Cliente'}`,
        tipo: "receber",
        valor: saldoAReceber > 0 ? saldoAReceber : valorOrdem,
        data: dataVencimento ? dataVencimento.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        data_vencimento: semPrazo ? null : (dataVencimento ? dataVencimento.toISOString().split('T')[0] : null),
        status: "pendente",
        recorrente: false,
        categoria: "Serviços",
        descricao: `Ordem de Serviço ${ordem.numero_os} - ${ordem.defeito_relatado}${semPrazo ? ' (Sem prazo)' : ''}${entradaPaga > 0 ? ` (Entrada paga: R$ ${entradaPaga.toFixed(2)})` : ''}`,
        user_id: data,
        os_numero: ordem.numero_os,
        valor_pago: entradaPaga > 0 ? entradaPaga : null,
      });
    } catch (error) {
      console.error("Erro ao criar conta para status:", error);
    }
  };

  const handlePopupContaConfirmar = async (dataVencimento: Date | null, semPrazo: boolean) => {
    if (!pendingStatusChange) return;
    
    await atualizarStatus(pendingStatusChange.id, pendingStatusChange.slug);
    await criarContaParaStatus(pendingStatusChange.id, pendingStatusChange.slug, dataVencimento, semPrazo);
    
    setDialogPopupConta(false);
    setPendingStatusChange(null);
  };

  // Enviar OS via WhatsApp - abre dialog
  const handleEnviarWhatsApp = async (ordem: OrdemServico) => {
    const ordemCompleta = await buscarOrdemCompleta(ordem.id);
    if (!ordemCompleta) return;
    setOrdemParaWhatsApp(ordemCompleta);
    setDialogWhatsApp(true);
  };

  const handleCompartilhar = async (ordem: OrdemServico) => {
    const link = await gerarLink(ordem.id);
    if (!link) return;
    setLinkCompartilhamento(link);
    setOrdemCompartilhar(ordem);
    setDialogCompartilharAberto(true);
  };

  const handleImprimirEtiqueta = async (ordem: OrdemServico) => {
    const printWindow = window.open("", "_blank", "width=400,height=400");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Carregando etiqueta...</title>
          <style>
            body {
              font-family: Arial, Helvetica, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              color: #000;
            }
          </style>
        </head>
        <body>Preparando etiqueta...</body>
      </html>
    `);
    printWindow.document.close();

    etiquetaPrintWindowRef.current = printWindow;

    const ordemCompleta = await buscarOrdemCompleta(ordem.id);
    if (!ordemCompleta) {
      printWindow.close();
      etiquetaPrintWindowRef.current = null;
      return;
    }

    setOrdemParaEtiqueta(ordemCompleta);
  };

  return (
    <AppLayout>
      <Suspense fallback={null}>
       <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto">
        <div className="min-w-0 p-4 md:p-6 max-w-full overflow-x-hidden">
          <div className="mb-5 md:mb-7 flex min-w-0 flex-col gap-4">

            {/* Header futurista */}
            <div className="relative flex items-center gap-3 rounded-xl border border-primary/10 bg-gradient-to-r from-primary/5 via-background to-background px-4 py-3 overflow-hidden">
              {/* Linha brilhante no topo */}
              <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

              <SidebarTrigger className="hidden lg:flex shrink-0" />

              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <ClipboardList className="h-4 w-4 text-primary" />
                  </div>
                  <div className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary animate-pulse" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg md:text-xl font-bold tracking-tight leading-none">
                    Ordens de Serviço
                  </h1>
                  <p className="text-[11px] text-muted-foreground capitalize mt-0.5 hidden sm:block font-mono">
                    {format(new Date(), "EEE · dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
              </div>

              <div className="ml-auto flex items-center gap-2 shrink-0">
                {!contadorOS.ilimitado && (
                  <div className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted/30 px-2.5 py-1 font-mono text-xs text-muted-foreground">
                    <span className="text-primary font-semibold">{contadorOS.usadas}</span>
                    <span>/</span>
                    <span>{contadorOS.limite}</span>
                    <span className="text-[10px] hidden sm:inline">OS</span>
                  </div>
                )}
                {usoCompartilhamentos.limite !== 0 && (
                  <div className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted/30 px-2.5 py-1 font-mono text-xs text-muted-foreground">
                    <RadioTower className="h-3 w-3" />
                    <span>{usoCompartilhamentos.limite === -1 ? "∞" : `${usoCompartilhamentos.usado}/${usoCompartilhamentos.limite}`}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Barra de ações + chips gerenciais na mesma linha */}
            <div className="flex flex-wrap items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 h-8 text-xs border-border/60 hover:border-border">
                    <Settings className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Config</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setDialogNumeracao(true)}>
                    <Hash className="h-4 w-4 mr-2" />
                    Numeração de OS
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDialogMensagensWhatsApp(true)}>
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Mensagens WhatsApp
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDialogTermoGarantia(true)}>
                    <FileText className="h-4 w-4 mr-2" />
                    Termo de Garantia
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDialogTermoResponsabilidade(true)}>
                    <ClipboardList className="h-4 w-4 mr-2" />
                    Termo de Responsabilidade
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDialogLayoutOS(true)}>
                    <Layout className="h-4 w-4 mr-2" />
                    Layout da OS
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDialogStatusOS(true)}>
                    <Palette className="h-4 w-4 mr-2" />
                    Status da OS
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDialogTaxasCartao(true)}>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Taxas de Cartão
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDialogEtiqueta(true)}>
                    <Tag className="h-4 w-4 mr-2" />
                    Etiqueta de Identificação
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDialogPersonalizarColunas(true)}>
                    <Columns3 className="h-4 w-4 mr-2" />
                    Personalizar Colunas
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDialogTracking(true)}>
                    <RadioTower className="h-4 w-4 mr-2" />
                    Página de Acompanhamento
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button variant="outline" size="sm" onClick={() => setDialogImportarOS(true)} className="h-8 text-xs flex-1 sm:flex-none gap-1.5 border-border/60 hover:border-border">
                <Upload className="h-3.5 w-3.5" />
                Importar
              </Button>
              <Button variant="outline" size="sm" onClick={() => setDialogServicoAvulso(true)} className="h-8 text-xs flex-1 sm:flex-none gap-1.5 border-border/60 hover:border-border">
                <Wrench className="h-3.5 w-3.5" />
                Avulso
              </Button>

              <Button
                size="sm"
                onClick={handleNovaOrdem}
                className="os-nova-btn h-8 text-xs flex-1 sm:flex-none gap-1.5 bg-primary hover:bg-primary/90 shadow-md shadow-primary/25 font-semibold tracking-wide"
              >
                <Plus className="h-3.5 w-3.5" />
                Nova OS
              </Button>

            </div>

            {/* Filtro de período — linha compacta */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted/20 px-2.5 py-1.5 text-xs text-muted-foreground font-mono">
                <CalendarIcon className="h-3 w-3 shrink-0" />
                <Select value={mesFiltro} onValueChange={aplicarFiltroMes}>
                  <SelectTrigger className="h-5 w-[130px] border-0 bg-transparent shadow-none focus:ring-0 text-xs p-0">
                    <SelectValue placeholder="Mês" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os meses</SelectItem>
                    {Array.from({ length: 12 }, (_, i) => {
                      const data = subMonths(new Date(), i);
                      const valor = format(data, "yyyy-MM");
                      const label = format(data, "MMMM yyyy", { locale: ptBR });
                      return (
                        <SelectItem key={valor} value={valor}>
                          {label.charAt(0).toUpperCase() + label.slice(1)}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <span className="text-xs text-muted-foreground/50 font-mono">|</span>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn("h-7 text-xs gap-1 px-2.5 border-border/50 font-mono", !dataInicio && "text-muted-foreground")}
                  >
                    <CalendarIcon className="h-3 w-3" />
                    {dataInicio ? format(dataInicio, "dd/MM") : "início"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dataInicio}
                    onSelect={(d) => { setDataInicio(d); aplicarFiltroMes("todos"); }}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>

              <span className="text-xs text-muted-foreground/40 font-mono">→</span>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn("h-7 text-xs gap-1 px-2.5 border-border/50 font-mono", !dataFim && "text-muted-foreground")}
                  >
                    <CalendarIcon className="h-3 w-3" />
                    {dataFim ? format(dataFim, "dd/MM") : "fim"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dataFim}
                    onSelect={(d) => { setDataFim(d); aplicarFiltroMes("todos"); }}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>

              {(dataInicio || dataFim || mesFiltro !== "todos") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setDataInicio(undefined); setDataFim(undefined); aplicarFiltroMes("todos"); }}
                  className="h-7 text-xs gap-1 px-2 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>

          {/* Banner de OS paradas — condicional */}
          <OSBannerParadas
            snapshot={gerencialSnapshot}
            onVerOSParadas={() => {
              setAbaAtiva("minhas");
              setTimeout(() => {
                osGerencialRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              }, 100);
            }}
          />

          {/* 4 cards gerenciais — grid 4 colunas largura total */}
          <div className="space-y-2">
            <div className="flex justify-end">
              <button
                onClick={toggleChipsExpandido}
                className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 transition-colors px-2 py-1 rounded shrink-0"
              >
                {chipsExpandido ? (
                  <><ChevronUp className="h-3.5 w-3.5 shrink-0" /><span>Ocultar painel</span></>
                ) : (
                  <><ChevronDown className="h-3.5 w-3.5 shrink-0" /><span>Ver painel gerencial</span></>
                )}
              </button>
            </div>
            <div
              style={{
                maxHeight: chipsExpandido ? "1000px" : "0px",
                opacity: chipsExpandido ? 1 : 0,
                overflow: "hidden",
                transition: "max-height 300ms ease-in-out, opacity 300ms ease-in-out",
              }}
            >
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
                <OSChipsGerenciais snapshot={gerencialSnapshot} />
              </div>
            </div>
          </div>

          {/* Abas principais */}
          <Tabs value={abaAtiva} onValueChange={handleMudarAba} className="w-full">
            <TabsList className="mb-4 h-8 bg-muted/40 border border-border/40 p-0.5">
              <TabsTrigger value="minhas" className="text-xs h-7 px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                Minhas OS
              </TabsTrigger>
              {!checandoAcessoTiny && temAcessoTiny && (
                <TabsTrigger value="terceirizada" className="text-xs h-7 px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  Terceirizada
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="minhas" className="mt-0">
          <DashboardOrdensServico ordens={ordens} servicosAvulsos={servicosAvulsosFiltrados} lucroOrdensEntregues={lucroOrdensEntregues} />

          <Card className="min-w-0 overflow-hidden border-border/40 shadow-sm">
            <CardHeader className="p-4 sm:p-5 border-b border-border/30 bg-muted/10">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="h-3.5 w-0.5 rounded-full bg-primary/60" />
                  <CardTitle className="text-sm font-semibold tracking-tight text-foreground/90">Gestão de OS</CardTitle>
                </div>
                <ToggleGroup
                  type="single"
                  value={visualizacao}
                  onValueChange={(v) => {
                    if (!v) return;
                    const novaVis = v as "tabela" | "kanban";
                    if (novaVis === "kanban" && statusFiltro !== "todos") setStatusFiltro("todos");
                    setVisualizacao(novaVis);
                  }}
                  className="rounded-lg bg-background border border-border/50 p-0.5 h-7"
                >
                  <ToggleGroupItem value="tabela" className="gap-1.5 text-xs px-3 h-6 rounded-md data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm transition-all">
                    <List className="h-3 w-3" />
                    Tabela
                  </ToggleGroupItem>
                  <ToggleGroupItem value="kanban" className="gap-1.5 text-xs px-3 h-6 rounded-md data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm transition-all">
                    <Columns3 className="h-3 w-3" />
                    Kanban
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            </CardHeader>
            <CardContent className="min-w-0 space-y-4 overflow-hidden p-4 sm:p-5 pt-4 sm:pt-4">
              {visualizacao === "tabela" && (
                <>
                  <BuscaOrdemServico 
                    busca={busca} 
                    onBuscaChange={setBusca}
                    statusFiltro={statusFiltro}
                    onStatusFiltroChange={setStatusFiltro}
                    dataInicio={dataInicio}
                    onDataInicioChange={setDataInicio}
                    dataFim={dataFim}
                    onDataFimChange={setDataFim}
                    mesFiltro={mesFiltro}
                    onMesFiltroChange={aplicarFiltroMes}
                  />
                  <TabelaOrdensServico
                    ordens={(() => {
                      const avulsosFiltradosPorStatus = statusFiltro !== "todos"
                        ? servicosAvulsosFiltrados.filter(sa => {
                            const status = (sa.status || "finalizado").trim().toLowerCase();
                            return status === statusFiltro.trim().toLowerCase();
                          })
                        : servicosAvulsosFiltrados;
                      const avulsosComoOrdens: OrdemServico[] = avulsosFiltradosPorStatus.map((sa) => ({
                        id: sa.id,
                        numero_os: "AVULSO",
                        created_at: sa.created_at,
                        data_saida: sa.created_at,
                        defeito_relatado: sa.nome + (sa.observacoes ? ` - ${sa.observacoes}` : ''),
                        total: sa.preco,
                        status: sa.status || "finalizado",
                        dispositivo_modelo: "",
                        dispositivo_imei: null,
                        dispositivo_tipo: "Serviço Avulso",
                        dispositivo_marca: "",
                        dispositivo_cor: null,
                        dispositivo_numero_serie: null,
                        senha_desbloqueio: null,
                        avarias: { is_avulso: true, custo: sa.custo, lucro: sa.lucro },
                        cliente_id: "",
                        funcionario_id: null,
                        tempo_garantia: null,
                        cliente: { id: "", nome: "—", telefone: null, cpf: null, endereco: null },
                      } as OrdemServico));
                      return [...ordens, ...avulsosComoOrdens].sort(
                        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                      );
                    })()}
                    loading={loading}
                    onVisualizar={handleVisualizar}
                    onEditar={handleEditar}
                    onImprimir={handleImprimir}
                    onExcluir={(ordem) => {
                      if ((ordem.avarias as any)?.is_avulso) {
                        setAvulsoParaExcluir(ordem.id);
                      } else {
                        handleExcluirClick(ordem);
                      }
                    }}
                    onAtualizarStatus={handleAtualizarStatus}
                    onEnviarWhatsApp={handleEnviarWhatsApp}
                    onCompartilhar={handleCompartilhar}
                    onImprimirTermo={handleImprimirTermo}
                    onImprimirEtiqueta={handleImprimirEtiqueta}
                    termoAtivo={(configuracaoLoja?.termo_responsabilidade_config as TermoResponsabilidadeConfig)?.ativo}
                  />
                </>
              )}

              {visualizacao === "kanban" && (
                <div className="w-full max-w-full overflow-hidden">
                  <KanbanOrdensServico
                    ordens={(() => {
                      const avulsosComoOrdens: OrdemServico[] = servicosAvulsosFiltrados.map((sa) => ({
                        id: sa.id,
                        numero_os: "AVULSO",
                        created_at: sa.created_at,
                        data_saida: sa.created_at,
                        defeito_relatado: sa.nome + (sa.observacoes ? ` - ${sa.observacoes}` : ''),
                        total: sa.preco,
                        status: sa.status || "finalizado",
                        dispositivo_modelo: "",
                        dispositivo_imei: null,
                        dispositivo_tipo: "Serviço Avulso",
                        dispositivo_marca: "",
                        dispositivo_cor: null,
                        dispositivo_numero_serie: null,
                        senha_desbloqueio: null,
                        avarias: { is_avulso: true, custo: sa.custo, lucro: sa.lucro },
                        cliente_id: "",
                        funcionario_id: null,
                        tempo_garantia: null,
                        cliente: { id: "", nome: "—", telefone: null, cpf: null, endereco: null },
                      } as OrdemServico));
                      return [...ordens, ...avulsosComoOrdens];
                    })()}
                    loading={loading}
                    onVisualizar={handleVisualizar}
                    onEditar={handleEditar}
                    onImprimir={handleImprimir}
                    onExcluir={(ordem) => {
                      if ((ordem.avarias as any)?.is_avulso) {
                        setAvulsoParaExcluir(ordem.id);
                      } else {
                        handleExcluirClick(ordem);
                      }
                    }}
                    onAtualizarStatus={handleAtualizarStatus}
                    onEnviarWhatsApp={handleEnviarWhatsApp}
                    onCompartilhar={handleCompartilhar}
                    onImprimirTermo={handleImprimirTermo}
                    onImprimirEtiqueta={handleImprimirEtiqueta}
                    termoAtivo={(configuracaoLoja?.termo_responsabilidade_config as TermoResponsabilidadeConfig)?.ativo}
                  />
                </div>
              )}
            </CardContent>
          </Card>

            <div ref={osGerencialRef}>
              <OSGerencialCards
                dataInicio={dataInicio}
                dataFim={dataFim}
                onAbrirOS={async (id) => {
                  const ordemCompleta = await buscarOrdemCompleta(id);
                  if (!ordemCompleta) return;
                  setOrdemSelecionada(ordemCompleta);
                  setDialogVisualizacao(true);
                }}
              />
            </div>
            </TabsContent>

            {temAcessoTiny && (
              <TabsContent value="terceirizada" className="mt-0">
                <TerceirizadaTab
                  integration={integration ?? null}
                  integrationLoading={integrationLoading}
                  onConectar={iniciarOAuth}
                  onDesconectar={desconectar}
                  onReconectar={iniciarOAuth}
                  onAtualizarIntervalo={atualizarIntervalo}
                />
              </TabsContent>
            )}
          </Tabs>

          <DialogServicoAvulso
            open={dialogServicoAvulso}
            onOpenChange={setDialogServicoAvulso}
            onCriar={(dados) => criarServicoAvulso(dados, limites?.servicos_avulsos_mes)}
          />

          <AlertDialog
            open={!!avulsoParaExcluir}
            onOpenChange={() => setAvulsoParaExcluir(null)}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir Serviço Avulso</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir este serviço avulso? Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={async () => {
                  if (avulsoParaExcluir) {
                    await excluirServicoAvulso(avulsoParaExcluir);
                    setAvulsoParaExcluir(null);
                  }
                }}>
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <DialogOrdemServico
            open={dialogAberto}
            onOpenChange={setDialogAberto}
            ordem={ordemSelecionada}
            onSuccess={async () => { await carregarOrdens(); await carregarLucroOrdensEntregues(); }}
          />

          <DialogVisualizacaoOrdem
            open={dialogVisualizacao}
            onOpenChange={setDialogVisualizacao}
            ordem={ordemSelecionada}
          />

          <DialogAssinaturaSaida
            open={dialogAssinaturaSaida}
            onOpenChange={setDialogAssinaturaSaida}
            ordem={ordemParaAssinatura}
            onSuccess={async () => { await carregarOrdens(); await carregarLucroOrdensEntregues(); }}
          />

          <DialogEnviarWhatsApp
            open={dialogWhatsApp}
            onOpenChange={setDialogWhatsApp}
            ordem={ordemParaWhatsApp}
            loja={configuracaoLoja || undefined}
          />

          {/* Dialog de Configuração de Numeração */}
          <Dialog open={dialogNumeracao} onOpenChange={setDialogNumeracao}>
            <DialogContent className="max-w-lg">
              <ConfiguracaoNumeracaoOS />
            </DialogContent>
          </Dialog>

          {/* Dialog de Configuração de Mensagens WhatsApp */}
          <DialogConfiguracaoMensagensWhatsApp
            open={dialogMensagensWhatsApp}
            onOpenChange={setDialogMensagensWhatsApp}
            onSave={refetchConfig}
          />

          {/* Dialog de Configuração de Termo de Garantia */}
          <DialogConfiguracaoTermoGarantia
            open={dialogTermoGarantia}
            onOpenChange={setDialogTermoGarantia}
            onSave={refetchConfig}
          />

          {/* Dialog de Configuração de Layout da OS */}
          <DialogConfiguracaoLayoutOS
            open={dialogLayoutOS}
            onOpenChange={setDialogLayoutOS}
            onSave={refetchConfig}
          />

          {/* Dialog de Taxas de Cartão */}
          <Dialog open={dialogTaxasCartao} onOpenChange={setDialogTaxasCartao}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <ConfiguracaoTaxasCartao />
            </DialogContent>
          </Dialog>

          {/* Dialog de Configuração de Etiqueta */}
          <DialogConfiguracaoEtiqueta
            open={dialogEtiqueta}
            onOpenChange={setDialogEtiqueta}
            onSave={refetchConfig}
          />

          {/* Dialog de Personalização de Colunas */}
          <DialogPersonalizarColunas
            open={dialogPersonalizarColunas}
            onOpenChange={setDialogPersonalizarColunas}
          />

          {/* Dialog de Configuração da Página de Acompanhamento */}
          <DialogConfiguracaoTracking
            open={dialogTracking}
            onOpenChange={setDialogTracking}
          />

          {/* Impressão de Etiqueta */}
          {ordemParaEtiqueta && (
            <ImpressaoEtiqueta
              ordem={ordemParaEtiqueta}
              printWindow={etiquetaPrintWindowRef.current}
              onFechar={() => {
                etiquetaPrintWindowRef.current = null;
                setOrdemParaEtiqueta(null);
              }}
            />
          )}

          {/* Dialog de Configuração de Termo de Responsabilidade */}
          <DialogConfiguracaoTermoResponsabilidade
            open={dialogTermoResponsabilidade}
            onOpenChange={setDialogTermoResponsabilidade}
            onSave={refetchConfig}
          />

          <AlertDialog
            open={!!ordemParaExcluir}
            onOpenChange={() => setOrdemParaExcluir(null)}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir a ordem de serviço{" "}
                  <strong>{ordemParaExcluir?.numero_os}</strong>? Esta ação não
                  pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmarExclusao}>
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Print Component */}
          {ordemParaImprimir && (
            <ImpressaoOrdemServico
              ordem={ordemParaImprimir}
              configuracaoLoja={configuracaoLoja || undefined}
              onFecharImpressao={handleFecharImpressao}
            />
          )}

          {/* Print Termo Responsabilidade */}
          {ordemParaImprimirTermo && (
            <ImpressaoTermoResponsabilidade
              ordem={ordemParaImprimirTermo}
              configuracaoLoja={configuracaoLoja || undefined}
              onFecharImpressao={handleFecharImpressaoTermo}
            />
          )}

          {/* Dialog de Configuração de Status OS */}
          <Dialog open={dialogStatusOS} onOpenChange={setDialogStatusOS}>
            <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
              <ConfiguracaoStatusOS />
            </DialogContent>
          </Dialog>

          {/* Dialog Popup Status Conta */}
          <DialogPopupStatusConta
            open={dialogPopupConta}
            onOpenChange={(open) => {
              setDialogPopupConta(open);
              if (!open) setPendingStatusChange(null);
            }}
            statusNome={pendingStatusChange?.nome || ''}
            onConfirmar={handlePopupContaConfirmar}
          />

          {/* Dialog de Limite Atingido */}
          <DialogLimiteAtingido
            open={dialogLimiteAtingido}
            onOpenChange={setDialogLimiteAtingido}
            tipo="ordens"
            usados={contadorOS.usadas}
            limite={contadorOS.limite}
          />

          {/* Dialog de Importação de OS */}
          <DialogImportarOS
            open={dialogImportarOS}
            onOpenChange={setDialogImportarOS}
            onImportar={importarOSEmLote}
          />
        </div>
      </main>
      </Suspense>

      {/* Dialog de Compartilhamento */}
      <Dialog open={dialogCompartilharAberto} onOpenChange={setDialogCompartilharAberto}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RadioTower className="h-5 w-5 text-blue-500" />
              Compartilhar Acompanhamento
            </DialogTitle>
            <DialogDescription>
              OS #{ordemCompartilhar?.numero_os} — {ordemCompartilhar?.cliente?.nome}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted border">
            <p className="text-xs text-muted-foreground flex-1 truncate">{linkCompartilhamento}</p>
            <Button
              size="sm"
              variant="ghost"
              className="shrink-0 h-7 px-2"
              onClick={async () => {
                await navigator.clipboard.writeText(linkCompartilhamento);
                toast.success("Link copiado!");
              }}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-3 mt-2">
            <Button
              className="w-full bg-green-600 hover:bg-green-700 text-white"
              onClick={() => {
                const celular = ordemCompartilhar?.cliente?.telefone ||
                               (ordemCompartilhar?.cliente as any)?.celular || '';
                if (!celular) {
                  toast.error("Cliente sem telefone cadastrado");
                  return;
                }
                const mensagem = encodeURIComponent(
                  `Olá ${ordemCompartilhar?.cliente?.nome}! Acompanhe sua OS #${ordemCompartilhar?.numero_os} em tempo real:\n${linkCompartilhamento}`
                );
                const numero = celular.replace(/\D/g, '');
                window.open(`https://wa.me/55${numero}?text=${mensagem}`, '_blank');
              }}
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Enviar pelo WhatsApp
            </Button>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.open(linkCompartilhamento, '_blank')}
            >
              <Eye className="h-4 w-4 mr-2" />
              Visualizar Página
            </Button>

            <Button
              variant="ghost"
              className="w-full"
              onClick={async () => {
                await navigator.clipboard.writeText(linkCompartilhamento);
                toast.success("Link copiado!");
                setDialogCompartilharAberto(false);
              }}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copiar Link
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
