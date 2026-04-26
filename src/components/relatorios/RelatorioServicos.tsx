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
import { RelatorioServico } from "@/types/relatorio-vendas";
import { formatCurrency } from "@/lib/formatters";
import { Wrench, TrendingUp, Clock, CheckCircle } from "lucide-react";

interface RelatorioServicosProps {
  servicos: RelatorioServico[];
  loading: boolean;
}

export const RelatorioServicosComponent = ({
  servicos,
  loading,
}: RelatorioServicosProps) => {
  const totalRealizado = servicos.reduce((acc, s) => acc + s.quantidadeRealizada, 0);
  const receitaTotal = servicos.reduce((acc, s) => acc + s.receitaTotal, 0);
  const ticketMedio = totalRealizado > 0 ? receitaTotal / totalRealizado : 0;
  
  const totalConcluidos = servicos.reduce(
    (acc, s) => acc + s.statusDistribuicao.concluido,
    0
  );
  const tempoMedioConclusao =
    servicos.length > 0
      ? servicos.reduce((acc, s) => acc + s.tempoMedioConclusao, 0) / servicos.length
      : 0;

  return (
    <div className="space-y-6">
      {/* Cards de Resumo */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Realizado</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRealizado}</div>
            <p className="text-xs text-muted-foreground">Serviços realizados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(receitaTotal)}</div>
            <p className="text-xs text-muted-foreground">Em serviços</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(ticketMedio)}</div>
            <p className="text-xs text-muted-foreground">Por serviço</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tempo Médio</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tempoMedioConclusao.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">Dias para conclusão</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Serviços */}
      <Card>
        <CardHeader>
          <CardTitle>Serviços Mais Realizados</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : servicos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum serviço realizado no período
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Serviço</TableHead>
                  <TableHead className="text-right">Realizados</TableHead>
                  <TableHead className="text-right">Receita Total</TableHead>
                  <TableHead className="text-center">Pendente</TableHead>
                  <TableHead className="text-center">Em Andamento</TableHead>
                  <TableHead className="text-center">Concluído</TableHead>
                  <TableHead className="text-right">Tempo Médio (dias)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {servicos.map((servico) => (
                  <TableRow key={servico.id}>
                    <TableCell className="font-medium">{servico.nomeServico}</TableCell>
                    <TableCell className="text-right font-medium">
                      {servico.quantidadeRealizada}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(servico.receitaTotal)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">
                        {servico.statusDistribuicao.pendente}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="default">
                        {servico.statusDistribuicao.em_andamento}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className="bg-green-500 hover:bg-green-600">
                        {servico.statusDistribuicao.concluido}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {servico.tempoMedioConclusao.toFixed(1)}
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
