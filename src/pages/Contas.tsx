import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Plus, CalendarIcon, X, CheckCircle } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DialogCadastroConta } from "@/components/contas/DialogCadastroConta";
import { TabelaContas } from "@/components/contas/TabelaContas";
import { DashboardContas } from "@/components/contas/DashboardContas";
import { useContas } from "@/hooks/useContas";
import { useFornecedores } from "@/hooks/useFornecedores";
import { Conta, CATEGORIAS_CONTA } from "@/types/conta";
import { Skeleton } from "@/components/ui/skeleton";
import { AppLayout } from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";

const MESES = [
  { value: "01", label: "Janeiro" },
  { value: "02", label: "Fevereiro" },
  { value: "03", label: "Março" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Maio" },
  { value: "06", label: "Junho" },
  { value: "07", label: "Julho" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

const ANOS = Array.from({ length: 2035 - 2020 + 1 }, (_, i) => (2035 - i).toString());

export default function Contas() {
  const [filtroTipo, setFiltroTipo] = useState<"todos" | "pagar" | "receber">("todos");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "pendente" | "pago">("todos");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todos");
  const [filtroFornecedor, setFiltroFornecedor] = useState<string>("todos");
  const [dataInicio, setDataInicio] = useState<Date | undefined>();
  const [dataFim, setDataFim] = useState<Date | undefined>();
  const [mesSelecionado, setMesSelecionado] = useState<string>("");
  const [anoSelecionado, setAnoSelecionado] = useState<string>("");
  const [dialogAberto, setDialogAberto] = useState(false);
  const [contaEditando, setContaEditando] = useState<Conta | null>(null);
  const [contasSelecionadas, setContasSelecionadas] = useState<string[]>([]);

  const {
    contas,
    loading,
    criarConta,
    atualizarConta,
    excluirConta,
    marcarComoPaga,
    marcarVariasComoPaga,
  } = useContas();

  const { fornecedores } = useFornecedores();

  // Build unique categories from existing data + CATEGORIAS_CONTA
  const categoriasDisponiveis = useMemo(() => {
    const cats = new Set<string>(CATEGORIAS_CONTA);
    contas.forEach(c => { if (c.categoria) cats.add(c.categoria); });
    return Array.from(cats).sort();
  }, [contas]);

  const contasFiltradas = useMemo(() => {
    return contas.filter((conta) => {
      const matchTipo = filtroTipo === "todos" || conta.tipo === filtroTipo;
      const matchStatus =
        filtroStatus === "todos" ||
        (filtroStatus === "pendente" && conta.status === "pendente") ||
        (filtroStatus === "pago" && (conta.status === "pago" || conta.status === "recebido"));
      const matchCategoria = filtroCategoria === "todos" || conta.categoria === filtroCategoria;
      const matchFornecedor = filtroFornecedor === "todos" || conta.fornecedor_id === filtroFornecedor;
      
      let matchData = true;
      
      // Filtro por mês/ano
      const mesEfetivo = mesSelecionado;
      const anoEfetivo = anoSelecionado || (mesSelecionado ? new Date().getFullYear().toString() : "");
      
      if (mesEfetivo && anoEfetivo) {
        const contaDataStr = String(conta.data).substring(0, 7); // "YYYY-MM"
        const mesAnoStr = `${anoEfetivo}-${mesEfetivo}`;
        matchData = contaDataStr === mesAnoStr;
      } else if (anoEfetivo && !mesEfetivo) {
        const contaAno = String(conta.data).substring(0, 4);
        matchData = contaAno === anoEfetivo;
      } else {
        if (dataInicio) {
          const contaDataStr = String(conta.data).substring(0, 10);
          const inicioStr = `${dataInicio.getFullYear()}-${String(dataInicio.getMonth() + 1).padStart(2, '0')}-${String(dataInicio.getDate()).padStart(2, '0')}`;
          matchData = contaDataStr >= inicioStr;
        }
        if (dataFim && matchData) {
          const contaDataStr = String(conta.data).substring(0, 10);
          const fimStr = `${dataFim.getFullYear()}-${String(dataFim.getMonth() + 1).padStart(2, '0')}-${String(dataFim.getDate()).padStart(2, '0')}`;
          matchData = contaDataStr <= fimStr;
        }
      }

      return matchTipo && matchStatus && matchCategoria && matchFornecedor && matchData;
    });
  }, [contas, filtroTipo, filtroStatus, filtroCategoria, filtroFornecedor, dataInicio, dataFim, mesSelecionado, anoSelecionado]);

  const temFiltrosAtivos = filtroCategoria !== "todos" || filtroFornecedor !== "todos" || dataInicio || dataFim || mesSelecionado !== "" || anoSelecionado !== "";

  const limparFiltros = () => {
    setFiltroCategoria("todos");
    setFiltroFornecedor("todos");
    setDataInicio(undefined);
    setDataFim(undefined);
    setMesSelecionado("");
    setAnoSelecionado("");
  };

  const handleSubmit = async (dados: any) => {
    if (contaEditando) {
      return await atualizarConta(contaEditando.id, dados);
    } else {
      return await criarConta(dados);
    }
  };

  const handleEditar = (conta: Conta) => {
    setContaEditando(conta);
    setDialogAberto(true);
  };

  const handleNovaConta = () => {
    setContaEditando(null);
    setDialogAberto(true);
  };

  const handleExcluir = async (id: string) => {
    await excluirConta(id);
  };

  const handleMarcarComoPaga = async (id: string, tipo: 'pagar' | 'receber') => {
    await marcarComoPaga(id, tipo);
  };

  const handleToggleSelecao = (id: string) => {
    setContasSelecionadas(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleToggleTodas = () => {
    const pendentes = contasFiltradas.filter(c => c.status === "pendente");
    const todasSelecionadas = pendentes.every(c => contasSelecionadas.includes(c.id));
    if (todasSelecionadas) {
      setContasSelecionadas([]);
    } else {
      setContasSelecionadas(pendentes.map(c => c.id));
    }
  };

  const handleBaixaEmMassa = async () => {
    const sucesso = await marcarVariasComoPaga(contasSelecionadas);
    if (sucesso) {
      setContasSelecionadas([]);
    }
  };

  return (
    <AppLayout>
      <main className="flex-1 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Contas a Pagar/Receber</h1>
            <p className="text-muted-foreground">
              Controle suas contas a pagar e receber
            </p>
          </div>
          <Button onClick={handleNovaConta}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Conta
          </Button>
        </div>

        {/* Dashboard - receives filtered data */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <DashboardContas contas={contasFiltradas} />
        )}

        {/* Filtros */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row gap-4">
            <Tabs
              value={filtroTipo}
              onValueChange={(v: any) => setFiltroTipo(v)}
              className="w-full md:w-auto"
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="todos">Todas</TabsTrigger>
                <TabsTrigger value="pagar" style={{ backgroundColor: filtroTipo === 'pagar' ? '#2563eb' : undefined, color: filtroTipo === 'pagar' ? '#fff' : undefined }}>A Pagar</TabsTrigger>
                <TabsTrigger value="receber" style={{ backgroundColor: filtroTipo === 'receber' ? '#2563eb' : undefined, color: filtroTipo === 'receber' ? '#fff' : undefined }}>A Receber</TabsTrigger>
              </TabsList>
            </Tabs>

            <Tabs
              value={filtroStatus}
              onValueChange={(v: any) => setFiltroStatus(v)}
              className="w-full md:w-auto"
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="todos">Todos</TabsTrigger>
                <TabsTrigger value="pendente" style={{ backgroundColor: filtroStatus === 'pendente' ? '#16a34a' : undefined, color: filtroStatus === 'pendente' ? '#fff' : undefined }}>Pendentes</TabsTrigger>
                <TabsTrigger value="pago" style={{ backgroundColor: filtroStatus === 'pago' ? '#16a34a' : undefined, color: filtroStatus === 'pago' ? '#fff' : undefined }}>Pagas</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Filtros avançados */}
          <div className="flex flex-col md:flex-row gap-3 items-start md:items-center flex-wrap">
            <Select value={mesSelecionado || "todos"} onValueChange={(v) => {
              setMesSelecionado(v === "todos" ? "" : v);
              if (v !== "todos") { setDataInicio(undefined); setDataFim(undefined); }
            }}>
              <SelectTrigger className="w-full md:w-[160px]">
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os meses</SelectItem>
                {MESES.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={anoSelecionado || "todos"} onValueChange={(v) => {
              setAnoSelecionado(v === "todos" ? "" : v);
              if (v !== "todos") { setDataInicio(undefined); setDataFim(undefined); }
            }}>
              <SelectTrigger className="w-full md:w-[120px]">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {ANOS.map(a => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas categorias</SelectItem>
                {categoriasDisponiveis.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filtroFornecedor} onValueChange={setFiltroFornecedor}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Fornecedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos fornecedores</SelectItem>
                {fornecedores.map(f => (
                  <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full md:w-[180px] justify-start text-left font-normal", !dataInicio && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataInicio ? format(dataInicio, "dd/MM/yyyy") : "Data início"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dataInicio} onSelect={setDataInicio} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full md:w-[180px] justify-start text-left font-normal", !dataFim && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataFim ? format(dataFim, "dd/MM/yyyy") : "Data fim"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dataFim} onSelect={setDataFim} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>

            {temFiltrosAtivos && (
              <Button variant="ghost" size="sm" onClick={limparFiltros}>
                <X className="h-4 w-4 mr-1" />
                Limpar filtros
              </Button>
            )}
          </div>
        </div>

        {/* Barra de ações em massa */}
        {contasSelecionadas.length > 0 && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
            <span className="text-sm font-medium">
              {contasSelecionadas.length} conta(s) selecionada(s)
            </span>
            <Button size="sm" onClick={handleBaixaEmMassa}>
              <CheckCircle className="h-4 w-4 mr-1" />
              Dar Baixa
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setContasSelecionadas([])}>
              Cancelar
            </Button>
          </div>
        )}

        {/* Tabela */}
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <TabelaContas
            contas={contasFiltradas}
            onEditar={handleEditar}
            onExcluir={handleExcluir}
            onMarcarComoPaga={handleMarcarComoPaga}
            contasSelecionadas={contasSelecionadas}
            onToggleSelecao={handleToggleSelecao}
            onToggleTodas={handleToggleTodas}
          />
        )}
      </main>

      <DialogCadastroConta
        open={dialogAberto}
        onOpenChange={setDialogAberto}
        onSubmit={handleSubmit}
        conta={contaEditando}
      />
    </AppLayout>
  );
}
