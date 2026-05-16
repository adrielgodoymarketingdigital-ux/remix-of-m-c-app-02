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
