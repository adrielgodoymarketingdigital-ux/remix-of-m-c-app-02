import type { ReactElement } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EvolucaoMensal } from "@/types/relatorio";
import { formatCurrency } from "@/lib/formatters";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  type TooltipProps,
} from "recharts";
import { BarChart3 } from "lucide-react";
import { useOcultarValores } from "@/contexts/OcultarValoresContext";
import { useIsDesktop } from "@/hooks/use-mobile";

interface GraficoEvolucaoProps {
  dados: EvolucaoMensal[];
  /** Opcional: no computador (lg+), esqueleto no lugar dos gráficos. */
  loading?: boolean;
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

/** Mesmas cores de sempre: receita/lucro na cor primária e custo em vermelho. */
const COR_RECEITA = "hsl(var(--primary))";
const COR_CUSTO = "#ef4444";
const ALTURA_GRAFICO = 300;

const formatoEixo = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

export const GraficoEvolucao = ({ dados, loading = false }: GraficoEvolucaoProps) => {
  const { valoresOcultos } = useOcultarValores();
  const isDesktop = useIsDesktop();
  const dadosFormatados = dados.map((d) => ({
    ...d,
    mesFormatado: formatarMes(d.mes),
  }));
  const tooltipFormatter = (value: number) => valoresOcultos ? "•••••" : formatCurrency(value);

  if (isDesktop) {
    return (
      <GraficoEvolucaoDesktop
        dados={dadosFormatados}
        loading={loading}
        valoresOcultos={valoresOcultos}
      />
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg sm:text-2xl">Evolução de Receita e Custos</CardTitle>
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

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg sm:text-2xl">Evolução de Lucro</CardTitle>
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

/* ------------------------------------------------------------------ */
/* Computador (lg+): mesmos dados e séries; só o visual muda.          */
/* ------------------------------------------------------------------ */

type DadoGrafico = EvolucaoMensal & { mesFormatado: string };

interface GraficoEvolucaoDesktopProps {
  dados: DadoGrafico[];
  loading: boolean;
  valoresOcultos: boolean;
}

function GraficoEvolucaoDesktop({ dados, loading, valoresOcultos }: GraficoEvolucaoDesktopProps) {
  const vazio = dados.length === 0;
  const eixoY = (v: number) => (valoresOcultos ? "•••" : formatoEixo.format(v));
  const eixoComum = {
    tickLine: false,
    axisLine: false,
    tick: { fontSize: 12, fill: "hsl(var(--muted-foreground))" },
  } as const;
  const legenda = (
    <Legend
      iconType="circle"
      iconSize={9}
      wrapperStyle={{ fontSize: 13, paddingTop: 12, color: "hsl(var(--muted-foreground))" }}
    />
  );

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <CardGraficoDesktop
        titulo="Evolução de Receita e Custos"
        subtitulo="Acompanhe a variação da receita e dos custos ao longo do tempo."
        loading={loading}
        vazio={vazio}
      >
        <AreaChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="degradeReceitaEvolucao" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COR_RECEITA} stopOpacity={0.28} />
              <stop offset="100%" stopColor={COR_RECEITA} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="degradeCustoEvolucao" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COR_CUSTO} stopOpacity={0.22} />
              <stop offset="100%" stopColor={COR_CUSTO} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
          <XAxis dataKey="mesFormatado" {...eixoComum} dy={8} />
          <YAxis {...eixoComum} width={56} tickFormatter={eixoY} />
          <Tooltip
            content={<TooltipGrafico valoresOcultos={valoresOcultos} />}
            cursor={{ stroke: "hsl(var(--muted-foreground))", strokeDasharray: "4 4", strokeOpacity: 0.5 }}
          />
          {legenda}
          <Area
            type="monotone"
            dataKey="receita"
            name="Receita"
            stroke={COR_RECEITA}
            strokeWidth={2.5}
            fill="url(#degradeReceitaEvolucao)"
            dot={{ r: 3, strokeWidth: 0, fill: COR_RECEITA }}
            activeDot={{ r: 5, strokeWidth: 2, stroke: "hsl(var(--card))" }}
          />
          <Area
            type="monotone"
            dataKey="custo"
            name="Custo"
            stroke={COR_CUSTO}
            strokeWidth={2.5}
            fill="url(#degradeCustoEvolucao)"
            dot={{ r: 3, strokeWidth: 0, fill: COR_CUSTO }}
            activeDot={{ r: 5, strokeWidth: 2, stroke: "hsl(var(--card))" }}
          />
        </AreaChart>
      </CardGraficoDesktop>

      <CardGraficoDesktop
        titulo="Evolução de Lucro"
        subtitulo="Veja a evolução do lucro bruto no período."
        loading={loading}
        vazio={vazio}
      >
        <BarChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
          <XAxis dataKey="mesFormatado" {...eixoComum} dy={8} />
          <YAxis {...eixoComum} width={56} tickFormatter={eixoY} />
          <Tooltip
            content={<TooltipGrafico valoresOcultos={valoresOcultos} />}
            cursor={{ fill: "hsl(var(--muted))", opacity: 0.6 }}
          />
          {legenda}
          <Bar dataKey="lucro" name="Lucro" fill={COR_RECEITA} radius={[6, 6, 0, 0]} maxBarSize={72} />
        </BarChart>
      </CardGraficoDesktop>
    </div>
  );
}

interface CardGraficoDesktopProps {
  titulo: string;
  subtitulo: string;
  loading: boolean;
  vazio: boolean;
  children: ReactElement;
}

function CardGraficoDesktop({ titulo, subtitulo, loading, vazio, children }: CardGraficoDesktopProps) {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="space-y-1 pb-2">
        <CardTitle className="text-lg font-semibold tracking-tight">{titulo}</CardTitle>
        <p className="text-sm text-muted-foreground">{subtitulo}</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="w-full rounded-xl" style={{ height: ALTURA_GRAFICO }} />
        ) : vazio ? (
          <EstadoVazioAnalise />
        ) : (
          <ResponsiveContainer width="100%" height={ALTURA_GRAFICO}>
            {children}
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

/** Estado vazio dos gráficos e tabelas da Análise no computador. */
export function EstadoVazioAnalise({ altura = ALTURA_GRAFICO }: { altura?: number }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/30 px-6 text-center"
      style={{ height: altura }}
    >
      <div aria-hidden="true" className="grid h-11 w-11 place-items-center rounded-full bg-muted text-muted-foreground">
        <BarChart3 className="h-5 w-5" />
      </div>
      <p className="text-sm text-muted-foreground">Nenhum dado encontrado para o período selecionado</p>
    </div>
  );
}

function TooltipGrafico({
  active,
  payload,
  label,
  valoresOcultos,
}: TooltipProps<number, string> & { valoresOcultos: boolean }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[180px] rounded-xl border bg-popover px-3 py-2.5 text-popover-foreground shadow-lg">
      <p className="mb-1.5 text-sm font-semibold">{label}</p>
      <ul className="space-y-1">
        {payload.map((item) => (
          <li key={String(item.dataKey)} className="flex items-center gap-2 text-sm">
            <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.color }} />
            <span className="text-muted-foreground">{item.name}:</span>
            <span className="ml-auto pl-3 font-semibold tabular-nums">
              {valoresOcultos ? "•••••" : formatCurrency(Number(item.value ?? 0))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
