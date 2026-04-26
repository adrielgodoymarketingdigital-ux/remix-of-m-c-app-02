import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResumoFinanceiro } from "@/types/relatorio";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import {
  TrendingUp,
  DollarSign,
  TrendingDown,
  Percent,
  Receipt,
  Wallet,
  Lock,
  CreditCard,
} from "lucide-react";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import { useOcultarValores } from "@/contexts/OcultarValoresContext";

interface DashboardFinanceiroProps {
  resumo: ResumoFinanceiro;
}

export const DashboardFinanceiro = ({ resumo }: DashboardFinanceiroProps) => {
  const { podeVerCustos, podeVerLucros, isFuncionario } = useFuncionarioPermissoes();
  const { valoresOcultos } = useOcultarValores();

  if (isFuncionario) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Faturado</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            <ValorMonetario valor={resumo.receitaTotal} />
          </div>
          <p className="text-xs text-muted-foreground">receita total de vendas</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Custo Total</CardTitle>
          <TrendingDown className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {podeVerCustos ? (
            <>
              <div className="text-2xl font-bold text-red-600">
                <ValorMonetario valor={resumo.custoTotal} />
              </div>
              <p className="text-xs text-muted-foreground">custo dos produtos</p>
            </>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Lock className="h-5 w-5" />
              <span className="text-sm">Sem permissão</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Lucro Bruto</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {podeVerLucros ? (
            <>
              <div className="text-2xl font-bold">
                <ValorMonetario valor={resumo.lucroTotal} />
              </div>
              <p className="text-xs text-muted-foreground">receita - custo</p>
            </>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Lock className="h-5 w-5" />
              <span className="text-sm">Sem permissão</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Margem de Lucro</CardTitle>
          <Percent className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {podeVerLucros ? (
            <>
              <div className="text-2xl font-bold">
                {valoresOcultos ? "•••••" : `${resumo.margemLucroMedia.toFixed(2)}%`}
              </div>
              <p className="text-xs text-muted-foreground">média do período</p>
            </>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Lock className="h-5 w-5" />
              <span className="text-sm">Sem permissão</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Custo Operacional
          </CardTitle>
          <Receipt className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {podeVerCustos ? (
            <>
              <div className="text-2xl font-bold text-orange-600">
                <ValorMonetario valor={resumo.custoOperacional} />
              </div>
              <p className="text-xs text-muted-foreground">contas a pagar</p>
            </>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Lock className="h-5 w-5" />
              <span className="text-sm">Sem permissão</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Taxas de Cartão</CardTitle>
          <CreditCard className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {podeVerCustos ? (
            <>
              <div className="text-2xl font-bold text-purple-600">
                <ValorMonetario valor={resumo.taxasCartao} />
              </div>
              <p className="text-xs text-muted-foreground">taxas de máquinas</p>
            </>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Lock className="h-5 w-5" />
              <span className="text-sm">Sem permissão</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Lucro Líquido</CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {podeVerLucros ? (
            <div
              className={`text-2xl font-bold ${
                resumo.lucroLiquido >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              <ValorMonetario valor={resumo.lucroLiquido} />
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Lock className="h-5 w-5" />
              <span className="text-sm">Sem permissão</span>
            </div>
          )}
          {podeVerLucros && (
            <p className="text-xs text-muted-foreground">
              lucro bruto - despesas
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
