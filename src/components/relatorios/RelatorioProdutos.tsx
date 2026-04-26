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
import { RelatorioProduto } from "@/types/relatorio-vendas";
import { formatCurrency } from "@/lib/formatters";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { Package, TrendingUp, AlertCircle } from "lucide-react";

interface RelatorioProdutosProps {
  produtos: RelatorioProduto[];
  loading: boolean;
}

export const RelatorioProdutosComponent = ({
  produtos,
  loading,
}: RelatorioProdutosProps) => {
  const totalVendido = produtos.reduce((acc, p) => acc + p.quantidadeVendida, 0);
  const receitaTotal = produtos.reduce((acc, p) => acc + p.receitaTotal, 0);
  const ticketMedio = totalVendido > 0 ? receitaTotal / totalVendido : 0;
  const produtosBaixaRotatividade = produtos.filter((p) => p.quantidadeVendida < 5).length;

  return (
    <div className="space-y-6">
      {/* Cards de Resumo */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Vendido</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalVendido}</div>
            <p className="text-xs text-muted-foreground">Produtos vendidos</p>
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
            <p className="text-xs text-muted-foreground">Por produto</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Baixa Rotatividade</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">
              {produtosBaixaRotatividade}
            </div>
            <p className="text-xs text-muted-foreground">Menos de 5 vendas</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Produtos */}
      <Card>
        <CardHeader>
          <CardTitle>Produtos Mais Vendidos</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : produtos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum produto vendido no período
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Qtd. Vendida</TableHead>
                  <TableHead className="text-right">Estoque Atual</TableHead>
                  <TableHead className="text-right">Receita Total</TableHead>
                  <TableHead className="text-right">Lucro</TableHead>
                  <TableHead className="text-right">Ticket Médio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {produtos.map((produto) => (
                  <TableRow key={produto.id}>
                    <TableCell className="font-medium">{produto.nome}</TableCell>
                    <TableCell>
                      {produto.sku ? (
                        <Badge variant="outline">{produto.sku}</Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {produto.quantidadeVendida}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={produto.estoqueAtual < 5 ? "destructive" : "secondary"}
                      >
                        {produto.estoqueAtual}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <ValorMonetario valor={produto.receitaTotal} />
                    </TableCell>
                    <TableCell className="text-right font-medium text-primary">
                      <ValorMonetario valor={produto.lucroTotal} />
                    </TableCell>
                    <TableCell className="text-right">
                      <ValorMonetario valor={produto.ticketMedio} />
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
