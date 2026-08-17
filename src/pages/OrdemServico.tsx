import { Suspense, lazy, useEffect, useState, useMemo, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Plus, FileText, Settings, Hash, MessageCircle, Layout, ClipboardList, Palette, Wrench, Trash2, Upload, CreditCard, List, Columns3, CalendarIcon, X, Tag, RadioTower, Copy, Eye, ChevronUp, ChevronDown, CheckSquare, RefreshCw, MapPin, Download, Timer, SlidersHorizontal } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TerceirizadaTab } from "@/components/ordens/tiny/TerceirizadaTab";
import { MicroSoldaUpStoreTab } from "@/components/ordens/tiny/MicroSoldaUpStoreTab";
import { useTinyIntegration } from "@/hooks/useTinyIntegration";
import { checkTinyAccess } from "@/lib/checkTinyAccess";
import { OSGerencialCards } from "@/components/ordens/OSGerencialCards";
import { OSChipsGerenciais, OSGerencialSnapshot } from "@/components/ordens/OSResumoBarra";
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
import { useOSStatusConfigContext as useOSStatusConfig } from "@/contexts/OSStatusConfigContext";
import { useOSTracking } from "@/hooks/useOSTracking";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import { useFuncionarios } from "@/hooks/useFuncionarios";
import { BuscaOrdemServico } from "@/components/ordens/BuscaOrdemServico";
import { TabelaOrdensServico } from "@/components/ordens/TabelaOrdensServico";
import { useConfiguracaoLoja } from "@/hooks/useConfiguracaoLoja";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { DashboardOrdensServico } from "@/components/ordens/DashboardOrdensServico";
import { AppLayout } from "@/components/layout/AppLayout";
import { TermoResponsabilidadeConfig } from "@/types/configuracao-loja";
import { supabase } from "@/integrations/supabase/client";
import { useServicosAvulsos } from "@/hooks/useServicosAvulsos";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatDate, dataHoje } from "@/lib/formatters";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { KanbanOrdensServico } from "@/components/ordens/KanbanOrdensServico";
import { KanbanTempoAberto } from "@/components/ordens/KanbanTempoAberto";

const DialogOrdemServico = lazy(() => import("@/components/ordens/DialogOrdemServico").then((m) => ({ default: m.DialogOrdemServico })));
const DialogOrdemServicoSimplificada = lazy(() => import("@/components/ordens/DialogOrdemServicoSimplificada").then((m) => ({ default: m.DialogOrdemServicoSimplificada })));
const DialogVisualizacaoOrdem = lazy(() => import("@/components/ordens/DialogVisualizacaoOrdem").then((m) => ({ default: m.DialogVisualizacaoOrdem })));
const DialogAssinaturaSaida = lazy(() => import("@/components/ordens/DialogAssinaturaSaida").then((m) => ({ default: m.DialogAssinaturaSaida })));
const DialogEnviarWhatsApp = lazy(() => import("@/components/ordens/DialogEnviarWhatsApp").then((m) => ({ default: m.DialogEnviarWhatsApp })));
const DialogConfiguracaoMensagensWhatsApp = lazy(() => import("@/components/ordens/DialogConfiguracaoMensagensWhatsApp").then((m) => ({ default: m.DialogConfiguracaoMensagensWhatsApp })));
const DialogConfiguracaoTermoGarantia = lazy(() => import("@/components/ordens/DialogConfiguracaoTermoGarantia").then((m) => ({ default: m.DialogConfiguracaoTermoGarantia })));
const DialogConfiguracaoValorHora = lazy(() => import("@/components/ordens/DialogConfiguracaoValorHora").then((m) => ({ default: m.DialogConfiguracaoValorHora })));
const DialogConfiguracaoLayoutOS = lazy(() => import("@/components/ordens/DialogConfiguracaoLayoutOS").then((m) => ({ default: m.DialogConfiguracaoLayoutOS })));
const DialogConfiguracaoTermoResponsabilidade = lazy(() => import("@/components/ordens/DialogConfiguracaoTermoResponsabilidade").then((m) => ({ default: m.DialogConfiguracaoTermoResponsabilidade })));
const DialogPopupStatusConta = lazy(() => import("@/components/ordens/DialogPopupStatusConta").then((m) => ({ default: m.DialogPopupStatusConta })));
const DialogProblemaGarantia = lazy(() => import("@/components/ordens/DialogProblemaGarantia").then((m) => ({ default: m.DialogProblemaGarantia })));
const ImpressaoOrdemServico = lazy(() => import("@/components/ordens/ImpressaoOrdemServico").then((m) => ({ default: m.ImpressaoOrdemServico })));
const ImpressaoTermoResponsabilidade = lazy(() => import("@/components/ordens/ImpressaoTermoResponsabilidade").then((m) => ({ default: m.ImpressaoTermoResponsabilidade })));
const ConfiguracaoNumeracaoOS = lazy(() => import("@/components/configuracoes/ConfiguracaoNumeracaoOS").then((m) => ({ default: m.ConfiguracaoNumeracaoOS })));
const ConfiguracaoTaxasCartao = lazy(() => import("@/components/configuracoes/ConfiguracaoTaxasCartao").then((m) => ({ default: m.ConfiguracaoTaxasCartao })));
const ConfiguracaoStatusOS = lazy(() => import("@/components/configuracoes/ConfiguracaoStatusOS").then((m) => ({ default: m.ConfiguracaoStatusOS })));
const ConfiguracaoLocalizacaoOS = lazy(() => import("@/components/configuracoes/ConfiguracaoLocalizacaoOS").then((m) => ({ default: m.ConfiguracaoLocalizacaoOS })));
const DialogLimiteAtingido = lazy(() => import("@/components/planos/DialogLimiteAtingido").then((m) => ({ default: m.DialogLimiteAtingido })));
const DialogServicoAvulso = lazy(() => import("@/components/ordens/DialogServicoAvulso").then((m) => ({ default: m.DialogServicoAvulso })));
const DialogImportarOS = lazy(() => import("@/components/ordens/DialogImportarOS").then((m) => ({ default: m.DialogImportarOS })));
const DialogExportarRelatorio = lazy(() => import("@/components/ordens/DialogExportarRelatorio").then((m) => ({ default: m.DialogExportarRelatorio })));
const DialogConfiguracaoEtiqueta = lazy(() => import("@/components/ordens/DialogConfiguracaoEtiqueta").then((m) => ({ default: m.DialogConfiguracaoEtiqueta })));
const ImpressaoEtiqueta = lazy(() => import("@/components/ordens/ImpressaoEtiqueta").then((m) => ({ default: m.ImpressaoEtiqueta })));
const DialogPersonalizarColunas = lazy(() => import("@/components/ordens/DialogPersonalizarColunas").then((m) => ({ default: m.DialogPersonalizarColunas })));
const DialogConfiguracaoTracking = lazy(() => import("@/components/ordens/DialogConfiguracaoTracking").then((m) => ({ default: m.DialogConfiguracaoTracking })));

export default function OrdemServicoPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
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
  const [abaAtiva, setAbaAtiva] = useState<"minhas" | "terceirizada" | "microsolda">(
    tabParam === "terceirizada" ? "terceirizada" : tabParam === "microsolda" ? "microsolda" : "minhas"
  );

  useEffect(() => {
    checkTinyAccess().then((acesso) => {
      setTemAcessoTiny(acesso);
      setChecandoAcessoTiny(false);
      if (!acesso && (abaAtiva === "terceirizada" || abaAtiva === "microsolda")) {
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
    setAbaAtiva(aba as "minhas" | "terceirizada" | "microsolda");
    if (aba === "terceirizada" || aba === "microsolda") {
      setSearchParams({ tab: aba });
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
  const [dialogSimplificadaAberto, setDialogSimplificadaAberto] = useState(false);
  const [dialogVisualizacao, setDialogVisualizacao] = useState(false);
  const [ordemSelecionada, setOrdemSelecionada] = useState<OrdemServico | null>(null);
  const [ordemParaExcluir, setOrdemParaExcluir] = useState<OrdemServico | null>(null);
  const [gerencialExcluir, setGerencialExcluir] = useState<{ id: string; numero_os: string } | null>(null);
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
  const [dialogValorHora, setDialogValorHora] = useState(false);
  const [contadorOS, setContadorOS] = useState({ usadas: 0, limite: -1, percentual: 0, ilimitado: true, restantes: Infinity });
  const [dialogPopupConta, setDialogPopupConta] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<{ id: string; slug: string; nome: string } | null>(null);
  const [dialogProblemaGarantia, setDialogProblemaGarantia] = useState(false);
  const [ordemParaGarantia, setOrdemParaGarantia] = useState<string | null>(null);
  const [dialogServicoAvulso, setDialogServicoAvulso] = useState(false);
  const [avulsoParaExcluir, setAvulsoParaExcluir] = useState<string | null>(null);
  const [dialogImportarOS, setDialogImportarOS] = useState(false);
  const [dialogExportarRelatorio, setDialogExportarRelatorio] = useState(false);
  const [visualizacao, setVisualizacao] = useState<"tabela" | "kanban" | "tempo">("tabela");
  const [dialogEtiqueta, setDialogEtiqueta] = useState(false);
  const [ordemParaEtiqueta, setOrdemParaEtiqueta] = useState<OrdemServico | null>(null);
  const [dialogPersonalizarColunas, setDialogPersonalizarColunas] = useState(false);
  const [dialogTracking, setDialogTracking] = useState(false);
  const [dialogLocalizacao, setDialogLocalizacao] = useState(false);
  const [selecaoAtiva, setSelecaoAtiva] = useState(false);
  const [itensSelecionados, setItensSelecionados] = useState<Set<string>>(new Set());
  const [dialogExcluirEmLote, setDialogExcluirEmLote] = useState(false);
  const [dialogMudarStatusEmLote, setDialogMudarStatusEmLote] = useState(false);
  const [statusEmLoteSelecionado, setStatusEmLoteSelecionado] = useState<string>("");
  const etiquetaPrintWindowRef = useRef<Window | null>(null);
  const osGerencialRef = useRef<HTMLDivElement | null>(null);
  const [usoCompartilhamentos, setUsoCompartilhamentos] = useState({ usado: 0, limite: 0, plano: '' });
  const [dialogCompartilharAberto, setDialogCompartilharAberto] = useState(false);
  const [linkCompartilhamento, setLinkCompartilhamento] = useState('');
  const [ordemCompartilhar, setOrdemCompartilhar] = useState<OrdemServico | null>(null);
  const { config: configuracaoLoja, refetch: refetchConfig } = useConfiguracaoLoja();
  const { empresas: empresasFiliais, nomeMatriz } = useEmpresa();
  const [lojaFiltro, setLojaFiltro] = useState("todos");
  const { obterContagemOSMes, abrirPaginaPagamento, limites, carregando: assinaturaCarregando } = useAssinatura();
  const { statusList, getStatusBySlug } = useOSStatusConfig();
  const { servicosAvulsos, criarServicoAvulso, atualizarStatusAvulso, excluirServicoAvulso } = useServicosAvulsos();
  const { compartilharWhatsApp, gerarLink } = useOSTracking();
  const { lojaUserId, isDonoLoja, permissoes, podeCompartilharLink } = useFuncionarioPermissoes();
  const podeVerTecnicos = isDonoLoja || (permissoes?.recursos?.ver_tecnicos_os ?? false);
  const { funcionarios } = useFuncionarios(lojaUserId);
  const tecnicosDisponiveis = podeVerTecnicos
    ? funcionarios.filter((f) => f.ativo).map((f) => ({ id: f.id, nome: f.nome, cargo: f.cargo }))
    : undefined;

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

  const mostrarOsFiliais = !!(configuracaoLoja?.permissoes_multiempresa?.mostrar_os_filiais_na_matriz);

  const {
    ordens: ordensRaw,
    loading,
    busca,
    setBusca,
    statusFiltro,
    setStatusFiltro,
    origemFiltro,
    setOrigemFiltro,
    midiaFiltro,
    setMidiaFiltro,
    tecnicoFiltro,
    setTecnicoFiltro,
    somenteRemessaCorporativa,
    setSomenteRemessaCorporativa,
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
  } = useOrdensServico(mostrarOsFiliais);

  const resolverNomeLoja = (empresaId: string | null | undefined): string => {
    if (!empresaId) return nomeMatriz || "Matriz";
    const filial = empresasFiliais.find(e => e.id === empresaId);
    return filial?.nome ?? "Filial";
  };

  const ordensPorFilial = useMemo(() => {
    if (!mostrarOsFiliais || lojaFiltro === "todos") return ordensRaw;
    if (lojaFiltro === "matriz") return ordensRaw.filter(o => !(o as any).empresa_id);
    return ordensRaw.filter(o => (o as any).empresa_id === lojaFiltro);
  }, [ordensRaw, mostrarOsFiliais, lojaFiltro]);

  // Filtro "atrasadas" vindo do atalho do Dashboard (?status=atrasadas): OS abertas
  // (fora dos status finais) criadas há mais de 3 dias. Mesma regra de
  // useDashboardResumo.ts, aplicada aqui só no client, sem alterar a query base.
  const STATUS_FECHADOS_ATRASO = ["entregue", "finalizado", "garantia", "cancelada"];
  const filtroAtrasadas = searchParams.get("status") === "atrasadas";
  const ordens = useMemo(() => {
    if (!filtroAtrasadas) return ordensPorFilial;
    const tresDiasAtras = new Date();
    tresDiasAtras.setDate(tresDiasAtras.getDate() - 3);
    return ordensPorFilial.filter((o: any) => {
      if (STATUS_FECHADOS_ATRASO.includes(o.status)) return false;
      return new Date(o.created_at) < tresDiasAtras;
    });
  }, [ordensPorFilial, filtroAtrasadas]);

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

  const podeAbrirNovaOrdem = () => {
    // Aguardar assinatura carregar antes de verificar limite
    if (assinaturaCarregando) return true;
    // Verificar se pode criar nova OS
    if (!contadorOS.ilimitado && contadorOS.usadas >= contadorOS.limite) {
      setDialogLimiteAtingido(true);
      return false;
    }
    return true;
  };

  const handleNovaOrdem = async () => {
    if (!podeAbrirNovaOrdem()) return;
    setOrdemSelecionada(null);
    setDialogAberto(true);
  };

  const handleNovaOrdemSimplificada = async () => {
    if (!podeAbrirNovaOrdem()) return;
    setDialogSimplificadaAberto(true);
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

  // Lista combinada (OS + serviços avulsos) usada pelo Kanban e pelos painéis
  // de resumo/atividades que ficam abaixo dele — mesma construção que já era
  // feita inline dentro do bloco do Kanban, só extraída para reuso.
  const ordensComAvulsosParaKanban = useMemo((): OrdemServico[] => {
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
  }, [ordens, servicosAvulsosFiltrados]);

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

  // Abrir automaticamente a OS indicada por ?numero= na URL (ex: vindo da Remessa)
  useEffect(() => {
    const numeroOS = searchParams.get("numero");
    if (!numeroOS || ordens.length === 0) return;

    const os = ordens.find((o) => o.numero_os === numeroOS);
    if (os) {
      handleVisualizar(os);
    }
    navigate("/os", { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, ordens]);

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
    await refetchConfig();
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
      await carregarContador();
    }
  };

  const handleToggleSelecionado = (id: string) => {
    setItensSelecionados(prev => {
      const novo = new Set(prev);
      if (novo.has(id)) {
        novo.delete(id);
      } else {
        novo.add(id);
      }
      return novo;
    });
  };

  const handleToggleTodos = (ids: string[]) => {
    setItensSelecionados(prev => {
      const todosJaSelecionados = ids.every(id => prev.has(id));
      if (todosJaSelecionados) {
        const novo = new Set(prev);
        ids.forEach(id => novo.delete(id));
        return novo;
      }
      return new Set([...prev, ...ids]);
    });
  };

  const handleCancelarSelecao = () => {
    setSelecaoAtiva(false);
    setItensSelecionados(new Set());
  };

  const handleConfirmarExclusaoEmLote = async () => {
    const ids = Array.from(itensSelecionados);
    for (const id of ids) {
      const isAvulso = servicosAvulsos.some(sa => sa.id === id);
      if (isAvulso) {
        await excluirServicoAvulso(id);
      } else {
        await excluirOrdem(id);
      }
    }
    setDialogExcluirEmLote(false);
    handleCancelarSelecao();
    toast.success(`${ids.length} ${ids.length === 1 ? "OS excluída" : "OS excluídas"} com sucesso`);
    await carregarContador();
  };

  const handleConfirmarMudarStatusEmLote = async () => {
    if (!statusEmLoteSelecionado) return;
    const ids = Array.from(itensSelecionados);
    for (const id of ids) {
      const isAvulso = servicosAvulsos.some(sa => sa.id === id);
      if (isAvulso) {
        await atualizarStatusAvulso(id, statusEmLoteSelecionado);
      } else {
        await atualizarStatus(id, statusEmLoteSelecionado);
      }
    }
    setDialogMudarStatusEmLote(false);
    setStatusEmLoteSelecionado("");
    const statusConfig = statusList.find(s => s.slug === statusEmLoteSelecionado);
    const nomeStatus = statusConfig?.nome ?? statusEmLoteSelecionado;
    handleCancelarSelecao();
    toast.success(`${ids.length} ${ids.length === 1 ? "OS atualizada" : "OS atualizadas"} para "${nomeStatus}"`);
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

    if (novoStatus === "garantia") {
      setOrdemParaGarantia(id);
      setDialogProblemaGarantia(true);
      return;
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
        data: dataHoje(),
        data_vencimento: semPrazo ? null : (dataVencimento ? `${dataVencimento.getFullYear()}-${String(dataVencimento.getMonth()+1).padStart(2,'0')}-${String(dataVencimento.getDate()).padStart(2,'0')}` : null),
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

  const handleConfirmarProblemaGarantia = async (_problemaRelatado: string) => {
    if (!ordemParaGarantia) return;
    await atualizarStatus(ordemParaGarantia, "garantia");
  };

  // Enviar OS via WhatsApp - abre dialog
  const handleEnviarWhatsApp = async (ordem: OrdemServico) => {
    const ordemCompleta = await buscarOrdemCompleta(ordem.id);
    if (!ordemCompleta) return;
    setOrdemParaWhatsApp(ordemCompleta);
    setDialogWhatsApp(true);
  };

  const handleCompartilhar = async (ordem: OrdemServico) => {
    if (!podeCompartilharLink) {
      toast.error("Você não tem permissão para compartilhar o link de acompanhamento");
      return;
    }
    const link = await gerarLink(ordem.id, lojaUserId ?? undefined);
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

    const ordemCompleta = await buscarOrdemCompleta(ordem.id, true);
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
          <div className="flex min-w-0 flex-col gap-4">

            {/* Card com fundo invertido ao tema — gradiente preto no modo claro, claro no modo escuro */}
            <div className="relative rounded-2xl bg-gradient-to-br from-slate-800 to-black dark:bg-slate-100 dark:bg-none px-4 py-4 md:px-5 md:py-5 flex flex-col gap-4 overflow-hidden">
              <div className="flex items-center gap-3">
                <SidebarTrigger className="hidden lg:flex shrink-0 text-white/70 hover:text-white dark:text-slate-500 dark:hover:text-slate-900" />

                <div className="h-10 w-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
                  <SlidersHorizontal className="h-5 w-5 text-primary" />
                </div>

                <div className="min-w-0 flex-1">
                  <h1 className="text-base sm:text-lg md:text-xl font-bold tracking-tight text-white dark:text-slate-900 truncate">
                    Centro de Controle
                  </h1>
                  <p className="text-xs text-white/50 dark:text-slate-500 truncate hidden sm:block">
                    Acompanhe e gerencie todas as ordens
                  </p>
                </div>

                <div className="ml-auto flex items-center gap-2 shrink-0">
                  {!contadorOS.ilimitado && (
                    <div className="hidden sm:flex items-center gap-1.5 rounded-lg bg-white/10 dark:bg-slate-900/10 px-2.5 py-1 font-mono text-xs text-white/70 dark:text-slate-600">
                      <span className="text-primary-foreground dark:text-primary font-semibold">{contadorOS.usadas}</span>
                      <span>/</span>
                      <span>{contadorOS.limite}</span>
                      <span className="text-[10px]">OS</span>
                    </div>
                  )}

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="sm"
                        className="os-nova-btn h-9 text-xs gap-1.5 bg-primary hover:bg-primary/90 shadow-md shadow-primary/25 font-semibold tracking-wide text-white"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Nova OS
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={handleNovaOrdem}>
                        Completa
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleNovaOrdemSimplificada}>
                        Simplificada
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Barra de ações */}
              <div className="flex flex-nowrap items-center gap-1.5 sm:gap-2 min-w-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDialogImportarOS(true)}
                  className="h-9 text-[11px] sm:text-xs flex-1 sm:flex-none gap-1 sm:gap-1.5 px-2 sm:px-3 bg-white/5 dark:bg-slate-900/5 border-white/10 dark:border-slate-900/10 text-white dark:text-slate-700 hover:bg-white/10 dark:hover:bg-slate-900/10 hover:text-white dark:hover:text-slate-900"
                >
                  <Upload className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">Importar</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDialogExportarRelatorio(true)}
                  className="h-9 text-[11px] sm:text-xs flex-1 sm:flex-none gap-1 sm:gap-1.5 px-2 sm:px-3 bg-white/5 dark:bg-slate-900/5 border-white/10 dark:border-slate-900/10 text-white dark:text-slate-700 hover:bg-white/10 dark:hover:bg-slate-900/10 hover:text-white dark:hover:text-slate-900"
                >
                  <Download className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">Exportar</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDialogServicoAvulso(true)}
                  className="h-9 text-[11px] sm:text-xs flex-1 sm:flex-none gap-1 sm:gap-1.5 px-2 sm:px-3 bg-white/5 dark:bg-slate-900/5 border-white/10 dark:border-slate-900/10 text-white dark:text-slate-700 hover:bg-white/10 dark:hover:bg-slate-900/10 hover:text-white dark:hover:text-slate-900"
                >
                  <Wrench className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">Avulso</span>
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 w-9 p-0 bg-white/5 dark:bg-slate-900/5 border-white/10 dark:border-slate-900/10 text-white dark:text-slate-700 hover:bg-white/10 dark:hover:bg-slate-900/10 hover:text-white dark:hover:text-slate-900 shrink-0"
                    >
                      <Settings className="h-4 w-4" />
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
                    <DropdownMenuItem onClick={() => setDialogValorHora(true)}>
                      <Timer className="h-4 w-4 mr-2" />
                      Valor por Hora (Mão de Obra)
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
                    <DropdownMenuItem onClick={() => setDialogLocalizacao(true)}>
                      <MapPin className="h-4 w-4 mr-2" />
                      Localizações Físicas
                    </DropdownMenuItem>
                    {usoCompartilhamentos.limite !== 0 && (
                      <DropdownMenuItem disabled className="font-mono text-xs opacity-70">
                        <RadioTower className="h-4 w-4 mr-2" />
                        {usoCompartilhamentos.limite === -1 ? "∞" : `${usoCompartilhamentos.usado}/${usoCompartilhamentos.limite}`} compartilhamentos
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Filtro de período */}
              <div className="flex items-center gap-1 sm:gap-1.5 flex-nowrap min-w-0">
                <div className="flex items-center gap-1 sm:gap-1.5 rounded-lg bg-white/5 dark:bg-slate-900/5 px-2 sm:px-2.5 py-1.5 text-xs text-white/70 dark:text-slate-600 font-mono min-w-0">
                  <CalendarIcon className="h-3 w-3 shrink-0" />
                  <Select value={mesFiltro} onValueChange={aplicarFiltroMes}>
                    <SelectTrigger className="h-5 w-[92px] sm:w-[130px] border-0 bg-transparent shadow-none focus:ring-0 text-[11px] sm:text-xs p-0 text-white/70 dark:text-slate-600">
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

                <span className="text-xs text-white/30 dark:text-slate-400 font-mono shrink-0 hidden sm:inline">|</span>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn("h-7 shrink-0 text-[11px] sm:text-xs gap-1 px-2 sm:px-2.5 bg-white/5 dark:bg-slate-900/5 border-white/10 dark:border-slate-900/10 text-white/70 dark:text-slate-600 hover:bg-white/10 dark:hover:bg-slate-900/10 hover:text-white dark:hover:text-slate-900 font-mono", !dataInicio && "text-white/50 dark:text-slate-400")}
                    >
                      <CalendarIcon className="h-3 w-3 shrink-0" />
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

                <span className="text-[11px] sm:text-xs text-white/30 dark:text-slate-400 font-mono shrink-0">até</span>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn("h-7 shrink-0 text-[11px] sm:text-xs gap-1 px-2 sm:px-2.5 bg-white/5 dark:bg-slate-900/5 border-white/10 dark:border-slate-900/10 text-white/70 dark:text-slate-600 hover:bg-white/10 dark:hover:bg-slate-900/10 hover:text-white dark:hover:text-slate-900 font-mono", !dataFim && "text-white/50 dark:text-slate-400")}
                    >
                      <CalendarIcon className="h-3 w-3 shrink-0" />
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
                    className="h-7 w-7 sm:w-auto shrink-0 text-xs gap-1 px-0 sm:px-2 text-white/50 dark:text-slate-500 hover:text-destructive hover:bg-white/10 dark:hover:bg-slate-900/10"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* 4 cards gerenciais — grid 4 colunas largura total */}
          <Card className="min-w-0 overflow-hidden border-border/40 bg-muted/20 shadow-sm mt-5 md:mt-7 mb-5 md:mb-7">
            <CardHeader className="p-4 sm:p-5 pb-0">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="h-3.5 w-0.5 rounded-full bg-primary/60" />
                  <CardTitle className="text-sm font-semibold tracking-tight text-foreground/90">Metas</CardTitle>
                </div>
                <button
                  onClick={toggleChipsExpandido}
                  className="flex items-center gap-1.5 text-xs font-medium text-blue-400 border border-blue-500/40 bg-blue-500/10 hover:bg-blue-500/20 hover:text-blue-300 hover:border-blue-400/60 transition-all px-3 py-1.5 rounded-lg shrink-0"
                >
                  {chipsExpandido ? (
                    <><ChevronUp className="h-3.5 w-3.5 shrink-0" /><span>Ocultar metas</span></>
                  ) : (
                    <><ChevronDown className="h-3.5 w-3.5 shrink-0" /><span>Ver metas</span></>
                  )}
                </button>
              </div>
            </CardHeader>
            <CardContent
              className="px-4 sm:px-5"
              style={{
                maxHeight: chipsExpandido ? "1000px" : "0px",
                opacity: chipsExpandido ? 1 : 0,
                paddingTop: chipsExpandido ? undefined : 0,
                paddingBottom: chipsExpandido ? undefined : 0,
                overflow: "hidden",
                transition: "max-height 300ms ease-in-out, opacity 300ms ease-in-out, padding 300ms ease-in-out",
              }}
            >
              <div className="grid grid-cols-4 gap-2 w-full py-4 sm:py-5">
                <OSChipsGerenciais snapshot={gerencialSnapshot} />
              </div>
            </CardContent>
          </Card>

          {/* Card "Indicadores" contém apenas o header e a navegação por abas —
              o conteúdo de cada aba (Gestão de OS, Terceirizada, MicroSolda)
              fica fora deste Card, como irmão, para não herdar seu fundo/estilo. */}
          <Card className="min-w-0 overflow-hidden border-border/40 bg-muted/20 shadow-sm">
            <CardHeader className="p-4 sm:p-5 pb-0">
              <div className="flex items-center gap-2">
                <div className="h-3.5 w-0.5 rounded-full bg-primary/60" />
                <CardTitle className="text-sm font-semibold tracking-tight text-foreground/90">Indicadores</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-5">
              <Tabs value={abaAtiva} onValueChange={handleMudarAba} className="w-full">
                <TabsList className="h-8 bg-muted/40 border border-border/40 p-0.5">
                  <TabsTrigger value="minhas" className="text-xs h-7 px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    Minhas OS
                  </TabsTrigger>
                  {!checandoAcessoTiny && temAcessoTiny && (
                    <TabsTrigger value="terceirizada" className="text-xs h-7 px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                      Terceirizada
                    </TabsTrigger>
                  )}
                  {!checandoAcessoTiny && temAcessoTiny && (
                    <TabsTrigger value="microsolda" className="text-xs h-7 px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                      MicroSolda + UpStore
                    </TabsTrigger>
                  )}
                </TabsList>
              </Tabs>
            </CardContent>
          </Card>

          {/* Conteúdo das abas — irmão do Card "Indicadores", não mais filho dele. */}
          <Tabs value={abaAtiva} onValueChange={handleMudarAba} className="w-full">
            <TabsContent value="minhas" className="mt-5 md:mt-7">
          <DashboardOrdensServico ordens={ordens} servicosAvulsos={servicosAvulsosFiltrados} lucroOrdensEntregues={lucroOrdensEntregues} />

          <Card className="min-w-0 overflow-hidden border-border/40 bg-muted/20 shadow-sm mt-5 md:mt-7">
            <CardHeader className="p-4 sm:p-5 border-b border-border/30 bg-muted/10">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="h-3.5 w-0.5 rounded-full bg-primary/60" />
                  <CardTitle className="text-sm font-semibold tracking-tight text-foreground/90">Gestão de OS</CardTitle>
                </div>
                <div className="hidden sm:flex items-center gap-2">
                  {visualizacao === "tabela" && (
                    <Button
                      variant={selecaoAtiva ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => selecaoAtiva ? handleCancelarSelecao() : setSelecaoAtiva(true)}
                      className="h-7 text-xs px-2.5 gap-1.5"
                    >
                      <CheckSquare className="h-3.5 w-3.5" />
                      {selecaoAtiva ? "Cancelar" : "Selecionar"}
                    </Button>
                  )}
                  <ToggleGroup
                    type="single"
                    value={visualizacao}
                    onValueChange={(v) => {
                      if (!v) return;
                      const novaVis = v as "tabela" | "kanban" | "tempo";
                      if (novaVis !== "tabela" && statusFiltro !== "todos") setStatusFiltro("todos");
                      if (novaVis !== "tabela") handleCancelarSelecao();
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
                    <ToggleGroupItem value="tempo" className="gap-1.5 text-xs px-3 h-6 rounded-md data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm transition-all">
                      <Timer className="h-3 w-3" />
                      Tempo Aberto
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </div>

              {/* Seletor de visualização — pills largas, mobile-first (fiel à referência) */}
              <div className="sm:hidden flex items-center gap-2 mt-3">
                {visualizacao === "tabela" && (
                  <Button
                    variant={selecaoAtiva ? "secondary" : "ghost"}
                    size="icon"
                    onClick={() => selecaoAtiva ? handleCancelarSelecao() : setSelecaoAtiva(true)}
                    className="h-9 w-9 shrink-0"
                    aria-label={selecaoAtiva ? "Cancelar seleção" : "Selecionar"}
                    title={selecaoAtiva ? "Cancelar seleção" : "Selecionar"}
                  >
                    <CheckSquare className="h-3.5 w-3.5" />
                  </Button>
                )}
                <ToggleGroup
                  type="single"
                  value={visualizacao}
                  onValueChange={(v) => {
                    if (!v) return;
                    const novaVis = v as "tabela" | "kanban" | "tempo";
                    if (novaVis !== "tabela" && statusFiltro !== "todos") setStatusFiltro("todos");
                    if (novaVis !== "tabela") handleCancelarSelecao();
                    setVisualizacao(novaVis);
                  }}
                  className="flex-1 rounded-xl bg-muted/30 border border-border/50 p-1 h-11 min-w-0"
                >
                  <ToggleGroupItem value="tabela" className="flex-1 min-w-0 gap-1 text-xs font-semibold px-1.5 h-9 rounded-lg data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm transition-all">
                    <List className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Lista</span>
                  </ToggleGroupItem>
                  <ToggleGroupItem value="kanban" className="flex-1 min-w-0 gap-1 text-xs font-semibold px-1.5 h-9 rounded-lg data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm transition-all">
                    <Columns3 className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Kanban</span>
                  </ToggleGroupItem>
                  <ToggleGroupItem value="tempo" className="flex-1 min-w-0 gap-1 text-xs font-semibold px-1.5 h-9 rounded-lg data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm transition-all">
                    <Timer className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Tempo</span>
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            </CardHeader>
            <CardContent className="min-w-0 space-y-4 overflow-hidden p-4 sm:p-5 pt-4 sm:pt-4">
              {visualizacao === "tabela" && (
                <>
                  {/* Barra de ações em lote */}
                  {selecaoAtiva && itensSelecionados.size > 0 && (
                    <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2.5 text-sm animate-in fade-in slide-in-from-top-1 duration-200">
                      <span className="font-semibold text-foreground">
                        {itensSelecionados.size} {itensSelecionados.size === 1 ? "OS selecionada" : "OS selecionadas"}
                      </span>
                      <div className="ml-auto flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCancelarSelecao}
                          className="h-7 text-xs px-3 text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3.5 w-3.5 mr-1" />
                          Cancelar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDialogExportarRelatorio(true)}
                          className="h-7 text-xs px-3 gap-1.5"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Exportar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDialogMudarStatusEmLote(true)}
                          className="h-7 text-xs px-3 gap-1.5"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Mudar status
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setDialogExcluirEmLote(true)}
                          className="h-7 text-xs px-3 gap-1.5"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Excluir {itensSelecionados.size} {itensSelecionados.size === 1 ? "OS" : "OS"}
                        </Button>
                      </div>
                    </div>
                  )}
                  <BuscaOrdemServico
                    busca={busca}
                    onBuscaChange={setBusca}
                    statusFiltro={statusFiltro}
                    onStatusFiltroChange={setStatusFiltro}
                    origemFiltro={origemFiltro}
                    onOrigemFiltroChange={setOrigemFiltro}
                    midiaFiltro={midiaFiltro}
                    onMidiaFiltroChange={setMidiaFiltro}
                    somenteRemessaCorporativa={somenteRemessaCorporativa}
                    onSomenteRemessaCorporativaChange={setSomenteRemessaCorporativa}
                    dataInicio={dataInicio}
                    onDataInicioChange={setDataInicio}
                    dataFim={dataFim}
                    onDataFimChange={setDataFim}
                    mesFiltro={mesFiltro}
                    onMesFiltroChange={aplicarFiltroMes}
                    lojaFiltro={mostrarOsFiliais ? lojaFiltro : undefined}
                    onLojaFiltroChange={mostrarOsFiliais ? setLojaFiltro : undefined}
                    empresasDisponiveis={mostrarOsFiliais ? empresasFiliais : undefined}
                    tecnicoFiltro={tecnicoFiltro}
                    onTecnicoFiltroChange={setTecnicoFiltro}
                    tecnicosDisponiveis={tecnicosDisponiveis}
                  />
                  <TabelaOrdensServico
                    selecaoAtiva={selecaoAtiva}
                    itensSelecionados={itensSelecionados}
                    onToggleSelecionado={handleToggleSelecionado}
                    onToggleTodos={handleToggleTodos}
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
                      // Ordenar por numero_os (sequencial e imutável) em vez de created_at,
                      // que pode ser retroativo via "data de entrada" no formulário.
                      // Serviços avulsos não têm numero_os sequencial ("AVULSO"), então
                      // continuam posicionados pela data nesse caso.
                      const numeroOsInt = (numeroOs: string): number | null => {
                        const digitos = numeroOs?.replace(/\D/g, '');
                        return digitos ? parseInt(digitos, 10) : null;
                      };
                      return [...ordens, ...avulsosComoOrdens].sort((a, b) => {
                        const numA = numeroOsInt(a.numero_os);
                        const numB = numeroOsInt(b.numero_os);
                        if (numA !== null && numB !== null) return numB - numA;
                        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                      });
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
                    mostrarColunaLoja={mostrarOsFiliais}
                    resolverNomeLoja={mostrarOsFiliais ? resolverNomeLoja : undefined}
                  />
                </>
              )}

              {visualizacao === "kanban" && (
                <div className="w-full max-w-full overflow-hidden">
                  <KanbanOrdensServico
                    ordens={ordensComAvulsosParaKanban}
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

              {visualizacao === "tempo" && (
                <div className="w-full max-w-full overflow-hidden">
                  <KanbanTempoAberto
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
                onExcluirOS={(id, numero_os) => setGerencialExcluir({ id, numero_os })}
              />
            </div>
            </TabsContent>

            {temAcessoTiny && (
              <TabsContent value="terceirizada" className="mt-5 md:mt-7">
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

            {temAcessoTiny && (
              <TabsContent value="microsolda" className="mt-5 md:mt-7">
                <MicroSoldaUpStoreTab
                  integration={integration ?? null}
                  integrationLoading={integrationLoading}
                  onConectar={iniciarOAuth}
                  ordensLocal={ordens}
                  loadingLocal={loading}
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
            onSuccess={async () => { await carregarOrdens(); await carregarLucroOrdensEntregues(); await carregarContador(); }}
          />

          <DialogOrdemServicoSimplificada
            open={dialogSimplificadaAberto}
            onOpenChange={setDialogSimplificadaAberto}
            onSuccess={async () => { await carregarOrdens(); await carregarLucroOrdensEntregues(); await carregarContador(); }}
          />

          <DialogVisualizacaoOrdem
            open={dialogVisualizacao}
            onOpenChange={setDialogVisualizacao}
            ordem={ordemSelecionada}
            onEditar={(ordem) => { setDialogVisualizacao(false); handleEditar(ordem); }}
          />

          <DialogAssinaturaSaida
            open={dialogAssinaturaSaida}
            onOpenChange={setDialogAssinaturaSaida}
            ordem={ordemParaAssinatura}
            onSuccess={async () => { await carregarOrdens(); await carregarLucroOrdensEntregues(); await carregarContador(); }}
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

          {/* Dialog de Valor por Hora (Mão de Obra) */}
          <DialogConfiguracaoValorHora
            open={dialogValorHora}
            onOpenChange={setDialogValorHora}
            onSave={refetchConfig}
          />

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

          {/* Dialog de Configuração de Localizações Físicas */}
          <Dialog open={dialogLocalizacao} onOpenChange={setDialogLocalizacao}>
            <DialogContent className="max-w-md">
              <Suspense fallback={null}>
                <ConfiguracaoLocalizacaoOS />
              </Suspense>
            </DialogContent>
          </Dialog>

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

          {/* Mudar status em lote */}
          <Dialog open={dialogMudarStatusEmLote} onOpenChange={(open) => {
            setDialogMudarStatusEmLote(open);
            if (!open) setStatusEmLoteSelecionado("");
          }}>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Mudar Status em Lote
                </DialogTitle>
                <DialogDescription>
                  Selecione o novo status para{" "}
                  <strong>{itensSelecionados.size} {itensSelecionados.size === 1 ? "OS selecionada" : "OS selecionadas"}</strong>.
                </DialogDescription>
              </DialogHeader>
              <div className="py-2">
                <Select value={statusEmLoteSelecionado} onValueChange={setStatusEmLoteSelecionado}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione um status..." />
                  </SelectTrigger>
                  <SelectContent>
                    {statusList.filter(s => s.ativo).map(s => (
                      <SelectItem key={s.slug} value={s.slug}>
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: s.cor }}
                          />
                          {s.nome}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="ghost" size="sm" onClick={() => setDialogMudarStatusEmLote(false)}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  disabled={!statusEmLoteSelecionado}
                  onClick={handleConfirmarMudarStatusEmLote}
                >
                  Confirmar
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Excluir em lote */}
          <AlertDialog open={dialogExcluirEmLote} onOpenChange={setDialogExcluirEmLote}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar Exclusão em Lote</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir{" "}
                  <strong>{itensSelecionados.size} {itensSelecionados.size === 1 ? "ordem de serviço" : "ordens de serviço"}</strong>?
                  Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleConfirmarExclusaoEmLote}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Excluir {itensSelecionados.size} {itensSelecionados.size === 1 ? "OS" : "OS"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

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

          {/* Excluir OS via Painel Gerencial */}
          <AlertDialog
            open={!!gerencialExcluir}
            onOpenChange={() => setGerencialExcluir(null)}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir a ordem de serviço{" "}
                  <strong>{gerencialExcluir?.numero_os}</strong>? Esta ação não
                  pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async () => {
                    if (gerencialExcluir) {
                      await excluirOrdem(gerencialExcluir.id);
                      setGerencialExcluir(null);
                      await carregarContador();
                    }
                  }}
                >
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

          {/* Dialog Problema Relatado - Garantia */}
          <DialogProblemaGarantia
            open={dialogProblemaGarantia}
            onOpenChange={(open) => {
              setDialogProblemaGarantia(open);
              if (!open) setOrdemParaGarantia(null);
            }}
            ordemId={ordemParaGarantia}
            onConfirmar={handleConfirmarProblemaGarantia}
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
            onImportar={async (ordens: Parameters<typeof importarOSEmLote>[0]) => {
              const resultado = await importarOSEmLote(ordens);
              await carregarContador();
              return resultado;
            }}
          />
        </div>
      </main>
      </Suspense>

      {/* Dialog de Compartilhamento */}
      <Dialog open={dialogCompartilharAberto} onOpenChange={setDialogCompartilharAberto}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RadioTower className="h-5 w-5 text-blue-500" />
              Compartilhar Acompanhamento
            </DialogTitle>
            <DialogDescription className="truncate max-w-full">
              OS #{ordemCompartilhar?.numero_os} — {ordemCompartilhar?.cliente?.nome}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted border overflow-hidden">
            <p className="text-xs text-muted-foreground flex-1 break-all min-w-0">{linkCompartilhamento}</p>
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

      {dialogExportarRelatorio && (
        <Suspense fallback={null}>
          <DialogExportarRelatorio
            aberto={dialogExportarRelatorio}
            onFechar={() => setDialogExportarRelatorio(false)}
            ordens={ordens}
            itensSelecionados={selecaoAtiva ? itensSelecionados : undefined}
          />
        </Suspense>
      )}
    </AppLayout>
  );
}
