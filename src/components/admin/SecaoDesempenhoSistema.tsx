import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { TrendingUp, TrendingDown, Minus, BarChart3, Users, CreditCard, Info, UserPlus, ArrowRight } from "lucide-react";
import type { AdminFinanceiroData } from "@/hooks/useAdminFinanceiro";

type HistoricoCrescimento = NonNullable<AdminFinanceiroData["historico_crescimento"]>;
type MetricaBloco = HistoricoCrescimento["cadastros"] | HistoricoCrescimento["pagantes"];

function fmt(n: number, casas = 1) {
  return n.toFixed(casas).replace(".", ",");
}

function BadgeCrescimento({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-muted-foreground text-sm">—</span>;
  if (pct > 0.5)
    return (
      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 font-semibold gap-1 border-0 text-sm">
        <TrendingUp className="h-3 w-3" />+{fmt(pct)}%
      </Badge>
    );
  if (pct < -0.5)
    return (
      <Badge className="bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 font-semibold gap-1 border-0 text-sm">
        <TrendingDown className="h-3 w-3" />{fmt(pct)}%
      </Badge>
    );
  return (
    <Badge className="bg-muted text-muted-foreground font-semibold gap-1 border-0 text-sm">
      <Minus className="h-3 w-3" />{fmt(pct)}%
    </Badge>
  );
}

function TendenciaBadge({ pct }: { pct: number }) {
  if (pct > 0.5)
    return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-0 gap-1"><TrendingUp className="h-3 w-3" /> Crescendo</Badge>;
  if (pct < -0.5)
    return <Badge className="bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 border-0 gap-1"><TrendingDown className="h-3 w-3" /> Declinando</Badge>;
  return <Badge className="bg-muted text-muted-foreground border-0 gap-1"><Minus className="h-3 w-3" /> Estável</Badge>;
}

function KpiGrid({ metrica, isLoading, tipo }: { metrica: MetricaBloco | undefined; isLoading: boolean; tipo: "cadastros" | "pagantes" }) {
  if (isLoading) return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
      {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
    </div>
  );
  if (!metrica) return null;
  const mediaNovos = (metrica as any).media_novos_por_mes ?? 0;
  const labelTotal = tipo === "cadastros" ? "usuários cadastrados no total" : "assinantes com plano pago ativo agora";
  const labelMedio = tipo === "cadastros"
    ? "Média de novos cadastros por mês (meses completos, excluindo migração)"
    : "Média de novos pagantes por mês (meses completos, excluindo migração)";
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
      <div className="bg-muted/30 rounded-lg p-3 space-y-1">
        <p className="text-xs text-muted-foreground">Total atual</p>
        <p className="text-2xl font-bold">{metrica.total_atual.toLocaleString("pt-BR")}</p>
        <p className="text-[10px] text-muted-foreground">{labelTotal}</p>
      </div>
      <div className="bg-muted/30 rounded-lg p-3 space-y-1">
        <p className="text-xs text-muted-foreground">Média de novos/mês</p>
        <p className="text-2xl font-bold">{mediaNovos.toLocaleString("pt-BR")}</p>
        <p className="text-[10px] text-muted-foreground">{labelMedio}</p>
      </div>
      <div className="bg-muted/30 rounded-lg p-3 space-y-1">
        <p className="text-xs text-muted-foreground">Crescimento último mês</p>
        <BadgeCrescimento pct={metrica.crescimento_ultimo_mes_pct} />
        <p className="text-[10px] text-muted-foreground">Variação % de {tipo} ativos vs mês anterior</p>
      </div>
    </div>
  );
}

function ProjecoesGrid({ metrica, isLoading, tipo }: { metrica: MetricaBloco | undefined; isLoading: boolean; tipo: "cadastros" | "pagantes" }) {
  if (isLoading) return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
    </div>
  );
  if (!metrica) return null;
  const labelTipo = tipo === "cadastros" ? "cadastros" : "pagantes";
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-lg bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 px-3 py-2.5">
        <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
          <strong>Como funciona a projeção:</strong> com base na média de <strong>{metrica.media_novos_por_mes} novos {labelTipo}/mês</strong> (meses completos reais, excluindo meses de migração de dados),
          estimamos quantos {labelTipo} você terá somando esse ritmo ao total atual de <strong>{metrica.total_atual.toLocaleString("pt-BR")}</strong>.
          <span className="text-amber-700 dark:text-amber-400"> É uma estimativa linear — o número real pode variar.</span>
        </p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {metrica.projecoes.map((p) => (
          <div key={p.meses} className="rounded-lg border bg-muted/20 p-3 space-y-1.5 hover:bg-muted/40 transition-colors">
            <p className="text-xs text-muted-foreground font-medium">Em {p.label}</p>
            <p className="text-2xl font-bold">{p.projetado.toLocaleString("pt-BR")}</p>
            <p className="text-[10px] text-muted-foreground">{labelTipo} projetados</p>
            <p className="text-[10px] text-emerald-600 font-medium">+{((p as any).novos_esperados ?? 0).toLocaleString("pt-BR")} novos</p>
          </div>
        ))}
      </div>
    </div>
  );
}

type CrescimentoAbsoluto = HistoricoCrescimento["crescimento_absoluto"];

function CrescimentoAbsolutoSection({ ca, isLoading, tipo }: {
  ca: CrescimentoAbsoluto | undefined;
  isLoading: boolean;
  tipo: "cadastros" | "pagantes";
}) {
  if (isLoading) return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
    </div>
  );
  if (!ca) return null;

  const campo = tipo === "cadastros" ? "novos_cadastros" : "novos_pagantes";
  const mediacampo = tipo === "cadastros" ? "media_mensal_cadastros" : "media_mensal_pagantes";
  const label = tipo === "cadastros" ? "cadastros" : "pagantes";

  const mesAtual = ca.mes_atual[campo];
  const mesPassado = ca.mes_passado[campo];
  const total3m = ca.ultimos_3_meses[campo as "novos_cadastros" | "novos_pagantes"];
  const media3m = ca.ultimos_3_meses[mediacampo as "media_mensal_cadastros" | "media_mensal_pagantes"];
  const previsao = ca.previsao_proximo_mes[tipo === "cadastros" ? "cadastros" : "pagantes"];

  const diff = mesPassado !== null ? mesAtual - mesPassado : null;

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-muted-foreground">Crescimento em números</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-muted/30 rounded-lg p-3 space-y-1">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <UserPlus className="h-3 w-3" /> Mês atual ({ca.mes_atual.label})
          </p>
          <p className="text-2xl font-bold">{mesAtual}</p>
          <p className="text-[10px] text-muted-foreground">novos {label}</p>
          {diff !== null && (
            <p className={`text-[10px] font-medium ${diff >= 0 ? "text-emerald-600" : "text-red-500"}`}>
              {diff >= 0 ? "+" : ""}{diff} vs mês passado
            </p>
          )}
        </div>
        <div className="bg-muted/30 rounded-lg p-3 space-y-1">
          <p className="text-xs text-muted-foreground">Mês passado ({ca.mes_passado.label})</p>
          <p className="text-2xl font-bold">{mesPassado ?? "—"}</p>
          <p className="text-[10px] text-muted-foreground">novos {label}</p>
        </div>
        <div className="bg-muted/30 rounded-lg p-3 space-y-1">
          <p className="text-xs text-muted-foreground">Últimos 3 meses</p>
          <p className="text-2xl font-bold">{total3m}</p>
          <p className="text-[10px] text-muted-foreground">novos {label} no total</p>
          <p className="text-[10px] text-muted-foreground">~{media3m}/mês de média</p>
        </div>
        <div className="bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/40 rounded-lg p-3 space-y-1">
          <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center gap-1">
            <ArrowRight className="h-3 w-3" /> Previsão próx. mês
          </p>
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{previsao}</p>
          <p className="text-[10px] text-blue-600 dark:text-blue-400">novos {label} esperados</p>
          <p className="text-[10px] text-blue-500 dark:text-blue-500">baseado na média dos últimos 3 meses</p>
        </div>
      </div>
    </div>
  );
}

interface Props {
  data: HistoricoCrescimento | null | undefined;
  isLoading: boolean;
}

export function SecaoDesempenhoSistema({ data, isLoading }: Props) {
  const [aba, setAba] = useState<"cadastros" | "pagantes">("cadastros");

  const chartCadastros = data?.snapshots.map((s) => ({
    mes: s.mes,
    "Cadastros acumulados": s.cadastros_acumulados,
    "Novos no mês": s.novos_cadastros,
    "Crescimento %": s.crescimento_cadastros_pct,
  })) ?? [];

  const chartPagantes = data?.snapshots.map((s) => ({
    mes: s.mes,
    "Pagantes ativos": s.pagantes_ativos,
    "Novos pagantes": s.novos_pagantes,
    "Crescimento %": s.crescimento_pagantes_pct,
  })) ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-5 w-5 text-primary" />
          Desempenho do Sistema
        </CardTitle>
        <CardDescription>
          Crescimento de cadastros e assinantes pagantes — histórico mensal + projeção de tendência
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs value={aba} onValueChange={(v) => setAba(v as typeof aba)}>
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="cadastros" className="gap-2">
              <Users className="h-4 w-4" /> Cadastros
            </TabsTrigger>
            <TabsTrigger value="pagantes" className="gap-2">
              <CreditCard className="h-4 w-4" /> Pagantes
            </TabsTrigger>
          </TabsList>

          {/* ── ABA CADASTROS ── */}
          <TabsContent value="cadastros" className="space-y-6 mt-4">
            <KpiGrid metrica={data?.cadastros} isLoading={isLoading} tipo="cadastros" />
            <CrescimentoAbsolutoSection ca={data?.crescimento_absoluto} isLoading={isLoading} tipo="cadastros" />

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-muted-foreground">Evolução de cadastros</p>
              </div>
              <div className="flex items-start gap-2 rounded-lg bg-muted/30 px-3 py-2 mb-3">
                <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <strong>Barras (azul):</strong> quantos usuários novos se cadastraram naquele mês. &nbsp;
                  <strong>Linha verde:</strong> total acumulado de cadastros até o fim do mês. &nbsp;
                  <strong>Linha amarela (eixo direito):</strong> o % de crescimento do total naquele mês vs o mês anterior.
                </p>
              </div>
              {isLoading ? <Skeleton className="h-52 w-full" /> : (
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartCadastros} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 11 }} allowDecimals={false} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} unit="%" tickFormatter={(v) => fmt(v, 0)} />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          return (
                            <div className="bg-background border rounded-lg px-3 py-2 text-xs shadow-md space-y-1">
                              <p className="font-semibold">{label}</p>
                              {payload.map((p) => (
                                <p key={String(p.dataKey)}>
                                  {p.name}:{" "}
                                  <strong>{p.dataKey === "Crescimento %" ? `${fmt(Number(p.value ?? 0))}%` : p.value}</strong>
                                </p>
                              ))}
                            </div>
                          );
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar yAxisId="left" dataKey="Novos no mês" fill="hsl(var(--primary))" opacity={0.7} radius={[2,2,0,0]} />
                      <Line yAxisId="left" type="monotone" dataKey="Cadastros acumulados" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                      <Line yAxisId="right" type="monotone" dataKey="Crescimento %" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div>
              <p className="text-sm font-medium mb-3 text-muted-foreground">Projeção de cadastros</p>
              <ProjecoesGrid metrica={data?.cadastros} isLoading={isLoading} tipo="cadastros" />
            </div>
          </TabsContent>

          {/* ── ABA PAGANTES ── */}
          <TabsContent value="pagantes" className="space-y-6 mt-4">
            <KpiGrid metrica={data?.pagantes} isLoading={isLoading} tipo="pagantes" />
            <CrescimentoAbsolutoSection ca={data?.crescimento_absoluto} isLoading={isLoading} tipo="pagantes" />

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-muted-foreground">Evolução de assinantes pagantes</p>
              </div>
              <div className="flex items-start gap-2 rounded-lg bg-muted/30 px-3 py-2 mb-3">
                <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <strong>Barras (azul):</strong> novos assinantes que ativaram um plano pago naquele mês pela primeira vez. &nbsp;
                  <strong>Linha verde:</strong> total de assinantes com plano pago ativo no fim do mês. &nbsp;
                  <strong>Linha amarela (eixo direito):</strong> o % de crescimento do total de pagantes naquele mês vs o mês anterior.
                </p>
              </div>
              {isLoading ? <Skeleton className="h-52 w-full" /> : (
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartPagantes} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 11 }} allowDecimals={false} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} unit="%" tickFormatter={(v) => fmt(v, 0)} />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          return (
                            <div className="bg-background border rounded-lg px-3 py-2 text-xs shadow-md space-y-1">
                              <p className="font-semibold">{label}</p>
                              {payload.map((p) => (
                                <p key={String(p.dataKey)}>
                                  {p.name}:{" "}
                                  <strong>{p.dataKey === "Crescimento %" ? `${fmt(Number(p.value ?? 0))}%` : p.value}</strong>
                                </p>
                              ))}
                            </div>
                          );
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar yAxisId="left" dataKey="Novos pagantes" fill="hsl(var(--primary))" opacity={0.7} radius={[2,2,0,0]} />
                      <Line yAxisId="left" type="monotone" dataKey="Pagantes ativos" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                      <Line yAxisId="right" type="monotone" dataKey="Crescimento %" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div>
              <p className="text-sm font-medium mb-3 text-muted-foreground">Projeção de pagantes</p>
              <ProjecoesGrid metrica={data?.pagantes} isLoading={isLoading} tipo="pagantes" />
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
