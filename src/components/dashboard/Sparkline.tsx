import { AreaChart, Area, ResponsiveContainer } from "recharts";

interface SparklineProps {
  dados: number[];
  cor?: string;
  altura?: number;
  destacarUltimoPonto?: boolean;
}

/**
 * Mini-gráfico de linha/área sem eixos, grid ou tooltip — para uso dentro de
 * cards de KPI. Não existia componente equivalente no projeto (só gráficos
 * completos em GraficosDashboard/GraficoEvolucao); mesma lib (recharts) já
 * usada em todo o app.
 */
export const Sparkline = ({ dados, cor = "#3b82f6", altura = 40, destacarUltimoPonto = false }: SparklineProps) => {
  const pontos = dados.map((valor, i) => ({ i, valor }));
  const gradientId = `sparkline-gradient-${cor.replace("#", "")}`;
  const ultimoIndex = pontos.length - 1;

  return (
    <div style={{ width: "100%", height: altura }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={pontos} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={cor} stopOpacity={0.6} />
              <stop offset="100%" stopColor={cor} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="valor"
            stroke={cor}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
            dot={
              destacarUltimoPonto
                ? (props: any) =>
                    props.index === ultimoIndex ? (
                      <circle
                        key="ultimo-ponto"
                        cx={props.cx}
                        cy={props.cy}
                        r={3.5}
                        fill={cor}
                        stroke="white"
                        strokeWidth={1.5}
                      />
                    ) : (
                      <g key={`p-${props.index}`} />
                    )
                : false
            }
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
