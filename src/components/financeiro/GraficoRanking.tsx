import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucroPorItem } from "@/types/relatorio";
import { formatCurrency } from "@/lib/formatters";
import { useOcultarValores } from "@/contexts/OcultarValoresContext";
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
}

export function GraficoRanking({ itens }: GraficoRankingProps) {
  const { valoresOcultos } = useOcultarValores();

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

  if (itens.length === 0) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
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

      <Card>
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
