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
import { LIMITE_PADRAO_RELATORIO_VENDIDOS, situacaoEstoque } from "@/lib/estoque/situacaoEstoque";
import { limiteDoItem } from "@/lib/estoque/estoqueMinimoItem";
import { useConfiguracaoEstoque } from "@/hooks/useConfiguracaoEstoque";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { Package, TrendingUp, AlertCircle, Trophy } from "lucide-react";
import { useIsDesktop } from "@/hooks/use-mobile";
import { CardResumoRelatorio, CabecalhoTabelaRelatorio } from "@/components/relatorios/CardResumoRelatorio";
import { EstadoRelatorio } from "@/components/relatorios/EstadoRelatorio";


interface RelatorioProdutosProps {
  produtos: RelatorioProduto[];
  loading: boolean;
}

export const RelatorioProdutosComponent = ({
  produtos,
  loading,
}: RelatorioProdutosProps) => {
  // Limite da loja (null = padrão do relatório: vermelho abaixo de 5).
  const { limiteBaixo } = useConfiguracaoEstoque();
  const totalVendido = produtos.reduce((acc, p) => acc + p.quantidadeVendida, 0);
  const receitaTotal = produtos.reduce((acc, p) => acc + p.receitaTotal, 0);
  const ticketMedio = totalVendido > 0 ? receitaTotal / totalVendido : 0;
  const produtosBaixaRotatividade = produtos.filter((p) => p.quantidadeVendida < 5).length;
  const isDesktop = useIsDesktop();

  // Computador (>= 1024px): mesmos dados, textos e regra de estoque, só o visual muda. Celular segue no return de baixo.
  if (isDesktop) {
    return (
      <div className="space-y-5">
        <div className="grid gap-4 lg:grid-cols-2 min-[1400px]:grid-cols-4">
          <CardResumoRelatorio titulo="Total Vendido" valor={totalVendido} descricao="Produtos vendidos" icon={Package} acento="blue" />
          <CardResumoRelatorio titulo="Receita Total" valor={<ValorMonetario valor={receitaTotal} />} descricao="Em vendas" icon={TrendingUp} acento="green" />
          <CardResumoRelatorio titulo="Ticket Médio" valor={<ValorMonetario valor={ticketMedio} />} descricao="Por produto" icon={Package} acento="purple" />
          <CardResumoRelatorio titulo="Baixa Rotatividade" valor={produtosBaixaRotatividade} descricao="Menos de 5 vendas" icon={AlertCircle} acento="orange" classeValor="text-orange-500" />
        </div>

        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="p-5 pb-4">
            <CabecalhoTabelaRelatorio titulo="Produtos Mais Vendidos" descricao="Produtos com mais saída no período e o estoque atual." icon={Trophy} acento="orange" />
          </div>
          {loading ? (
            <EstadoRelatorio tipo="carregando" texto="Carregando..." />
          ) : produtos.length === 0 ? (
            <EstadoRelatorio tipo="vazio" texto="Nenhum produto vendido no período" icon={Package} />
          ) : (
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-5">Nome</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Qtd. Vendida</TableHead>
                  <TableHead className="text-right">Estoque Atual</TableHead>
                  <TableHead className="text-right">Receita Total</TableHead>
                  <TableHead className="text-right">Lucro</TableHead>
                  <TableHead className="pr-5 text-right">Ticket Médio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {produtos.map((produto) => (
                  <TableRow key={produto.id}>
                    <TableCell className="pl-5 font-medium">{produto.nome}</TableCell>
                    <TableCell>
                      {produto.sku ? (
                        <Badge variant="outline">{produto.sku}</Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {produto.quantidadeVendida}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={
                          situacaoEstoque(produto.estoqueAtual, limiteDoItem(produto.estoqueMinimo, limiteBaixo), LIMITE_PADRAO_RELATORIO_VENDIDOS) === "ok"
                            ? "secondary"
                            : "destructive"
                        }
                      >
                        {produto.estoqueAtual}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <ValorMonetario valor={produto.receitaTotal} />
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums text-primary">
                      <ValorMonetario valor={produto.lucroTotal} />
                    </TableCell>
                    <TableCell className="pr-5 text-right tabular-nums">
                      <ValorMonetario valor={produto.ticketMedio} />
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
                        variant={
                          situacaoEstoque(produto.estoqueAtual, limiteDoItem(produto.estoqueMinimo, limiteBaixo), LIMITE_PADRAO_RELATORIO_VENDIDOS) === "ok"
                            ? "secondary"
                            : "destructive"
                        }
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
