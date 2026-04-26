import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useStripeBalance, MonthlyRenewalItem } from "@/hooks/useStripeBalance";
import { CheckCircle2, Clock, DollarSign, TrendingUp, AlertTriangle, RefreshCw } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Progress } from "@/components/ui/progress";

const formatarMoeda = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const planoLabelsMap: Record<string, string> = {
  basico_mensal: "Básico M",
  basico_anual: "Básico A",
  intermediario_mensal: "Inter. M",
  intermediario_anual: "Inter. A",
  profissional_mensal: "Prof. M",
  profissional_anual: "Prof. A",
  desconhecido: "Outro",
};

const formatarData = (data: string) => {
  try {
    return format(parseISO(data), "dd/MM", { locale: ptBR });
  } catch {
    return "—";
  }
};

export function CardRenovacoesMes() {
  const { balance, fetchBalance, isLoading } = useStripeBalance();

  useEffect(() => {
    fetchBalance();

    // Segundo fetch curto para evitar exibir snapshot antigo após deploy/reload
    const warmupRefetch = window.setTimeout(() => {
      fetchBalance();
    }, 1500);

    // Mantém dados atualizados sem depender de outros cards
    const intervalRefetch = window.setInterval(() => {
      fetchBalance();
    }, 60000);

    return () => {
      window.clearTimeout(warmupRefetch);
      window.clearInterval(intervalRefetch);
    };
  }, [fetchBalance]);

  const renewals = balance?.monthly_renewals;

  if (isLoading && !renewals) return null;
  if (!renewals) return null;

  const { paid, pending, total_paid, total_pending, total_expected, paid_count, pending_count } = renewals;
  const totalCount = paid_count + pending_count;
  const progressPercent = totalCount > 0 ? (paid_count / totalCount) * 100 : 0;

  // Quanto já entrou na Stripe (available + pending) vs quanto ainda falta
  const jaEntrou = balance ? balance.available + balance.pending : 0;
  const faltaEntrar = total_pending;

  const monthLabel = renewals.month
    ? (() => {
        const [year, month] = renewals.month.split("-");
        const date = new Date(Number(year), Number(month) - 1);
        return format(date, "MMMM 'de' yyyy", { locale: ptBR });
      })()
    : "este mês";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Renovações do Mês ({monthLabel})
        </h2>
        <Button variant="outline" size="sm" className="gap-1" onClick={() => fetchBalance()} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        {/* Já pagaram */}
        <Card className="border-emerald-200 dark:border-emerald-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Já Renovaram
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{paid_count}</div>
            <p className="text-sm font-semibold text-emerald-600 mt-1">{formatarMoeda(total_paid)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">já cobrado neste mês</p>
          </CardContent>
        </Card>

        {/* Ainda vão pagar */}
        <Card className="border-amber-200 dark:border-amber-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-400 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Faltam Renovar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{pending_count}</div>
            <p className="text-sm font-semibold text-amber-600 mt-1">{formatarMoeda(total_pending)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">ainda vai entrar neste mês</p>
          </CardContent>
        </Card>

        {/* Total esperado do mês */}
        <Card className="border-blue-200 dark:border-blue-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-400 flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total Previsto no Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatarMoeda(total_expected)}</div>
            <p className="text-xs text-muted-foreground mt-1">{totalCount} renovações no total</p>
          </CardContent>
        </Card>

        {/* Inadimplentes */}
        <Card className="border-red-200 dark:border-red-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-700 dark:text-red-400 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Inadimplentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{balance?.unpaid_count ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">past_due + incomplete</p>
          </CardContent>
        </Card>
      </div>

      {/* Progress bar */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progresso das renovações</span>
            <span className="text-sm text-muted-foreground">
              {paid_count}/{totalCount} ({progressPercent.toFixed(0)}%)
            </span>
          </div>
          <Progress value={progressPercent} className="h-3" />
          <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              Recebido: {formatarMoeda(total_paid)}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
              Falta: {formatarMoeda(faltaEntrar)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Lists */}
      <div className="grid gap-3 md:grid-cols-2">
        {/* Quem já pagou */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Já pagaram este mês ({paid_count})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {paid.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma renovação registrada ainda</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {paid.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-xs p-2 rounded bg-emerald-50 dark:bg-emerald-950/20">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{item.name || item.email || "—"}</p>
                      <p className="text-muted-foreground truncate">{item.email}</p>
                    </div>
                    <div className="text-right ml-2 shrink-0">
                      <p className="font-semibold text-emerald-600">{formatarMoeda(item.amount)}</p>
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
            )}
          </CardContent>
        </Card>

        {/* Quem ainda vai pagar */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              Ainda vão renovar ({pending_count})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todas as renovações do mês já foram feitas</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {pending.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-xs p-2 rounded bg-amber-50 dark:bg-amber-950/20">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{item.name || item.email || "—"}</p>
                      <p className="text-muted-foreground truncate">{item.email}</p>
                    </div>
                    <div className="text-right ml-2 shrink-0">
                      <p className="font-semibold text-amber-600">{formatarMoeda(item.amount)}</p>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="text-[10px] px-1">
                          {planoLabelsMap[item.plan] || item.plan}
                        </Badge>
                        {item.renewal_date && (
                          <span className="text-muted-foreground">renova {formatarData(item.renewal_date)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
