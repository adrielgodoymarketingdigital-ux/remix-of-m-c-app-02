import { useCotacaoDolar } from "@/hooks/useCotacaoDolar";
import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, RefreshCw, DollarSign, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export function CardCotacaoDolar() {
  const { cotacao, variacao, loading, atualizar } = useCotacaoDolar();

  return (
    <Card className="w-fit px-4 py-2">
      <div className="flex items-center gap-3">

        <div className="flex items-center gap-1 text-muted-foreground">
          <DollarSign className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">USD</span>
        </div>

        <div className="h-4 w-px bg-border" />

        <span className="text-sm font-semibold">
          R$ {cotacao?.toFixed(4) ?? "---"}
        </span>

        {variacao !== null && (
          <span className={cn(
            "text-xs font-medium flex items-center gap-0.5",
            variacao > 0 ? "text-green-600" : variacao < 0 ? "text-red-500" : "text-muted-foreground"
          )}>
            {variacao > 0
              ? <TrendingUp className="h-3 w-3" />
              : variacao < 0
              ? <TrendingDown className="h-3 w-3" />
              : <Minus className="h-3 w-3" />}
            {variacao > 0 ? "+" : ""}{Number(variacao).toFixed(2)}%
          </span>
        )}

        <button
          onClick={atualizar}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={cn("h-3 w-3", loading ? "animate-spin" : "")} />
        </button>

      </div>
    </Card>
  );
}
