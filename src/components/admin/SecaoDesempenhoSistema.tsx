import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react";
import type { AdminFinanceiroData } from "@/hooks/useAdminFinanceiro";

type HistoricoCrescimento = NonNullable<AdminFinanceiroData["historico_crescimento"]>;
type Snapshot = HistoricoCrescimento["snapshots"][number];

const PERIODOS = [
  { label: "Mensal", value: "mensal" },
  { label: "Trimestral", value: "trimestral" },
  { label: "Semestral", value: "semestral" },
  { label: "Anual", value: "anual" },
] as const;

type Periodo = (typeof PERIODOS)[number]["value"];

function fmt(n: number, casas = 1) {
  return n.toFixed(casas).replace(".", ",");
}

function sinalCrescimento(pct: number | null) {
  if (pct === null) return null;
  if (pct > 0.5) return "up";
  if (pct < -0.5) return "down";
  return "flat";
}

function BadgeCrescimento({ pct }: { pct: number | null }) {
  const sinal = sinalCrescimento(pct);
  if (sinal === null) return <span className="text-muted-foreground text-sm">—</span>;
  if (sinal === "up")
    return (
      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 font-semibold gap-1 border-0">
        <TrendingUp className="h-3 w-3" />+{fmt(pct!)}%
      </Badge>
    );
  if (sinal === "down")
    return (
      <Badge className="bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 font-semibold gap-1 border-0">
        <TrendingDown className="h-3 w-3" />
        {fmt(pct!)}%
      </Badge>
    );
  return (
    <Badge className="bg-muted text-muted-foreground font-semibold gap-1 border-0">
      <Minus className="h-3 w-3" />
      {fmt(pct!)}%
    </Badge>
  );
}

function agruparTrimestral(snapshots: Snapshot[]): Snapshot[] {
  const grupos: Snapshot[] = [];
  for (let i = 2; i < snapshots.length; i += 3) {
    const slice = snapshots.slice(Math.max(0, i - 2), i + 1);
    const ultimo = slice[slice.length - 1];
    const primeiro = slice[0];
    const crescimento_pct =
      primeiro.ativos > 0 ? ((ultimo.ativos - primeiro.ativos) / primeiro.ativos) * 100 : null;
    grupos.push({ ...ultimo, mes: `T${Math.floor(grupos.length) + 1} ${ultimo.mes.slice(-2)}`, crescimento_pct });
  }
  return grupos;
}

function agruparSemestral(snapshots: Snapshot[]): Snapshot[] {
  const grupos: Snapshot[] = [];
  for (let i = 5; i < snapshots.length; i += 6) {
    const slice = snapshots.slice(Math.max(0, i - 5), i + 1);
    const ultimo = slice[slice.length - 1];
    const primeiro = slice[0];
    const crescimento_pct =
      primeiro.ativos > 0 ? ((ultimo.ativos - primeiro.ativos) / primeiro.ativos) * 100 : null;
    grupos.push({ ...ultimo, mes: `S${grupos.length + 1}/${ultimo.mes.slice(-2)}`, crescimento_pct });
  }
  return grupos;
}

function agruparAnual(snapshots: Snapshot[]): Snapshot[] {
  const porAno: Record<string, Snapshot[]> = {};
  for (const s of snapshots) {
    const ano = s.data.slice(0, 4);
    if (!porAno[ano]) porAno[ano] = [];
    porAno[ano].push(s);
  }
  return Object.entries(porAno).map(([ano, items]) => {
    const ultimo = items[items.length - 1];
    const primeiro = items[0];
    const crescimento_pct =
      primeiro.ativos > 0 ? ((ultimo.ativos - primeiro.ativos) / primeiro.ativos) * 100 : null;
    return { ...ultimo, mes: ano, crescimento_pct };
  });
}

interface Props {
  data: HistoricoCrescimento | null | undefined;
  isLoading: boolean;
}

export function SecaoDesempenhoSistema({ data, isLoading }: Props) {
  const [periodo, setPeriodo] = useState<Periodo>("mensal");

  const chartData = (() => {
    if (!data) return [];
    if (periodo === "mensal") return data.snapshots;
    if (periodo === "trimestral") return agruparTrimestral(data.snapshots);
    if (periodo === "semestral") return agruparSemestral(data.snapshots);
    return agruparAnual(data.snapshots);
  })();

  const projecaoChart = (() => {
    if (!data) return [];
    const historico = data.snapshots.slice(-6).map((s) => ({
      mes: s.mes,
      ativos: s.ativos,
      projetado: undefined as number | undefined,
    }));
    const ultimo = historico[historico.length - 1];
    const taxaMensal = data.crescimento_medio_mensal_pct / 100;
    const proj = [1, 3, 6, 12].map((m) => ({
      mes: `+${m}m`,
      ativos: undefined as number | undefined,
      projetado: Math.round((ultimo?.ativos ?? 0) * Math.pow(1 + taxaMensal, m)),
    }));
    return [...historico, ...proj];
  })();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-5 w-5 text-primary" />
          Desempenho do Sistema
        </CardTitle>
        <CardDescription>Crescimento de assinantes por período e projeção de tendência</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Seletor de período */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-muted-foreground font-medium">Período:</span>
          <ToggleGroup
            type="single"
            value={periodo}
            onValueChange={(v) => v && setPeriodo(v as Periodo)}
            className="gap-1"
          >
            {PERIODOS.map((p) => (
              <ToggleGroupItem key={p.value} value={p.value} className="h-8 px-3 text-sm">
                {p.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        {/* KPIs */}
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        ) : data ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-muted/30 rounded-lg p-3 space-y-1">
              <p className="text-xs text-muted-foreground">Assinantes hoje</p>
              <p className="text-2xl font-bold">{data.total_atual}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 space-y-1">
              <p className="text-xs text-muted-foreground">Crescimento médio/mês</p>
              <BadgeCrescimento pct={data.crescimento_medio_mensal_pct} />
              <p className="text-xs text-muted-foreground">{fmt(data.crescimento_medio_mensal_pct)}% ao mês (média)</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 space-y-1">
              <p className="text-xs text-muted-foreground">Crescimento último mês</p>
              <BadgeCrescimento pct={data.crescimento_ultimo_mes_pct} />
              {data.crescimento_ultimo_mes_pct !== null && (
                <p className="text-xs text-muted-foreground">
                  {fmt(data.crescimento_ultimo_mes_pct)}% vs mês anterior
                </p>
              )}
            </div>
            <div className="bg-muted/30 rounded-lg p-3 space-y-1">
              <p className="text-xs text-muted-foreground">Tendência</p>
              {sinalCrescimento(data.crescimento_medio_mensal_pct) === "up" ? (
                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-0 gap-1">
                  <TrendingUp className="h-3 w-3" /> Crescendo
                </Badge>
              ) : sinalCrescimento(data.crescimento_medio_mensal_pct) === "down" ? (
                <Badge className="bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 border-0 gap-1">
                  <TrendingDown className="h-3 w-3" /> Declinando
                </Badge>
              ) : (
                <Badge className="bg-muted text-muted-foreground border-0 gap-1">
                  <Minus className="h-3 w-3" /> Estável
                </Badge>
              )}
              <p className="text-xs text-muted-foreground">baseada nos últimos 12 meses</p>
            </div>
          </div>
        ) : null}

        {/* Gráfico de evolução histórica */}
        <div>
          <p className="text-sm font-medium mb-2 text-muted-foreground">Evolução de assinantes ativos</p>
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradAtivos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload as Snapshot;
                      return (
                        <div className="bg-background border rounded-lg px-3 py-2 text-xs shadow-md space-y-1">
                          <p className="font-semibold">{label}</p>
                          <p>Ativos: <strong>{d.ativos}</strong></p>
                          <p>Novos: <strong className="text-emerald-600">+{d.novos}</strong></p>
                          <p>Cancelados: <strong className="text-red-500">-{d.cancelados}</strong></p>
                          {d.crescimento_pct !== null && (
                            <p>Crescimento: <strong className={d.crescimento_pct >= 0 ? "text-emerald-600" : "text-red-500"}>
                              {d.crescimento_pct >= 0 ? "+" : ""}{fmt(d.crescimento_pct)}%
                            </strong></p>
                          )}
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="ativos"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#gradAtivos)"
                    dot={{ r: 3, fill: "hsl(var(--primary))" }}
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Projeções */}
        <div>
          <p className="text-sm font-medium mb-3 text-muted-foreground">
            Projeção mantendo {data ? fmt(data.crescimento_medio_mensal_pct) : "—"}% de crescimento ao mês
          </p>
          {isLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
          ) : data ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {data.projecoes.map((p) => (
                <div key={p.meses} className="rounded-lg border bg-muted/20 p-3 space-y-1 hover:bg-muted/40 transition-colors">
                  <p className="text-xs text-muted-foreground font-medium">Em {p.label}</p>
                  <p className="text-xl font-bold">{p.assinantes_projetados}</p>
                  <p className="text-xs text-muted-foreground">assinantes projetados</p>
                  <BadgeCrescimento pct={p.crescimento_acumulado_pct} />
                  <p className="text-[10px] text-muted-foreground">vs. hoje</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* Gráfico histórico + projeção */}
        <div>
          <p className="text-sm font-medium mb-2 text-muted-foreground">Histórico recente + projeção futura</p>
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={projecaoChart} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="bg-background border rounded-lg px-3 py-2 text-xs shadow-md space-y-1">
                          <p className="font-semibold">{label}</p>
                          {payload.map((p) => (
                            <p key={String(p.dataKey)}>
                              {p.dataKey === "ativos" ? "Histórico" : "Projeção"}: <strong>{p.value}</strong>
                            </p>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <Line type="monotone" dataKey="ativos" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} name="Histórico" />
                  <Line type="monotone" dataKey="projetado" stroke="#10b981" strokeWidth={2} strokeDasharray="6 3" dot={{ r: 4, fill: "#10b981" }} connectNulls={false} name="Projeção" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground mt-1 text-center">
            Linha contínua = histórico real · Linha tracejada = projeção com taxa média de crescimento
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
