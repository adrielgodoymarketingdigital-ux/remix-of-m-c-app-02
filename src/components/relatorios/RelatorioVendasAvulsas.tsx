import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RelatorioVendaAvulsa } from "@/types/relatorio-vendas";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { ShoppingBag, TrendingUp, Receipt } from "lucide-react";
import { useIsDesktop } from "@/hooks/use-mobile";
import { CardResumoRelatorio, CabecalhoTabelaRelatorio } from "@/components/relatorios/CardResumoRelatorio";
import { EstadoRelatorio } from "@/components/relatorios/EstadoRelatorio";


interface RelatorioVendasAvulsasProps {
  vendas: RelatorioVendaAvulsa[];
  loading: boolean;
}

const formatarFormaPagamento = (forma: string) => {
  const mapa: Record<string, string> = {
    dinheiro: "Dinheiro",
    pix: "PIX",
    cartao_credito: "Cartão de Crédito",
    cartao_debito: "Cartão de Débito",
    a_receber: "A Receber",
    a_prazo: "A Prazo",
  };
  return mapa[forma] ?? forma;
};

export const RelatorioVendasAvulsasComponent = ({
  vendas,
  loading,
}: RelatorioVendasAvulsasProps) => {
  const totalVendas = vendas.length;
  const receitaTotal = vendas.reduce((acc, v) => acc + v.valor, 0);
  const ticketMedio = totalVendas > 0 ? receitaTotal / totalVendas : 0;
  const isDesktop = useIsDesktop();

  // Computador (>= 1024px): mesmos dados e textos, só o visual muda. Celular segue no return de baixo.
  if (isDesktop) {
    return (
      <div className="space-y-5">
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <CardResumoRelatorio titulo="Total de Vendas" valor={totalVendas} descricao="Vendas avulsas no período" icon={ShoppingBag} acento="blue" />
          <CardResumoRelatorio titulo="Receita Total" valor={<ValorMonetario valor={receitaTotal} />} descricao="Em vendas avulsas" icon={TrendingUp} acento="green" />
          <CardResumoRelatorio titulo="Ticket Médio" valor={<ValorMonetario valor={ticketMedio} />} descricao="Por venda" icon={Receipt} acento="purple" />
        </div>

        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="p-5 pb-4">
            <CabecalhoTabelaRelatorio titulo="Vendas Avulsas" descricao="Vendas avulsas registradas no período." icon={Receipt} acento="orange" />
          </div>
          {loading ? (
            <EstadoRelatorio tipo="carregando" texto="Carregando..." />
          ) : vendas.length === 0 ? (
            <EstadoRelatorio tipo="vazio" texto="Nenhuma venda avulsa no período" icon={ShoppingBag} />
          ) : (
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-5">Descrição</TableHead>
                  <TableHead>Forma de Pagamento</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="pr-5 text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendas.map((venda) => (
                  <TableRow key={venda.id}>
                    <TableCell className="pl-5 font-medium">{venda.descricao}</TableCell>
                    <TableCell>{formatarFormaPagamento(venda.formaPagamento)}</TableCell>
                    <TableCell className="tabular-nums">
                      {new Date(venda.data).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="pr-5 text-right font-medium tabular-nums text-primary">
                      <ValorMonetario valor={venda.valor} />
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
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Vendas</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalVendas}</div>
            <p className="text-xs text-muted-foreground">Vendas avulsas no período</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold"><ValorMonetario valor={receitaTotal} /></div>
            <p className="text-xs text-muted-foreground">Em vendas avulsas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold"><ValorMonetario valor={ticketMedio} /></div>
            <p className="text-xs text-muted-foreground">Por venda</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vendas Avulsas</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : vendas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma venda avulsa no período
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Forma de Pagamento</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendas.map((venda) => (
                  <TableRow key={venda.id}>
                    <TableCell className="font-medium">{venda.descricao}</TableCell>
                    <TableCell>{formatarFormaPagamento(venda.formaPagamento)}</TableCell>
                    <TableCell>
                      {new Date(venda.data).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right font-medium text-primary">
                      <ValorMonetario valor={venda.valor} />
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
