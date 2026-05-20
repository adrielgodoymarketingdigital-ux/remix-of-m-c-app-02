import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, TrendingUp, Star, Users, CreditCard } from "lucide-react";

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface DiaStat {
  dia: number;        // 1-31 (dia do mês) ou 0-6 (dia da semana)
  label: string;
  cadastros: number;
  assinaturas: number;
  total: number;
}

type Modo = "dia_mes" | "dia_semana";
type Periodo = "3m" | "6m" | "12m" | "all";

const PLANOS_PAGOS = [
  "basico_mensal", "intermediario_mensal", "profissional_mensal",
  "basico_anual", "intermediario_anual", "profissional_anual",
  "profissional_ultra_mensal", "profissional_ultra_anual",
];

export function MelhoresDiasMes() {
  const [modo, setModo] = useState<Modo>("dia_semana");
  const [periodo, setPeriodo] = useState<Periodo>("6m");
  const [stats, setStats] = useState<DiaStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarDados();
  }, [modo, periodo]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const dataLimite = periodo !== "all"
        ? new Date(Date.now() - parseInt(periodo) * 30 * 24 * 60 * 60 * 1000).toISOString()
        : null;

      // Buscar cadastros (profiles)
      let queryCadastros = supabase.from("profiles").select("created_at");
      if (dataLimite) queryCadastros = queryCadastros.gte("created_at", dataLimite);
      const { data: cadastros } = await queryCadastros;

      // Buscar assinaturas pagas
      let queryAssinaturas = supabase
        .from("assinaturas")
        .select("created_at")
        .in("plano_tipo", PLANOS_PAGOS as any)
        .eq("status", "active");
      if (dataLimite) queryAssinaturas = queryAssinaturas.gte("created_at", dataLimite);
      const { data: assinaturas } = await queryAssinaturas;

      // Agregar por dia do mês (1-31) ou dia da semana (0-6)
      const mapCadastros: Record<number, number> = {};
      const mapAssinaturas: Record<number, number> = {};

      (cadastros ?? []).forEach(({ created_at }) => {
        if (!created_at) return;
        const d = new Date(created_at);
        const chave = modo === "dia_mes" ? d.getDate() : d.getDay();
        mapCadastros[chave] = (mapCadastros[chave] ?? 0) + 1;
      });

      (assinaturas ?? []).forEach(({ created_at }) => {
        if (!created_at) return;
        const d = new Date(created_at);
        const chave = modo === "dia_mes" ? d.getDate() : d.getDay();
        mapAssinaturas[chave] = (mapAssinaturas[chave] ?? 0) + 1;
      });

      let resultado: DiaStat[];

      if (modo === "dia_semana") {
        resultado = Array.from({ length: 7 }, (_, i) => ({
          dia: i,
          label: DIAS_SEMANA[i],
          cadastros: mapCadastros[i] ?? 0,
          assinaturas: mapAssinaturas[i] ?? 0,
          total: (mapCadastros[i] ?? 0) + (mapAssinaturas[i] ?? 0),
        }));
      } else {
        resultado = Array.from({ length: 31 }, (_, i) => ({
          dia: i + 1,
          label: String(i + 1),
          cadastros: mapCadastros[i + 1] ?? 0,
          assinaturas: mapAssinaturas[i + 1] ?? 0,
          total: (mapCadastros[i + 1] ?? 0) + (mapAssinaturas[i + 1] ?? 0),
        }));
      }

      setStats(resultado);
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

  const maxCadastros = Math.max(...stats.map(s => s.cadastros), 1);
  const maxAssinaturas = Math.max(...stats.map(s => s.assinaturas), 1);

  // Top 3 dias por total
  const top3 = [...stats].sort((a, b) => b.total - a.total).slice(0, 3);
  const melhorCadastro = [...stats].sort((a, b) => b.cadastros - a.cadastros)[0];
  const melhorAssinatura = [...stats].sort((a, b) => b.assinaturas - a.assinaturas)[0];

  return (
    <div className="space-y-6">
      {/* Header + controles */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-500" />
            Melhores Dias para Engajamento
          </h3>
          <p className="text-sm text-muted-foreground">
            {modo === "dia_semana"
              ? "Qual dia da semana gera mais cadastros e assinaturas"
              : "Qual dia do mês gera mais cadastros e assinaturas"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={modo} onValueChange={(v) => setModo(v as Modo)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dia_semana">Dia da Semana</SelectItem>
              <SelectItem value="dia_mes">Dia do Mês</SelectItem>
            </SelectContent>
          </Select>
          <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
            <SelectTrigger className="w-[150px]">
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
      </div>

      {/* KPIs de destaque */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {top3.map((dia, idx) => (
          <Card
            key={dia.dia}
            className={
              idx === 0
                ? "border-yellow-400 bg-yellow-50/50 dark:bg-yellow-950/20"
                : idx === 1
                ? "border-slate-400 bg-slate-50/50 dark:bg-slate-950/20"
                : "border-orange-400 bg-orange-50/50 dark:bg-orange-950/20"
            }
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">{idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"}</span>
                <Badge variant="outline" className="text-xs">
                  {dia.total} eventos
                </Badge>
              </div>
              <p className="text-xl font-bold">{dia.label}</p>
              <div className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3 text-blue-500" />
                  {dia.cadastros} cadastros
                </span>
                <span className="flex items-center gap-1">
                  <CreditCard className="h-3 w-3 text-emerald-500" />
                  {dia.assinaturas} assinaturas
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Destaques separados */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/10">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center flex-shrink-0">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Melhor dia para Cadastros</p>
              <p className="text-lg font-bold text-blue-600">{melhorCadastro?.label}</p>
              <p className="text-xs text-muted-foreground">{melhorCadastro?.cadastros} novos usuários</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/10">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center flex-shrink-0">
              <CreditCard className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Melhor dia para Assinaturas</p>
              <p className="text-lg font-bold text-emerald-600">{melhorAssinatura?.label}</p>
              <p className="text-xs text-muted-foreground">{melhorAssinatura?.assinaturas} assinaturas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de barras — Cadastros */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-500" />
            Cadastros por {modo === "dia_semana" ? "Dia da Semana" : "Dia do Mês"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`flex items-end gap-1 h-32 ${modo === "dia_mes" ? "overflow-x-auto" : ""}`}>
            {stats.map((s) => {
              const pct = maxCadastros > 0 ? (s.cadastros / maxCadastros) * 100 : 0;
              const isMelhor = s.dia === melhorCadastro?.dia;
              return (
                <div
                  key={s.dia}
                  className={`flex flex-col items-center gap-1 ${modo === "dia_mes" ? "min-w-[28px]" : "flex-1"}`}
                >
                  <span className="text-[9px] text-muted-foreground font-medium">
                    {s.cadastros > 0 ? s.cadastros : ""}
                  </span>
                  <div
                    className={`w-full rounded-t-sm transition-all ${isMelhor ? "bg-blue-500" : "bg-blue-300 dark:bg-blue-700"}`}
                    style={{ height: `${Math.max(pct, 4)}%` }}
                    title={`${s.label}: ${s.cadastros} cadastros`}
                  />
                  <span className="text-[9px] text-muted-foreground">{s.label}</span>
                  {isMelhor && <Star className="h-2.5 w-2.5 text-yellow-500" />}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Gráfico de barras — Assinaturas */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-emerald-500" />
            Assinaturas por {modo === "dia_semana" ? "Dia da Semana" : "Dia do Mês"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`flex items-end gap-1 h-32 ${modo === "dia_mes" ? "overflow-x-auto" : ""}`}>
            {stats.map((s) => {
              const pct = maxAssinaturas > 0 ? (s.assinaturas / maxAssinaturas) * 100 : 0;
              const isMelhor = s.dia === melhorAssinatura?.dia;
              return (
                <div
                  key={s.dia}
                  className={`flex flex-col items-center gap-1 ${modo === "dia_mes" ? "min-w-[28px]" : "flex-1"}`}
                >
                  <span className="text-[9px] text-muted-foreground font-medium">
                    {s.assinaturas > 0 ? s.assinaturas : ""}
                  </span>
                  <div
                    className={`w-full rounded-t-sm transition-all ${isMelhor ? "bg-emerald-500" : "bg-emerald-300 dark:bg-emerald-700"}`}
                    style={{ height: `${Math.max(pct, 4)}%` }}
                    title={`${s.label}: ${s.assinaturas} assinaturas`}
                  />
                  <span className="text-[9px] text-muted-foreground">{s.label}</span>
                  {isMelhor && <Star className="h-2.5 w-2.5 text-yellow-500" />}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Tabela resumo */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tabela Completa</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground text-xs">
                  <th className="text-left py-2 font-medium">{modo === "dia_semana" ? "Dia da Semana" : "Dia"}</th>
                  <th className="text-right py-2 font-medium">Cadastros</th>
                  <th className="text-right py-2 font-medium">Assinaturas</th>
                  <th className="text-right py-2 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {[...stats]
                  .sort((a, b) => b.total - a.total)
                  .filter(s => s.total > 0)
                  .map((s, i) => (
                    <tr key={s.dia} className="border-b last:border-0">
                      <td className="py-1.5">
                        <div className="flex items-center gap-2">
                          {i === 0 && <span>🥇</span>}
                          {i === 1 && <span>🥈</span>}
                          {i === 2 && <span>🥉</span>}
                          {i > 2 && <span className="text-muted-foreground text-xs w-4">{i + 1}.</span>}
                          <span className="font-medium">{s.label}</span>
                        </div>
                      </td>
                      <td className="text-right py-1.5 text-blue-600 font-medium">{s.cadastros}</td>
                      <td className="text-right py-1.5 text-emerald-600 font-medium">{s.assinaturas}</td>
                      <td className="text-right py-1.5 font-bold">{s.total}</td>
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
