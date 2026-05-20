import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Users, CreditCard, Megaphone, TrendingUp, TrendingDown, Minus } from "lucide-react";

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
  score: number;
}

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

const VERBA_CONFIG: Record<NivelVerba, {
  label: string;
  cor: string;
  bg: string;
  border: string;
  barCor: string;
  barCorLight: string;
  icon: typeof TrendingUp;
}> = {
  alta:   {
    label: "Verba ALTA",
    cor: "text-emerald-700 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    border: "border-emerald-400 dark:border-emerald-600",
    barCor: "bg-emerald-500",
    barCorLight: "bg-emerald-200 dark:bg-emerald-700",
    icon: TrendingUp,
  },
  normal: {
    label: "Verba Normal",
    cor: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-400 dark:border-amber-600",
    barCor: "bg-amber-400",
    barCorLight: "bg-amber-200 dark:bg-amber-700",
    icon: Minus,
  },
  baixa:  {
    label: "Verba baixa",
    cor: "text-slate-500 dark:text-slate-400",
    bg: "bg-slate-50 dark:bg-slate-900/20",
    border: "border-slate-300 dark:border-slate-700",
    barCor: "bg-slate-400",
    barCorLight: "bg-slate-200 dark:bg-slate-700",
    icon: TrendingDown,
  },
};

// ─── Gráfico de barras com cor por nível de verba ─────────────────────────────
function ScoreBarChart({
  dados,
  maxScore,
  isDiaMes = false,
}: {
  dados: (DiaStat & { nivel: NivelVerba })[];
  maxScore: number;
  isDiaMes?: boolean;
}) {
  const [tooltip, setTooltip] = useState<{ d: DiaStat & { nivel: NivelVerba }; x: number } | null>(null);

  return (
    <div className="relative">
      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute -top-16 z-10 pointer-events-none bg-popover border rounded-lg shadow-lg px-3 py-2 text-xs whitespace-nowrap"
          style={{ left: `${tooltip.x}px`, transform: "translateX(-50%)" }}
        >
          <p className="font-bold mb-0.5">{isDiaMes ? `Dia ${tooltip.d.label}` : tooltip.d.label}</p>
          <p className="text-blue-600">📋 {tooltip.d.cadastros} cadastros</p>
          <p className="text-emerald-600">💳 {tooltip.d.assinaturas} assinaturas</p>
          <p className="font-semibold">Score: {tooltip.d.score}</p>
          <p className={VERBA_CONFIG[tooltip.d.nivel].cor}>{VERBA_CONFIG[tooltip.d.nivel].label}</p>
        </div>
      )}

      <div className={`flex items-end gap-1 h-36 ${isDiaMes ? "overflow-x-auto pb-1" : ""}`}>
        {dados.map((d) => {
          const pct = maxScore > 0 ? (d.score / maxScore) * 100 : 0;
          const cfg = VERBA_CONFIG[d.nivel];
          const isTop = d.score === maxScore;

          return (
            <div
              key={d.chave}
              className={`flex flex-col items-center gap-0.5 cursor-pointer group ${isDiaMes ? "min-w-[26px]" : "flex-1"}`}
              onMouseEnter={(e) => setTooltip({ d, x: e.currentTarget.getBoundingClientRect().left + e.currentTarget.offsetWidth / 2 - (e.currentTarget.closest(".relative") as HTMLElement)?.getBoundingClientRect().left })}
              onMouseLeave={() => setTooltip(null)}
            >
              {/* Valor do score no topo */}
              <span className={`text-[9px] leading-none font-semibold transition-opacity ${d.score > 0 ? "opacity-100" : "opacity-0"} ${isTop ? cfg.cor : "text-muted-foreground"}`}>
                {d.score > 0 ? d.score : ""}
              </span>

              {/* Barra com gradiente */}
              <div
                className={`w-full rounded-t-md transition-all duration-500 group-hover:opacity-80 relative overflow-hidden ${cfg.barCor}`}
                style={{ height: `${Math.max(pct, 3)}%` }}
              >
                {/* Brilho no topo da barra */}
                <div className="absolute top-0 inset-x-0 h-1 bg-white/30 rounded-t-md" />
              </div>

              {/* Label */}
              <span className={`text-[9px] leading-none font-medium ${isTop ? "text-foreground font-bold" : "text-muted-foreground"}`}>
                {d.label}
              </span>

              {/* Ícone do nível */}
              {(() => {
                const Icon = cfg.icon;
                return <Icon className={`h-2 w-2 ${cfg.cor} opacity-70`} />;
              })()}
            </div>
          );
        })}
      </div>

      {/* Legenda */}
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        {(["alta", "normal", "baixa"] as NivelVerba[]).map((nivel) => {
          const cfg = VERBA_CONFIG[nivel];
          const count = dados.filter(d => d.nivel === nivel).length;
          if (count === 0) return null;
          return (
            <div key={nivel} className="flex items-center gap-1">
              <div className={`w-2.5 h-2.5 rounded-sm ${cfg.barCor}`} />
              <span className={`text-[10px] font-medium ${cfg.cor}`}>{cfg.label} ({count})</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Gráfico de barras duplas (cadastros + assinaturas) ───────────────────────
function DualBarChart({
  dados,
  isDiaMes = false,
}: {
  dados: DiaStat[];
  isDiaMes?: boolean;
}) {
  const maxCad = Math.max(...dados.map(d => d.cadastros), 1);
  const maxAsn = Math.max(...dados.map(d => d.assinaturas), 1);
  const maxVal = Math.max(maxCad, maxAsn);

  const [tooltip, setTooltip] = useState<{ d: DiaStat; x: number } | null>(null);

  return (
    <div className="relative">
      {tooltip && (
        <div
          className="absolute -top-14 z-10 pointer-events-none bg-popover border rounded-lg shadow-lg px-3 py-2 text-xs whitespace-nowrap"
          style={{ left: `${tooltip.x}px`, transform: "translateX(-50%)" }}
        >
          <p className="font-bold mb-0.5">{isDiaMes ? `Dia ${tooltip.d.label}` : tooltip.d.label}</p>
          <p className="text-blue-600">📋 {tooltip.d.cadastros} cadastros</p>
          <p className="text-emerald-600">💳 {tooltip.d.assinaturas} assinaturas</p>
        </div>
      )}

      <div className={`flex items-end gap-1 h-36 ${isDiaMes ? "overflow-x-auto pb-1" : ""}`}>
        {dados.map((d) => {
          const pctCad = (d.cadastros / maxVal) * 100;
          const pctAsn = (d.assinaturas / maxVal) * 100;
          const isTopCad = d.cadastros === maxCad;
          const isTopAsn = d.assinaturas === maxAsn;

          return (
            <div
              key={d.chave}
              className={`flex items-end gap-px cursor-pointer group ${isDiaMes ? "min-w-[28px]" : "flex-1"}`}
              onMouseEnter={(e) => setTooltip({ d, x: e.currentTarget.getBoundingClientRect().left + e.currentTarget.offsetWidth / 2 - (e.currentTarget.closest(".relative") as HTMLElement)?.getBoundingClientRect().left })}
              onMouseLeave={() => setTooltip(null)}
            >
              {/* Barra cadastros (azul) */}
              <div className="flex-1 flex flex-col items-center gap-0.5">
                <div
                  className={`w-full rounded-t-sm transition-all duration-500 group-hover:opacity-80 relative overflow-hidden ${isTopCad ? "bg-blue-500" : "bg-blue-200 dark:bg-blue-800"}`}
                  style={{ height: `${Math.max(pctCad, 2)}%` }}
                >
                  <div className="absolute top-0 inset-x-0 h-0.5 bg-white/30" />
                </div>
              </div>

              {/* Barra assinaturas (verde) */}
              <div className="flex-1 flex flex-col items-center gap-0.5">
                <div
                  className={`w-full rounded-t-sm transition-all duration-500 group-hover:opacity-80 relative overflow-hidden ${isTopAsn ? "bg-emerald-500" : "bg-emerald-200 dark:bg-emerald-800"}`}
                  style={{ height: `${Math.max(pctAsn, 2)}%` }}
                >
                  <div className="absolute top-0 inset-x-0 h-0.5 bg-white/30" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Labels abaixo */}
      <div className={`flex gap-1 mt-0.5 ${isDiaMes ? "overflow-x-auto" : ""}`}>
        {dados.map((d) => (
          <div key={d.chave} className={`text-center ${isDiaMes ? "min-w-[28px]" : "flex-1"}`}>
            <span className="text-[8px] text-muted-foreground">{d.label}</span>
          </div>
        ))}
      </div>

      {/* Legenda */}
      <div className="flex items-center gap-4 mt-2">
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
          <span className="text-[10px] text-muted-foreground">Cadastros</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
          <span className="text-[10px] text-muted-foreground">Assinaturas</span>
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
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

      setStatsSemana(
        Array.from({ length: 7 }, (_, i) => {
          const cad = semCad[i] ?? 0;
          const asn = semAsn[i] ?? 0;
          return { chave: i, label: DIAS_SEMANA[i], cadastros: cad, assinaturas: asn, total: cad + asn, score: calcularScore(cad, asn, maxSemCad, maxSemAsn) };
        })
      );

      setStatsMes(
        Array.from({ length: 31 }, (_, i) => {
          const cad = mesCad[i + 1] ?? 0;
          const asn = mesAsn[i + 1] ?? 0;
          return { chave: i + 1, label: String(i + 1), cadastros: cad, assinaturas: asn, total: cad + asn, score: calcularScore(cad, asn, maxMesCad, maxMesAsn) };
        })
      );
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const maxScoreSem = Math.max(...statsSemana.map(d => d.score), 1);
  const maxScoreMes = Math.max(...statsMes.map(d => d.score), 1);

  const semanaComNivel = statsSemana.map(d => ({ ...d, nivel: getNivelVerba(d.score, maxScoreSem) }));
  const mesComNivel    = statsMes.map(d => ({ ...d, nivel: getNivelVerba(d.score, maxScoreMes) }));

  const top5Mes = [...mesComNivel].sort((a, b) => b.score - a.score).slice(0, 5);
  const diasVerbaAlta   = semanaComNivel.filter(d => d.nivel === "alta");
  const diasVerbaNormal = semanaComNivel.filter(d => d.nivel === "normal");
  const diasVerbaBaixa  = semanaComNivel.filter(d => d.nivel === "baixa");

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center">
            <Megaphone className="h-4 w-4 text-orange-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Melhores Dias para Anunciar</h3>
            <p className="text-sm text-muted-foreground">
              Score = cadastros (1×) + assinaturas (3×) — verde = aumente a verba
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

      {/* ══════════════════════════════════════════════════════════════════
          BLOCO 1 — DIA DA SEMANA
      ══════════════════════════════════════════════════════════════════ */}
      <Card className="border-orange-300 dark:border-orange-700 bg-gradient-to-br from-orange-50/80 to-amber-50/50 dark:from-orange-950/30 dark:to-amber-950/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-orange-600" />
            Recomendação — Dias da Semana
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Passe o mouse nas barras para ver os detalhes de cada dia
          </p>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* Mini-cards dos 7 dias */}
          <div className="grid grid-cols-7 gap-1.5">
            {semanaComNivel.map((d) => {
              const cfg = VERBA_CONFIG[d.nivel];
              const Icon = cfg.icon;
              return (
                <div key={d.chave} className={`rounded-xl border-2 p-2 flex flex-col items-center gap-1 ${cfg.bg} ${cfg.border}`}>
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
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">Aumente a verba em: </span>
                  <span className="font-bold">{diasVerbaAlta.map(d => d.label).join(", ")}</span>
                  {" "}— maior volume de conversões no histórico.
                </p>
              </div>
            )}
            {diasVerbaNormal.length > 0 && (
              <div className="flex items-start gap-2">
                <Minus className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm">
                  <span className="font-semibold text-amber-700 dark:text-amber-400">Mantenha normal em: </span>
                  <span className="font-bold">{diasVerbaNormal.map(d => d.label).join(", ")}</span>.
                </p>
              </div>
            )}
            {diasVerbaBaixa.length > 0 && (
              <div className="flex items-start gap-2">
                <TrendingDown className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold">Reduza ou pause em: </span>
                  {diasVerbaBaixa.map(d => d.label).join(", ")}.
                </p>
              </div>
            )}
          </div>

          {/* Gráfico score por verba */}
          <div className="rounded-xl border bg-white/60 dark:bg-black/20 p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-orange-400" />
              Score por Dia da Semana — cor indica nível de verba recomendado
            </p>
            <ScoreBarChart dados={semanaComNivel} maxScore={maxScoreSem} />
          </div>

          {/* Gráfico duplo cadastros + assinaturas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl border bg-white/60 dark:bg-black/20 p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-blue-500" />
                Cadastros vs Assinaturas por Dia
              </p>
              <DualBarChart dados={statsSemana} />
            </div>

            <div className="rounded-xl border bg-white/60 dark:bg-black/20 p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5 text-emerald-500" />
                Ranking de Score
              </p>
              <div className="space-y-1.5">
                {[...semanaComNivel].sort((a, b) => b.score - a.score).map((d, i) => {
                  const cfg = VERBA_CONFIG[d.nivel];
                  const Icon = cfg.icon;
                  return (
                    <div key={d.chave} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-5 text-right">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}</span>
                      <span className="text-xs font-medium w-8">{d.label}</span>
                      <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${cfg.barCor} transition-all duration-500 flex items-center justify-end pr-1.5`}
                          style={{ width: `${maxScoreSem > 0 ? (d.score / maxScoreSem) * 100 : 0}%` }}
                        >
                          {(maxScoreSem > 0 ? (d.score / maxScoreSem) * 100 : 0) > 20 && (
                            <span className="text-[9px] text-white font-bold">{d.score}</span>
                          )}
                        </div>
                      </div>
                      <Icon className={`h-3 w-3 flex-shrink-0 ${cfg.cor}`} />
                      <Badge variant="outline" className={`text-[9px] px-1 py-0 ${cfg.cor} ${cfg.border} flex-shrink-0`}>
                        {d.nivel === "alta" ? "ALTA" : d.nivel === "normal" ? "Normal" : "baixa"}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

        </CardContent>
      </Card>

      {/* ══════════════════════════════════════════════════════════════════
          BLOCO 2 — DIA DO MÊS
      ══════════════════════════════════════════════════════════════════ */}
      <Card className="border-violet-300 dark:border-violet-700 bg-gradient-to-br from-violet-50/80 to-purple-50/50 dark:from-violet-950/30 dark:to-purple-950/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-violet-600" />
            Recomendação — Dia do Mês
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Top 5 melhores dias do mês para intensificar anúncios
          </p>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* Top 5 dias */}
          <div className="grid grid-cols-5 gap-2">
            {top5Mes.map((d, i) => {
              const cfg = VERBA_CONFIG[d.nivel];
              const Icon = cfg.icon;
              return (
                <div key={d.chave} className={`rounded-xl border-2 p-3 flex flex-col items-center gap-1 ${cfg.bg} ${cfg.border}`}>
                  <span className="text-base">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}º`}</span>
                  <span className="text-xs text-muted-foreground font-medium">Dia</span>
                  <span className="text-2xl font-black leading-none">{d.label}</span>
                  <Icon className={`h-3 w-3 ${cfg.cor}`} />
                  <div className="text-center space-y-0.5">
                    <div className="text-[9px] text-blue-600 font-medium">{d.cadastros} cad.</div>
                    <div className="text-[9px] text-emerald-600 font-medium">{d.assinaturas} asin.</div>
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
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">Aumente a verba nos dias: </span>
                <span className="font-bold text-base">{top5Mes.map(d => d.label).join(", ")}</span>
                {" "}do mês — picos históricos de cadastros e assinaturas.
              </p>
            </div>
          </div>

          {/* Gráfico score com cor de verba — dia do mês */}
          <div className="rounded-xl border bg-white/60 dark:bg-black/20 p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-violet-400" />
              Score por Dia do Mês — passe o mouse para ver detalhes
            </p>
            <ScoreBarChart dados={mesComNivel} maxScore={maxScoreMes} isDiaMes />
          </div>

          {/* Gráfico duplo — dia do mês */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl border bg-white/60 dark:bg-black/20 p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-blue-500" />
                Cadastros vs Assinaturas por Dia
              </p>
              <DualBarChart dados={statsMes} isDiaMes />
            </div>

            {/* Tabela ranking completo */}
            <div className="rounded-xl border bg-white/60 dark:bg-black/20 p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5 text-emerald-500" />
                Ranking completo
              </p>
              <div className="overflow-y-auto max-h-52">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-white/80 dark:bg-black/40">
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-1 font-medium">Dia</th>
                      <th className="text-right py-1 font-medium text-blue-600">Cad.</th>
                      <th className="text-right py-1 font-medium text-emerald-600">Asin.</th>
                      <th className="text-right py-1 font-medium">Score</th>
                      <th className="text-right py-1 font-medium">Verba</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...mesComNivel]
                      .sort((a, b) => b.score - a.score)
                      .filter(d => d.total > 0)
                      .map((d, i) => {
                        const cfg = VERBA_CONFIG[d.nivel];
                        return (
                          <tr key={d.chave} className="border-b last:border-0">
                            <td className="py-1 font-medium">
                              <span className="mr-1 text-[10px]">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}</span>
                              Dia {d.label}
                            </td>
                            <td className="text-right py-1 text-blue-600">{d.cadastros}</td>
                            <td className="text-right py-1 text-emerald-600">{d.assinaturas}</td>
                            <td className="text-right py-1 font-bold">{d.score}</td>
                            <td className="text-right py-1">
                              <Badge variant="outline" className={`text-[9px] px-1 py-0 ${cfg.cor} ${cfg.border}`}>
                                {d.nivel === "alta" ? "ALTA" : d.nivel === "normal" ? "Norm." : "baixa"}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </CardContent>
      </Card>

    </div>
  );
}
