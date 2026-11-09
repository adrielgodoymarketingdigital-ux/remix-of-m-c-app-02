import { useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Search, FileText, Clock, CheckCircle, Settings } from "lucide-react";
import { useOrcamentos } from "@/hooks/useOrcamentos";
import { TabelaOrcamentos } from "@/components/orcamentos/TabelaOrcamentos";
import { DialogCadastroOrcamento } from "@/components/orcamentos/DialogCadastroOrcamento";
import { DialogVisualizarOrcamento } from "@/components/orcamentos/DialogVisualizarOrcamento";
import { DialogConverterOrcamentoOS } from "@/components/orcamentos/DialogConverterOrcamentoOS";
import { DialogConfiguracaoLayoutOrcamento } from "@/components/orcamentos/DialogConfiguracaoLayoutOrcamento";
import { Orcamento } from "@/types/orcamento";
import { formatCurrency } from "@/lib/formatters";
import { AppLayout } from "@/components/layout/AppLayout";
import { useIsDesktop } from "@/hooks/use-mobile";
import { TopoOrcamentosDesktop } from "@/components/orcamentos/desktop/TopoOrcamentosDesktop";
import { FiltrosOrcamentosDesktop } from "@/components/orcamentos/desktop/FiltrosOrcamentosDesktop";
import { TabelaOrcamentosDesktop } from "@/components/orcamentos/desktop/TabelaOrcamentosDesktop";
import {
  filtrarOrcamentos,
  paginar,
  POR_PAGINA_PADRAO,
  resumoOrcamentos,
  TODOS_OS_STATUS,
  type FiltroStatus,
} from "@/lib/orcamentos/listaOrcamentosDesktop";

export default function Orcamentos() {
  const {
    orcamentos,
    carregando,
    criarOrcamento,
    atualizarOrcamento,
    atualizarStatus,
    excluirOrcamento,
  } = useOrcamentos();

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [dialogAberto, setDialogAberto] = useState(false);
  const [dialogVisualizarAberto, setDialogVisualizarAberto] = useState(false);
  const [dialogConverterAberto, setDialogConverterAberto] = useState(false);
  const [orcamentoSelecionado, setOrcamentoSelecionado] = useState<Orcamento | null>(null);
  const [orcamentoExcluir, setOrcamentoExcluir] = useState<Orcamento | null>(null);
  const [configLayoutAberto, setConfigLayoutAberto] = useState(false);
  const isDesktop = useIsDesktop();
  // Só no computador: status efetivo e período pela criação (a busca é a mesma de cima).
  const [statusDesktop, setStatusDesktop] = useState<FiltroStatus>(TODOS_OS_STATUS);
  const [dataInicioDesktop, setDataInicioDesktop] = useState("");
  const [dataFimDesktop, setDataFimDesktop] = useState("");
  const [paginaDesktop, setPaginaDesktop] = useState(1);
  const [porPaginaDesktop, setPorPaginaDesktop] = useState(POR_PAGINA_PADRAO);
  const { t: tExclusao } = useTranslation("comum", { keyPrefix: "orcamentos.tabela.exclusao" });

  const orcamentosFiltrados = orcamentos.filter((o) => {
    const matchBusca =
      o.numero_orcamento.toLowerCase().includes(busca.toLowerCase()) ||
      o.cliente_nome?.toLowerCase().includes(busca.toLowerCase());
    const matchStatus = filtroStatus === "todos" || o.status === filtroStatus;
    return matchBusca && matchStatus;
  });

  const stats = {
    total: orcamentos.length,
    pendentes: orcamentos.filter((o) => o.status === "pendente").length,
    aprovados: orcamentos.filter((o) => o.status === "aprovado").length,
    valorTotal: orcamentos
      .filter((o) => o.status === "aprovado" || o.status === "convertido")
      .reduce((acc, o) => acc + o.valor_total, 0),
  };
  // Computador (>= 1024px): cartões pelas regras de src/lib/orcamentos/listaOrcamentosDesktop
  // (mesmas contas de `stats`, somando em centavos). Abaixo disso segue `stats`.
  const resumoDesktop = useMemo(() => resumoOrcamentos(orcamentos), [orcamentos]);
  const orcamentosFiltradosDesktop = useMemo(
    () =>
      filtrarOrcamentos(orcamentos, {
        busca,
        status: statusDesktop,
        dataInicio: dataInicioDesktop,
        dataFim: dataFimDesktop,
      }),
    [orcamentos, busca, statusDesktop, dataInicioDesktop, dataFimDesktop],
  );
  const temFiltrosAtivosDesktop =
    busca.trim() !== "" || statusDesktop !== TODOS_OS_STATUS || dataInicioDesktop !== "" || dataFimDesktop !== "";
  const limparFiltrosDesktop = () => {
    setBusca("");
    setStatusDesktop(TODOS_OS_STATUS);
    setDataInicioDesktop("");
    setDataFimDesktop("");
  };

  // Volta para a página 1 quando a busca, um filtro ou o tamanho da página mudam
  // (ajuste de estado durante a renderização, como em Serviços).
  const chaveFiltrosDesktop = JSON.stringify([busca, statusDesktop, dataInicioDesktop, dataFimDesktop, porPaginaDesktop]);
  const [chaveFiltrosAnterior, setChaveFiltrosAnterior] = useState(chaveFiltrosDesktop);
  let paginaPedidaDesktop = paginaDesktop;
  if (chaveFiltrosAnterior !== chaveFiltrosDesktop) {
    setChaveFiltrosAnterior(chaveFiltrosDesktop);
    setPaginaDesktop(1);
    paginaPedidaDesktop = 1;
  }
  const paginaAtualDesktop = useMemo(
    () => paginar(orcamentosFiltradosDesktop, paginaPedidaDesktop, porPaginaDesktop),
    [orcamentosFiltradosDesktop, paginaPedidaDesktop, porPaginaDesktop],
  );
  // A lista encolheu (exclusão, mudança de status com filtro) e a página pedida sumiu: fica na última que existe.
  if (!carregando && paginaAtualDesktop.pagina !== paginaPedidaDesktop) setPaginaDesktop(paginaAtualDesktop.pagina);

  const handleSalvar = async (dados: any) => {
    if (orcamentoSelecionado) {
      await atualizarOrcamento(orcamentoSelecionado.id, dados);
    } else {
      await criarOrcamento(dados);
    }
    setDialogAberto(false);
    setOrcamentoSelecionado(null);
  };

  const handleEditar = (orcamento: Orcamento) => {
    setOrcamentoSelecionado(orcamento);
    setDialogAberto(true);
  };

  const handleVisualizar = (orcamento: Orcamento) => {
    setOrcamentoSelecionado(orcamento);
    setDialogVisualizarAberto(true);
  };

  const handleConverterOS = (orcamento: Orcamento) => {
    setOrcamentoSelecionado(orcamento);
    setDialogConverterAberto(true);
  };

  const handleConfirmarExclusao = async () => {
    if (orcamentoExcluir) {
      await excluirOrcamento(orcamentoExcluir.id);
      setOrcamentoExcluir(null);
    }
  };

  return (
    <AppLayout>
      {isDesktop ? (
        // Computador (>= 1024px): mesmo estado, mesmos handlers e diálogos; topo, filtros e tabela próprios.
        // Abaixo disso segue o layout de sempre (ramo de baixo, intocado).
        <main className="flex-1 overflow-auto p-6 space-y-6">
          <TopoOrcamentosDesktop
            resumo={resumoDesktop}
            carregando={carregando}
            onConfigurarLayout={() => setConfigLayoutAberto(true)}
            onNovoOrcamento={() => setDialogAberto(true)}
          />

          <FiltrosOrcamentosDesktop
            busca={busca}
            onBusca={setBusca}
            status={statusDesktop}
            onStatus={setStatusDesktop}
            dataInicio={dataInicioDesktop}
            onDataInicio={setDataInicioDesktop}
            dataFim={dataFimDesktop}
            onDataFim={setDataFimDesktop}
            temFiltrosAtivos={temFiltrosAtivosDesktop}
            onLimparFiltros={limparFiltrosDesktop}
            carregando={carregando}
            quantidadeEncontrada={orcamentosFiltradosDesktop.length}
          />

          <TabelaOrcamentosDesktop
            pagina={paginaAtualDesktop}
            porPagina={porPaginaDesktop}
            onPagina={setPaginaDesktop}
            onPorPagina={setPorPaginaDesktop}
            carregando={carregando}
            totalGeral={orcamentos.length}
            onNovoOrcamento={() => setDialogAberto(true)}
            onLimparFiltros={limparFiltrosDesktop}
            onVisualizar={handleVisualizar}
            onEditar={handleEditar}
            onExcluir={setOrcamentoExcluir}
            onAtualizarStatus={atualizarStatus}
            onConverterOS={handleConverterOS}
          />
        </main>
      ) : (
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Orçamentos</h1>
            <p className="text-muted-foreground">
              Gerencie seus orçamentos e propostas comerciais
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setConfigLayoutAberto(true)}
              title="Configurar layout de impressão"
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button onClick={() => setDialogAberto(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Orçamento
            </Button>
          </div>
        </div>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Orçamentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{stats.total}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pendentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-500" />
                <span className="text-2xl font-bold">{stats.pendentes}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Aprovados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-2xl font-bold">{stats.aprovados}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Valor Aprovado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {formatCurrency(stats.valorTotal)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por número ou cliente..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="aprovado">Aprovado</SelectItem>
              <SelectItem value="rejeitado">Rejeitado</SelectItem>
              <SelectItem value="expirado">Expirado</SelectItem>
              <SelectItem value="convertido">Convertido</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tabela */}
        {carregando ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <TabelaOrcamentos
            orcamentos={orcamentosFiltrados}
            onVisualizar={handleVisualizar}
            onEditar={handleEditar}
            onExcluir={setOrcamentoExcluir}
            onAtualizarStatus={atualizarStatus}
            onConverterOS={handleConverterOS}
          />
        )}
      </main>
      )}

      {/* Dialog de Configuração de Layout de Impressão */}
      <DialogConfiguracaoLayoutOrcamento
        open={configLayoutAberto}
        onOpenChange={setConfigLayoutAberto}
      />

      {/* Dialog de Cadastro/Edição */}
      <DialogCadastroOrcamento
        aberto={dialogAberto}
        onFechar={() => {
          setDialogAberto(false);
          setOrcamentoSelecionado(null);
        }}
        onSalvar={handleSalvar}
        orcamentoEdicao={orcamentoSelecionado}
      />

      {/* Dialog de Visualização */}
      <DialogVisualizarOrcamento
        aberto={dialogVisualizarAberto}
        onFechar={() => {
          setDialogVisualizarAberto(false);
          setOrcamentoSelecionado(null);
        }}
        orcamento={orcamentoSelecionado}
      />

      {/* Dialog de Converter em OS */}
      <DialogConverterOrcamentoOS
        aberto={dialogConverterAberto}
        onFechar={() => {
          setDialogConverterAberto(false);
          setOrcamentoSelecionado(null);
        }}
        orcamento={orcamentoSelecionado}
        onConvertido={() => {
          setDialogConverterAberto(false);
          setOrcamentoSelecionado(null);
        }}
      />

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog
        open={!!orcamentoExcluir}
        onOpenChange={() => setOrcamentoExcluir(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            {/* Computador: os mesmos textos traduzidos (comum.orcamentos.tabela.exclusao).
                Abaixo de 1024px, os de sempre. */}
            <AlertDialogTitle>{isDesktop ? tExclusao("titulo") : "Confirmar exclusão"}</AlertDialogTitle>
            <AlertDialogDescription>
              {isDesktop ? (
                <Trans
                  t={tExclusao}
                  i18nKey="texto"
                  values={{ numero: orcamentoExcluir?.numero_orcamento }}
                  components={{ b: <strong /> }}
                />
              ) : (
                <>
              Tem certeza que deseja excluir o orçamento{" "}
              <strong>{orcamentoExcluir?.numero_orcamento}</strong>? Esta ação não
              pode ser desfeita.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isDesktop ? tExclusao("cancelar") : "Cancelar"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmarExclusao}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDesktop ? tExclusao("confirmar") : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
