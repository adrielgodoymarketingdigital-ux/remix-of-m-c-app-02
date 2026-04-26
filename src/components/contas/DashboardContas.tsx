import { Card } from "@/components/ui/card";
import { Conta } from "@/types/conta";
import { TrendingUp, TrendingDown, AlertTriangle, DollarSign } from "lucide-react";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import { ValorMonetario } from "@/components/ui/valor-monetario";

interface DashboardContasProps {
  contas: Conta[];
}

export function DashboardContas({ contas }: DashboardContasProps) {
  const { isFuncionario } = useFuncionarioPermissoes();

  if (isFuncionario) return null;
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

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0); // Zerar horas para comparar apenas data
  
  const contasVencidasList = contas.filter((c) => {
    const dataVencimento = new Date(c.data + "T00:00:00");
    return dataVencimento < hoje && c.status === "pendente";
  });
  
  const contasVencidas = contasVencidasList.length;
  const valorVencidas = contasVencidasList.reduce((acc, c) => acc + Number(c.valor), 0);

  const saldo = totalAReceber - totalAPagar;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Total a Pagar</p>
            <p className="text-2xl font-bold text-red-600"><ValorMonetario valor={totalAPagar} /></p>
          </div>
          <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center">
            <TrendingDown className="h-6 w-6 text-red-600" />
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Total a Receber</p>
            <p className="text-2xl font-bold text-green-600"><ValorMonetario valor={totalAReceber} /></p>
          </div>
          <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center">
            <TrendingUp className="h-6 w-6 text-green-600" />
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Saldo Previsto</p>
            <p className={`text-2xl font-bold ${saldo >= 0 ? "text-green-600" : "text-red-600"}`}>
              <ValorMonetario valor={saldo} />
            </p>
          </div>
          <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
            <DollarSign className="h-6 w-6 text-blue-600" />
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Contas Vencidas</p>
            <p className="text-2xl font-bold text-orange-600">{contasVencidas}</p>
            {valorVencidas > 0 && (
              <p className="text-sm text-orange-500 mt-1">
                Total: <ValorMonetario valor={valorVencidas} />
              </p>
            )}
          </div>
          <div className="h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-950 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-orange-600" />
          </div>
        </div>
      </Card>
    </div>
  );
}
