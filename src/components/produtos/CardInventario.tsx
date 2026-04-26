import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface CardInventarioProps {
  titulo: string;
  icon: LucideIcon;
  iconColor?: string;
  totalItens?: number;
  totalQuantidade: number;
  valorCusto: number;
  valorVenda: number;
  valorLucro: number;
}

export function CardInventario({
  titulo,
  icon: Icon,
  iconColor = "text-muted-foreground",
  totalItens,
  totalQuantidade,
  valorCusto,
  valorVenda,
  valorLucro,
}: CardInventarioProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
        <CardTitle className="text-xs font-medium truncate pr-1">{titulo}</CardTitle>
        <Icon className={cn("h-3.5 w-3.5 shrink-0", iconColor)} />
      </CardHeader>
      <CardContent className="p-3 pt-0 space-y-1">
        <div className="text-base xl:text-lg font-bold">
          {totalItens !== undefined ? (
            <>
              {totalItens} <span className="text-xs font-normal text-muted-foreground">cadastros</span>
              <span className="text-xs font-normal text-muted-foreground"> · </span>
              {totalQuantidade} <span className="text-xs font-normal text-muted-foreground">em estoque</span>
            </>
          ) : (
            <>
              {totalQuantidade} <span className="text-xs font-normal text-muted-foreground">itens</span>
            </>
          )}
        </div>
        <div className="flex flex-col gap-0.5 text-[11px]">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Custo total:</span>
            <ValorMonetario valor={valorCusto} tipo="custo" className="font-medium" />
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Venda total:</span>
            <ValorMonetario valor={valorVenda} tipo="preco" className="font-medium text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Lucro potencial:</span>
            <ValorMonetario valor={valorLucro} tipo="lucro" className="font-medium text-emerald-600 dark:text-emerald-400" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
