import { Suspense, lazy, useEffect, useState, useMemo, useRef } from "react";
import { toast } from "sonner";
import { Plus, FileText, Settings, Hash, MessageCircle, Layout, ClipboardList, Palette, Wrench, Trash2, Upload, CreditCard, List, Columns3, CalendarIcon, X, Tag, RadioTower, Copy, Eye } from "lucide-react";
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

export default function OrdemServicoPage() {
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
  const etiquetaPrintWindowRef = useRef<Window | null>(null);
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
          <div className="mb-4 md:mb-6 flex min-w-0 flex-col gap-4">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="hidden lg:flex" />
              <h1 className="text-xl md:text-2xl font-bold">Ordens de Serviço</h1>
              <div className="ml-auto text-right hidden sm:block">
                <p className="text-sm font-medium capitalize">
                  {format(new Date(), "EEEE", { locale: ptBR })}
                </p>
                <p className="text-xs text-muted-foreground capitalize">
                  {format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Settings className="h-4 w-4" />
                    <span className="hidden sm:inline">Configurações</span>
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
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" onClick={() => setDialogImportarOS(true)} className="flex-1 sm:flex-none">
                <Upload className="mr-2 h-4 w-4" />
                Importar
              </Button>
              <Button variant="outline" onClick={() => setDialogServicoAvulso(true)} className="flex-1 sm:flex-none">
                <Wrench className="mr-2 h-4 w-4" />
                Serviço Avulso
              </Button>
              <Button onClick={handleNovaOrdem} className="flex-1 sm:flex-none">
                <Plus className="mr-2 h-4 w-4" />
                Nova Ordem
              </Button>
              {usoCompartilhamentos.limite !== 0 && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-auto">
                  <RadioTower className="h-3.5 w-3.5" />
                  {usoCompartilhamentos.limite === -1 ? (
                    <span>Compartilhamentos: Ilimitado</span>
                  ) : (
                    <span>
                      {usoCompartilhamentos.usado}/{usoCompartilhamentos.limite} compartilhamentos este mês
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Filtro de data global */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-muted-foreground">Período:</span>
              
              {/* Filtro por Mês */}
              <Select value={mesFiltro} onValueChange={aplicarFiltroMes}>
                <SelectTrigger className="h-8 w-[160px] text-xs">
                  <SelectValue placeholder="Mês" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Meses</SelectItem>
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

              <span className="text-xs text-muted-foreground">ou</span>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn("text-xs gap-1.5", !dataInicio && "text-muted-foreground")}
                  >
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {dataInicio ? format(dataInicio, "dd/MM/yyyy") : "Data início"}
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

              <span className="text-xs text-muted-foreground">até</span>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn("text-xs gap-1.5", !dataFim && "text-muted-foreground")}
                  >
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {dataFim ? format(dataFim, "dd/MM/yyyy") : "Data fim"}
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
                  onClick={() => {
                    setDataInicio(undefined);
                    setDataFim(undefined);
                    aplicarFiltroMes("todos");
                  }}
                  className="text-xs gap-1 h-8 px-2"
                >
                  <X className="h-3.5 w-3.5" /> Limpar
                </Button>
              )}
            </div>
          </div>

          <DashboardOrdensServico ordens={ordens} servicosAvulsos={servicosAvulsosFiltrados} lucroOrdensEntregues={lucroOrdensEntregues} />

          <Card className="min-w-0 overflow-hidden">
            <CardHeader className="p-4 sm:p-6">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-lg sm:text-xl">Gestão de Ordens de Serviço</CardTitle>
                <ToggleGroup
                  type="single"
                  value={visualizacao}
                onValueChange={(v) => {
                  if (!v) return;
                  const novaVis = v as "tabela" | "kanban";
                  if (novaVis === "kanban" && statusFiltro !== "todos") {
                    setStatusFiltro("todos");
                  }
                  setVisualizacao(novaVis);
                }}
                  className="border rounded-lg p-1"
                >
                  <ToggleGroupItem value="tabela" className="gap-1.5 text-xs px-3">
                    <List className="h-3.5 w-3.5" />
                    Tabela
                  </ToggleGroupItem>
                  <ToggleGroupItem value="kanban" className="gap-1.5 text-xs px-3">
                    <Columns3 className="h-3.5 w-3.5" />
                    Kanban
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            </CardHeader>
            <CardContent className="min-w-0 space-y-4 overflow-hidden p-4 sm:p-6 pt-0 sm:pt-0">
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
            onSuccess={carregarOrdens}
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
