import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useStripeBalance, PendingByDate } from "@/hooks/useStripeBalance";
import { RefreshCw, Wallet, Clock, DollarSign, AlertCircle, CalendarClock, ArrowRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const formatarMoeda = (valor: number) => {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const formatarDataHora = (data: string) => {
  try {
    return format(parseISO(data), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return "Data inválida";
  }
};

const formatarData = (data: string) => {
  try {
    return format(parseISO(data), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return "Data inválida";
  }
};

export function CardSaldoStripe() {
  const { balance, isLoading, error, fetchBalance, refetch } = useStripeBalance();

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  if (isLoading && !balance) {
    return (
      <Card className="col-span-full lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="space-y-1">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Saldo Stripe
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
          <Skeleton className="h-20" />
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
              Saldo Stripe
            </CardTitle>
            <CardDescription className="text-destructive flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Erro ao carregar
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="mt-3"
            disabled={isLoading}
          >
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Saldo Stripe
            <Badge variant="outline" className="ml-2 text-xs">
              {balance?.currency || "BRL"}
            </Badge>
          </CardTitle>
          <CardDescription className="flex items-center gap-1 text-xs">
            <Clock className="h-3 w-3" />
            Atualizado: {balance?.last_update ? formatarDataHora(balance.last_update) : "---"}
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading}
          className="gap-1"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Atualizar</span>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Saldos principais */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Saldo Disponível - Verde */}
          <div className="rounded-lg border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              <DollarSign className="h-4 w-4" />
              Disponível
            </div>
            <p className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {balance ? formatarMoeda(balance.available) : "R$ 0,00"}
            </p>
            <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-1">
              Pronto para saque
            </p>
          </div>

          {/* Saldo Pendente - Amarelo/Âmbar */}
          <div className="rounded-lg border-2 border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-amber-600/5 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-400">
              <Clock className="h-4 w-4" />
              Pendente
            </div>
            <p className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">
              {balance ? formatarMoeda(balance.pending) : "R$ 0,00"}
            </p>
            <p className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-1">
              {balance?.pending_by_date && balance.pending_by_date.length > 0 ? (
                <>Liberação total: {balance.pending_by_date[balance.pending_by_date.length - 1].formatted_date}</>
              ) : (
                "Aguardando liberação"
              )}
            </p>
          </div>

          {/* Saldo Total - Azul */}
          <div className="rounded-lg border-2 border-blue-500/30 bg-gradient-to-br from-blue-500/10 to-blue-600/5 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400">
              <Wallet className="h-4 w-4" />
              Total
            </div>
            <p className="mt-2 text-2xl font-bold text-blue-600 dark:text-blue-400">
              {balance ? formatarMoeda(balance.total) : "R$ 0,00"}
            </p>
            <p className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-1">
              Disponível + Pendente
            </p>
          </div>

          {/* Receita Prevista - Roxo/Violeta */}
          <div className="rounded-lg border-2 border-violet-500/30 bg-gradient-to-br from-violet-500/10 to-violet-600/5 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-violet-600 dark:text-violet-400">
              <CalendarClock className="h-4 w-4" />
              Receita Prevista
            </div>
            <p className="mt-2 text-2xl font-bold text-violet-600 dark:text-violet-400">
              {balance?.mrr_stripe ? formatarMoeda(balance.mrr_stripe) : "R$ 0,00"}
            </p>
            <p className="text-xs text-violet-600/70 dark:text-violet-400/70 mt-1">
              {balance?.active_subscriptions_count ?? 0} assinaturas ativas
            </p>
          </div>
        </div>

        {/* Cronograma de liberação */}
        {balance?.pending_by_date && balance.pending_by_date.length > 0 && (
          <div className="rounded-lg border p-4 bg-muted/30">
            <div className="flex items-center gap-2 text-sm font-medium mb-3">
              <CalendarClock className="h-4 w-4 text-primary" />
              Cronograma de Liberação
            </div>
            <div className="space-y-2">
              {balance.pending_by_date.slice(0, 5).map((item: PendingByDate, index: number) => (
                <div 
                  key={item.date} 
                  className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">{item.formatted_date}</span>
                  </div>
                  <span className="font-medium text-primary">
                    {formatarMoeda(item.amount)}
                  </span>
                </div>
              ))}
              {balance.pending_by_date.length > 5 && (
                <p className="text-xs text-muted-foreground text-center pt-1">
                  + {balance.pending_by_date.length - 5} datas adicionais
                </p>
              )}
            </div>
          </div>
        )}

        {/* Próximo payout */}
        {balance?.next_payout && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-primary">Próximo Saque Automático</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Chegada prevista: {formatarData(balance.next_payout.arrival_date)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-primary">
                  {formatarMoeda(balance.next_payout.amount)}
                </p>
                <Badge variant="secondary" className="text-xs">
                  {balance.next_payout.status === "pending" ? "Processando" : balance.next_payout.status}
                </Badge>
              </div>
            </div>
          </div>
        )}

        {/* Mensagem quando não há pendentes */}
        {balance && balance.pending === 0 && (!balance.pending_by_date || balance.pending_by_date.length === 0) && (
          <div className="rounded-lg border p-4 bg-muted/20 text-center">
            <p className="text-sm text-muted-foreground">
              Não há valores pendentes de liberação
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
