import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResumoVendas } from "@/types/venda";
import { TrendingUp, Package, Smartphone, DollarSign } from "lucide-react";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import { ValorMonetario } from "@/components/ui/valor-monetario";

interface DashboardVendasProps {
  resumo: ResumoVendas;
}

export const DashboardVendas = ({ resumo }: DashboardVendasProps) => {
  const { isFuncionario } = useFuncionarioPermissoes();

  if (isFuncionario) return null;
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total de Vendas</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{resumo.totalVendas}</div>
          <p className="text-xs text-muted-foreground">vendas realizadas</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Dispositivos</CardTitle>
          <Smartphone className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{resumo.vendasDispositivos}</div>
          <p className="text-xs text-muted-foreground">dispositivos vendidos</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Produtos</CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{resumo.vendasProdutos}</div>
          <p className="text-xs text-muted-foreground">produtos vendidos</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Faturado</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold"><ValorMonetario valor={resumo.totalFaturado} /></div>
          <p className="text-xs text-muted-foreground">no período</p>
        </CardContent>
      </Card>
    </div>
  );
};
