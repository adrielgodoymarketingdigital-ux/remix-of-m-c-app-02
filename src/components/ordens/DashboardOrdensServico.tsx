import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, DollarSign, TrendingUp, Wrench } from "lucide-react";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import { useOSStatusConfig } from "@/hooks/useOSStatusConfig";

interface OrdemServico {
  id: string;
  status: string | null;
  total: number | null;
}

interface ServicoAvulso {
  id: string;
  nome: string;
  custo: number;
  preco: number;
  lucro: number;
  status: string;
}

interface DashboardOrdensServicoProps {
  ordens: OrdemServico[];
  servicosAvulsos?: ServicoAvulso[];
  lucroOrdensEntregues?: number | null;
}

export const DashboardOrdensServico = ({
  ordens,
  servicosAvulsos = [],
  lucroOrdensEntregues,
}: DashboardOrdensServicoProps) => {
  const { podeVerLucros, isFuncionario } = useFuncionarioPermissoes();
  const { statusList } = useOSStatusConfig();

  const statusCounts = statusList
    .filter((s) => s.ativo)
    .map((s) => ({
      slug: s.slug,
      nome: s.nome,
      cor: s.cor,
      count: ordens.filter((o) => o.status === s.slug).length,
    }));

  const visibleStatuses = statusCounts.filter((s) => {
    const config = statusList.find((st) => st.slug === s.slug);
    return s.count > 0 || config?.is_sistema;
  });

  const ordensEntregues = ordens.filter((o) => o.status === "entregue");
  const valorFaturado = ordensEntregues.reduce((acc, ordem) => acc + (ordem.total || 0), 0);

  const totalAvulsos = servicosAvulsos.length;
  const valorAvulsos = servicosAvulsos.reduce((acc, sa) => acc + sa.preco, 0);
  const avulsosEntregues = servicosAvulsos.filter(sa => sa.status === "entregue");
  const lucroAvulsosEntregues = avulsosEntregues.reduce((acc, sa) => acc + (Number(sa.preco || 0) - Number(sa.custo || 0)), 0);
  const lucroAvulsos = servicosAvulsos.reduce((acc, sa) => acc + (Number(sa.preco || 0) - Number(sa.custo || 0)), 0);
  const lucroTotal = (lucroOrdensEntregues || 0) + lucroAvulsosEntregues;

  return (
    <div className="space-y-4 mb-6">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {visibleStatuses.map((s) => (
          <Card key={s.slug}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium">{s.nome}</CardTitle>
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: s.cor }} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" style={{ color: s.cor }}>{s.count}</div>
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Serviços Avulsos</CardTitle>
            <Wrench className="h-4 w-4 text-violet-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-violet-600">{totalAvulsos}</div>
            {totalAvulsos > 0 && (
              <p className="text-xs text-muted-foreground"><ValorMonetario valor={valorAvulsos} /></p>
            )}
          </CardContent>
        </Card>

        {!isFuncionario && podeVerLucros && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium">Lucro Avulsos Entregues</CardTitle>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">
                <ValorMonetario valor={lucroAvulsosEntregues} />
              </div>
              {avulsosEntregues.length > 0 && (
                <p className="text-xs text-muted-foreground">{avulsosEntregues.length} serviço(s) entregue(s)</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {!isFuncionario && (
        <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Ordens</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{ordens.length}</div>
              <p className="text-xs text-muted-foreground">Ordens cadastradas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor Faturado</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600"><ValorMonetario valor={valorFaturado + valorAvulsos} /></div>
              <p className="text-xs text-muted-foreground">Receita dos serviços entregues + avulsos</p>
            </CardContent>
          </Card>

          {podeVerLucros && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Lucro dos Serviços</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600"><ValorMonetario valor={lucroTotal} /></div>
                <p className="text-xs text-muted-foreground">Lucro dos serviços entregues + avulsos</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};
