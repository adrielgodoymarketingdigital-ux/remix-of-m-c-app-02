import { useCotacaoDolar } from "@/hooks/useCotacaoDolar";
import { TrendingUp, TrendingDown, RefreshCw, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

// Cotação em real: sempre no formato brasileiro, qualquer que seja o idioma da conta.
const formatoCotacao = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
const formatoVariacao = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function CardCotacaoDolar() {
  const { cotacao, variacao, loading, atualizar } = useCotacaoDolar();
  const { t } = useTranslation("dashboard");

  return (
    <div className="rounded-xl border border-border bg-background px-3 py-1.5">
      <p className="mb-0.5 text-[10px] leading-tight text-muted-foreground">{t("cotacao.rotulo")}</p>

      <div className="flex items-center gap-2">
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
        </span>
        <span className="text-xs font-semibold text-muted-foreground">USD/BRL</span>

        <div className="h-3.5 w-px bg-border" />

        <span className="whitespace-nowrap text-sm font-bold tracking-tight text-foreground">
          {loading && cotacao === null
            ? <span className="text-muted-foreground">···</span>
            : cotacao === null ? "---" : `R$ ${formatoCotacao.format(cotacao)}`}
        </span>

        {variacao !== null && (
          <div className={cn(
            "flex items-center gap-0.5 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-bold",
            variacao > 0
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : variacao < 0
                ? "bg-red-500/10 text-red-700 dark:text-red-300"
                : "bg-muted text-muted-foreground"
          )}>
            {variacao > 0 ? (
              <TrendingUp className="h-3 w-3" />
            ) : variacao < 0 ? (
              <TrendingDown className="h-3 w-3" />
            ) : (
              <Minus className="h-3 w-3" />
            )}
            {variacao > 0 ? "+" : ""}{formatoVariacao.format(variacao)}%
          </div>
        )}

        <button
          type="button"
          onClick={atualizar}
          className="text-muted-foreground transition-colors hover:text-foreground"
          title={t("cotacao.atualizar")}
          aria-label={t("cotacao.atualizar")}
        >
          <RefreshCw className={cn("h-3 w-3", loading ? "animate-spin" : "")} />
        </button>
      </div>
    </div>
  );
}
