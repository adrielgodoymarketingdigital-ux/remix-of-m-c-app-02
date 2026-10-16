import { useState, useMemo, useRef } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import {
  Plus, X, CheckCircle, LayoutGrid, TrendingDown, TrendingUp, Layers, Clock3, CircleCheck,
  CalendarDays, CalendarRange, Truck, ChevronDown, RefreshCw,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DialogCadastroConta } from "@/components/contas/DialogCadastroConta";
import { TabelaContas } from "@/components/contas/TabelaContas";
import { DashboardContas, type CardContas } from "@/components/contas/DashboardContas";
import { inicioDoDiaHoje, isContaVencida } from "@/lib/contas/contaVencida";
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

// Visual dos filtros (referência layout-contas/referencia-lista). Só classes; os Tabs/Selects são os mesmos.
const SEGMENTO = "grid h-auto w-full grid-cols-3 gap-1 rounded-none bg-transparent p-0";
// Os dois grupos: inativo branco com borda, ativo azul com gradiente (como na imagem de referência)
const OPCAO = cn(
  "flex h-[49px] min-w-0 items-center justify-center gap-[7px] rounded-xl border border-border bg-card px-[5px] text-[13px] font-medium text-[#66758F] shadow-[0_2px_8px_rgba(16,24,40,0.03)] max-[370px]:gap-1 max-[370px]:text-xs dark:text-muted-foreground",
  "[&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0 max-[370px]:[&>svg]:h-3.5 max-[370px]:[&>svg]:w-3.5",
  "data-[state=active]:border-transparent data-[state=active]:bg-[linear-gradient(105deg,#246BFF,#079FD0)] data-[state=active]:text-white data-[state=active]:shadow-[0_5px_12px_rgba(36,107,255,0.18)] dark:data-[state=active]:text-white",
  "focus-visible:ring-[3px] focus-visible:ring-[#A7C8FF] focus-visible:ring-offset-2",
);
const CAMPO_FILTRO = cn(
  "h-[53px] w-full justify-start gap-[13px] rounded-[13px] border border-border bg-card px-[15px] text-left text-sm font-medium text-foreground shadow-none hover:bg-card",
  "[&>span]:flex-1 [&>span]:text-left [&>svg]:shrink-0 [&>svg:first-child]:h-5 [&>svg:first-child]:w-5 [&>svg:first-child]:text-[#526580] [&>svg:last-child]:h-[17px] [&>svg:last-child]:w-[17px] [&>svg:last-child]:text-[#526580] [&>svg:last-child]:opacity-100",
  "dark:[&>svg]:text-muted-foreground",
  "focus:ring-[3px] focus:ring-[#A7C8FF] focus:ring-offset-0 focus-visible:ring-[3px] focus-visible:ring-[#A7C8FF] focus-visible:ring-offset-0",
);
const BOTAO_ACAO_FILTRO = "flex h-[51px] w-full items-center justify-center gap-[9px] rounded-xl border text-sm font-bold transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-offset-2 focus-visible:ring-offset-background [&>svg]:h-[19px] [&>svg]:w-[19px]";

/** Ilustração decorativa do cabeçalho: documento com cifrão (SVG próprio). */
function IlustracaoContas() {
  return (
    <svg aria-hidden="true" viewBox="0 0 120 90" className="h-[78px] w-[104px] opacity-90 min-[391px]:h-[90px] min-[391px]:w-[120px] dark:opacity-60">
      <circle cx="16" cy="40" r="7" fill="#C9DCFF" />
      <path d="M16 47 C17 60 20 70 24 80" stroke="#C9DCFF" strokeWidth="3" strokeLinecap="round" fill="none" />
      <rect x="30" y="6" width="58" height="76" rx="9" fill="#E3EDFF" />
      <rect x="36" y="2" width="58" height="76" rx="9" fill="#D3E3FF" opacity="0.7" />
      <rect x="44" y="20" width="26" height="5" rx="2.5" fill="#9DBFFF" />
      <rect x="44" y="32" width="40" height="5" rx="2.5" fill="#B5CEFF" />
      <rect x="44" y="44" width="34" height="5" rx="2.5" fill="#9DBFFF" />
      <rect x="44" y="56" width="40" height="5" rx="2.5" fill="#B5CEFF" />
      <circle cx="96" cy="32" r="17" fill="#3D7EFF" />
      <text x="96" y="39" textAnchor="middle" fontSize="20" fontWeight="700" fill="#fff" fontFamily="Inter, system-ui, sans-serif">$</text>
    </svg>
  );
}

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
  // Filtro "Vencidas" (só ativado pelo card) e qual card está com o filtro aplicado
  const [filtroVencidas, setFiltroVencidas] = useState(false);
  const [cardAtivo, setCardAtivo] = useState<CardContas | null>(null);
  const listaRef = useRef<HTMLDivElement>(null);
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
    registrarPagamentoParcial,
    estornarPagamento,
    listarPagamentos,
  } = useContas();

  const { fornecedores } = useFornecedores();

  // Build unique categories from existing data + CATEGORIAS_CONTA
  const categoriasDisponiveis = useMemo(() => {
    const cats = new Set<string>(CATEGORIAS_CONTA);
    contas.forEach(c => { if (c.categoria) cats.add(c.categoria); });
    return Array.from(cats).sort();
  }, [contas]);

  const contasFiltradas = useMemo(() => {
    const hoje = inicioDoDiaHoje();
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

      const matchVencidas = !filtroVencidas || isContaVencida(conta, hoje);

      return matchTipo && matchStatus && matchCategoria && matchFornecedor && matchData && matchVencidas;
    });
  }, [contas, filtroTipo, filtroStatus, filtroCategoria, filtroFornecedor, dataInicio, dataFim, mesSelecionado, anoSelecionado, filtroVencidas]);

  const temFiltrosAtivos = filtroCategoria !== "todos" || filtroFornecedor !== "todos" || dataInicio || dataFim || mesSelecionado !== "" || anoSelecionado !== "" || filtroVencidas;

  const limparFiltros = () => {
    setFiltroVencidas(false);
    setCardAtivo(null);
    setFiltroCategoria("todos");
    setFiltroFornecedor("todos");
    setDataInicio(undefined);
    setDataFim(undefined);
    setMesSelecionado("");
    setAnoSelecionado("");
  };

  // Toque no card: aplica o filtro equivalente ao número do card (os filtros
  // extras ficam como estão, porque os cards já são calculados sobre eles).
  // Tocar de novo no card ativo desfaz (volta para Todas + Todos).
  const handleSelecionarCard = (card: CardContas) => {
    if (cardAtivo === card) {
      setFiltroTipo("todos");
      setFiltroStatus("todos");
      setFiltroVencidas(false);
      setCardAtivo(null);
      return;
    }
    const tipoPorCard = { pagar: "pagar", receber: "receber", saldo: "todos", vencidas: "todos" } as const;
    setFiltroTipo(tipoPorCard[card]);
    setFiltroStatus("pendente");
    setFiltroVencidas(card === "vencidas");
    setCardAtivo(card);
    requestAnimationFrame(() => listaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  // Mudança manual de filtro: tira o destaque do card (o filtro "Vencidas" só sai pelo chip ou Limpar)
  const manual = () => setCardAtivo(null);

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

  const handleMarcarComoPaga = async (id: string, tipo: 'pagar' | 'receber', formaPagamento?: string) => {
    await marcarComoPaga(id, tipo, formaPagamento);
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
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="max-w-[290px] text-[26px] font-extrabold leading-[1.18] tracking-[-1px] text-[#0B1429] min-[391px]:text-[30px] md:max-w-[600px] md:text-4xl dark:text-foreground">
              Contas a Pagar/Receber
            </h1>
            <p className="mt-3 max-w-[240px] text-[13px] leading-[1.6] text-muted-foreground md:max-w-none">
              Controle suas contas a pagar e receber
            </p>
          </div>
          <div className="flex w-[42%] max-w-[230px] shrink-0 flex-col items-end">
            <IlustracaoContas />
            <button
              type="button"
              onClick={handleNovaConta}
              className={cn(
                "-mt-3 flex h-[51px] w-full items-center justify-center gap-2.5 rounded-xl text-[15px] font-semibold text-white",
                "bg-[linear-gradient(100deg,#1748E9,#079FD0)] shadow-[0_8px_18px_rgba(36,107,255,0.15)] transition hover:brightness-105",
                "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              )}
            >
              <Plus className="h-5 w-5" aria-hidden="true" />
              Nova Conta
            </button>
          </div>
        </div>

        {/* Dashboard - receives filtered data */}
        {loading ? (
          <div className="grid grid-cols-1 gap-[13px] md:grid-cols-2">
            <Skeleton className="h-[105px] w-full rounded-[17px]" />
            <Skeleton className="h-[105px] w-full rounded-[17px]" />
            <Skeleton className="h-[105px] w-full rounded-[17px]" />
            <Skeleton className="h-[105px] w-full rounded-[17px]" />
          </div>
        ) : (
          <DashboardContas contas={contasFiltradas} cardAtivo={cardAtivo} onSelecionarCard={handleSelecionarCard} />
        )}

        {/* Filtros */}
        <div className="flex flex-col">
          <div className="flex flex-col gap-[13px] md:flex-row md:gap-4 md:pr-12">
            <Tabs
              value={filtroTipo}
              onValueChange={(v: any) => { manual(); setFiltroTipo(v); }}
              className="w-full md:flex-1"
            >
              <TabsList aria-label="Tipo de conta" className={SEGMENTO}>
                <TabsTrigger value="todos" className={OPCAO}><LayoutGrid aria-hidden="true" />Todas</TabsTrigger>
                <TabsTrigger value="pagar" className={cn(OPCAO, "[&:not([data-state=active])>svg]:text-[#F04438]")}><TrendingDown aria-hidden="true" />A Pagar</TabsTrigger>
                <TabsTrigger value="receber" className={cn(OPCAO, "[&:not([data-state=active])>svg]:text-[#18B76A]")}><TrendingUp aria-hidden="true" />A Receber</TabsTrigger>
              </TabsList>
            </Tabs>

            <Tabs
              value={filtroStatus}
              onValueChange={(v: any) => { manual(); setFiltroStatus(v); }}
              className="w-full md:flex-1"
            >
              <TabsList aria-label="Situação da conta" className={SEGMENTO}>
                <TabsTrigger value="todos" className={OPCAO}><Layers aria-hidden="true" />Todos</TabsTrigger>
                <TabsTrigger value="pendente" className={OPCAO}><Clock3 aria-hidden="true" />Pendentes</TabsTrigger>
                <TabsTrigger value="pago" className={OPCAO}><CircleCheck aria-hidden="true" />Pagas</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Filtros avançados (aplicam na hora; não há botão "Filtrar") */}
          <div className="mt-5 grid grid-cols-1 gap-[11px] md:grid-cols-2">
            <Select value={mesSelecionado || "todos"} onValueChange={(v) => {
              manual();
              setMesSelecionado(v === "todos" ? "" : v);
              if (v !== "todos") { setDataInicio(undefined); setDataFim(undefined); }
            }}>
              <SelectTrigger aria-label="Mês" className={CAMPO_FILTRO}>
                <CalendarDays aria-hidden="true" />
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
              manual();
              setAnoSelecionado(v === "todos" ? "" : v);
              if (v !== "todos") { setDataInicio(undefined); setDataFim(undefined); }
            }}>
              <SelectTrigger aria-label="Ano" className={CAMPO_FILTRO}>
                <CalendarRange aria-hidden="true" />
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {ANOS.map(a => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filtroCategoria} onValueChange={(v) => { manual(); setFiltroCategoria(v); }}>
              <SelectTrigger aria-label="Categoria" className={CAMPO_FILTRO}>
                <LayoutGrid aria-hidden="true" />
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas categorias</SelectItem>
                {categoriasDisponiveis.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filtroFornecedor} onValueChange={(v) => { manual(); setFiltroFornecedor(v); }}>
              <SelectTrigger aria-label="Fornecedor" className={CAMPO_FILTRO}>
                <Truck aria-hidden="true" />
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
                <Button variant="outline" className={cn(CAMPO_FILTRO, !dataInicio && "text-muted-foreground hover:text-muted-foreground")}>
                  <CalendarDays aria-hidden="true" />
                  <span>{dataInicio ? format(dataInicio, "dd/MM/yyyy") : "Data início"}</span>
                  <ChevronDown aria-hidden="true" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dataInicio} onSelect={(d) => { manual(); setDataInicio(d); }} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn(CAMPO_FILTRO, !dataFim && "text-muted-foreground hover:text-muted-foreground")}>
                  <CalendarDays aria-hidden="true" />
                  <span>{dataFim ? format(dataFim, "dd/MM/yyyy") : "Data fim"}</span>
                  <ChevronDown aria-hidden="true" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dataFim} onSelect={(d) => { manual(); setDataFim(d); }} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          {/* Ações dos filtros: chip "Vencidas" (quando ativo) e Limpar (só com filtro ativo, como antes) */}
          {temFiltrosAtivos && (
            <div className={cn("mt-[19px] grid gap-2.5", filtroVencidas ? "grid-cols-2" : "grid-cols-1")}>
              {filtroVencidas && (
                <button
                  type="button"
                  onClick={() => { setFiltroVencidas(false); setCardAtivo(null); }}
                  aria-label="Remover filtro Vencidas"
                  className={cn(BOTAO_ACAO_FILTRO, "border-[#FFD9BF] bg-[#FFF0E1] text-[#C2410C] hover:bg-[#FFE4CC] focus-visible:ring-orange-400/40 dark:border-orange-500/30 dark:bg-orange-500/15 dark:text-orange-300")}
                >
                  Vencidas
                  <X aria-hidden="true" />
                </button>
              )}
              <button
                type="button"
                onClick={limparFiltros}
                className={cn(BOTAO_ACAO_FILTRO, "border-border bg-card text-[#0B1429] hover:bg-muted/60 focus-visible:ring-[#A7C8FF] dark:text-foreground")}
              >
                <RefreshCw aria-hidden="true" />
                Limpar filtros
              </button>
            </div>
          )}
        </div>

        {/* Início da lista: destino da rolagem ao tocar num card */}
        <div ref={listaRef} className="scroll-mt-28 md:scroll-mt-6" aria-hidden="true" />

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
            onRegistrarPagamento={registrarPagamentoParcial}
            onEstornarPagamento={estornarPagamento}
            listarPagamentos={listarPagamentos}
          />
        )}
      </main>

      <DialogCadastroConta
        open={dialogAberto}
        onOpenChange={setDialogAberto}
        onSubmit={handleSubmit}
        conta={contaEditando}
        tipoInicial={filtroTipo === "receber" ? "receber" : "pagar"}
      />
    </AppLayout>
  );
}
