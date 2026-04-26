import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EvolucaoMensal } from "@/types/relatorio";
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

interface GraficoEvolucaoProps {
  dados: EvolucaoMensal[];
}

const formatarMes = (mes: string) => {
  const [ano, mesNum] = mes.split("-");
  const meses = [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez",
  ];
  return `${meses[parseInt(mesNum) - 1]}/${ano}`;
};

export const GraficoEvolucao = ({ dados }: GraficoEvolucaoProps) => {
  const { valoresOcultos } = useOcultarValores();
  const dadosFormatados = dados.map((d) => ({
    ...d,
    mesFormatado: formatarMes(d.mes),
  }));
  const tooltipFormatter = (value: number) => valoresOcultos ? "•••••" : formatCurrency(value);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Evolução de Receita e Custos</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dadosFormatados}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mesFormatado" />
              <YAxis />
              <Tooltip formatter={tooltipFormatter} />
              <Legend />
              <Line
                type="monotone"
                dataKey="receita"
                stroke="hsl(var(--primary))"
                name="Receita"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="custo"
                stroke="#ef4444"
                name="Custo"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Evolução de Lucro</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dadosFormatados}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mesFormatado" />
              <YAxis />
              <Tooltip formatter={tooltipFormatter} />
              <Legend />
              <Bar dataKey="lucro" fill="hsl(var(--primary))" name="Lucro" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};
