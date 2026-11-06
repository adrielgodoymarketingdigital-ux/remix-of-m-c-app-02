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
import { Smartphone, Package, TrendingUp, Trophy } from "lucide-react";
import { useIsDesktop } from "@/hooks/use-mobile";
import { CardResumoRelatorio, CabecalhoTabelaRelatorio } from "@/components/relatorios/CardResumoRelatorio";
import { EstadoRelatorio } from "@/components/relatorios/EstadoRelatorio";


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
  const isDesktop = useIsDesktop();

  // Computador (>= 1024px): mesmos dados e textos, só o visual muda. Celular segue no return de baixo.
  if (isDesktop) {
    return (
      <div className="space-y-5">
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <CardResumoRelatorio titulo="Total Vendido" valor={totalVendido} descricao="Dispositivos vendidos" icon={Smartphone} acento="blue" />
          <CardResumoRelatorio titulo="Receita Total" valor={<ValorMonetario valor={receitaTotal} />} descricao="Em vendas" icon={TrendingUp} acento="green" />
          <CardResumoRelatorio titulo="Ticket Médio" valor={<ValorMonetario valor={ticketMedio} />} descricao="Por dispositivo" icon={Package} acento="purple" />
        </div>

        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="p-5 pb-4">
            <CabecalhoTabelaRelatorio titulo="Dispositivos Mais Vendidos" descricao="Modelos que mais geram receita no período." icon={Trophy} acento="orange" />
          </div>
          {loading ? (
            <EstadoRelatorio tipo="carregando" texto="Carregando..." />
          ) : dispositivos.length === 0 ? (
            <EstadoRelatorio tipo="vazio" texto="Nenhum dispositivo vendido no período" icon={Smartphone} />
          ) : (
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-5">Tipo</TableHead>
                  <TableHead>Marca</TableHead>
                  <TableHead>Modelo</TableHead>
                  <TableHead className="text-right">Qtd. Vendida</TableHead>
                  <TableHead className="text-right">Receita Total</TableHead>
                  <TableHead className="text-right">Lucro</TableHead>
                  <TableHead className="pr-5 text-right">Ticket Médio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dispositivos.map((dispositivo) => (
                  <TableRow key={dispositivo.id}>
                    <TableCell className="pl-5">
                      <Badge variant="outline">{dispositivo.tipo}</Badge>
                    </TableCell>
                    <TableCell>{dispositivo.marca}</TableCell>
                    <TableCell className="font-medium">{dispositivo.modelo}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {dispositivo.quantidadeVendida}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <ValorMonetario valor={dispositivo.receitaTotal} />
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums text-primary">
                      <ValorMonetario valor={dispositivo.lucroTotal} />
                    </TableCell>
                    <TableCell className="pr-5 text-right tabular-nums">
                      <ValorMonetario valor={dispositivo.ticketMedio} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    );
  }

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
