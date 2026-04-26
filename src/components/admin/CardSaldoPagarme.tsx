import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { usePagarmeBalance, PagarmePaymentItem } from "@/hooks/usePagarmeBalance";
import { RefreshCw, QrCode, Clock, DollarSign, AlertCircle, CalendarClock, CheckCircle2, XCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const formatarMoeda = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatarDataHora = (data: string) => {
  try {
    return format(parseISO(data), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return "Data inválida";
  }
};

const formatarData = (data: string) => {
  try {
    return format(parseISO(data), "dd/MM", { locale: ptBR });
  } catch {
    return "—";
  }
};

const planoLabelsMap: Record<string, string> = {
  basico_mensal: "Básico M",
  basico_anual: "Básico A",
  intermediario_mensal: "Inter. M",
  intermediario_anual: "Inter. A",
  profissional_mensal: "Prof. M",
  profissional_anual: "Prof. A",
};

export function CardSaldoPagarme() {
  const { balance, isLoading, error, fetchBalance, refetch } = usePagarmeBalance();

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  if (isLoading && !balance) {
    return (
      <Card className="col-span-full lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="space-y-1">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Pagar.me (PIX)
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
              <QrCode className="h-5 w-5" />
              Pagar.me (PIX)
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
          <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-3" disabled={isLoading}>
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
            <QrCode className="h-5 w-5 text-teal-600" />
            Pagar.me (PIX)
            <Badge variant="outline" className="ml-2 text-xs">BRL</Badge>
          </CardTitle>
          <CardDescription className="flex items-center gap-1 text-xs">
            <Clock className="h-3 w-3" />
            Atualizado: {balance?.last_update ? formatarDataHora(balance.last_update) : "---"}
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading} className="gap-1">
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Atualizar</span>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main metrics */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border-2 border-teal-500/30 bg-gradient-to-br from-teal-500/10 to-teal-600/5 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-teal-600 dark:text-teal-400">
              <DollarSign className="h-4 w-4" />
              Total Recebido
            </div>
            <p className="mt-2 text-2xl font-bold text-teal-600 dark:text-teal-400">
              {balance ? formatarMoeda(balance.total_received) : "R$ 0,00"}
            </p>
            <p className="text-xs text-teal-600/70 dark:text-teal-400/70 mt-1">
              {balance?.paid_count ?? 0} pagamentos confirmados
            </p>
          </div>

          <div className="rounded-lg border-2 border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-amber-600/5 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-400">
              <Clock className="h-4 w-4" />
              PIX Pendentes
            </div>
            <p className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">
              {balance ? formatarMoeda(balance.total_pending) : "R$ 0,00"}
            </p>
            <p className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-1">
              {balance?.pending_count ?? 0} aguardando pagamento
            </p>
          </div>

          <div className="rounded-lg border-2 border-rose-500/30 bg-gradient-to-br from-rose-500/10 to-rose-600/5 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-rose-600 dark:text-rose-400">
              <XCircle className="h-4 w-4" />
              PIX Expirados
            </div>
            <p className="mt-2 text-2xl font-bold text-rose-600 dark:text-rose-400">
              {balance?.expired_count ?? 0}
            </p>
            <p className="text-xs text-rose-600/70 dark:text-rose-400/70 mt-1">
              QR Codes não pagos
            </p>
          </div>

          <div className="rounded-lg border-2 border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 to-indigo-600/5 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-indigo-600 dark:text-indigo-400">
              <CalendarClock className="h-4 w-4" />
              MRR PIX
            </div>
            <p className="mt-2 text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {balance ? formatarMoeda(balance.mrr) : "R$ 0,00"}
            </p>
            <p className="text-xs text-indigo-600/70 dark:text-indigo-400/70 mt-1">
              {balance?.active_subscriptions_count ?? 0} assinaturas ativas
            </p>
          </div>
        </div>

        {/* Monthly summary */}
        {balance?.monthly && (
          <div className="rounded-lg border p-4 bg-muted/30">
            <div className="flex items-center gap-2 text-sm font-medium mb-3">
              <CalendarClock className="h-4 w-4 text-teal-600" />
              Este Mês via PIX
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="text-center p-3 rounded-lg bg-teal-50 dark:bg-teal-950/20">
                <p className="text-xs text-muted-foreground">Recebido</p>
                <p className="text-lg font-bold text-teal-600">{formatarMoeda(balance.monthly.total_paid)}</p>
                <p className="text-xs text-muted-foreground">{balance.monthly.paid_count} pagamentos</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20">
                <p className="text-xs text-muted-foreground">Renovações Pendentes</p>
                <p className="text-lg font-bold text-amber-600">{formatarMoeda(balance.monthly.total_pending_renewals)}</p>
                <p className="text-xs text-muted-foreground">{balance.monthly.upcoming_count} assinantes</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/20">
                <p className="text-xs text-muted-foreground">Total Esperado</p>
                <p className="text-lg font-bold text-indigo-600">
                  {formatarMoeda(balance.monthly.total_paid + balance.monthly.total_pending_renewals)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {balance.monthly.paid_count + balance.monthly.upcoming_count} no total
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Recent paid payments */}
        {balance?.recent_payments && balance.recent_payments.length > 0 && (
          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2 text-sm font-medium mb-3">
              <CheckCircle2 className="h-4 w-4 text-teal-500" />
              Últimos Pagamentos PIX ({balance.recent_payments.length})
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {balance.recent_payments.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-xs p-2 rounded bg-teal-50 dark:bg-teal-950/20">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{item.name || item.email || "—"}</p>
                    <p className="text-muted-foreground truncate">{item.email}</p>
                  </div>
                  <div className="text-right ml-2 shrink-0">
                    <p className="font-semibold text-teal-600">{formatarMoeda(item.amount)}</p>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className="text-[10px] px-1">
                        {planoLabelsMap[item.plan] || item.plan}
                      </Badge>
                      {item.paid_date && (
                        <span className="text-muted-foreground">{formatarData(item.paid_date)}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No data message */}
        {balance && balance.paid_count === 0 && balance.pending_count === 0 && (
          <div className="rounded-lg border p-4 bg-muted/20 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhum pagamento PIX registrado ainda
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}