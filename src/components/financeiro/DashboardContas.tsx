import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Conta } from "@/types/conta";
import { DollarSign, TrendingDown, TrendingUp, AlertCircle } from "lucide-react";
import { ValorMonetario } from "@/components/ui/valor-monetario";

interface DashboardContasProps {
  contas: Conta[];
}

export const DashboardContas = ({ contas }: DashboardContasProps) => {
  const hoje = new Date();
  const dataVencimento3Dias = new Date();
  dataVencimento3Dias.setDate(hoje.getDate() + 3);

  const totalAPagar = contas
    .filter((c) => c.tipo === "pagar" && c.status === "pendente")
    .reduce((acc, c) => acc + Number(c.valor), 0);

  const totalAReceber = contas
    .filter((c) => c.tipo === "receber" && c.status === "pendente")
    .reduce((acc, c) => acc + Number(c.valor), 0);

  const totalPago = contas
    .filter((c) => c.tipo === "pagar" && c.status === "pago")
    .reduce((acc, c) => acc + Number(c.valor), 0);

  const totalRecebido = contas
    .filter((c) => c.tipo === "receber" && c.status === "recebido")
    .reduce((acc, c) => acc + Number(c.valor), 0);

  const contasVencidas = contas.filter(
    (c) => c.status === "pendente" && new Date(c.data) < hoje
  ).length;

  const contasVencendo = contas.filter(
    (c) =>
      c.status === "pendente" &&
      new Date(c.data) >= hoje &&
      new Date(c.data) <= dataVencimento3Dias
  ).length;

  const saldo = totalRecebido + totalAReceber - (totalPago + totalAPagar);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total a Pagar</CardTitle>
          <TrendingDown className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-destructive">
            <ValorMonetario valor={totalAPagar} />
          </div>
          <p className="text-xs text-muted-foreground">Contas pendentes</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total a Receber</CardTitle>
          <TrendingUp className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-primary">
            <ValorMonetario valor={totalAReceber} />
          </div>
          <p className="text-xs text-muted-foreground">Contas pendentes</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Contas Vencendo</CardTitle>
          <AlertCircle className="h-4 w-4 text-orange-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-500">{contasVencendo}</div>
          <p className="text-xs text-muted-foreground">Próximos 3 dias</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Contas Vencidas</CardTitle>
          <AlertCircle className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-destructive">{contasVencidas}</div>
          <p className="text-xs text-muted-foreground">Requer atenção</p>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pago no Período</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold"><ValorMonetario valor={totalPago} /></div>
          <p className="text-xs text-muted-foreground">Contas pagas</p>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Recebido no Período</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold"><ValorMonetario valor={totalRecebido} /></div>
          <p className="text-xs text-muted-foreground">Contas recebidas</p>
        </CardContent>
      </Card>
    </div>
  );
};
