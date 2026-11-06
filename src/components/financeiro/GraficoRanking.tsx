import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucroPorItem } from "@/types/relatorio";
import { formatCurrency } from "@/lib/formatters";
import { useOcultarValores } from "@/contexts/OcultarValoresContext";
import { useIsDesktop } from "@/hooks/use-mobile";
import { TabelaTopItens } from "./TabelaTopItens";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface GraficoRankingProps {
  itens: LucroPorItem[];
  /** Opcional: no computador (lg+), esqueleto nas tabelas. */
  loading?: boolean;
  /** Opcional: botão "Ver todos" das tabelas do computador. */
  onVerTodos?: () => void;
}

export function GraficoRanking({ itens, loading = false, onVerTodos }: GraficoRankingProps) {
  const { valoresOcultos } = useOcultarValores();
  const isDesktop = useIsDesktop();

  // Computador: os mesmos 8 itens de cada ranking, em tabela.
  const itensTopLucro = useMemo(
    () => [...itens].sort((a, b) => b.lucroTotal - a.lucroTotal).slice(0, 8),
    [itens]
  );
  const itensMaisVendidos = useMemo(
    () => [...itens].sort((a, b) => b.quantidadeVendida - a.quantidadeVendida).slice(0, 8),
    [itens]
  );

  const truncarNome = (nome: string) =>
    nome.length > 25 ? `${nome.substring(0, 22)}...` : nome;

  const topLucro = useMemo(() => {
    return [...itens]
      .sort((a, b) => b.lucroTotal - a.lucroTotal)
      .slice(0, 8)
      .map((item) => ({
        nome: item.nome,
        lucro: item.lucroTotal,
        receita: item.receitaTotal,
        quantidade: item.quantidadeVendida,
      }));
  }, [itens]);

  const topVendas = useMemo(() => {
    return [...itens]
      .sort((a, b) => b.quantidadeVendida - a.quantidadeVendida)
      .slice(0, 8)
      .map((item) => ({
        nome: item.nome,
        quantidade: item.quantidadeVendida,
        receita: item.receitaTotal,
      }));
  }, [itens]);

  const tooltipFormatter = (value: number, name: string) => {
    if (valoresOcultos && (name === "lucro" || name === "receita")) return "•••••";
    if (name === "lucro" || name === "receita") return formatCurrency(value);
    return value;
  };

  if (isDesktop) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <TabelaTopItens
          titulo="Top Lucro por Item"
          subtitulo="Produtos e serviços que mais geram lucro no período."
          modo="lucro"
          itens={itensTopLucro}
          loading={loading}
          onVerTodos={onVerTodos}
        />
        <TabelaTopItens
          titulo="Mais Vendidos (Quantidade)"
          subtitulo="Itens mais vendidos no período."
          modo="quantidade"
          itens={itensMaisVendidos}
          loading={loading}
          onVerTodos={onVerTodos}
        />
      </div>
    );
  }

  if (itens.length === 0) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Top Lucro por Item</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topLucro} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(v) => (valoresOcultos ? "•••" : formatCurrency(v))}
              />
              <YAxis
                dataKey="nome"
                type="category"
                width={140}
                tick={{ fontSize: 11 }}
                tickFormatter={truncarNome}
              />
              <Tooltip formatter={tooltipFormatter} />
              <Bar dataKey="lucro" name="Lucro" radius={[0, 4, 4, 0]}>
                {topLucro.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.lucro >= 0 ? "hsl(var(--primary))" : "hsl(var(--destructive))"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Mais Vendidos (Quantidade)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topVendas} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis
                dataKey="nome"
                type="category"
                width={140}
                tick={{ fontSize: 11 }}
                tickFormatter={truncarNome}
              />
              <Tooltip formatter={tooltipFormatter} />
              <Bar
                dataKey="quantidade"
                name="Quantidade"
                fill="hsl(var(--primary))"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
