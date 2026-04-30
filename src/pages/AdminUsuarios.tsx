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
  const assinantes = usuariosFiltrados.filter(u => u.is_pagante);
  
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
  const TAXA_PIX = 0.0119;
  const TAXA_CARTAO = 0.0439;
  const TAXA_PROCESSAMENTO_CARTAO = 0.55;

  const mrrAtual = assinantes.reduce((total, u) => {
    const valorBruto = PRECOS_MENSAIS[u.plano_tipo] || 0;
    const metodo = (u as unknown as Record<string, unknown>).payment_method as string || 'pix';

    let valorLiquido: number;
    if (metodo === 'cartao' || metodo === 'credit_card') {
      valorLiquido = valorBruto * (1 - TAXA_CARTAO) - TAXA_PROCESSAMENTO_CARTAO;
    } else {
      valorLiquido = valorBruto * (1 - TAXA_PIX);
    }

    return total + Math.max(0, valorLiquido);
  }, 0);
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

  // Novos usuários este mês
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const novosEsteMes = usuariosFiltrados.filter(u =>
    u.created_at && new Date(u.created_at) >= inicioMes
  ).length;

  const novosAssinantesEsteMes = assinantes.filter(u =>
    u.created_at && new Date(u.created_at) >= inicioMes
  ).length;

  const totalAssinantesHistorico = assinantes.length + assinantesPerdidos.length;
  const churnRate = totalAssinantesHistorico > 0
    ? (assinantesPerdidos.length / totalAssinantesHistorico * 100)
    : 0;

  const ticketMedio = assinantes.length > 0 ? mrrAtual / assinantes.length : 0;

  // Breakdown por provedor de pagamento
  const planosPagos = [
    "basico_mensal", "basico_anual",
    "intermediario_mensal", "intermediario_anual",
    "profissional_mensal", "profissional_anual",
  ];

  const assinantesPagarme = usuariosFiltrados.filter(u =>
    (u as unknown as Record<string, unknown>).payment_provider === 'pagarme' &&
    u.status === 'active' &&
    planosPagos.includes(u.plano_tipo) &&
    (!u.data_fim || new Date(u.data_fim) > new Date())
  );

  const tictoVigentes = usuariosFiltrados.filter(u =>
    (u as unknown as Record<string, unknown>).payment_provider === 'ticto' &&
    u.status === 'active' &&
    planosPagos.includes(u.plano_tipo) &&
    u.data_fim !== null && u.data_fim !== undefined && new Date(u.data_fim) > new Date()
  );

  const tictoVencidos = usuariosFiltrados.filter(u =>
    (u as unknown as Record<string, unknown>).payment_provider === 'ticto' &&
    u.status === 'active' &&
    planosPagos.includes(u.plano_tipo) &&
    u.data_fim !== null && u.data_fim !== undefined && new Date(u.data_fim) <= new Date()
  );

  const assinantesStripe = usuariosFiltrados.filter(u =>
    (u as unknown as Record<string, unknown>).payment_provider === 'stripe' &&
    u.status === 'active' &&
    planosPagos.includes(u.plano_tipo) &&
    (!u.data_fim || new Date(u.data_fim) > new Date())
  );

  const totalAssinantesVigentes = assinantesPagarme.length + tictoVigentes.length + assinantesStripe.length;

  const percentualMigrado = (tictoVigentes.length + assinantesPagarme.length) > 0
    ? Math.round((assinantesPagarme.length / (tictoVigentes.length + assinantesPagarme.length)) * 100)
    : 0;

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

        {/* HEADER */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <Shield className="h-4 w-4 text-violet-500" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Gestão de Usuários</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Painel administrativo · {estatisticas.total} usuários cadastrados
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <NotificacoesAdmin />
            <Button onClick={() => setDialogWhatsAppAberto(true)} variant="outline" size="sm">
              <MessageCircle className="h-4 w-4 mr-2" />
              <span className="hidden md:inline">WhatsApp</span>
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
              variant="outline" size="sm"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              <span className="hidden md:inline">Sync Stripe</span>
            </Button>
            <Button onClick={bloquearTrialsExpirados} variant="destructive" size="sm" disabled={bloqueandoUsuario || isLoading}>
              <ShieldX className="h-4 w-4 mr-2" />
              <span className="hidden md:inline">Bloquear Trials</span>
            </Button>
            <Button onClick={recarregar} variant="outline" size="icon" disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        <div className="space-y-6">

          {/* LINHA 1 — KPIs principais */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

            <Card className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-slate-500/5 to-transparent" />
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Cadastrados</span>
                  <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <Users className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                  </div>
                </div>
                <div className="text-3xl font-bold">{estatisticas.total}</div>
                <div className="mt-2 flex items-center gap-1 text-xs text-emerald-600">
                  <TrendingUp className="h-3 w-3" />
                  <span>+{novosEsteMes} este mês</span>
                </div>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden border-emerald-200 dark:border-emerald-800">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent" />
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Assinantes</span>
                  <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                    <CreditCard className="h-4 w-4 text-emerald-600" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{assinantes.length}</div>
                <div className="mt-2 text-xs text-emerald-600">
                  {assinantes.length} pagantes ativos
                </div>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden border-blue-200 dark:border-blue-800">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent" />
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-blue-700 dark:text-blue-400 uppercase tracking-wider">MRR</span>
                  <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                    <DollarSign className="h-4 w-4 text-blue-600" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{formatarMoeda(mrrAtual)}</div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Ticket médio: {formatarMoeda(ticketMedio)}
                </div>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden border-green-200 dark:border-green-800">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent" />
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-green-700 dark:text-green-400 uppercase tracking-wider">Online Agora</span>
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
                  </span>
                </div>
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">{onlineCount}</div>
                <div className="mt-2 text-xs text-muted-foreground">Usando o sistema agora</div>
              </CardContent>
            </Card>

          </div>

          {/* LINHA 2 — Métricas secundárias */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

            <Card className="border-cyan-200 dark:border-cyan-800 bg-cyan-50/30 dark:bg-cyan-950/10">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-cyan-100 dark:bg-cyan-900/50 flex items-center justify-center flex-shrink-0">
                  <UserCheck className="h-5 w-5 text-cyan-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-cyan-600">{freeAtivos.length}</div>
                  <div className="text-xs text-muted-foreground">Free Ativos</div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-orange-200 dark:border-orange-800 bg-orange-50/30 dark:bg-orange-950/10">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center flex-shrink-0">
                  <UserMinus className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-orange-600">{naoAssinaram.length}</div>
                  <div className="text-xs text-muted-foreground">Sem Plano</div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-950/10">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-red-100 dark:bg-red-900/50 flex items-center justify-center flex-shrink-0">
                  <UserX className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-600">{assinantesPerdidos.length}</div>
                  <div className="text-xs text-muted-foreground">Churn: {churnRate.toFixed(1)}%</div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-violet-200 dark:border-violet-800 bg-violet-50/30 dark:bg-violet-950/10">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center flex-shrink-0">
                  <Target className="h-5 w-5 text-violet-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-violet-600">{taxaConversaoSistema.toFixed(1)}%</div>
                  <div className="text-xs text-muted-foreground">Conversão</div>
                </div>
              </CardContent>
            </Card>

          </div>

          {/* Card Migração Ticto → Pagar.me */}
          <Card className="border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20">
            <CardContent className="p-5">

              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                    <RefreshCw className="h-4 w-4 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">Migração Ticto → Pagar.me</h3>
                    <p className="text-xs text-muted-foreground">{percentualMigrado}% concluída</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-amber-600 border-amber-400">
                  {assinantesPagarme.length}/{tictoVigentes.length + assinantesPagarme.length}
                </Badge>
              </div>

              {/* Barra de progresso */}
              <div className="w-full bg-muted rounded-full h-2 mb-4">
                <div
                  className="bg-gradient-to-r from-amber-400 to-green-500 h-2 rounded-full transition-all"
                  style={{ width: `${percentualMigrado}%` }}
                />
              </div>

              {/* Grid de provedores */}
              <div className="grid grid-cols-3 gap-3">

                <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                  <div className="text-xl font-bold text-green-600">{assinantesPagarme.length}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Pagar.me</div>
                  <div className="text-[10px] text-green-600 font-medium">✓ Migrados</div>
                </div>

                <div className="text-center p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <div className="text-xl font-bold text-amber-600">{tictoVigentes.length}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Ticto</div>
                  <div className="text-[10px] text-amber-600 font-medium">⏳ Pendentes</div>
                </div>

                <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                  <div className="text-xl font-bold text-red-600">{tictoVencidos.length}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Ticto</div>
                  <div className="text-[10px] text-red-600 font-medium">⚠️ Vencidos</div>
                </div>

              </div>

              {tictoVencidos.length > 0 && (
                <p className="text-xs text-red-600 mt-3 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {tictoVencidos.length} assinante(s) do Ticto com plano vencido hoje — precisam renovar no Pagar.me
                </p>
              )}

            </CardContent>
          </Card>

          {/* LINHA 3 — Projeção MRR + Conversão */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            <Card className="md:col-span-2 bg-gradient-to-br from-blue-950/20 to-indigo-950/20 border-blue-800/30">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-blue-400" />
                    <span className="font-medium text-blue-400 text-sm">Projeção de Receita</span>
                  </div>
                  <Select value={periodoProjecao} onValueChange={setPeriodoProjecao}>
                    <SelectTrigger className="w-28 h-7 text-xs border-blue-800/50">
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
                <div className="flex items-end gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Projeção {periodoProjecao}m</div>
                    <div className="text-3xl font-bold text-blue-400">{formatarMoeda(projecaoMRR)}</div>
                  </div>
                  <div className="pb-1 text-muted-foreground text-sm">
                    = {formatarMoeda(mrrAtual)}/mês × {mesesProjecao}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Target className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">Taxa de Conversão</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`text-3xl font-bold ${indicadorConversao.cor}`}>
                    {taxaConversaoSistema.toFixed(1)}%
                  </div>
                  <div className={`px-2 py-0.5 rounded-full text-xs font-medium ${indicadorConversao.bg} ${indicadorConversao.cor}`}>
                    {indicadorConversao.label}
                  </div>
                </div>
                <div className="mt-3 text-xs text-muted-foreground space-y-0.5">
                  <p>{assinantes.length} assinantes de {estatisticas.total} cadastrados</p>
                  <p>Benchmark: 2-5% (freemium SaaS)</p>
                </div>
              </CardContent>
            </Card>

          </div>

          {/* FILTROS */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou email..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={filtroPlano} onValueChange={setFiltroPlano}>
                  <SelectTrigger className="sm:w-48">
                    <SelectValue placeholder="Todos os planos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os planos</SelectItem>
                    {planosUnicos.map(plano => (
                      <SelectItem key={plano} value={plano}>
                        {plano.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* TABS */}
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
