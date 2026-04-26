import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VendasPorPeriodo } from "@/types/venda";
import { formatCurrency } from "@/lib/formatters";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useOcultarValores } from "@/contexts/OcultarValoresContext";

interface GraficoVendasProps {
  dados: VendasPorPeriodo[];
}

export const GraficoVendas = ({ dados }: GraficoVendasProps) => {
  const { valoresOcultos } = useOcultarValores();
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Vendas por Período</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dados}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="data" />
              <YAxis />
              <Tooltip 
                formatter={(value: number) => valoresOcultos ? "•••••" : formatCurrency(value)}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="total" 
                stroke="hsl(var(--primary))" 
                name="Total"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quantidade de Vendas</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dados}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="data" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar 
                dataKey="quantidade" 
                fill="hsl(var(--primary))" 
                name="Quantidade"
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};
