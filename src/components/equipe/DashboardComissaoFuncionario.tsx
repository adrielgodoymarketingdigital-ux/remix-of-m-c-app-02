import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, ShoppingCart, Wrench } from "lucide-react";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { formatCurrency } from "@/lib/formatters";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import { startOfMonth, endOfMonth, subMonths } from "date-fns";
import type { ComissaoCargo } from "@/types/funcionario";

export function DashboardComissaoFuncionario() {
  const { funcionarioId, isFuncionario } = useFuncionarioPermissoes();

  const { data, isLoading } = useQuery({
    queryKey: ["comissao-funcionario", funcionarioId],
    queryFn: async () => {
      if (!funcionarioId) return null;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: funcData } = await supabase
        .from("loja_funcionarios")
        .select("comissao_tipo, comissao_valor, comissao_escopo, comissoes_por_cargo, cargo, loja_user_id")
        .eq("funcionario_user_id", user.id)
        .eq("ativo", true)
        .maybeSingle();

      if (!funcData) return null;

      const agora = new Date();
      const inicio = startOfMonth(agora).toISOString();
      const fim = endOfMonth(agora).toISOString();
      const mesAnterior = subMonths(agora, 1);
      const inicioAnt = startOfMonth(mesAnterior).toISOString();
      const fimAnt = endOfMonth(mesAnterior).toISOString();

      const { data: vendas } = await supabase
        .from("vendas")
        .select("total, tipo")
        .eq("funcionario_id", funcionarioId)
        .eq("cancelada", false)
        .gte("data", inicio)
        .lte("data", fim);

      const { data: ordens } = await supabase
        .from("ordens_servico")
        .select("total")
        .eq("funcionario_id", funcionarioId)
        .is("deleted_at", null)
        .in("status", ["finalizado", "entregue"])
        .gte("updated_at", inicio)
        .lte("updated_at", fim);

      const { data: vendasAnt } = await supabase
        .from("vendas")
        .select("total")
        .eq("funcionario_id", funcionarioId)
        .eq("cancelada", false)
        .gte("data", inicioAnt)
        .lte("data", fimAnt);

      const vendasProdutos = (vendas || [])
        .filter(v => v.tipo === "produto" || (v.tipo as string) === "peca")
        .reduce((acc, v) => acc + Number(v.total), 0);
      const vendasDispositivos = (vendas || [])
        .filter(v => v.tipo === "dispositivo")
        .reduce((acc, v) => acc + Number(v.total), 0);
      const totalServicos = (ordens || []).reduce((acc, o) => acc + Number(o.total || 0), 0);
      const totalVendas = vendasProdutos + vendasDispositivos + totalServicos;
      const qtdVendas = (vendas || []).length;
      const qtdOS = (ordens || []).length;
      const totalAnterior = (vendasAnt || []).reduce((acc, v) => acc + Number(v.total), 0);

      // Calculate commission per cargo
      const comissoesPorCargo = funcData.comissoes_por_cargo as unknown as Record<string, ComissaoCargo> | null;
      const detalhes: { cargo: string; comissao: number; descricao: string }[] = [];
      let comissaoTotal = 0;

      if (comissoesPorCargo && Object.keys(comissoesPorCargo).length > 0) {
        Object.entries(comissoesPorCargo).forEach(([cargo, config]) => {
          if (!config.tipo || !config.valor) return;
          let base = 0;
          let qtd = 0;
          switch (config.escopo) {
            case "vendas_produtos": base = vendasProdutos; qtd = qtdVendas; break;
            case "vendas_dispositivos": base = vendasDispositivos; qtd = qtdVendas; break;
            case "vendas_todos": base = vendasProdutos + vendasDispositivos; qtd = qtdVendas; break;
            case "servicos_os": base = totalServicos; qtd = qtdOS; break;
            default: base = totalVendas; qtd = qtdVendas + qtdOS; break;
          }
          const c = config.tipo === "porcentagem" ? base * (config.valor / 100) : qtd * config.valor;
          comissaoTotal += c;
          const desc = config.tipo === "porcentagem" ? `${config.valor}%` : `R$ ${config.valor.toFixed(2)}/un`;
          detalhes.push({ cargo, comissao: c, descricao: desc });
        });
      } else if (funcData.comissao_tipo && funcData.comissao_valor) {
        if (funcData.comissao_tipo === "porcentagem") {
          comissaoTotal = totalVendas * (Number(funcData.comissao_valor) / 100);
        } else {
          comissaoTotal = (qtdVendas + qtdOS) * Number(funcData.comissao_valor);
        }
      }

      return { totalVendas, qtdVendas, qtdOS, comissao: comissaoTotal, totalAnterior, detalhes };
    },
    enabled: !!funcionarioId && isFuncionario,
  });

  if (!isFuncionario) return null;
  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (!data) return null;

  const variacao = data.totalAnterior > 0 ? ((data.totalVendas - data.totalAnterior) / data.totalAnterior * 100) : 0;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Sua Comissão do Mês</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Vendido</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold"><ValorMonetario valor={data.totalVendas} /></div>
            {variacao !== 0 && (
              <p className={`text-xs ${variacao > 0 ? "text-green-600" : "text-destructive"}`}>
                {variacao > 0 ? "+" : ""}{variacao.toFixed(0)}% vs mês anterior
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Vendas</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{data.qtdVendas}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">OS Concluídas</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{data.qtdOS}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Comissão Estimada</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-primary"><ValorMonetario valor={data.comissao} /></div>
            {data.detalhes && data.detalhes.length > 1 && (
              <div className="mt-1 space-y-0.5">
                {data.detalhes.map((d, i) => (
                  <p key={i} className="text-xs text-muted-foreground">
                    {d.cargo}: <ValorMonetario valor={d.comissao} /> ({d.descricao})
                  </p>
                ))}
              </div>
            )}
            {data.detalhes && data.detalhes.length === 1 && (
              <p className="text-xs text-muted-foreground">{data.detalhes[0].descricao}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
