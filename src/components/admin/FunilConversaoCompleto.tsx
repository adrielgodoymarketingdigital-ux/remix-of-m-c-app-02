import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, TrendingDown, ArrowDown, Users, CreditCard } from "lucide-react";

interface EtapaFunil {
  id: string;
  label: string;
  descricao: string;
  total: number;
  perdidos: number;
  taxaConversao: number; // % em relação à etapa anterior
  taxaTotal: number;     // % em relação ao topo do funil
  cor: string;
}

type Periodo = "7d" | "30d" | "90d" | "all";

const PLANOS_PAGOS = [
  "basico_mensal", "intermediario_mensal", "profissional_mensal",
  "basico_anual", "intermediario_anual", "profissional_anual", "profissional_ultra_mensal",
];

export function FunilConversaoCompleto() {
  const [periodo, setPeriodo] = useState<Periodo>("all");
  const [etapas, setEtapas] = useState<EtapaFunil[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarDados();
  }, [periodo]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      // Filtro de data
      const dataLimite = periodo !== "all"
        ? new Date(Date.now() - parseInt(periodo) * 24 * 60 * 60 * 1000).toISOString()
        : null;

      // 1. Total cadastros
      let queryAuth = supabase.from("profiles").select("user_id, created_at", { count: "exact" });
      if (dataLimite) queryAuth = queryAuth.gte("created_at", dataLimite);
      const { count: totalCadastros } = await queryAuth;

      // 2. Entraram no app (têm registro em user_onboarding)
      let queryOnb = supabase.from("user_onboarding").select("user_id", { count: "exact" });
      if (dataLimite) queryOnb = queryOnb.gte("created_at", dataLimite);
      const { count: entrarNoApp } = await queryOnb;

      // 3. Cadastrou cliente
      let queryCliente = supabase
        .from("user_onboarding")
        .select("user_id", { count: "exact" })
        .eq("step_cliente_cadastrado", true);
      if (dataLimite) queryCliente = queryCliente.gte("created_at", dataLimite);
      const { count: cadastrouCliente } = await queryCliente;

      // 4. Criou OS
      let queryOS = supabase
        .from("user_onboarding")
        .select("user_id", { count: "exact" })
        .eq("step_os_criada", true);
      if (dataLimite) queryOS = queryOS.gte("created_at", dataLimite);
      const { count: criouOS } = await queryOS;

      // 5. Completou onboarding (aha moment)
      let queryCompletou = supabase
        .from("user_onboarding")
        .select("user_id", { count: "exact" })
        .eq("onboarding_completed", true);
      if (dataLimite) queryCompletou = queryCompletou.gte("created_at", dataLimite);
      const { count: completou } = await queryCompletou;

      // 6. Virou pagante
      let queryPagante = supabase
        .from("assinaturas")
        .select("user_id", { count: "exact" })
        .eq("status", "active")
        .in("plano_tipo", PLANOS_PAGOS as any);
      if (dataLimite) queryPagante = queryPagante.gte("created_at", dataLimite);
      const { count: virouPagante } = await queryPagante;

      const valores = [
        totalCadastros ?? 0,
        entrarNoApp ?? 0,
        cadastrouCliente ?? 0,
        criouOS ?? 0,
        completou ?? 0,
        virouPagante ?? 0,
      ];

      const topo = valores[0] || 1;

      const definicoes = [
        { id: "cadastro",   label: "Cadastros",             descricao: "Se registraram no app",                          cor: "bg-blue-500" },
        { id: "app",        label: "Entraram no App",        descricao: "Acessaram e iniciaram o onboarding",             cor: "bg-indigo-500" },
        { id: "cliente",    label: "Cadastraram Cliente",    descricao: "Completaram a 1ª etapa do onboarding",           cor: "bg-violet-500" },
        { id: "os",         label: "Criaram uma OS",         descricao: "Completaram a 2ª etapa do onboarding",           cor: "bg-purple-500" },
        { id: "onboarding", label: "Completaram Onboarding", descricao: "Atingiram o Aha Moment (viram o lucro)",         cor: "bg-fuchsia-500" },
        { id: "pagante",    label: "Viraram Pagantes",       descricao: "Assinaram um plano pago",                        cor: "bg-emerald-500" },
      ];

      const etapasCalculadas: EtapaFunil[] = definicoes.map((def, i) => {
        const total = valores[i];
        const anterior = i === 0 ? topo : valores[i - 1];
        const perdidos = i < valores.length - 1 ? total - valores[i + 1] : 0;
        return {
          ...def,
          total,
          perdidos: Math.max(0, perdidos),
          taxaConversao: anterior > 0 ? Math.round((total / anterior) * 100) : 0,
          taxaTotal: Math.round((total / topo) * 100),
        };
      });

      setEtapas(etapasCalculadas);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-20" />)}
      </div>
    );
  }

  const topo = etapas[0]?.total || 1;
  const taxaFinalTotal = etapas[5]?.total
    ? Math.round((etapas[5].total / topo) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold">Funil de Conversão Completo</h3>
          <p className="text-sm text-muted-foreground">
            Do cadastro até virar pagante — onde cada usuário parou
          </p>
        </div>
        <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
          <SelectTrigger className="w-[180px]">
            <Calendar className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Últimos 7 dias</SelectItem>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
            <SelectItem value="90d">Últimos 90 dias</SelectItem>
            <SelectItem value="all">Todo o período</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPIs topo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Users className="h-4 w-4" />
            <span className="text-xs">Total Cadastros</span>
          </div>
          <p className="text-2xl font-bold">{etapas[0]?.total ?? 0}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <CreditCard className="h-4 w-4" />
            <span className="text-xs">Viraram Pagantes</span>
          </div>
          <p className="text-2xl font-bold text-emerald-600">{etapas[5]?.total ?? 0}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <TrendingDown className="h-4 w-4" />
            <span className="text-xs">Conversão Total</span>
          </div>
          <p className="text-2xl font-bold">{taxaFinalTotal}%</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <TrendingDown className="h-4 w-4 text-red-500" />
            <span className="text-xs">Maior Abandono</span>
          </div>
          <p className="text-sm font-bold text-red-600 leading-tight">
            {etapas.slice(0, -1).reduce((max, e) =>
              e.perdidos > (max?.perdidos ?? 0) ? e : max
            , etapas[0])?.label ?? "—"}
          </p>
        </Card>
      </div>

      {/* Funil visual */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Jornada do Usuário</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {etapas.map((etapa, i) => (
            <div key={etapa.id}>
              {/* Etapa */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                    <span className="font-medium">{etapa.label}</span>
                    <span className="text-xs text-muted-foreground hidden sm:inline">— {etapa.descricao}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{etapa.total}</span>
                    <Badge
                      variant="outline"
                      className={`text-xs ${etapa.taxaTotal >= 50 ? "border-green-400 text-green-700" : etapa.taxaTotal >= 25 ? "border-yellow-400 text-yellow-700" : "border-red-400 text-red-700"}`}
                    >
                      {etapa.taxaTotal}% do total
                    </Badge>
                  </div>
                </div>

                {/* Barra */}
                <div className="h-9 bg-muted rounded-md overflow-hidden relative">
                  <div
                    className={`h-full ${etapa.cor} rounded-md transition-all duration-500 flex items-center px-3`}
                    style={{ width: `${Math.max(etapa.taxaTotal, 2)}%` }}
                  >
                    {etapa.taxaTotal > 12 && (
                      <span className="text-xs text-white font-semibold">
                        {etapa.taxaConversao}% da etapa anterior
                      </span>
                    )}
                  </div>
                  {etapa.taxaTotal <= 12 && (
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      {etapa.taxaConversao}% da etapa anterior
                    </span>
                  )}
                </div>
              </div>

              {/* Seta de abandono entre etapas */}
              {i < etapas.length - 1 && etapa.perdidos > 0 && (
                <div className="flex items-center gap-2 py-1 pl-6">
                  <ArrowDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  <span className="text-xs text-red-500 font-medium">
                    {etapa.perdidos} pararam aqui
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({Math.round((etapa.perdidos / (etapas[0]?.total || 1)) * 100)}% do total)
                  </span>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Tabela resumo */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Resumo por Etapa</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground text-xs">
                  <th className="text-left py-2 font-medium">Etapa</th>
                  <th className="text-right py-2 font-medium">Usuários</th>
                  <th className="text-right py-2 font-medium">% Total</th>
                  <th className="text-right py-2 font-medium">Conv. Etapa</th>
                  <th className="text-right py-2 font-medium">Pararam aqui</th>
                </tr>
              </thead>
              <tbody>
                {etapas.map((etapa, i) => (
                  <tr key={etapa.id} className="border-b last:border-0">
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${etapa.cor}`} />
                        {etapa.label}
                      </div>
                    </td>
                    <td className="text-right py-2 font-medium">{etapa.total}</td>
                    <td className="text-right py-2">
                      <span className={etapa.taxaTotal >= 50 ? "text-green-600" : etapa.taxaTotal >= 25 ? "text-yellow-600" : "text-red-600"}>
                        {etapa.taxaTotal}%
                      </span>
                    </td>
                    <td className="text-right py-2 text-muted-foreground">
                      {i === 0 ? "—" : `${etapa.taxaConversao}%`}
                    </td>
                    <td className="text-right py-2">
                      {i < etapas.length - 1 ? (
                        <span className={etapa.perdidos > 50 ? "text-red-600 font-medium" : "text-muted-foreground"}>
                          {etapa.perdidos}
                        </span>
                      ) : "—"}
                    </td>
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
