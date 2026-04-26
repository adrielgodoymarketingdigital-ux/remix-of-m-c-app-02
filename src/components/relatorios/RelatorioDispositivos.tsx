import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RelatorioDispositivo } from "@/types/relatorio-vendas";
import { formatCurrency } from "@/lib/formatters";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { Smartphone, Package, TrendingUp } from "lucide-react";

interface RelatorioDispositivosProps {
  dispositivos: RelatorioDispositivo[];
  loading: boolean;
}

export const RelatorioDispositivosComponent = ({
  dispositivos,
  loading,
}: RelatorioDispositivosProps) => {
  const totalVendido = dispositivos.reduce((acc, d) => acc + d.quantidadeVendida, 0);
  const receitaTotal = dispositivos.reduce((acc, d) => acc + d.receitaTotal, 0);
  const ticketMedio = totalVendido > 0 ? receitaTotal / totalVendido : 0;

  return (
    <div className="space-y-6">
      {/* Cards de Resumo */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Vendido</CardTitle>
            <Smartphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalVendido}</div>
            <p className="text-xs text-muted-foreground">Dispositivos vendidos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold"><ValorMonetario valor={receitaTotal} /></div>
            <p className="text-xs text-muted-foreground">Em vendas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold"><ValorMonetario valor={ticketMedio} /></div>
            <p className="text-xs text-muted-foreground">Por dispositivo</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Dispositivos */}
      <Card>
        <CardHeader>
          <CardTitle>Dispositivos Mais Vendidos</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : dispositivos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum dispositivo vendido no período
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Marca</TableHead>
                  <TableHead>Modelo</TableHead>
                  <TableHead className="text-right">Qtd. Vendida</TableHead>
                  <TableHead className="text-right">Receita Total</TableHead>
                  <TableHead className="text-right">Lucro</TableHead>
                  <TableHead className="text-right">Ticket Médio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dispositivos.map((dispositivo) => (
                  <TableRow key={dispositivo.id}>
                    <TableCell>
                      <Badge variant="outline">{dispositivo.tipo}</Badge>
                    </TableCell>
                    <TableCell>{dispositivo.marca}</TableCell>
                    <TableCell>{dispositivo.modelo}</TableCell>
                    <TableCell className="text-right font-medium">
                      {dispositivo.quantidadeVendida}
                    </TableCell>
                    <TableCell className="text-right">
                      <ValorMonetario valor={dispositivo.receitaTotal} />
                    </TableCell>
                    <TableCell className="text-right font-medium text-primary">
                      <ValorMonetario valor={dispositivo.lucroTotal} />
                    </TableCell>
                    <TableCell className="text-right">
                      <ValorMonetario valor={dispositivo.ticketMedio} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
