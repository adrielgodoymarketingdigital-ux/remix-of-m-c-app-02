import { useEffect, useState } from "react";
import { Wallet, TrendingUp, TrendingDown } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { FiltroPeriodoAvancado, FiltrosPeriodo } from "@/components/financeiro/FiltroPeriodoAvancado";
import { ListaExtrato } from "@/components/financeiro/ListaExtrato";
import { useExtratoFinanceiro } from "@/hooks/useExtratoFinanceiro";
import { nowBrasilia } from "@/lib/dataBrasilia";

/** Mesmo cálculo do preset "mes_atual" de FiltroPeriodoAvancado — usado só pro estado inicial. */
function periodoMesAtual(): FiltrosPeriodo {
  const hoje = nowBrasilia();
  const inicioMes = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1));
  const fimMes = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + 1, 0));
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  return { dataInicio: fmt(inicioMes), dataFim: fmt(fimMes) };
}

export default function Extrato() {
  const [filtro, setFiltro] = useState<FiltrosPeriodo>(periodoMesAtual);
  const {
    resumo,
    carregandoResumo,
    carregarResumo,
    eventos,
    carregandoLista,
    temMais,
    carregarLista,
    carregarMais,
    identidadeCarregando,
  } = useExtratoFinanceiro();

  useEffect(() => {
    if (identidadeCarregando || !filtro.dataInicio || !filtro.dataFim) return;
    carregarResumo(filtro);
    carregarLista(filtro, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identidadeCarregando, filtro.dataInicio, filtro.dataFim]);

  return (
    <AppLayout>
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-5xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Extrato</h1>
            <p className="text-muted-foreground">
              Todo o dinheiro que entrou e saiu da loja, como um extrato bancário.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Saldo Atual</CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  <ValorMonetario valor={resumo?.saldo_atual ?? 0} />
                </div>
                <p className="text-xs text-muted-foreground">Acumulado desde o início</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Entradas</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  <ValorMonetario valor={resumo?.entradas_periodo ?? 0} />
                </div>
                <p className="text-xs text-muted-foreground">No período selecionado</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Saídas</CardTitle>
                <TrendingDown className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">
                  <ValorMonetario valor={resumo?.saidas_periodo ?? 0} />
                </div>
                <p className="text-xs text-muted-foreground">No período selecionado</p>
              </CardContent>
            </Card>
          </div>

          <FiltroPeriodoAvancado
            onFiltrar={setFiltro}
            loading={carregandoResumo || carregandoLista}
          />

          <ListaExtrato
            eventos={eventos}
            carregando={carregandoLista}
            temMais={temMais}
            onCarregarMais={() => carregarMais(filtro)}
          />
        </div>
      </main>
    </AppLayout>
  );
}
