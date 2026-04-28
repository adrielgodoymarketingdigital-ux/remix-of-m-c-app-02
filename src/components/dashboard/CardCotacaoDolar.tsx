import { useCotacaoDolar } from "@/hooks/useCotacaoDolar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, RefreshCw, DollarSign, Minus } from "lucide-react";

export function CardCotacaoDolar() {
  const { cotacao, cotacaoCompra, variacao, ultimaAtualizacao, loading, erro, atualizar } =
    useCotacaoDolar();

  const formatarValor = (v: number) =>
    v.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 });

  const badgeVariacao = () => {
    if (variacao === null) return null;
    if (variacao > 0)
      return (
        <Badge className="bg-green-100 text-green-700 border-green-300 gap-1">
          <TrendingUp className="h-3 w-3" />+{variacao.toFixed(2).replace(".", ",")}%
        </Badge>
      );
    if (variacao < 0)
      return (
        <Badge className="bg-red-100 text-red-700 border-red-300 gap-1">
          <TrendingDown className="h-3 w-3" />{variacao.toFixed(2).replace(".", ",")}%
        </Badge>
      );
    return (
      <Badge variant="secondary" className="gap-1">
        <Minus className="h-3 w-3" />0,00%
      </Badge>
    );
  };

  return (
    <Card className="p-4 sm:p-6 shadow-md border-l-4 border-l-yellow-500">
      <CardHeader className="p-0 mb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
              <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-600 dark:text-yellow-400" />
            </div>
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={atualizar}
            disabled={loading}
            title="Atualizar cotação"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <p className="text-sm text-muted-foreground mb-1">Dólar Hoje</p>

        {loading && cotacao === null ? (
          <p className="text-muted-foreground text-sm">Carregando...</p>
        ) : erro ? (
          <div className="space-y-2">
            <p className="text-xs text-red-500">{erro}</p>
            <Button variant="outline" size="sm" onClick={atualizar}>
              Tentar novamente
            </Button>
          </div>
        ) : cotacao !== null ? (
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-lg sm:text-xl font-bold">
                R$ {formatarValor(cotacao)}
              </span>
              {badgeVariacao()}
            </div>
            {cotacaoCompra !== null && (
              <p className="text-sm text-muted-foreground">
                Compra: R$ {formatarValor(cotacaoCompra)}
              </p>
            )}
            {ultimaAtualizacao && (
              <p className="text-xs text-muted-foreground">
                Atualizado às{" "}
                {ultimaAtualizacao.toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
