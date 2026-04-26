import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useOcultarValores } from "@/contexts/OcultarValoresContext";

interface MetricasSetor {
  faturamentoServicos: number;
  faturamentoProdutos: number;
  faturamentoDispositivos: number;
  custoServicos: number;
  custoProdutos: number;
  custoDispositivos: number;
}

interface ProdutoVendido {
  nome: string;
  quantidade: number;
  total: number;
}

interface GraficosDashboardProps {
  metricas: MetricasSetor;
  produtosMaisVendidos: ProdutoVendido[];
  produtosMenosVendidos: ProdutoVendido[];
  isDemoMode?: boolean;
}

const COLORS = ['#22c55e', '#3b82f6', '#8b5cf6'];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export const GraficosDashboard = ({ 
  metricas, 
  produtosMaisVendidos, 
  produtosMenosVendidos,
  isDemoMode 
}: GraficosDashboardProps) => {
  const { valoresOcultos } = useOcultarValores();
  // Abreviações para os nomes
  const abreviar = (nome: string) => {
    if (nome === 'Dispositivos') return 'Disp.';
    if (nome === 'Serviços') return 'Serv.';
    if (nome === 'Produtos') return 'Prod.';
    return nome;
  };

  // Dados para gráfico de faturamento por setor
  const dadosFaturamento = [
    { name: 'Serviços', value: metricas.faturamentoServicos, color: COLORS[0] },
    { name: 'Produtos', value: metricas.faturamentoProdutos, color: COLORS[1] },
    { name: 'Dispositivos', value: metricas.faturamentoDispositivos, color: COLORS[2] },
  ].filter(d => d.value > 0);

  // Calcular lucro por setor
  const lucroServicos = metricas.faturamentoServicos - metricas.custoServicos;
  const lucroProdutos = metricas.faturamentoProdutos - metricas.custoProdutos;
  const lucroDispositivos = metricas.faturamentoDispositivos - metricas.custoDispositivos;

  const dadosLucro = [
    { name: 'Serviços', value: lucroServicos, color: COLORS[0] },
    { name: 'Produtos', value: lucroProdutos, color: COLORS[1] },
    { name: 'Dispositivos', value: lucroDispositivos, color: COLORS[2] },
  ].filter(d => d.value > 0);

  // Determinar setor campeão
  const setorMaisVende = dadosFaturamento.reduce((max, item) => 
    item.value > max.value ? item : max, { name: '', value: 0 });
  
  const setorMaisLucra = dadosLucro.reduce((max, item) => 
    item.value > max.value ? item : max, { name: '', value: 0 });

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg p-2 shadow-lg">
          <p className="font-medium">{payload[0].name}</p>
          <p className="text-sm text-muted-foreground">
            {valoresOcultos ? "•••••" : formatCurrency(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg p-2 shadow-lg">
          <p className="font-medium text-sm">{label}</p>
          <p className="text-sm text-muted-foreground">
            Qtd: {payload[0].value}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Título da seção */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Análise de Vendas</h2>
        {isDemoMode && (
          <span className="text-xs bg-muted px-2 py-1 rounded">
            Dados fictícios
          </span>
        )}
      </div>

      {/* Gráficos de Pizza - Setor */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Faturamento por Setor */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Faturamento por Setor</CardTitle>
            {setorMaisVende.name && (
              <p className="text-xs text-muted-foreground">
                Campeão: <span className="font-semibold text-green-600">{setorMaisVende.name}</span>
              </p>
            )}
          </CardHeader>
          <CardContent>
            {dadosFaturamento.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={dadosFaturamento}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${abreviar(name)} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {dadosFaturamento.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend 
                    formatter={(value) => value}
                    wrapperStyle={{ fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                Sem dados de vendas
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lucro por Setor */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Lucro por Setor</CardTitle>
            {setorMaisLucra.name && (
              <p className="text-xs text-muted-foreground">
                Campeão: <span className="font-semibold text-green-600">{setorMaisLucra.name}</span>
              </p>
            )}
          </CardHeader>
          <CardContent>
            {dadosLucro.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={dadosLucro}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${abreviar(name)} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {dadosLucro.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend 
                    formatter={(value) => value}
                    wrapperStyle={{ fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                Sem dados de lucro
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gráficos de Barra - Produtos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Produtos Mais Vendidos */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Top 5 Produtos Mais Vendidos</CardTitle>
          </CardHeader>
          <CardContent>
            {produtosMaisVendidos.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={produtosMaisVendidos} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis 
                    type="category" 
                    dataKey="nome" 
                    width={100}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value) => value.length > 12 ? `${value.substring(0, 12)}...` : value}
                  />
                  <Tooltip content={<CustomBarTooltip />} />
                  <Bar dataKey="quantidade" fill="#22c55e" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                Sem vendas de produtos
              </div>
            )}
          </CardContent>
        </Card>

        {/* Produtos Menos Vendidos */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Top 5 Produtos Menos Vendidos</CardTitle>
          </CardHeader>
          <CardContent>
            {produtosMenosVendidos.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={produtosMenosVendidos} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis 
                    type="category" 
                    dataKey="nome" 
                    width={100}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value) => value.length > 12 ? `${value.substring(0, 12)}...` : value}
                  />
                  <Tooltip content={<CustomBarTooltip />} />
                  <Bar dataKey="quantidade" fill="#f97316" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                Sem dados de produtos
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
