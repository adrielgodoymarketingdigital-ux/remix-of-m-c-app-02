import { useCotacaoDolar } from "@/hooks/useCotacaoDolar";
import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, RefreshCw, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export function CardCotacaoDolar() {
  const { cotacao, variacao, loading, atualizar } = useCotacaoDolar();

  return (
    <Card className="relative overflow-hidden border border-border/60 bg-background/80 backdrop-blur-sm px-3 py-2 w-fit">

      {/* Linha decorativa superior */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent" />

      <div className="flex items-center gap-3">

        {/* Label USD com ponto pulsante */}
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
          </span>
          <span className="text-[10px] font-mono font-semibold tracking-widest text-muted-foreground uppercase">
            USD/BRL
          </span>
        </div>

        {/* Separador */}
        <div className="h-3.5 w-px bg-border/60" />

        {/* Valor */}
        <span className="font-mono text-sm font-bold tracking-tight">
          {loading && !cotacao ? (
            <span className="text-muted-foreground">···</span>
          ) : (
            <>
              <span className="text-[10px] text-muted-foreground mr-0.5">R$</span>
              {cotacao?.toFixed(4) ?? "---"}
            </>
          )}
        </span>

        {/* Variação */}
        {variacao !== null && (
          <div className={cn(
            "flex items-center gap-0.5 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-sm",
            variacao > 0
              ? "bg-emerald-500/10 text-emerald-500"
              : variacao < 0
                ? "bg-red-500/10 text-red-500"
                : "bg-muted text-muted-foreground"
          )}>
            {variacao > 0 ? (
              <TrendingUp className="h-2.5 w-2.5" />
            ) : variacao < 0 ? (
              <TrendingDown className="h-2.5 w-2.5" />
            ) : (
              <Minus className="h-2.5 w-2.5" />
            )}
            {variacao > 0 ? "+" : ""}{Number(variacao).toFixed(2)}%
          </div>
        )}

        {/* Botão atualizar */}
        <button
          onClick={atualizar}
          className="text-muted-foreground/50 hover:text-muted-foreground transition-colors ml-0.5"
          title="Atualizar cotação"
        >
          <RefreshCw className={cn("h-2.5 w-2.5", loading ? "animate-spin" : "")} />
        </button>

      </div>

      {/* Linha decorativa inferior */}
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-border/40 to-transparent" />

    </Card>
  );
}
