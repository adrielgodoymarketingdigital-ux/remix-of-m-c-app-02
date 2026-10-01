import { useEffect, useState } from "react";
import { Wallet, TrendingUp, TrendingDown, Store, PlusCircle, Scale } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { FiltroPeriodoAvancado, FiltrosPeriodo } from "@/components/financeiro/FiltroPeriodoAvancado";
import { ListaExtrato } from "@/components/financeiro/ListaExtrato";
import { DialogDetalheExtrato } from "@/components/financeiro/DialogDetalheExtrato";
import { DialogLancamentoExtrato } from "@/components/financeiro/DialogLancamentoExtrato";
import { DialogBalancoCaixa } from "@/components/financeiro/DialogBalancoCaixa";
import { DialogEditarLancamentoExtrato } from "@/components/financeiro/DialogEditarLancamentoExtrato";
import { DialogExcluirLancamentoExtrato } from "@/components/financeiro/DialogExcluirLancamentoExtrato";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  EdicaoLancamentoExtrato,
  EventoExtrato,
  NovoLancamentoExtrato,
  ORIGENS_PDV,
  useExtratoFinanceiro,
} from "@/hooks/useExtratoFinanceiro";
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
  const [somentePDV, setSomentePDV] = useState(false);
  const [eventoDetalhe, setEventoDetalhe] = useState<EventoExtrato | null>(null);
  const [eventoEditando, setEventoEditando] = useState<EventoExtrato | null>(null);
  const [eventoExcluindo, setEventoExcluindo] = useState<EventoExtrato | null>(null);
  const [lancamentoAberto, setLancamentoAberto] = useState(false);
  const [balancoAberto, setBalancoAberto] = useState(false);
  const origensLista = somentePDV ? ORIGENS_PDV : undefined;
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
    buscarSaldoAtual,
    criarLancamento,
    atualizarLancamento,
    excluirLancamento,
  } = useExtratoFinanceiro();

  // Lançamento manual e ajuste de balanço: grava e recarrega cards + lista.
  const salvarLancamento = async (lancamento: NovoLancamentoExtrato) => {
    const ok = await criarLancamento(lancamento);
    if (!ok) return false;
    toast.success(lancamento.categoria === "balanco" ? "Balanço lançado — saldo ajustado" : "Lançamento registrado");
    carregarResumo(filtro);
    carregarLista(filtro, 0, origensLista);
    return true;
  };

  // Editar valor/data/conta-no-saldo de um lançamento manual ou de balanço já gravado.
  const salvarEdicaoLancamento = async (edicao: EdicaoLancamentoExtrato) => {
    const ok = await atualizarLancamento(edicao);
    if (!ok) return false;
    toast.success("Lançamento atualizado");
    carregarResumo(filtro);
    carregarLista(filtro, 0, origensLista);
    return true;
  };

  // Excluir: o saldo/cards recalculam sozinhos (somam direto da tabela), só recarrega.
  const confirmarExclusaoLancamento = async (evento: EventoExtrato) => {
    setEventoExcluindo(null);
    const ok = await excluirLancamento(evento.referencia_id);
    if (!ok) return;
    toast.success("Lançamento excluído");
    carregarResumo(filtro);
    carregarLista(filtro, 0, origensLista);
  };

  useEffect(() => {
    if (identidadeCarregando || !filtro.dataInicio || !filtro.dataFim) return;
    carregarResumo(filtro);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identidadeCarregando, filtro.dataInicio, filtro.dataFim]);

  // O filtro "Só PDV" restringe só a lista; os cards continuam com o total do período.
  useEffect(() => {
    if (identidadeCarregando || !filtro.dataInicio || !filtro.dataFim) return;
    carregarLista(filtro, 0, origensLista);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identidadeCarregando, filtro.dataInicio, filtro.dataFim, somentePDV]);

  return (
    <AppLayout>
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">Extrato</h1>
              <p className="text-muted-foreground">
                Todo o dinheiro que entrou e saiu da loja, como um extrato bancário.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setBalancoAberto(true)} disabled={identidadeCarregando}>
                <Scale className="h-4 w-4 mr-2" />
                Balanço do caixa
              </Button>
              <Button onClick={() => setLancamentoAberto(true)} disabled={identidadeCarregando}>
                <PlusCircle className="h-4 w-4 mr-2" />
                Lançar entrada/saída
              </Button>
            </div>
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

          <div className="flex items-center gap-2">
            <Switch id="extrato-somente-pdv" checked={somentePDV} onCheckedChange={setSomentePDV} />
            <Label htmlFor="extrato-somente-pdv" className="flex items-center gap-1.5 text-sm cursor-pointer">
              <Store className="h-4 w-4 text-muted-foreground" />
              Só movimentações do PDV (sangria e suprimento)
            </Label>
          </div>

          <ListaExtrato
            eventos={eventos}
            carregando={carregandoLista}
            temMais={temMais}
            onCarregarMais={() => carregarMais(filtro, origensLista)}
            onVerDetalhes={setEventoDetalhe}
            onEditar={setEventoEditando}
            onExcluir={setEventoExcluindo}
            mensagemVazio={somentePDV ? "Nenhuma sangria ou suprimento do PDV neste período." : undefined}
          />

          <DialogLancamentoExtrato
            open={lancamentoAberto}
            onOpenChange={setLancamentoAberto}
            onSalvar={salvarLancamento}
          />

          <DialogBalancoCaixa
            open={balancoAberto}
            onOpenChange={setBalancoAberto}
            buscarSaldoAtual={buscarSaldoAtual}
            onSalvar={salvarLancamento}
          />

          <DialogDetalheExtrato
            evento={eventoDetalhe}
            onOpenChange={(open) => { if (!open) setEventoDetalhe(null); }}
          />

          <DialogEditarLancamentoExtrato
            evento={eventoEditando}
            onOpenChange={(open) => { if (!open) setEventoEditando(null); }}
            onSalvar={salvarEdicaoLancamento}
          />

          <DialogExcluirLancamentoExtrato
            evento={eventoExcluindo}
            onOpenChange={(open) => { if (!open) setEventoExcluindo(null); }}
            onConfirmar={confirmarExclusaoLancamento}
          />
        </div>
      </main>
    </AppLayout>
  );
}
