import { useState, useMemo } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Bell, 
  UserPlus, 
  CreditCard, 
  XCircle, 
  AlertTriangle,
  CheckCheck,
  Search,
  Filter,
  Calendar,
  RefreshCw
} from "lucide-react";
import { Navigate } from "react-router-dom";
import { NotificacoesAdmin } from "@/components/admin/NotificacoesAdmin";
import { useAdminNotifications, AdminNotification } from "@/hooks/useAdminNotifications";
import { useAdminUsuarios } from "@/hooks/useAdminUsuarios";
import { format, isToday, isYesterday, isThisWeek, isThisMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { AppLayout } from "@/components/layout/AppLayout";
import { PreferenciasNotificacaoPush } from "@/components/configuracoes/PreferenciasNotificacaoPush";

const tipoIcone = {
  novo_trial: UserPlus,
  nova_assinatura: CreditCard,
  cancelamento: XCircle,
  pagamento_falhou: AlertTriangle,
};

const tipoCor = {
  novo_trial: 'text-blue-500 bg-blue-50',
  nova_assinatura: 'text-green-500 bg-green-50',
  cancelamento: 'text-red-500 bg-red-50',
  pagamento_falhou: 'text-yellow-500 bg-yellow-50',
};

const tipoLabel = {
  novo_trial: 'Novo Trial',
  nova_assinatura: 'Nova Assinatura',
  cancelamento: 'Cancelamento',
  pagamento_falhou: 'Pagamento Falhou',
};

function NotificationCard({
  notification,
  onMarkAsRead,
}: {
  notification: AdminNotification;
  onMarkAsRead: (id: string) => void;
}) {
  const Icone = tipoIcone[notification.tipo];
  const cor = tipoCor[notification.tipo];
  const label = tipoLabel[notification.tipo];

  return (
    <Card className={cn(
      "transition-all hover:shadow-md",
      !notification.lida && "border-l-4 border-l-primary"
    )}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className={cn("p-2 rounded-full", cor)}>
            <Icone className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2">
                <h3 className={cn("font-medium", !notification.lida && "font-semibold")}>
                  {notification.titulo}
                </h3>
                {!notification.lida && (
                  <Badge variant="default" className="text-xs">Nova</Badge>
                )}
              </div>
              <Badge variant="outline" className="text-xs whitespace-nowrap">
                {label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-2">{notification.mensagem}</p>
            
            {notification.dados && Object.keys(notification.dados).length > 0 && (
              <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2 mb-2">
                {notification.dados.plano_tipo && (
                  <span className="mr-3">Plano: <strong>{String(notification.dados.plano_tipo)}</strong></span>
                )}
                {notification.dados.user_id && (
                  <span className="text-xs opacity-60">ID: {String(notification.dados.user_id).slice(0, 8)}...</span>
                )}
              </div>
            )}
            
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {format(parseISO(notification.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
              </span>
              {!notification.lida && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => onMarkAsRead(notification.id)}
                >
                  <CheckCheck className="h-3 w-3 mr-1" />
                  Marcar como lida
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function NotificationSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminNotificacoes() {
  const { isAdmin, isLoading: isLoadingAdmin } = useAdminUsuarios();
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead, refetch } = useAdminNotifications();
  
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroPeriodo, setFiltroPeriodo] = useState<string>("todos");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");

  // Redirect if not admin
  if (!isLoadingAdmin && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const notificacoesFiltradas = useMemo(() => {
    return notifications.filter(n => {
      // Filter by search
      const matchBusca = !busca || 
        n.titulo.toLowerCase().includes(busca.toLowerCase()) ||
        n.mensagem.toLowerCase().includes(busca.toLowerCase());
      
      // Filter by type
      const matchTipo = filtroTipo === "todos" || n.tipo === filtroTipo;
      
      // Filter by status
      const matchStatus = filtroStatus === "todos" || 
        (filtroStatus === "lidas" && n.lida) ||
        (filtroStatus === "nao_lidas" && !n.lida);
      
      // Filter by period
      let matchPeriodo = true;
      const date = parseISO(n.created_at);
      if (filtroPeriodo === "hoje") matchPeriodo = isToday(date);
      else if (filtroPeriodo === "ontem") matchPeriodo = isYesterday(date);
      else if (filtroPeriodo === "semana") matchPeriodo = isThisWeek(date);
      else if (filtroPeriodo === "mes") matchPeriodo = isThisMonth(date);
      
      return matchBusca && matchTipo && matchStatus && matchPeriodo;
    });
  }, [notifications, busca, filtroTipo, filtroStatus, filtroPeriodo]);

  // Group notifications by date
  const notificacoesAgrupadas = useMemo(() => {
    const groups: Record<string, AdminNotification[]> = {};
    
    notificacoesFiltradas.forEach(n => {
      const date = parseISO(n.created_at);
      let label: string;
      
      if (isToday(date)) label = "Hoje";
      else if (isYesterday(date)) label = "Ontem";
      else label = format(date, "dd 'de' MMMM", { locale: ptBR });
      
      if (!groups[label]) groups[label] = [];
      groups[label].push(n);
    });
    
    return groups;
  }, [notificacoesFiltradas]);

  // Stats
  const stats = useMemo(() => ({
    total: notifications.length,
    naoLidas: unreadCount,
    trials: notifications.filter(n => n.tipo === 'novo_trial').length,
    assinaturas: notifications.filter(n => n.tipo === 'nova_assinatura').length,
    cancelamentos: notifications.filter(n => n.tipo === 'cancelamento').length,
    falhas: notifications.filter(n => n.tipo === 'pagamento_falhou').length,
  }), [notifications, unreadCount]);

  return (
    <AppLayout>
      <main className="flex-1 overflow-auto">
        <div className="space-y-6 p-4 md:p-6">
          {/* Header Desktop */}
          <div className="hidden md:flex items-center justify-between gap-4 border-b bg-background p-4 -mx-4 md:-mx-6">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                <h1 className="text-xl font-semibold">Central de Notificações</h1>
              </div>
            </div>
            <NotificacoesAdmin />
          </div>

          {/* Preferências de Notificação Push */}
          <PreferenciasNotificacaoPush />

            {/* Stats Cards */}
            <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs md:text-sm font-medium">Total</CardTitle>
                  <Bell className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl md:text-2xl font-bold">{stats.total}</div>
                </CardContent>
              </Card>

              <Card className="border-primary/20 bg-primary/5">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs md:text-sm font-medium text-primary">Não Lidas</CardTitle>
                  <Badge variant="default">{stats.naoLidas}</Badge>
                </CardHeader>
                <CardContent>
                  <div className="text-xl md:text-2xl font-bold text-primary">{stats.naoLidas}</div>
                </CardContent>
              </Card>

              <Card className="border-blue-200 bg-blue-50/50">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs md:text-sm font-medium text-blue-700">Trials</CardTitle>
                  <UserPlus className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl md:text-2xl font-bold text-blue-700">{stats.trials}</div>
                </CardContent>
              </Card>

              <Card className="border-green-200 bg-green-50/50">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs md:text-sm font-medium text-green-700">Assinaturas</CardTitle>
                  <CreditCard className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl md:text-2xl font-bold text-green-700">{stats.assinaturas}</div>
                </CardContent>
              </Card>

              <Card className="border-red-200 bg-red-50/50">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs md:text-sm font-medium text-red-700">Cancelamentos</CardTitle>
                  <XCircle className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl md:text-2xl font-bold text-red-700">{stats.cancelamentos}</div>
                </CardContent>
              </Card>

              <Card className="border-yellow-200 bg-yellow-50/50">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs md:text-sm font-medium text-yellow-700">Falhas</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl md:text-2xl font-bold text-yellow-700">{stats.falhas}</div>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar notificações..."
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                    <SelectTrigger className="w-full md:w-[180px]">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os tipos</SelectItem>
                      <SelectItem value="novo_trial">Novo Trial</SelectItem>
                      <SelectItem value="nova_assinatura">Nova Assinatura</SelectItem>
                      <SelectItem value="cancelamento">Cancelamento</SelectItem>
                      <SelectItem value="pagamento_falhou">Pagamento Falhou</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
                    <SelectTrigger className="w-full md:w-[180px]">
                      <Calendar className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Período" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os períodos</SelectItem>
                      <SelectItem value="hoje">Hoje</SelectItem>
                      <SelectItem value="ontem">Ontem</SelectItem>
                      <SelectItem value="semana">Esta semana</SelectItem>
                      <SelectItem value="mes">Este mês</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                    <SelectTrigger className="w-full md:w-[180px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todas</SelectItem>
                      <SelectItem value="nao_lidas">Não lidas</SelectItem>
                      <SelectItem value="lidas">Lidas</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button variant="outline" onClick={refetch} disabled={isLoading}>
                    <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                  </Button>
                </div>

                {unreadCount > 0 && (
                  <div className="mt-4 flex justify-end">
                    <Button variant="outline" size="sm" onClick={markAllAsRead}>
                      <CheckCheck className="h-4 w-4 mr-2" />
                      Marcar todas como lidas ({unreadCount})
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notifications List */}
            <div className="space-y-6">
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map(i => (
                    <NotificationSkeleton key={i} />
                  ))}
                </div>
              ) : notificacoesFiltradas.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Bell className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-medium mb-2">Nenhuma notificação encontrada</h3>
                    <p className="text-sm text-muted-foreground">
                      {busca || filtroTipo !== "todos" || filtroPeriodo !== "todos" || filtroStatus !== "todos"
                        ? "Tente ajustar os filtros para ver mais resultados"
                        : "As notificações aparecerão aqui quando houver atividade"}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                Object.entries(notificacoesAgrupadas).map(([date, items]) => (
                  <div key={date}>
                    <h2 className="text-sm font-medium text-muted-foreground mb-3 sticky top-0 bg-background py-2">
                      {date}
                    </h2>
                    <div className="space-y-3">
                      {items.map(notification => (
                        <NotificationCard
                          key={notification.id}
                          notification={notification}
                          onMarkAsRead={markAsRead}
                        />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
        </div>
      </main>
    </AppLayout>
  );
}
