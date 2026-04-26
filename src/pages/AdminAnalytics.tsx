import { useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  RefreshCw,
  DollarSign,
  Users,
  TrendingUp,
  CalendarClock,
  AlertTriangle,
  Activity,
  CreditCard,
} from "lucide-react";
import { useTictoAnalytics } from "@/hooks/useTictoAnalytics";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const formatarMoeda = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatarData = (data: string | null) => {
  if (!data) return "—";
  try {
    return format(parseISO(data), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return "—";
  }
};

const formatarDataHora = (data: string | null) => {
  if (!data) return "—";
  try {
    return format(parseISO(data), "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return "—";
  }
};

export default function AdminAnalytics() {
  const { data, isLoading, error, fetchData } = useTictoAnalytics();

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <AppLayout>
      <main className="flex-1 p-4 sm:p-6 overflow-auto space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <Activity className="h-6 w-6 text-primary" />
              Analytics Ticto
            </h1>
            <p className="text-sm text-muted-foreground">
              Métricas de assinaturas, MRR e renovações via integração Ticto
            </p>
          </div>
          <Button onClick={() => fetchData()} variant="outline" size="sm" className="w-full sm:w-auto gap-2" disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-sm text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Métricas principais */}
        {isLoading && !data ? (
          <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : data ? (
          <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <Card className="border-l-4 border-l-emerald-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">MRR Bruto</CardTitle>
                <DollarSign className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">{formatarMoeda(data.mrr)}</div>
                <p className="text-xs text-muted-foreground">Recorrência mensal</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-emerald-700">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">MRR Líquido</CardTitle>
                <DollarSign className="h-4 w-4 text-emerald-700" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-700">{formatarMoeda(data.mrrLiquido)}</div>
                <p className="text-xs text-muted-foreground">−6,99% −R$2,49/venda</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Faturamento Mês</CardTitle>
                <TrendingUp className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{formatarMoeda(data.faturamentoMes)}</div>
                <p className="text-xs text-muted-foreground">Líq.: {formatarMoeda(data.faturamentoMesLiquido)}</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-primary">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Assinaturas Ativas</CardTitle>
                <Users className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.totalAtivas}</div>
                <p className="text-xs text-muted-foreground">Active + trialing</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-amber-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Renovações Pendentes</CardTitle>
                <CalendarClock className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600">{data.renovacoesMes.total}</div>
                <p className="text-xs text-muted-foreground">{formatarMoeda(data.renovacoesMes.totalPendentes)} a receber</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-destructive">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Inadimplentes</CardTitle>
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{data.inadimplentes.length}</div>
                <p className="text-xs text-muted-foreground">Status past_due</p>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {/* Distribuição por plano */}
        {data && Object.keys(data.planBreakdown).length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Distribuição por Plano
            </h2>
            <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {Object.entries(data.planBreakdown)
                .sort(([, a], [, b]) => b.mrr - a.mrr)
                .map(([plano, info]) => (
                  <Card key={plano} className="border-l-4 border-l-emerald-500">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">{info.nome}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{info.count}</div>
                      <p className="text-xs text-muted-foreground">{formatarMoeda(info.mrr)}/mês</p>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </div>
        )}

        {/* Renovações pendentes do mês */}
        {data && data.renovacoesMes.pendentes.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-amber-500" />
                Renovações pendentes este mês ({data.renovacoesMes.pendentes.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {data.renovacoesMes.pendentes.map((u, i) => (
                    <div key={`${u.user_id}-${i}`} className="flex items-center justify-between p-2 rounded border bg-card">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{u.nome || u.email || "—"}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      </div>
                      <div className="text-right ml-2">
                        <p className="text-xs font-medium">{formatarData(u.data_proxima_cobranca)}</p>
                        <Badge variant="outline" className="text-[10px]">{u.plano_tipo}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Inadimplentes */}
        {data && data.inadimplentes.length > 0 && (
          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Inadimplentes ({data.inadimplentes.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {data.inadimplentes.map((u, i) => (
                    <div key={`${u.user_id}-${i}`} className="flex items-center justify-between p-2 rounded border bg-destructive/5">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{u.nome || u.email || "—"}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      </div>
                      <div className="text-right ml-2">
                        <Badge variant="destructive" className="text-[10px]">past_due</Badge>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{u.plano_tipo}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Histórico de eventos */}
        {data && data.eventos.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                Últimos eventos Ticto ({data.eventos.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-80">
                <div className="space-y-2">
                  {data.eventos.map((ev) => (
                    <div key={ev.id} className="flex items-start justify-between p-2 rounded border bg-card text-xs">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary" className="text-[10px]">{ev.tipo}</Badge>
                          {ev.plano_tipo && <span className="text-muted-foreground">{ev.plano_tipo}</span>}
                        </div>
                        <p className="truncate text-muted-foreground mt-1">{ev.email_usuario || "—"}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground ml-2 whitespace-nowrap">{formatarDataHora(ev.created_at)}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {data && (
          <p className="text-xs text-muted-foreground text-right">
            Última atualização: {formatarDataHora(data.lastUpdate)}
          </p>
        )}
      </main>
    </AppLayout>
  );
}
