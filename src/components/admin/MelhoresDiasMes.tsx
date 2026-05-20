import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Users, CreditCard, Star, Megaphone, TrendingUp, TrendingDown, Minus } from "lucide-react";

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
  score: number; // 0–100, combinado ponderado
}

// Score combinado: assinatura vale 3x mais que cadastro (intenção de compra maior)
function calcularScore(cadastros: number, assinaturas: number, maxCad: number, maxAsn: number): number {
  const normCad = maxCad > 0 ? (cadastros / maxCad) * 100 : 0;
  const normAsn = maxAsn > 0 ? (assinaturas / maxAsn) * 100 : 0;
  return Math.round((normCad * 1 + normAsn * 3) / 4);
}

type NivelVerba = "alta" | "normal" | "baixa";

function getNivelVerba(score: number, maxScore: number): NivelVerba {
  const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;
  if (pct >= 70) return "alta";
  if (pct >= 35) return "normal";
  return "baixa";
}

const VERBA_CONFIG: Record<NivelVerba, { label: string; cor: string; bg: string; border: string; icon: typeof TrendingUp }> = {
  alta:   { label: "Verba ALTA",   cor: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-400 dark:border-emerald-600", icon: TrendingUp   },
  normal: { label: "Verba Normal", cor: "text-amber-700 dark:text-amber-400",    bg: "bg-amber-50 dark:bg-amber-950/30",     border: "border-amber-400 dark:border-amber-600",     icon: Minus        },
  baixa:  { label: "Verba baixa",  cor: "text-slate-500 dark:text-slate-400",    bg: "bg-slate-50 dark:bg-slate-900/20",     border: "border-slate-300 dark:border-slate-700",     icon: TrendingDown },
};

function BarChart({
  dados,
  campo,
  cor,
  melhorChave,
}: {
  dados: DiaStat[];
  campo: "cadastros" | "assinaturas";
  cor: "blue" | "emerald";
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
  const [periodo, setPeriodo] = useState<Periodo>("all");
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

      let queryCad = supabase.from("profiles").select("created_at");
      if (dataLimite) queryCad = queryCad.gte("created_at", dataLimite);
      const { data: cadastros } = await queryCad;

      let queryAsn = supabase
        .from("assinaturas")
        .select("created_at")
        .in("plano_tipo", PLANOS_PAGOS)
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
        semCad[d.getDay()] = (semCad[d.getDay()] ?? 0) + 1;
        mesCad[d.getDate()] = (mesCad[d.getDate()] ?? 0) + 1;
      });

      (assinaturas ?? []).forEach(({ created_at }) => {
        if (!created_at) return;
        const d = new Date(created_at);
        semAsn[d.getDay()] = (semAsn[d.getDay()] ?? 0) + 1;
        mesAsn[d.getDate()] = (mesAsn[d.getDate()] ?? 0) + 1;
      });

      const maxSemCad = Math.max(...Object.values(semCad), 1);
      const maxSemAsn = Math.max(...Object.values(semAsn), 1);
      const maxMesCad = Math.max(...Object.values(mesCad), 1);
      const maxMesAsn = Math.max(...Object.values(mesAsn), 1);

      const semana: DiaStat[] = Array.from({ length: 7 }, (_, i) => {
        const cad = semCad[i] ?? 0;
        const asn = semAsn[i] ?? 0;
        return {
          chave: i,
          label: DIAS_SEMANA[i],
          cadastros: cad,
          assinaturas: asn,
          total: cad + asn,
          score: calcularScore(cad, asn, maxSemCad, maxSemAsn),
        };
      });

      const mes: DiaStat[] = Array.from({ length: 31 }, (_, i) => {
        const cad = mesCad[i + 1] ?? 0;
        const asn = mesAsn[i + 1] ?? 0;
        return {
          chave: i + 1,
          label: String(i + 1),
          cadastros: cad,
          assinaturas: asn,
          total: cad + asn,
          score: calcularScore(cad, asn, maxMesCad, maxMesAsn),
        };
      });

      setStatsSemana(semana);
      setStatsMes(mes);
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

  const melhorSemCad   = statsSemana.reduce((m, d) => d.cadastros   > m.cadastros   ? d : m, statsSemana[0]);
  const melhorSemAsn   = statsSemana.reduce((m, d) => d.assinaturas > m.assinaturas ? d : m, statsSemana[0]);
  const melhorMesCad   = statsMes.reduce((m, d) => d.cadastros   > m.cadastros   ? d : m, statsMes[0]);
  const melhorMesAsn   = statsMes.reduce((m, d) => d.assinaturas > m.assinaturas ? d : m, statsMes[0]);

  const maxScoreSem = Math.max(...statsSemana.map(d => d.score), 1);
  const maxScoreMes = Math.max(...statsMes.map(d => d.score), 1);

  const semanaComNivel = statsSemana.map(d => ({
    ...d,
    nivel: getNivelVerba(d.score, maxScoreSem),
  }));

  const top5Mes = [...statsMes].sort((a, b) => b.score - a.score).slice(0, 5);

  // Dias de verba ALTA na semana
  const diasVerbaAlta = semanaComNivel.filter(d => d.nivel === "alta");
  const diasVerbaNormal = semanaComNivel.filter(d => d.nivel === "normal");

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
              Score combinado de cadastros + assinaturas — aumente a verba nos dias verdes
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
            <SelectItem value="all">Todo o período ★</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ══════════════════════════════════════════
          CARD DE RECOMENDAÇÃO — DIA DA SEMANA
      ══════════════════════════════════════════ */}
      <Card className="border-orange-300 dark:border-orange-700 bg-gradient-to-br from-orange-50/80 to-amber-50/50 dark:from-orange-950/30 dark:to-amber-950/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-orange-600" />
            Recomendação de Verba — Dias da Semana
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Score = cadastros (peso 1×) + assinaturas (peso 3×) — assinatura vale mais porque indica intenção de compra
          </p>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Grid dos 7 dias com badge de verba */}
          <div className="grid grid-cols-7 gap-1.5">
            {semanaComNivel.map((d) => {
              const cfg = VERBA_CONFIG[d.nivel];
              const Icon = cfg.icon;
              return (
                <div
                  key={d.chave}
                  className={`rounded-xl border-2 p-2 flex flex-col items-center gap-1 transition-all ${cfg.bg} ${cfg.border}`}
                >
                  <span className="text-xs font-bold">{d.label}</span>
                  <span className="text-lg font-black leading-none">{d.score}</span>
                  <Icon className={`h-3 w-3 ${cfg.cor}`} />
                  <span className={`text-[9px] font-semibold text-center leading-tight ${cfg.cor}`}>
                    {d.nivel === "alta" ? "ALTA" : d.nivel === "normal" ? "Normal" : "baixa"}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Resumo textual */}
          <div className="rounded-lg bg-white/70 dark:bg-black/20 border border-orange-200 dark:border-orange-800 p-4 space-y-2">
            {diasVerbaAlta.length > 0 && (
              <div className="flex items-start gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm">
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">Aumente a verba em:</span>{" "}
                  <span className="font-bold">{diasVerbaAlta.map(d => d.label).join(", ")}</span>
                  {" "}— são os dias com mais conversões no histórico.
                </p>
              </div>
            )}
            {diasVerbaNormal.length > 0 && (
              <div className="flex items-start gap-2">
                <Minus className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm">
                  <span className="font-semibold text-amber-700 dark:text-amber-400">Mantenha verba normal em:</span>{" "}
                  <span className="font-bold">{diasVerbaNormal.map(d => d.label).join(", ")}</span>.
                </p>
              </div>
            )}
            <div className="flex items-start gap-2">
              <TrendingDown className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold">Reduza ou pause em:</span>{" "}
                {semanaComNivel.filter(d => d.nivel === "baixa").map(d => d.label).join(", ") || "nenhum"}.
              </p>
            </div>
          </div>

          {/* Tabela de detalhes da semana */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-1.5 font-medium">Dia</th>
                  <th className="text-right py-1.5 font-medium text-blue-600">Cadastros</th>
                  <th className="text-right py-1.5 font-medium text-emerald-600">Assinaturas</th>
                  <th className="text-right py-1.5 font-medium">Score</th>
                  <th className="text-right py-1.5 font-medium">Verba</th>
                </tr>
              </thead>
              <tbody>
                {[...semanaComNivel].sort((a, b) => b.score - a.score).map((d, i) => {
                  const cfg = VERBA_CONFIG[d.nivel];
                  return (
                    <tr key={d.chave} className="border-b last:border-0">
                      <td className="py-1.5 font-medium flex items-center gap-1">
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : <span className="w-4 text-center text-muted-foreground">{i + 1}.</span>}
                        {d.label}
                      </td>
                      <td className="text-right py-1.5 text-blue-600 font-medium">{d.cadastros}</td>
                      <td className="text-right py-1.5 text-emerald-600 font-medium">{d.assinaturas}</td>
                      <td className="text-right py-1.5 font-bold">{d.score}</td>
                      <td className="text-right py-1.5">
                        <Badge variant="outline" className={`text-[10px] ${cfg.cor} ${cfg.border}`}>
                          {cfg.label}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ══════════════════════════════════════════
          CARD DE RECOMENDAÇÃO — DIA DO MÊS
      ══════════════════════════════════════════ */}
      <Card className="border-violet-300 dark:border-violet-700 bg-gradient-to-br from-violet-50/80 to-purple-50/50 dark:from-violet-950/30 dark:to-purple-950/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-violet-600" />
            Recomendação de Verba — Dia do Mês
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Top 5 melhores dias do mês para aumentar o investimento em anúncios
          </p>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Top 5 dias do mês */}
          <div className="grid grid-cols-5 gap-2">
            {top5Mes.map((d, i) => {
              const nivel = getNivelVerba(d.score, maxScoreMes);
              const cfg = VERBA_CONFIG[nivel];
              const Icon = cfg.icon;
              return (
                <div
                  key={d.chave}
                  className={`rounded-xl border-2 p-3 flex flex-col items-center gap-1 ${cfg.bg} ${cfg.border}`}
                >
                  <span className="text-base">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}º`}</span>
                  <span className="text-xl font-black leading-none">Dia</span>
                  <span className="text-2xl font-black leading-none">{d.label}</span>
                  <Icon className={`h-3 w-3 ${cfg.cor}`} />
                  <div className="text-center">
                    <div className="text-[9px] text-blue-600">{d.cadastros} cad.</div>
                    <div className="text-[9px] text-emerald-600">{d.assinaturas} asin.</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Texto de recomendação */}
          <div className="rounded-lg bg-white/70 dark:bg-black/20 border border-violet-200 dark:border-violet-800 p-4">
            <div className="flex items-start gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm">
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">Aumente a verba nos dias:</span>{" "}
                <span className="font-bold text-lg">{top5Mes.map(d => d.label).join(", ")}</span>
                {" "}do mês — histórico mostra pico de conversão nesses dias.
              </p>
            </div>
          </div>

          {/* Tabela ranking completo */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-1.5 font-medium">Dia</th>
                  <th className="text-right py-1.5 font-medium text-blue-600">Cadastros</th>
                  <th className="text-right py-1.5 font-medium text-emerald-600">Assinaturas</th>
                  <th className="text-right py-1.5 font-medium">Score</th>
                  <th className="text-right py-1.5 font-medium">Verba</th>
                </tr>
              </thead>
              <tbody>
                {[...statsMes]
                  .sort((a, b) => b.score - a.score)
                  .filter(d => d.total > 0)
                  .map((d, i) => {
                    const nivel = getNivelVerba(d.score, maxScoreMes);
                    const cfg = VERBA_CONFIG[nivel];
                    return (
                      <tr key={d.chave} className="border-b last:border-0">
                        <td className="py-1.5 font-medium">
                          <span className="mr-1">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}</span>
                          Dia {d.label}
                        </td>
                        <td className="text-right py-1.5 text-blue-600 font-medium">{d.cadastros}</td>
                        <td className="text-right py-1.5 text-emerald-600 font-medium">{d.assinaturas}</td>
                        <td className="text-right py-1.5 font-bold">{d.score}</td>
                        <td className="text-right py-1.5">
                          <Badge variant="outline" className={`text-[10px] ${cfg.cor} ${cfg.border}`}>
                            {cfg.label}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ══════════════════════════════════════════
          GRÁFICOS DETALHADOS
      ══════════════════════════════════════════ */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <span className="h-px flex-1 bg-border" />
          Gráficos detalhados por dia da semana
          <span className="h-px flex-1 bg-border" />
        </h4>
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

      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <span className="h-px flex-1 bg-border" />
          Gráficos detalhados por dia do mês
          <span className="h-px flex-1 bg-border" />
        </h4>
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

    </div>
  );
}
