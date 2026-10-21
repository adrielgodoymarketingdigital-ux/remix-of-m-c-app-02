import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertCircle, Info, Megaphone, RefreshCw, UserPlus, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAdminMarketingCadastros } from "@/hooks/useAdminMarketingCadastros";
import {
  PERIODOS_MARKETING,
  calcularVariacao,
  formatarVariacao,
  percentual,
  type PeriodoMarketing,
  type Variacao,
} from "@/lib/marketing/cadastrosPorDia";

const fmtNumero = (n: number) => n.toLocaleString("pt-BR");
const fmtPct = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
/** "2026-10-21" → "21/10" (sem Date: a string já é o dia de Brasília). */
const fmtDiaCurto = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
const fmtDiaLongo = (dia: string) => `${fmtDiaCurto(dia)}/${dia.slice(0, 4)}`;

function corVariacao(v: Variacao): string {
  if (v.tipo === "percentual" && v.valor < 0) return "text-red-600 dark:text-red-400";
  if (v.tipo === "sem_dados" || (v.tipo === "percentual" && Math.round(v.valor) === 0)) return "text-muted-foreground";
  return "text-emerald-600 dark:text-emerald-400";
}

interface CardResumoProps {
  titulo: string;
  icone: typeof Users;
  valor: number;
  anterior: number;
  detalhe?: string;
  carregando: boolean;
}

function CardResumo({ titulo, icone: Icone, valor, anterior, detalhe, carregando }: CardResumoProps) {
  const variacao = calcularVariacao(valor, anterior);
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">{titulo}</p>
          <Icone className="h-4 w-4 text-muted-foreground shrink-0" />
        </div>
        {carregando ? (
          <Skeleton className="h-8 w-20 mt-2" />
        ) : (
          <>
            <p className="text-2xl font-semibold mt-1" data-testid={`valor-${titulo}`}>{fmtNumero(valor)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              <span className={`font-medium ${corVariacao(variacao)}`}>{formatarVariacao(variacao)}</span>
              {" "}vs. período anterior ({fmtNumero(anterior)})
            </p>
            {detalhe && <p className="text-xs text-muted-foreground mt-0.5">{detalhe}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface PainelCadastrosMarketingProps {
  periodo: PeriodoMarketing;
  onPeriodoChange: (periodo: PeriodoMarketing) => void;
}

export function PainelCadastrosMarketing({ periodo, onPeriodoChange }: PainelCadastrosMarketingProps) {
  const { data, isLoading, isError, refetch, isFetching } = useAdminMarketingCadastros(periodo);
  const totais = data?.totais;
  const anteriores = data?.totaisAnterior;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Cadastros</h2>
          {data && (
            <p className="text-xs text-muted-foreground">
              {fmtDiaLongo(data.atual.inicio)} a {fmtDiaLongo(data.atual.fim)} · comparado com {fmtDiaLongo(data.anterior.inicio)} a {fmtDiaLongo(data.anterior.fim)}
            </p>
          )}
        </div>
        <Select value={periodo} onValueChange={(v) => onPeriodoChange(v as PeriodoMarketing)}>
          <SelectTrigger className="w-full sm:w-[200px]" aria-label="Período"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PERIODOS_MARKETING.map((p) => <SelectItem key={p.valor} value={p.valor}>{p.rotulo}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isError ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">Indicadores indisponíveis no momento</p>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <CardResumo titulo="Cadastros" icone={UserPlus} valor={totais?.cadastros ?? 0} anterior={anteriores?.cadastros ?? 0} carregando={isLoading} />
            <CardResumo
              titulo="Com UTM"
              icone={Users}
              valor={totais?.com_utm ?? 0}
              anterior={anteriores?.com_utm ?? 0}
              detalhe={totais ? `${fmtPct(percentual(totais.com_utm, totais.cadastros))} do total` : undefined}
              carregando={isLoading}
            />
            <CardResumo
              titulo="Vindos da Meta"
              icone={Megaphone}
              valor={totais?.meta ?? 0}
              anterior={anteriores?.meta ?? 0}
              detalhe={totais ? `${fmtPct(percentual(totais.meta, totais.cadastros))} do total` : undefined}
              carregando={isLoading}
            />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Cadastros por dia</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading || !data ? (
                <Skeleton className="h-56 w-full" />
              ) : (
                <div className="h-56" data-testid="grafico-cadastros-dia">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.dias} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                      <XAxis dataKey="dia" tickFormatter={fmtDiaCurto} tick={{ fontSize: 11 }} minTickGap={12} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip
                        cursor={{ className: "fill-muted/40" }}
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0].payload as (typeof data.dias)[number];
                          return (
                            <div className="bg-background border rounded-lg px-3 py-2 text-xs shadow-md space-y-1">
                              <p className="font-semibold">{fmtDiaLongo(d.dia)}</p>
                              <p>Cadastros: <strong>{fmtNumero(d.cadastros)}</strong></p>
                              <p>Com UTM: <strong>{fmtNumero(d.com_utm)}</strong></p>
                              <p>Vindos da Meta: <strong>{fmtNumero(d.meta)}</strong></p>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="cadastros" name="Cadastros" fill="hsl(var(--primary))" opacity={0.8} radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <div className="flex items-start gap-2 rounded-lg bg-muted/30 px-3 py-2">
        <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground">UTM e origem só são gravadas para cadastros a partir de 25/05/2026.</p>
      </div>
    </div>
  );
}
