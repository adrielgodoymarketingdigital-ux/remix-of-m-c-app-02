import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Users, CreditCard, Star, Megaphone } from "lucide-react";

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

type Periodo = "3m" | "6m" | "12m" | "all";

const PLANOS_PAGOS: string[] = [
  "basico_mensal", "intermediario_mensal", "profissional_mensal",
  "basico_anual", "intermediario_anual", "profissional_anual",
  "profissional_ultra_mensal", "profissional_ultra_anual",
];

interface DiaStat {
  chave: number;
  label: string;
  cadastros: number;
  assinaturas: number;
  total: number;
}

function BarChart({
  dados,
  campo,
  cor,
  melhorChave,
}: {
  dados: DiaStat[];
  campo: "cadastros" | "assinaturas";
  cor: string;
  melhorChave: number;
}) {
  const max = Math.max(...dados.map((d) => d[campo]), 1);
  const isDiaMes = dados.length === 31;

  return (
    <div className={`flex items-end gap-0.5 h-28 ${isDiaMes ? "overflow-x-auto pb-1" : ""}`}>
      {dados.map((d) => {
        const pct = (d[campo] / max) * 100;
        const isMelhor = d.chave === melhorChave;
        const corBarra = isMelhor
          ? cor === "blue" ? "bg-blue-500" : "bg-emerald-500"
          : cor === "blue" ? "bg-blue-200 dark:bg-blue-800" : "bg-emerald-200 dark:bg-emerald-800";
        return (
          <div
            key={d.chave}
            className={`flex flex-col items-center gap-0.5 ${isDiaMes ? "min-w-[22px]" : "flex-1"}`}
          >
            <span className="text-[8px] text-muted-foreground leading-none">
              {d[campo] > 0 ? d[campo] : ""}
            </span>
            <div
              className={`w-full rounded-t-sm transition-all duration-500 ${corBarra}`}
              style={{ height: `${Math.max(pct, 3)}%` }}
              title={`${d.label}: ${d[campo]}`}
            />
            <span className={`text-[8px] leading-none ${isMelhor ? "font-bold text-foreground" : "text-muted-foreground"}`}>
              {d.label}
            </span>
            {isMelhor && <Star className="h-2 w-2 text-yellow-500 fill-yellow-400" />}
          </div>
        );
      })}
    </div>
  );
}

export function MelhoresDiasMes() {
  const [periodo, setPeriodo] = useState<Periodo>("6m");
  const [statsSemana, setStatsSemana] = useState<DiaStat[]>([]);
  const [statsMes, setStatsMes] = useState<DiaStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarDados();
  }, [periodo]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const meses = periodo === "all" ? null : parseInt(periodo);
      const dataLimite = meses
        ? new Date(Date.now() - meses * 30 * 24 * 60 * 60 * 1000).toISOString()
        : null;

      // Buscar cadastros
      let queryCad = supabase.from("profiles").select("created_at");
      if (dataLimite) queryCad = queryCad.gte("created_at", dataLimite);
      const { data: cadastros } = await queryCad;

      // Buscar assinaturas pagas
      let queryAsn = supabase
        .from("assinaturas")
        .select("created_at")
        .in("plano_tipo", PLANOS_PAGOS as any)
        .eq("status", "active");
      if (dataLimite) queryAsn = queryAsn.gte("created_at", dataLimite);
      const { data: assinaturas } = await queryAsn;

      const semCad: Record<number, number> = {};
      const semAsn: Record<number, number> = {};
      const mesCad: Record<number, number> = {};
      const mesAsn: Record<number, number> = {};

      (cadastros ?? []).forEach(({ created_at }) => {
        if (!created_at) return;
        const d = new Date(created_at);
        const ds = d.getDay();
        const dm = d.getDate();
        semCad[ds] = (semCad[ds] ?? 0) + 1;
        mesCad[dm] = (mesCad[dm] ?? 0) + 1;
      });

      (assinaturas ?? []).forEach(({ created_at }) => {
        if (!created_at) return;
        const d = new Date(created_at);
        const ds = d.getDay();
        const dm = d.getDate();
        semAsn[ds] = (semAsn[ds] ?? 0) + 1;
        mesAsn[dm] = (mesAsn[dm] ?? 0) + 1;
      });

      setStatsSemana(
        Array.from({ length: 7 }, (_, i) => ({
          chave: i,
          label: DIAS_SEMANA[i],
          cadastros: semCad[i] ?? 0,
          assinaturas: semAsn[i] ?? 0,
          total: (semCad[i] ?? 0) + (semAsn[i] ?? 0),
        }))
      );

      setStatsMes(
        Array.from({ length: 31 }, (_, i) => ({
          chave: i + 1,
          label: String(i + 1),
          cadastros: mesCad[i + 1] ?? 0,
          assinaturas: mesAsn[i + 1] ?? 0,
          total: (mesCad[i + 1] ?? 0) + (mesAsn[i + 1] ?? 0),
        }))
      );
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  const melhorSemCad = statsSemana.reduce((m, d) => d.cadastros > m.cadastros ? d : m, statsSemana[0]);
  const melhorSemAsn = statsSemana.reduce((m, d) => d.assinaturas > m.assinaturas ? d : m, statsSemana[0]);
  const melhorMesCad = statsMes.reduce((m, d) => d.cadastros > m.cadastros ? d : m, statsMes[0]);
  const melhorMesAsn = statsMes.reduce((m, d) => d.assinaturas > m.assinaturas ? d : m, statsMes[0]);

  const top3Semana = [...statsSemana].sort((a, b) => b.total - a.total).slice(0, 3);
  const top3Mes = [...statsMes].sort((a, b) => b.total - a.total).slice(0, 3);

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center">
            <Megaphone className="h-4 w-4 text-orange-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Melhores Dias para Anunciar</h3>
            <p className="text-sm text-muted-foreground">
              Quando seus usuários mais se cadastram e assinam — rode anúncios nesses dias
            </p>
          </div>
        </div>
        <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
          <SelectTrigger className="w-[160px]">
            <Calendar className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3m">Últimos 3 meses</SelectItem>
            <SelectItem value="6m">Últimos 6 meses</SelectItem>
            <SelectItem value="12m">Último ano</SelectItem>
            <SelectItem value="all">Todo o período</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Resumo rápido — 4 pills de destaque */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-blue-50/60 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <CardContent className="p-3 flex items-center gap-3">
            <Users className="h-5 w-5 text-blue-500 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground leading-tight">Mais cadastros na semana</p>
              <p className="text-base font-bold text-blue-600">{melhorSemCad?.label}</p>
              <p className="text-[10px] text-muted-foreground">{melhorSemCad?.cadastros} usuários</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800">
          <CardContent className="p-3 flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-emerald-500 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground leading-tight">Mais assinaturas na semana</p>
              <p className="text-base font-bold text-emerald-600">{melhorSemAsn?.label}</p>
              <p className="text-[10px] text-muted-foreground">{melhorSemAsn?.assinaturas} assinaturas</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-50/60 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <CardContent className="p-3 flex items-center gap-3">
            <Users className="h-5 w-5 text-blue-500 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground leading-tight">Mais cadastros no mês</p>
              <p className="text-base font-bold text-blue-600">Dia {melhorMesCad?.label}</p>
              <p className="text-[10px] text-muted-foreground">{melhorMesCad?.cadastros} usuários</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800">
          <CardContent className="p-3 flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-emerald-500 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground leading-tight">Mais assinaturas no mês</p>
              <p className="text-base font-bold text-emerald-600">Dia {melhorMesAsn?.label}</p>
              <p className="text-[10px] text-muted-foreground">{melhorMesAsn?.assinaturas} assinaturas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── DIA DA SEMANA ─── */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <span className="h-px flex-1 bg-border" />
          Por Dia da Semana
          <span className="h-px flex-1 bg-border" />
        </h4>

        {/* Top 3 semana */}
        <div className="grid grid-cols-3 gap-2">
          {top3Semana.map((d, i) => (
            <Card key={d.chave} className={i === 0 ? "border-yellow-400 dark:border-yellow-600" : ""}>
              <CardContent className="p-3 text-center">
                <div className="text-lg">{i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}</div>
                <div className="font-bold text-sm">{d.label}</div>
                <div className="text-[10px] text-blue-600">{d.cadastros} cad.</div>
                <div className="text-[10px] text-emerald-600">{d.assinaturas} asin.</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-500" />
                Cadastros por Dia da Semana
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <BarChart dados={statsSemana} campo="cadastros" cor="blue" melhorChave={melhorSemCad?.chave} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-emerald-500" />
                Assinaturas por Dia da Semana
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <BarChart dados={statsSemana} campo="assinaturas" cor="emerald" melhorChave={melhorSemAsn?.chave} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ─── DIA DO MÊS ─── */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <span className="h-px flex-1 bg-border" />
          Por Dia do Mês
          <span className="h-px flex-1 bg-border" />
        </h4>

        {/* Top 5 dias do mês */}
        <div className="grid grid-cols-5 gap-2">
          {[...statsMes].sort((a, b) => b.total - a.total).slice(0, 5).map((d, i) => (
            <Card key={d.chave} className={i === 0 ? "border-yellow-400 dark:border-yellow-600" : ""}>
              <CardContent className="p-2 text-center">
                <div className="text-base">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i+1}º`}</div>
                <div className="font-bold text-sm">Dia {d.label}</div>
                <div className="text-[10px] text-blue-600">{d.cadastros} cad.</div>
                <div className="text-[10px] text-emerald-600">{d.assinaturas} asin.</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3">
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-500" />
                Cadastros por Dia do Mês
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <BarChart dados={statsMes} campo="cadastros" cor="blue" melhorChave={melhorMesCad?.chave} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-emerald-500" />
                Assinaturas por Dia do Mês
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <BarChart dados={statsMes} campo="assinaturas" cor="emerald" melhorChave={melhorMesAsn?.chave} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tabela completa dia do mês */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Ranking completo — Dia do Mês</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground text-xs">
                  <th className="text-left py-1.5 font-medium">Dia</th>
                  <th className="text-right py-1.5 font-medium text-blue-600">Cadastros</th>
                  <th className="text-right py-1.5 font-medium text-emerald-600">Assinaturas</th>
                  <th className="text-right py-1.5 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {[...statsMes]
                  .sort((a, b) => b.total - a.total)
                  .filter((d) => d.total > 0)
                  .map((d, i) => (
                    <tr key={d.chave} className="border-b last:border-0">
                      <td className="py-1 flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground w-4">
                          {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}
                        </span>
                        <span className="font-medium">Dia {d.label}</span>
                      </td>
                      <td className="text-right py-1 text-blue-600 font-medium">{d.cadastros}</td>
                      <td className="text-right py-1 text-emerald-600 font-medium">{d.assinaturas}</td>
                      <td className="text-right py-1 font-bold">{d.total}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
