import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Venda } from "@/types/venda";
import { formatDate } from "@/lib/formatters";
import { Clock, AlertTriangle, CheckCircle, DollarSign } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { getVendaReceitaLiquida } from "@/lib/vendasFinanceiras";

interface DashboardAReceberProps {
  vendas: Venda[];
  loading?: boolean;
  onMarcarRecebido?: (vendaId: string) => Promise<boolean>;
}

export const DashboardAReceber = ({
  vendas,
  loading,
  onMarcarRecebido,
}: DashboardAReceberProps) => {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  
  const em3Dias = new Date(hoje);
  em3Dias.setDate(hoje.getDate() + 3);

  // Filtrar apenas vendas a receber não canceladas e não recebidas
  const vendasAReceber = vendas.filter(
    (v) =>
      v.forma_pagamento === "a_receber" &&
      !v.recebido &&
      !v.cancelada
  );

  const totalAReceber = vendasAReceber.reduce(
    (acc, v) => acc + getVendaReceitaLiquida(v),
    0
  );

  const vendasVencidas = vendasAReceber.filter((v) => {
    if (!v.data_prevista_recebimento) return false;
    const dataVencimento = new Date(v.data_prevista_recebimento);
    dataVencimento.setHours(0, 0, 0, 0);
    return dataVencimento < hoje;
  });

  const vendasVencendo = vendasAReceber.filter((v) => {
    if (!v.data_prevista_recebimento) return false;
    const dataVencimento = new Date(v.data_prevista_recebimento);
    dataVencimento.setHours(0, 0, 0, 0);
    return dataVencimento >= hoje && dataVencimento <= em3Dias;
  });

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Cards de resumo */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total A Receber</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              <ValorMonetario valor={totalAReceber} />
            </div>
            <p className="text-xs text-muted-foreground">
              {vendasAReceber.length} venda{vendasAReceber.length !== 1 ? "s" : ""} pendente{vendasAReceber.length !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vencidas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {vendasVencidas.length}
            </div>
            <p className="text-xs text-muted-foreground">
              <ValorMonetario valor={vendasVencidas.reduce((acc, v) => acc + getVendaReceitaLiquida(v), 0)} />
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vencendo em 3 dias</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">
              {vendasVencendo.length}
            </div>
            <p className="text-xs text-muted-foreground">
              <ValorMonetario valor={vendasVencendo.reduce((acc, v) => acc + getVendaReceitaLiquida(v), 0)} />
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quantidade</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vendasAReceber.length}</div>
            <p className="text-xs text-muted-foreground">vendas a receber</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de vendas a receber */}
      {vendasAReceber.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vendas Pendentes de Recebimento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {vendasAReceber.map((venda) => {
                const dataVencimento = venda.data_prevista_recebimento
                  ? new Date(venda.data_prevista_recebimento)
                  : null;
                if (dataVencimento) dataVencimento.setHours(0, 0, 0, 0);

                const isVencida = dataVencimento && dataVencimento < hoje;
                const isVencendo =
                  dataVencimento &&
                  dataVencimento >= hoje &&
                  dataVencimento <= em3Dias;

                return (
                  <div
                    key={venda.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {venda.tipo === "dispositivo" && venda.dispositivos
                            ? `${venda.dispositivos.marca} ${venda.dispositivos.modelo}`
                            : venda.produtos?.nome || "Venda"}
                        </span>
                        {isVencida && (
                          <Badge variant="destructive" className="text-xs">
                            Vencida
                          </Badge>
                        )}
                        {isVencendo && !isVencida && (
                          <Badge className="bg-orange-500 text-xs">
                            Vencendo
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {venda.clientes?.nome || "Cliente não informado"} •{" "}
                        {venda.data_prevista_recebimento
                          ? `Venc: ${formatDate(venda.data_prevista_recebimento)}`
                          : "Sem data definida"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">
                        <ValorMonetario valor={getVendaReceitaLiquida(venda)} tipo="preco" />
                      </span>
                      {onMarcarRecebido && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onMarcarRecebido(venda.id)}
                          className="text-green-600 border-green-600 hover:bg-green-50"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Recebido
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};