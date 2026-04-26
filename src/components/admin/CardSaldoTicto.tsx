import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useTictoAnalytics } from "@/hooks/useTictoAnalytics";
import {
  RefreshCw,
  Wallet,
  Clock,
  DollarSign,
  AlertCircle,
  CalendarClock,
  Users,
  AlertTriangle,
  ShoppingCart,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const formatarMoeda = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatarData = (data: string) => {
  try {
    return format(parseISO(data), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return "Data inválida";
  }
};

const formatarDataHora = (data: string) => {
  try {
    return format(parseISO(data), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return "";
  }
};

const EVENTO_LABELS: Record<string, { label: string; color: string }> = {
  compra_aprovada: { label: "Compra Aprovada", color: "text-emerald-600" },
  authorized: { label: "Autorizado", color: "text-emerald-600" },
  subscription_canceled: { label: "Cancelamento", color: "text-destructive" },
  subscription_delayed: { label: "Atraso", color: "text-amber-600" },
  refunded: { label: "Reembolso", color: "text-destructive" },
  chargeback: { label: "Chargeback", color: "text-destructive" },
};

export function CardSaldoTicto() {
  const { data, isLoading, error, fetchData, refetch } = useTictoAnalytics();

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (isLoading && !data) {
    return (
      <Card className="col-span-full lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="space-y-1">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Ticto
            </CardTitle>
            <CardDescription>Carregando...</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="col-span-full lg:col-span-2 border-destructive/50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="space-y-1">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Ticto
            </CardTitle>
            <CardDescription className="text-destructive flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Erro ao carregar
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  const planEntries = data ? Object.entries(data.planBreakdown).sort(([, a], [, b]) => b.mrr - a.mrr) : [];

  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Wallet className="h-5 w-5 text-orange-500" />
            Ticto
            <Badge variant="outline" className="ml-2 text-xs">BRL</Badge>
          </CardTitle>
          <CardDescription className="flex items-center gap-1 text-xs">
            <Clock className="h-3 w-3" />
            Atualizado: {data?.lastUpdate ? formatarDataHora(data.lastUpdate) : "---"}
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading} className="gap-1">
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Atualizar</span>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Métricas principais */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* MRR */}
          <div className="rounded-lg border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              <DollarSign className="h-4 w-4" />
              MRR Ticto
            </div>
            <p className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {data ? formatarMoeda(data.mrr) : "R$ 0,00"}
            </p>
            <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-1">
              Receita mensal recorrente
            </p>
          </div>

          {/* Assinaturas Ativas */}
          <div className="rounded-lg border-2 border-blue-500/30 bg-gradient-to-br from-blue-500/10 to-blue-600/5 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400">
              <Users className="h-4 w-4" />
              Assinantes Ativos
            </div>
            <p className="mt-2 text-2xl font-bold text-blue-600 dark:text-blue-400">
              {data?.totalAtivas ?? 0}
            </p>
            <p className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-1">
              Via Ticto
            </p>
          </div>

          {/* Renovações Pendentes */}
          <div className="rounded-lg border-2 border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-amber-600/5 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-400">
              <CalendarClock className="h-4 w-4" />
              Renovações Mês
            </div>
            <p className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">
              {data?.renovacoesMes.total ?? 0}
            </p>
            <p className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-1">
              {data ? formatarMoeda(data.renovacoesMes.totalPendentes) : "R$ 0,00"} pendente
            </p>
          </div>

          {/* Inadimplentes */}
          <div className="rounded-lg border-2 border-red-500/30 bg-gradient-to-br from-red-500/10 to-red-600/5 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-red-600 dark:text-red-400">
              <AlertTriangle className="h-4 w-4" />
              Inadimplentes
            </div>
            <p className="mt-2 text-2xl font-bold text-red-600 dark:text-red-400">
              {data?.inadimplentes.length ?? 0}
            </p>
            <p className="text-xs text-red-600/70 dark:text-red-400/70 mt-1">
              Pagamento atrasado
            </p>
          </div>
        </div>

        {/* Distribuição por plano */}
        {planEntries.length > 0 && (
          <div className="rounded-lg border p-4 bg-muted/30">
            <div className="flex items-center gap-2 text-sm font-medium mb-3">
              <ShoppingCart className="h-4 w-4 text-orange-500" />
              Distribuição por Plano (Ticto)
            </div>
            <div className="space-y-2">
              {planEntries.map(([plano, info]) => (
                <div key={plano} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{info.nome}</span>
                    <Badge variant="secondary" className="text-xs">{info.count}</Badge>
                  </div>
                  <span className="font-medium text-primary">{formatarMoeda(info.mrr)}/mês</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Renovações pendentes detalhadas */}
        {data && data.renovacoesMes.pendentes.length > 0 && (
          <div className="rounded-lg border p-4 bg-muted/30">
            <div className="flex items-center gap-2 text-sm font-medium mb-3">
              <CalendarClock className="h-4 w-4 text-amber-500" />
              Renovações Pendentes no Mês
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {data.renovacoesMes.pendentes.map((sub) => (
                <div key={sub.user_id} className="text-xs p-2 rounded bg-amber-50 dark:bg-amber-950/30 flex justify-between items-center">
                  <div>
                    <p className="font-medium">{sub.nome || sub.email || "Sem info"}</p>
                    <p className="text-muted-foreground">{sub.email}</p>
                  </div>
                  <span className="text-amber-600 font-medium">
                    {sub.data_proxima_cobranca ? formatarData(sub.data_proxima_cobranca) : "---"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Inadimplentes detalhados */}
        {data && data.inadimplentes.length > 0 && (
          <div className="rounded-lg border border-red-200 dark:border-red-800 p-4 bg-red-50/50 dark:bg-red-950/20">
            <div className="flex items-center gap-2 text-sm font-medium mb-3 text-red-700 dark:text-red-400">
              <AlertTriangle className="h-4 w-4" />
              Inadimplentes Ticto
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {data.inadimplentes.map((sub) => (
                <div key={sub.user_id} className="text-xs p-2 rounded bg-red-50 dark:bg-red-950/30">
                  <p className="font-medium">{sub.nome || sub.email || "Sem info"}</p>
                  <p className="text-muted-foreground">{sub.email}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Histórico de transações */}
        {data && data.eventos.length > 0 && (
          <div className="rounded-lg border p-4 bg-muted/30">
            <div className="flex items-center gap-2 text-sm font-medium mb-3">
              <Clock className="h-4 w-4 text-primary" />
              Últimas Transações Ticto
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {data.eventos.slice(0, 10).map((evt) => {
                const info = EVENTO_LABELS[evt.tipo] || { label: evt.tipo, color: "text-muted-foreground" };
                return (
                  <div key={evt.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-xs ${info.color}`}>
                        {info.label}
                      </Badge>
                      <span className="text-muted-foreground text-xs truncate max-w-[200px]">
                        {evt.email_usuario || "---"}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {evt.created_at ? formatarDataHora(evt.created_at) : "---"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Mensagem quando não há dados */}
        {data && data.totalAtivas === 0 && data.eventos.length === 0 && (
          <div className="rounded-lg border p-4 bg-muted/20 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhuma assinatura ou transação via Ticto ainda
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
