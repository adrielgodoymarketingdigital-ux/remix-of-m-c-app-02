import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { cn } from "@/lib/utils";
import type { LucroPorItem } from "@/types/relatorio";
import { EstadoVazioAnalise } from "./GraficoEvolucao";

/**
 * Tabela "Top Lucro por Item" / "Mais Vendidos" da Análise no computador (lg+).
 * Só exibe o que já vem em LucroPorItem (mesmos 8 itens dos gráficos do celular);
 * nenhum cálculo novo.
 */

// Mesmos rótulos e cores de tipo da TabelaLucros.
const tipoLabels: Record<LucroPorItem["tipo"], string> = {
  dispositivo: "Dispositivo",
  produto: "Produto",
  servico: "Serviço",
};
const tipoColors: Record<LucroPorItem["tipo"], string> = {
  dispositivo: "bg-blue-500",
  produto: "bg-green-500",
  servico: "bg-purple-500",
};

// Mesmas faixas de cor da margem da TabelaLucros (>= 30 verde, >= 15 amarelo, abaixo vermelho).
const corMargem = (m: number) =>
  m >= 30
    ? { texto: "text-green-600 dark:text-green-400", barra: "bg-green-500" }
    : m >= 15
      ? { texto: "text-yellow-600 dark:text-yellow-400", barra: "bg-yellow-500" }
      : { texto: "text-red-600 dark:text-red-400", barra: "bg-red-500" };

interface TabelaTopItensProps {
  titulo: string;
  subtitulo: string;
  modo: "lucro" | "quantidade";
  itens: LucroPorItem[];
  loading?: boolean;
  onVerTodos?: () => void;
}

export function TabelaTopItens({ titulo, subtitulo, modo, itens, loading = false, onVerTodos }: TabelaTopItensProps) {
  return (
    <Card className="flex flex-col rounded-2xl shadow-sm">
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <div className="min-w-0 space-y-1">
          <CardTitle className="text-lg font-semibold tracking-tight">{titulo}</CardTitle>
          <p className="text-sm text-muted-foreground">{subtitulo}</p>
        </div>
        {onVerTodos && itens.length > 0 && !loading && (
          <Button variant="outline" size="sm" className="shrink-0 rounded-xl" onClick={onVerTodos}>
            Ver todos
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex-1">
        {loading ? (
          <div className="space-y-2" aria-hidden="true">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        ) : itens.length === 0 ? (
          <EstadoVazioAnalise altura={260} />
        ) : (
          <table className="w-full table-fixed text-sm">
            <colgroup>
              <col className="w-8" />
              <col />
              <col className={modo === "lucro" ? "w-14" : "w-24"} />
              <col className="w-32" />
              {modo === "lucro" && <col className="w-28 2xl:w-40" />}
            </colgroup>
            <thead>
              <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                <th scope="col" className="pb-2 font-medium">#</th>
                <th scope="col" className="pb-2 font-medium">Item</th>
                <th scope="col" className="pb-2 text-right font-medium">{modo === "lucro" ? "Vendas" : "Quantidade"}</th>
                <th scope="col" className="pb-2 pr-1 text-right font-medium">{modo === "lucro" ? "Lucro" : "Receita Total"}</th>
                {modo === "lucro" && <th scope="col" className="pb-2 pl-3 font-medium">Margem</th>}
              </tr>
            </thead>
            <tbody>
              {itens.map((item, i) => {
                const margem = corMargem(item.margemLucro);
                return (
                  <tr key={`${item.id}-${i}`} className="border-b last:border-0">
                    <td className="py-2 align-middle text-xs font-semibold text-muted-foreground tabular-nums">{i + 1}</td>
                    <td className="py-2 pr-3 align-middle">
                      <div className="min-w-0 space-y-1">
                        <p className="truncate font-medium leading-tight" title={item.nome}>{item.nome}</p>
                        <span
                          className={cn(
                            "inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none text-white",
                            tipoColors[item.tipo],
                          )}
                        >
                          {tipoLabels[item.tipo]}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 text-right align-middle tabular-nums">{item.quantidadeVendida}</td>
                    <td
                      className={cn(
                        "whitespace-nowrap py-2 pr-1 text-right align-middle font-semibold tabular-nums",
                        modo === "lucro" &&
                          (item.lucroTotal >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive"),
                      )}
                    >
                      <ValorMonetario valor={modo === "lucro" ? item.lucroTotal : item.receitaTotal} />
                    </td>
                    {modo === "lucro" && (
                      <td className="py-2 pl-3 align-middle">
                        <div className="flex items-center gap-2">
                          <span className={cn("w-12 shrink-0 text-xs font-semibold tabular-nums", margem.texto)}>
                            {item.margemLucro.toFixed(1)}%
                          </span>
                          <div aria-hidden="true" className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn("h-full rounded-full", margem.barra)}
                              style={{ width: `${Math.min(Math.max(item.margemLucro, 0), 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
