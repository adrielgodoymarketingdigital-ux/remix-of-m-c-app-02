import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LucroPorItem } from "@/types/relatorio";
import { Skeleton } from "@/components/ui/skeleton";
import { Lock } from "lucide-react";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import { ValorMonetario } from "@/components/ui/valor-monetario";

interface TabelaLucrosProps {
  itens: LucroPorItem[];
  loading: boolean;
}

const tipoLabels: Record<string, string> = {
  dispositivo: "Dispositivo",
  produto: "Produto",
  servico: "Serviço",
};

const tipoColors: Record<string, string> = {
  dispositivo: "bg-blue-500",
  produto: "bg-green-500",
  servico: "bg-purple-500",
};

const formaPagamentoLabels = {
  a_receber: "A receber",
  a_prazo: "A prazo",
} as const;

export const TabelaLucros = ({ itens, loading }: TabelaLucrosProps) => {
  const { podeVerCustos, podeVerLucros } = useFuncionarioPermissoes();

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (itens.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhum dado encontrado para o período selecionado
      </div>
    );
  }

  // Se não pode ver lucros, mostrar mensagem
  if (!podeVerLucros) {
    return (
      <div className="text-center py-8 text-muted-foreground flex flex-col items-center gap-2">
        <Lock className="h-8 w-8" />
        <p>Você não tem permissão para visualizar os lucros</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Item</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead className="text-right">Qtd Vendida</TableHead>
          <TableHead className="text-right">Receita</TableHead>
          {podeVerCustos && <TableHead className="text-right">Custo</TableHead>}
          <TableHead className="text-right">Lucro</TableHead>
          <TableHead className="text-right">Margem</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {itens.map((item) => (
          <TableRow key={item.id}>
            <TableCell className="font-medium">
              <div className="space-y-1">
                <div>{item.nome}</div>
                {item.parcelamentoDetalhes?.map((detalhe, index) => (
                  <div key={`${item.id}-${detalhe.formaPagamento}-${detalhe.parcelaNumero}-${index}`} className="text-xs font-normal text-muted-foreground">
                    {formaPagamentoLabels[detalhe.formaPagamento]} • {detalhe.parcelaNumero ?? "-"}/{detalhe.totalParcelas ?? "-"} • <ValorMonetario valor={detalhe.valorParcela} />
                  </div>
                ))}
              </div>
            </TableCell>
            <TableCell>
              <Badge className={tipoColors[item.tipo]}>
                {tipoLabels[item.tipo]}
              </Badge>
            </TableCell>
            <TableCell className="text-right">{item.quantidadeVendida}</TableCell>
            <TableCell className="text-right text-green-600 font-medium">
              <ValorMonetario valor={item.receitaTotal} />
            </TableCell>
            {podeVerCustos && (
              <TableCell className="text-right text-red-600">
                <ValorMonetario valor={item.custoTotal} />
              </TableCell>
            )}
            <TableCell className="text-right font-semibold">
              <ValorMonetario valor={item.lucroTotal} />
            </TableCell>
            <TableCell className="text-right">
              <Badge
                variant="outline"
                className={
                  item.margemLucro >= 30
                    ? "text-green-600"
                    : item.margemLucro >= 15
                    ? "text-yellow-600"
                    : "text-red-600"
                }
              >
                {item.margemLucro.toFixed(1)}%
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
