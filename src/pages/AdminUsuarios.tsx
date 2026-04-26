import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAdminUsuarios, UsuarioAdmin, PRECOS_MENSAIS, TipoBloqueio, PlanoAcesso, UnidadeTempo } from "@/hooks/useAdminUsuarios";
import { TabelaUsuariosAdmin } from "@/components/admin/TabelaUsuariosAdmin";
import { NotificacoesAdmin } from "@/components/admin/NotificacoesAdmin";
import { DialogBloquearUsuario } from "@/components/admin/DialogBloquearUsuario";
import { DialogDeletarUsuario } from "@/components/admin/DialogDeletarUsuario";
import { DialogConcederAcesso } from "@/components/admin/DialogConcederAcesso";
import { 
  Users, 
  UserCheck, 
  UserX, 
  Clock, 
  CreditCard, 
  RefreshCw, 
  Search,
  AlertTriangle,
  TrendingUp,
  Shield,
  ShieldX,
  DollarSign,
  MessageCircle,
  Ban,
  UserMinus,
  Target,
  Activity,
} from "lucide-react";
import { DialogConfiguracaoMensagensWhatsAppAdmin } from "@/components/admin/DialogConfiguracaoMensagensWhatsAppAdmin";
import { useAdminWhatsAppTemplates } from "@/hooks/useAdminWhatsAppTemplates";
import { Navigate } from "react-router-dom";
import { useStripeBalance } from "@/hooks/useStripeBalance";
import { useOnlineUsersCount } from "@/hooks/useUserPresence";

export default function AdminUsuarios() {
  const { 
    usuarios, 
    isLoading, 
    isAdmin, 
    estatisticas, 
    metricasReceita, 
    bloqueandoUsuario,
    recarregar, 
    bloquearUsuario, 
    desbloquearUsuario,
    deletarUsuario,
    concederAcesso,
    bloquearTrialsExpirados,
  } = useAdminUsuarios();
  
  const { balance: stripeBalance, fetchBalance, isLoading: stripeLoading } = useStripeBalance();
  
  useEffect(() => {
    if (isAdmin) {
      fetchBalance();
    }
  }, [isAdmin, fetchBalance]);

  const [busca, setBusca] = useState("");
  const [filtroPlano, setFiltroPlano] = useState<string>("todos");
  const [abaAtiva, setAbaAtiva] = useState("todos");
  const [periodoProjecao, setPeriodoProjecao] = useState("3");
  const [onlineCount, setOnlineCount] = useState(0);

  useOnlineUsersCount(
    !!isAdmin,
    useCallback((count: number) => setOnlineCount(count), []),
  );
  
  // Dialog states
  const [dialogBloqueioAberto, setDialogBloqueioAberto] = useState(false);
  const [usuarioSelecionado, setUsuarioSelecionado] = useState<UsuarioAdmin | null>(null);
  const [dialogDeletarAberto, setDialogDeletarAberto] = useState(false);
  const [usuarioParaDeletar, setUsuarioParaDeletar] = useState<UsuarioAdmin | null>(null);
  const [dialogAcessoAberto, setDialogAcessoAberto] = useState(false);
  const [usuarioParaAcesso, setUsuarioParaAcesso] = useState<UsuarioAdmin | null>(null);
  const [dialogWhatsAppAberto, setDialogWhatsAppAberto] = useState(false);
  const { getMensagemFormatada } = useAdminWhatsAppTemplates();

  if (!isLoading && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const filtrarUsuarios = (lista: UsuarioAdmin[]) => {
    return lista.filter(usuario => {
      const matchBusca = !busca || 
        usuario.nome?.toLowerCase().includes(busca.toLowerCase()) ||
        usuario.email?.toLowerCase().includes(busca.toLowerCase());
      const matchPlano = filtroPlano === "todos" || usuario.plano_tipo === filtroPlano;
      return matchBusca && matchPlano;
    });
  };

  const usuariosFiltrados = filtrarUsuarios(usuarios);
  
  const agora = new Date();
  const doisDiasAtras = new Date(agora.getTime() - 2 * 24 * 60 * 60 * 1000);
  const tresDiasAtras = new Date(agora.getTime() - 3 * 24 * 60 * 60 * 1000);

  // 1. Assinantes - status active + stripe_subscription_id real
  const assinantes = usuariosFiltrados.filter(u => u.is_pagante && u.status === "active");
  
  // 2. Free Ativos - plano free, logou nos últimos 2 dias
  const freeAtivos = usuariosFiltrados.filter(u => {
    if (u.plano_tipo !== "free" || u.status !== "active") return false;
    if (!u.last_login_at) return false;
    return new Date(u.last_login_at) >= doisDiasAtras;
  });
  
  // 3. Free Inativos - plano free, sem login ou >3 dias
  const freeInativos = usuariosFiltrados.filter(u => {
    if (u.plano_tipo !== "free" || u.status !== "active") return false;
    if (!u.last_login_at) return true;
    return new Date(u.last_login_at) < tresDiasAtras;
  });
  
  // 4. Não Assinaram - nunca tiveram plano pago (exclui quem já foi assinante)
  const naoAssinaram = usuariosFiltrados.filter(u => {
    const hasRealSubscription = u.stripe_subscription_id?.startsWith("sub_") && 
      !u.stripe_subscription_id?.startsWith("sub_demo_") &&
      !u.stripe_subscription_id?.startsWith("sub_trial_") &&
      !u.stripe_subscription_id?.startsWith("sub_pending_");
    // Nunca teve assinatura real, e não é pagante ativo
    return !hasRealSubscription && !u.is_pagante && u.status !== "canceled";
  });
  
  // 5. Assinantes Perdidos - tiveram subscription real + status canceled
  const assinantesPerdidos = usuariosFiltrados.filter(u => {
    if (u.status !== "canceled") return false;
    const hasRealStripeCustomer = u.stripe_customer_id?.startsWith("cus_") ?? false;
    const hasRealSubscription = u.stripe_subscription_id?.startsWith("sub_") && 
      !u.stripe_subscription_id?.startsWith("sub_demo_") &&
      !u.stripe_subscription_id?.startsWith("sub_trial_") &&
      !u.stripe_subscription_id?.startsWith("sub_pending_");
    return hasRealStripeCustomer || hasRealSubscription;
  });

  // 6. Assinantes Sem Pagar - dados da Stripe (past_due + incomplete)
  const assinantesSemPagar = stripeBalance?.unpaid_count ?? 0;

  const planosUnicos = Array.from(new Set(usuarios.map(u => u.plano_tipo)));

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
  };

  // MRR e Projeção
  const mrrAtual = stripeBalance?.mrr_active_only ?? 0;
  const mesesProjecao = parseInt(periodoProjecao);
  const projecaoMRR = mrrAtual * mesesProjecao;

  // Conversão do sistema
  const taxaConversaoSistema = estatisticas.total > 0 
    ? ((assinantes.length / estatisticas.total) * 100) 
    : 0;
  
  // Benchmark SaaS freemium: 2-5%
  const getIndicadorConversao = (taxa: number) => {
    if (taxa >= 5) return { cor: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-900/30", label: "Acima da média" };
    if (taxa >= 2) return { cor: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-900/30", label: "Dentro da média" };
    return { cor: "text-red-600", bg: "bg-red-100 dark:bg-red-900/30", label: "Abaixo da média" };
  };
  const indicadorConversao = getIndicadorConversao(taxaConversaoSistema);

  // Handlers
  const handleAbrirBloqueio = (usuario: UsuarioAdmin) => {
    setUsuarioSelecionado(usuario);
    setDialogBloqueioAberto(true);
  };
  const handleConfirmarBloqueio = async (userId: string, motivo: string, tipoBloqueio: TipoBloqueio) => {
    await bloquearUsuario(userId, motivo, tipoBloqueio);
  };
  const handleDesbloquear = async (userId: string) => {
    await desbloquearUsuario(userId);
  };
  const handleAbrirDeletar = (usuario: UsuarioAdmin) => {
    setUsuarioParaDeletar(usuario);
    setDialogDeletarAberto(true);
  };
  const handleConfirmarDeletar = async (userId: string) => {
    return await deletarUsuario(userId);
  };
  const handleAbrirConcederAcesso = (usuario: UsuarioAdmin) => {
    setUsuarioParaAcesso(usuario);
    setDialogAcessoAberto(true);
  };
  const handleConfirmarConcederAcesso = async (userId: string, planoTipo: PlanoAcesso, tempoAcesso: number, unidadeTempo: UnidadeTempo, motivo: string) => {
    return await concederAcesso(userId, planoTipo, tempoAcesso, unidadeTempo, motivo);
  };

  return (
    <AppLayout>
      <main className="flex-1 p-4 md:p-6 overflow-x-hidden overflow-y-auto">
        <div className="mb-4 md:mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="text-xl md:text-2xl lg:text-3xl font-bold">Gestão de Usuários</h1>
          </div>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">Gerenciar usuários do sistema</p>
            <NotificacoesAdmin />
          </div>
        </div>

        <div className="space-y-4 md:space-y-6">
          {/* Action buttons */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <h2 className="text-lg md:text-2xl font-bold">Dashboard</h2>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => setDialogWhatsAppAberto(true)} variant="outline" size="sm" className="text-xs md:text-sm">
                <MessageCircle className="h-4 w-4 mr-1" />
                <span className="hidden md:inline">Mensagens WhatsApp</span>
                <span className="md:hidden">WhatsApp</span>
              </Button>
              <Button 
                onClick={async () => {
                  try {
                    toast.loading("Sincronizando com Stripe...");
                    const { data, error } = await supabase.functions.invoke("sync-stripe-subscriptions");
                    toast.dismiss();
                    if (error) throw error;
                    if (data?.error) throw new Error(data.error);
                    toast.success(`Sincronização concluída: ${data.processed} assinaturas processadas`);
                    recarregar();
                    fetchBalance();
                  } catch (err: any) {
                    toast.dismiss();
                    toast.error(err.message || "Erro ao sincronizar");
                  }
                }}
                variant="outline" size="sm" className="text-xs md:text-sm"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                <span className="hidden md:inline">Sincronizar Stripe</span>
                <span className="md:hidden">Sync</span>
              </Button>
              <Button 
                onClick={bloquearTrialsExpirados} 
                variant="destructive" size="sm" 
                disabled={bloqueandoUsuario || isLoading}
                className="flex-1 md:flex-none text-xs md:text-sm"
              >
                <ShieldX className="h-4 w-4 mr-1 md:mr-2" />
                <span className="hidden md:inline">Bloquear Trials Expirados</span>
                <span className="md:hidden">Bloquear</span>
              </Button>
              <Button onClick={recarregar} variant="outline" size="sm" disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* 7 Cards Superiores */}
          <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8">
            <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-green-700 dark:text-green-400">Online Agora</CardTitle>
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
              </CardHeader>
              <CardContent>
                <div className="text-lg sm:text-2xl font-bold text-green-700 dark:text-green-400 flex items-center gap-1">
                  <Activity className="h-4 w-4" />
                  {onlineCount}
                </div>
                <p className="text-[10px] text-green-600/70 dark:text-green-400/70 mt-1">Usando o sistema</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium">Cadastrados</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-lg sm:text-2xl font-bold">{estatisticas.total}</div>
                <p className="text-[10px] text-muted-foreground mt-1">Todos os usuários</p>
              </CardContent>
            </Card>

            <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Assinantes</CardTitle>
                <CreditCard className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-lg sm:text-2xl font-bold text-emerald-700 dark:text-emerald-400">{assinantes.length}</div>
                <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70 mt-1">Pagamento em dia</p>
              </CardContent>
            </Card>

            <Card className="border-cyan-200 bg-cyan-50/50 dark:bg-cyan-950/20">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-cyan-700 dark:text-cyan-400">Free Ativos</CardTitle>
                <UserCheck className="h-4 w-4 text-cyan-500" />
              </CardHeader>
              <CardContent>
                <div className="text-lg sm:text-2xl font-bold text-cyan-700 dark:text-cyan-400">{freeAtivos.length}</div>
                <p className="text-[10px] text-cyan-600/70 dark:text-cyan-400/70 mt-1">Últimos 2 dias</p>
              </CardContent>
            </Card>

            <Card className="border-gray-200 bg-gray-50/50 dark:bg-gray-950/20">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-gray-700 dark:text-gray-400">Free Inativos</CardTitle>
                <Clock className="h-4 w-4 text-gray-500" />
              </CardHeader>
              <CardContent>
                <div className="text-lg sm:text-2xl font-bold text-gray-700 dark:text-gray-400">{freeInativos.length}</div>
                <p className="text-[10px] text-muted-foreground mt-1">+3 dias sem uso</p>
              </CardContent>
            </Card>

            <Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-950/20">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-orange-700 dark:text-orange-400">Não Assinaram</CardTitle>
                <UserMinus className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-lg sm:text-2xl font-bold text-orange-700 dark:text-orange-400">{naoAssinaram.length}</div>
                <p className="text-[10px] text-orange-600/70 dark:text-orange-400/70 mt-1">Sem plano pago</p>
              </CardContent>
            </Card>

            <Card className="border-red-200 bg-red-50/50 dark:bg-red-950/20">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-red-700 dark:text-red-400">Perdidos</CardTitle>
                <UserX className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-lg sm:text-2xl font-bold text-red-700 dark:text-red-400">{assinantesPerdidos.length}</div>
                <p className="text-[10px] text-red-600/70 dark:text-red-400/70 mt-1">Cancelaram plano</p>
              </CardContent>
            </Card>

            <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-amber-700 dark:text-amber-400">Sem Pagar</CardTitle>
                <Ban className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-lg sm:text-2xl font-bold text-amber-700 dark:text-amber-400">{assinantesSemPagar}</div>
                <p className="text-[10px] text-amber-600/70 dark:text-amber-400/70 mt-1">Renovação pendente</p>
              </CardContent>
            </Card>
          </div>

          {/* Métricas de Receita (MRR) - 2 cards */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-green-50/50 dark:from-emerald-950/20 dark:to-green-950/20">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-base">
                  <DollarSign className="h-5 w-5" />
                  MRR Atual (Stripe)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                  {formatarMoeda(mrrAtual)}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {stripeBalance?.active_subscriptions_count ?? 0} assinantes ativos pagando
                </p>
              </CardContent>
            </Card>

            <Card className="border-blue-200 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400 text-base">
                    <TrendingUp className="h-5 w-5" />
                    Projeção de MRR
                  </CardTitle>
                  <Select value={periodoProjecao} onValueChange={setPeriodoProjecao}>
                    <SelectTrigger className="w-[130px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 meses</SelectItem>
                      <SelectItem value="6">6 meses</SelectItem>
                      <SelectItem value="12">1 ano</SelectItem>
                      <SelectItem value="24">2 anos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {formatarMoeda(projecaoMRR)}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {formatarMoeda(mrrAtual)}/mês × {mesesProjecao} meses
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Métricas de Conversão */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Target className="h-5 w-5 text-primary" />
                  Conversão do Sistema
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="text-4xl font-bold text-primary">
                    {taxaConversaoSistema.toFixed(1)}%
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${indicadorConversao.bg} ${indicadorConversao.cor}`}>
                    {indicadorConversao.label}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {assinantes.length} assinantes de {estatisticas.total} cadastrados
                </p>
                <div className="mt-3 p-3 rounded-lg bg-muted/30 text-xs text-muted-foreground">
                  <p className="font-medium mb-1">Benchmark SaaS Freemium:</p>
                  <p>• Abaixo: &lt;2% | Dentro: 2-5% | Acima: &gt;5%</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Conversão da Landing Page
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Cadastros</span>
                    <span className="text-lg font-bold">{estatisticas.total}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Assinaram</span>
                    <span className="text-lg font-bold text-emerald-600">{assinantes.length}</span>
                  </div>
                  <div className="flex items-center justify-between border-t pt-2">
                    <span className="text-sm font-medium">Taxa de assinatura</span>
                    <span className="text-lg font-bold text-primary">{taxaConversaoSistema.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="mt-3 p-3 rounded-lg bg-muted/30 text-xs text-muted-foreground">
                  <p className="font-medium mb-1">Benchmark Landing Pages SaaS:</p>
                  <p>• Taxa cadastro: 2-5% dos visitantes</p>
                  <p>• Taxa assinatura: 1-3% dos cadastrados</p>
                  <p className="mt-1 text-[10px]">Conecte analytics para ver visitantes da LP</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filtros */}
          <Card>
            <CardContent className="pt-4 md:pt-6">
              <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Buscar</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Nome ou email..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-10" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Plano</label>
                  <Select value={filtroPlano} onValueChange={setFiltroPlano}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os planos</SelectItem>
                      {planosUnicos.map(plano => (
                        <SelectItem key={plano} value={plano}>
                          {plano.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs value={abaAtiva} onValueChange={setAbaAtiva}>
            <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
              <TabsList className="grid w-max md:w-full grid-cols-7 min-w-[600px]">
                <TabsTrigger value="todos" className="text-[10px] md:text-xs px-2">
                  Todos ({usuariosFiltrados.length})
                </TabsTrigger>
                <TabsTrigger value="assinantes" className="text-[10px] md:text-xs text-emerald-600 px-2">
                  Assinantes ({assinantes.length})
                </TabsTrigger>
                <TabsTrigger value="free-ativos" className="text-[10px] md:text-xs text-cyan-600 px-2">
                  Free At. ({freeAtivos.length})
                </TabsTrigger>
                <TabsTrigger value="free-inativos" className="text-[10px] md:text-xs text-gray-600 px-2">
                  Free In. ({freeInativos.length})
                </TabsTrigger>
                <TabsTrigger value="nao-assinaram" className="text-[10px] md:text-xs text-orange-600 px-2">
                  Sem Plano ({naoAssinaram.length})
                </TabsTrigger>
                <TabsTrigger value="perdidos" className="text-[10px] md:text-xs text-red-600 px-2">
                  Perdidos ({assinantesPerdidos.length})
                </TabsTrigger>
                <TabsTrigger value="sem-pagar" className="text-[10px] md:text-xs text-amber-600 px-2">
                  S/ Pagar ({assinantesSemPagar})
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="todos" className="mt-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Todos os Usuários</CardTitle>
                    <Badge variant="secondary">{usuariosFiltrados.length}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <TabelaUsuariosAdmin usuarios={usuariosFiltrados} isLoading={isLoading} onBloquear={handleAbrirBloqueio} onDeletar={handleAbrirDeletar} onConcederAcesso={handleAbrirConcederAcesso} getMensagemFormatada={getMensagemFormatada} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="assinantes" className="mt-4">
              <Card className="border-emerald-200 dark:border-emerald-800">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                      <CreditCard className="h-5 w-5" /> Assinantes
                    </CardTitle>
                    <Badge className="bg-emerald-500">{assinantes.length}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">Usuários com assinatura ativa e pagamento em dia</p>
                </CardHeader>
                <CardContent>
                  <TabelaUsuariosAdmin usuarios={assinantes} isLoading={isLoading} onBloquear={handleAbrirBloqueio} onDeletar={handleAbrirDeletar} onConcederAcesso={handleAbrirConcederAcesso} getMensagemFormatada={getMensagemFormatada} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="free-ativos" className="mt-4">
              <Card className="border-cyan-200 dark:border-cyan-800">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-cyan-700 dark:text-cyan-400">
                      <UserCheck className="h-5 w-5" /> Free Ativos
                    </CardTitle>
                    <Badge className="bg-cyan-500">{freeAtivos.length}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">Plano free, usaram nos últimos 2 dias</p>
                </CardHeader>
                <CardContent>
                  <TabelaUsuariosAdmin usuarios={freeAtivos} isLoading={isLoading} onBloquear={handleAbrirBloqueio} onDeletar={handleAbrirDeletar} onConcederAcesso={handleAbrirConcederAcesso} getMensagemFormatada={getMensagemFormatada} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="free-inativos" className="mt-4">
              <Card className="border-gray-200 dark:border-gray-800">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-gray-700 dark:text-gray-400">
                      <Clock className="h-5 w-5" /> Free Inativos
                    </CardTitle>
                    <Badge variant="secondary">{freeInativos.length}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">Plano free, sem usar há mais de 3 dias</p>
                </CardHeader>
                <CardContent>
                  <TabelaUsuariosAdmin usuarios={freeInativos} isLoading={isLoading} onBloquear={handleAbrirBloqueio} onDeletar={handleAbrirDeletar} onConcederAcesso={handleAbrirConcederAcesso} getMensagemFormatada={getMensagemFormatada} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="nao-assinaram" className="mt-4">
              <Card className="border-orange-200 dark:border-orange-800">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
                      <UserMinus className="h-5 w-5" /> Não Assinaram
                    </CardTitle>
                    <Badge variant="destructive">{naoAssinaram.length}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">Nunca assinaram nenhum plano pago</p>
                </CardHeader>
                <CardContent>
                  <TabelaUsuariosAdmin usuarios={naoAssinaram} isLoading={isLoading} onBloquear={handleAbrirBloqueio} onDeletar={handleAbrirDeletar} onConcederAcesso={handleAbrirConcederAcesso} getMensagemFormatada={getMensagemFormatada} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="perdidos" className="mt-4">
              <Card className="border-red-200 dark:border-red-800">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
                      <UserX className="h-5 w-5" /> Assinantes Perdidos
                    </CardTitle>
                    <Badge variant="destructive">{assinantesPerdidos.length}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">Cancelaram a assinatura</p>
                </CardHeader>
                <CardContent>
                  <TabelaUsuariosAdmin usuarios={assinantesPerdidos} isLoading={isLoading} onBloquear={handleAbrirBloqueio} onDeletar={handleAbrirDeletar} onConcederAcesso={handleAbrirConcederAcesso} getMensagemFormatada={getMensagemFormatada} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sem-pagar" className="mt-4">
              <Card className="border-amber-200 dark:border-amber-800">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                      <Ban className="h-5 w-5" /> Assinantes Sem Pagar
                    </CardTitle>
                    <Badge variant="destructive">{assinantesSemPagar}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">Renovação pendente na Stripe (past_due ou incomplete)</p>
                </CardHeader>
                <CardContent>
                  {stripeBalance?.past_due_subscriptions && stripeBalance.past_due_subscriptions.length > 0 ? (
                    <div className="space-y-2">
                      {[...(stripeBalance.past_due_subscriptions || []), ...(stripeBalance.incomplete_subscriptions || [])].map((u, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                          <div>
                            <p className="font-medium text-sm">{u.name || "Sem nome"}</p>
                            <p className="text-xs text-muted-foreground">{u.email || "Sem email"}</p>
                          </div>
                          <Badge variant={u.status === "past_due" ? "destructive" : "outline"}>
                            {u.status === "past_due" ? "Atrasado" : "Incompleto"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {stripeLoading ? "Carregando dados da Stripe..." : "Nenhum assinante com pagamento pendente"}
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <DialogBloquearUsuario
        open={dialogBloqueioAberto}
        onOpenChange={setDialogBloqueioAberto}
        usuario={usuarioSelecionado ? {
          user_id: usuarioSelecionado.user_id,
          nome: usuarioSelecionado.nome,
          email: usuarioSelecionado.email,
          bloqueado: usuarioSelecionado.bloqueado_admin,
          bloqueado_tipo: usuarioSelecionado.bloqueado_tipo || undefined,
        } : null}
        onConfirmar={handleConfirmarBloqueio}
        onDesbloquear={handleDesbloquear}
        isLoading={bloqueandoUsuario}
      />

      <DialogDeletarUsuario
        open={dialogDeletarAberto}
        onOpenChange={setDialogDeletarAberto}
        usuario={usuarioParaDeletar}
        onConfirmar={handleConfirmarDeletar}
      />

      <DialogConcederAcesso
        open={dialogAcessoAberto}
        onOpenChange={setDialogAcessoAberto}
        usuario={usuarioParaAcesso ? {
          user_id: usuarioParaAcesso.user_id,
          nome: usuarioParaAcesso.nome,
          email: usuarioParaAcesso.email,
          plano_tipo: usuarioParaAcesso.plano_tipo,
          status: usuarioParaAcesso.status,
        } : null}
        onConfirmar={handleConfirmarConcederAcesso}
        isLoading={bloqueandoUsuario}
      />

      <DialogConfiguracaoMensagensWhatsAppAdmin
        open={dialogWhatsAppAberto}
        onOpenChange={setDialogWhatsAppAberto}
      />
    </AppLayout>
  );
}
