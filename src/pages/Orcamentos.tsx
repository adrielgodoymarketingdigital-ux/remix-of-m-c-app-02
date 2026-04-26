import { useState } from "react";
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
import { Plus, Search, FileText, Clock, CheckCircle } from "lucide-react";
import { useOrcamentos } from "@/hooks/useOrcamentos";
import { TabelaOrcamentos } from "@/components/orcamentos/TabelaOrcamentos";
import { DialogCadastroOrcamento } from "@/components/orcamentos/DialogCadastroOrcamento";
import { DialogVisualizarOrcamento } from "@/components/orcamentos/DialogVisualizarOrcamento";
import { Orcamento } from "@/types/orcamento";
import { formatCurrency } from "@/lib/formatters";
import { AppLayout } from "@/components/layout/AppLayout";

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
  const [orcamentoSelecionado, setOrcamentoSelecionado] = useState<Orcamento | null>(null);
  const [orcamentoExcluir, setOrcamentoExcluir] = useState<Orcamento | null>(null);

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

  const handleConfirmarExclusao = async () => {
    if (orcamentoExcluir) {
      await excluirOrcamento(orcamentoExcluir.id);
      setOrcamentoExcluir(null);
    }
  };

  return (
    <AppLayout>
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Orçamentos</h1>
            <p className="text-muted-foreground">
              Gerencie seus orçamentos e propostas comerciais
            </p>
          </div>
          <Button onClick={() => setDialogAberto(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Orçamento
          </Button>
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
          />
        )}
      </main>

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

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog
        open={!!orcamentoExcluir}
        onOpenChange={() => setOrcamentoExcluir(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o orçamento{" "}
              <strong>{orcamentoExcluir?.numero_orcamento}</strong>? Esta ação não
              pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmarExclusao}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
