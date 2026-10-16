import { useState } from "react";
import { format, subDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TabelaVendas } from "@/components/vendas/TabelaVendas";
import { DashboardAReceber } from "@/components/vendas/DashboardAReceber";
import { DashboardResumoTipos } from "@/components/vendas/DashboardResumoTipos";
import { useVendas } from "@/hooks/useVendas";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import { Filter, Calendar, CalendarRange, ChevronUp, CreditCard, Layout, RefreshCw, Settings, Search, Tag, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { IlustracaoVendas } from "@/components/vendas/IlustracaoVendas";
import { TextoAjustado } from "@/components/vendas/TextoAjustado";
import { formatCurrency } from "@/lib/formatters";
import { AppLayout } from "@/components/layout/AppLayout";
import { DialogConfiguracaoLayoutVendas } from "@/components/vendas/DialogConfiguracaoLayoutVendas";
import { dataBrasiliaISO } from "@/lib/dataBrasilia";

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

// Estilos da área de filtros (referência visual layout-vendas)
const GRADIENTE_ATIVO = "bg-[linear-gradient(110deg,#1554F5,#079FD0)] text-white shadow-[0_5px_12px_rgba(36,107,255,0.17)]";
const FOCO = "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/25 focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const ROTULO = "mb-2.5 block text-[13px] font-semibold";
const CAMPO = "h-[52px] rounded-xl border-border bg-background pl-[42px] text-[13px] focus:ring-[3px] focus:ring-primary/10 focus:border-primary dark:bg-muted/40";
const ICONE_CAMPO = "pointer-events-none absolute left-3.5 top-1/2 z-10 h-[19px] w-[19px] -translate-y-1/2 text-muted-foreground";
const BOTAO_ACAO = cn(
  "flex h-[49px] items-center justify-center gap-2.5 rounded-xl text-[13px] font-semibold transition lg:w-48 disabled:pointer-events-none disabled:opacity-50",
  FOCO,
);

export default function Vendas() {
  const { vendas, todasVendas, loading, carregarVendas, cancelarVenda, editarVenda, alterarDataVenda, marcarComoRecebido, marcarComoPendente, excluirVenda, cancelarContaAPrazoOS } = useVendas();
  const { podeVerTotalVendas } = useFuncionarioPermissoes();
  const [dialogLayoutAberto, setDialogLayoutAberto] = useState(false);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState<string>("todos");
  const [pagamentoFiltro, setPagamentoFiltro] = useState<string>("todos");
  const [tipoFiltroData, setTipoFiltroData] = useState<"mes" | "periodo">("mes");
  const [mesSelecionado, setMesSelecionado] = useState<string>("");
  const [anoSelecionado, setAnoSelecionado] = useState<string>(new Date().getFullYear().toString());
  const [busca, setBusca] = useState<string>("");
  const [filtrosAbertos, setFiltrosAbertos] = useState(true);

  // Destaque visual do atalho de data: derivado do período já selecionado (não muda o filtro)
  const atalhoAtivo = (() => {
    if (tipoFiltroData !== "periodo" || !dataInicio || !dataFim) return null;
    const hoje = dataBrasiliaISO();
    const ontem = dataBrasiliaISO(subDays(new Date(), 1));
    if (dataInicio === hoje && dataFim === hoje) return "hoje";
    if (dataInicio === ontem && dataFim === ontem) return "ontem";
    if (dataInicio === dataBrasiliaISO(subDays(new Date(), 7)) && dataFim === hoje) return "7dias";
    return null;
  })();

  const anos = Array.from({ length: 2035 - 2020 + 1 }, (_, i) => (2035 - i).toString());

  const handleFiltrar = () => {
    let dataInicioFiltro = dataInicio;
    let dataFimFiltro = dataFim;

    if (tipoFiltroData === "mes" && mesSelecionado && anoSelecionado) {
      const ano = parseInt(anoSelecionado);
      const mes = parseInt(mesSelecionado);
      dataInicioFiltro = `${ano}-${mesSelecionado}-01`;
      const ultimoDia = new Date(ano, mes, 0).getDate();
      dataFimFiltro = `${ano}-${mesSelecionado}-${ultimoDia}`;
    }

    carregarVendas(dataInicioFiltro, dataFimFiltro);
  };

  const handleLimparFiltros = () => {
    setDataInicio("");
    setDataFim("");
    setTipoFiltro("todos");
    setPagamentoFiltro("todos");
    setMesSelecionado("");
    setAnoSelecionado(new Date().getFullYear().toString());
    setBusca("");
    carregarVendas();
  };

  const getPeriodoLabel = () => {
    if (tipoFiltroData === "mes" && mesSelecionado) {
      const mes = MESES.find(m => m.value === mesSelecionado)?.label ?? mesSelecionado;
      return `${mes}/${anoSelecionado}`;
    }
    if (tipoFiltroData === "periodo" && dataInicio && dataFim) {
      if (dataInicio === dataFim) return dataInicio.split("-").reverse().join("/");
      return `${dataInicio.split("-").reverse().join("/")} – ${dataFim.split("-").reverse().join("/")}`;
    }
    return "todos os períodos";
  };

  const vendasFiltradas = vendas.filter((venda) => {
    const tipoMatch = tipoFiltro === "todos" || venda.tipo === tipoFiltro;
    const pagamentoMatch =
      pagamentoFiltro === "todos" ||
      (venda.forma_pagamento && venda.forma_pagamento === pagamentoFiltro) ||
      (!venda.forma_pagamento && pagamentoFiltro === "todos");

    const term = busca.toLowerCase().trim();
    const buscaMatch = !term || [
      venda.produtos?.nome,
      venda.produtos?.sku,
      venda.pecas?.nome,
      venda.dispositivos?.modelo,
      venda.dispositivos?.marca,
      venda.dispositivos?.marca && venda.dispositivos?.modelo
        ? `${venda.dispositivos.marca} ${venda.dispositivos.modelo}`
        : undefined,
      venda.ordens_servico?.numero_os,
      venda.ordens_servico?.servicos?.nome,
      venda.clientes?.nome,
    ].some((campo) => campo?.toLowerCase().includes(term));

    return tipoMatch && pagamentoMatch && buscaMatch;
  });

  // Mesmo cálculo de antes, guardado para medir o tamanho do texto no card
  const totalVendidoTexto = formatCurrency(
    vendasFiltradas
      .filter(v => !v.cancelada)
      .reduce((acc, v) => {
        if (v.parcela_numero && Number(v.parcela_numero) > 1) return acc;
        const total = Number(v.total || 0) - Number(v.valor_desconto_manual || 0) - Number(v.valor_desconto_cupom || 0);
        if (v.total_parcelas && Number(v.total_parcelas) > 1 && Number(v.parcela_numero) === 1) {
          return acc + total * Number(v.total_parcelas);
        }
        return acc + total;
      }, 0)
  );

  return (
    <AppLayout>
      <main className="flex-1 p-4 sm:p-6 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
          {/* Cabeçalho da página */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 pt-1">
              <h1 className="text-[27px] min-[391px]:text-[30px] md:text-[35px] font-extrabold leading-[1.2] tracking-[-1px]">Vendas</h1>
              <p className="mt-2 max-w-[205px] min-[391px]:max-w-[245px] md:max-w-[500px] text-xs min-[391px]:text-[13px] leading-[1.6] text-muted-foreground">
                Lista completa de todas as vendas realizadas
              </p>
            </div>
            {/* md:mr-11: deixa livre o botão flutuante de privacidade (olho) do layout */}
            <div className="flex shrink-0 items-start gap-2 md:mr-11">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 w-9 gap-2 rounded-xl px-0 sm:w-auto sm:px-3" aria-label="Configurações">
                    <Settings className="h-4 w-4" />
                    <span className="hidden sm:inline">Configurações</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setDialogLayoutAberto(true)}>
                    <Layout className="h-4 w-4 mr-2" />
                    Layout de Impressão
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <IlustracaoVendas />
            </div>
          </div>

          {/* Filtros */}
          <section
            aria-labelledby="filtros-vendas-titulo"
            className="rounded-[20px] border border-border bg-card p-[15px] min-[391px]:p-5 shadow-[0_8px_25px_rgba(16,24,40,0.045),0_2px_6px_rgba(16,24,40,0.025)] dark:shadow-none"
          >
            <div className={cn("flex items-center justify-between gap-3", filtrosAbertos && "mb-[22px]")}>
              <div className="flex min-w-0 items-center gap-[13px]">
                <div className="flex h-[45px] w-[45px] shrink-0 items-center justify-center rounded-[13px] bg-primary/10 text-primary dark:bg-primary/15">
                  <Filter className="h-[23px] w-[23px]" />
                </div>
                <div className="min-w-0">
                  <h2 id="filtros-vendas-titulo" className="text-[17px] font-extrabold leading-tight">Filtros</h2>
                  <p className="mt-[5px] text-xs text-muted-foreground">Personalize a exibição das vendas</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFiltrosAbertos((v) => !v)}
                aria-expanded={filtrosAbertos}
                aria-controls="filtros-vendas-conteudo"
                aria-label={filtrosAbertos ? "Recolher filtros" : "Expandir filtros"}
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-primary transition-colors hover:bg-muted",
                  FOCO,
                )}
              >
                <ChevronUp className={cn("h-5 w-5 transition-transform duration-200", !filtrosAbertos && "rotate-180")} />
              </button>
            </div>

            <div id="filtros-vendas-conteudo" hidden={!filtrosAbertos}>
              {/* Atalhos de data */}
              <div className="scrollbar-hide -mx-1 flex gap-2 overflow-x-auto px-1 pb-[5px] md:flex-wrap">
                {([
                  {
                    id: "hoje",
                    label: "Hoje",
                    onClick: () => {
                      const hoje = dataBrasiliaISO();
                      setTipoFiltroData("periodo");
                      setDataInicio(hoje);
                      setDataFim(hoje);
                      carregarVendas(hoje, hoje);
                    },
                  },
                  {
                    id: "ontem",
                    label: "Ontem",
                    onClick: () => {
                      const ontem = dataBrasiliaISO(subDays(new Date(), 1));
                      setTipoFiltroData("periodo");
                      setDataInicio(ontem);
                      setDataFim(ontem);
                      carregarVendas(ontem, ontem);
                    },
                  },
                  {
                    id: "7dias",
                    label: "Últimos 7 dias",
                    onClick: () => {
                      const hoje = dataBrasiliaISO();
                      const seteDiasAtras = dataBrasiliaISO(subDays(new Date(), 7));
                      setTipoFiltroData("periodo");
                      setDataInicio(seteDiasAtras);
                      setDataFim(hoje);
                      carregarVendas(seteDiasAtras, hoje);
                    },
                  },
                ] as const).map((atalho) => {
                  const ativo = atalhoAtivo === atalho.id;
                  return (
                    <button
                      key={atalho.id}
                      type="button"
                      onClick={atalho.onClick}
                      aria-pressed={ativo}
                      className={cn(
                        "flex h-[43px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[11px] border px-[11px] min-[391px]:px-[13px] text-xs font-medium transition-colors",
                        ativo
                          ? cn("border-transparent", GRADIENTE_ATIVO)
                          : "border-border bg-background text-foreground hover:bg-muted dark:bg-muted/40 dark:hover:bg-muted",
                        FOCO,
                      )}
                    >
                      <Calendar className="h-[17px] w-[17px]" />
                      {atalho.label}
                    </button>
                  );
                })}
              </div>

              {/* Mês / Período */}
              <p className="mb-[13px] mt-[23px] flex items-center gap-2.5 text-[13px] font-semibold">
                <Calendar className="h-[19px] w-[19px]" />
                Filtrar por:
              </p>
              <div className="grid grid-cols-2 gap-[5px] rounded-[13px] border border-border bg-background p-1 dark:bg-muted/40 md:max-w-md">
                {([
                  { valor: "mes", label: "Mês", Icone: Calendar },
                  { valor: "periodo", label: "Período", Icone: CalendarRange },
                ] as const).map(({ valor, label, Icone }) => {
                  const ativo = tipoFiltroData === valor;
                  return (
                    <button
                      key={valor}
                      type="button"
                      onClick={() => setTipoFiltroData(valor)}
                      aria-pressed={ativo}
                      className={cn(
                        "flex h-[45px] items-center justify-center gap-2.5 rounded-[10px] text-[13px] transition-colors",
                        ativo ? cn("font-semibold", GRADIENTE_ATIVO) : "font-medium text-foreground hover:bg-muted",
                        FOCO,
                      )}
                    >
                      <Icone className="h-[18px] w-[18px]" />
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Campos */}
              <div className="mt-[22px] grid grid-cols-1 gap-[19px] sm:grid-cols-2 lg:grid-cols-4">
                {tipoFiltroData === "mes" ? (
                  <>
                    <div>
                      <Label htmlFor="mes" className={ROTULO}>Mês</Label>
                      <div className="relative">
                        <Calendar className={ICONE_CAMPO} aria-hidden="true" />
                        <Select value={mesSelecionado} onValueChange={setMesSelecionado}>
                          <SelectTrigger id="mes" className={CAMPO}>
                            <SelectValue placeholder="Selecione o mês" />
                          </SelectTrigger>
                          <SelectContent>
                            {MESES.map((mes) => (
                              <SelectItem key={mes.value} value={mes.value}>
                                {mes.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="ano" className={ROTULO}>Ano</Label>
                      <div className="relative">
                        <Calendar className={ICONE_CAMPO} aria-hidden="true" />
                        <Select value={anoSelecionado} onValueChange={setAnoSelecionado}>
                          <SelectTrigger id="ano" className={CAMPO}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {anos.map((ano) => (
                              <SelectItem key={ano} value={ano}>
                                {ano}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <Label htmlFor="dataInicio" className={ROTULO}>Data Início</Label>
                      <div className="relative">
                        <Calendar className={ICONE_CAMPO} aria-hidden="true" />
                        <Input
                          id="dataInicio"
                          type="date"
                          value={dataInicio}
                          onChange={(e) => setDataInicio(e.target.value)}
                          className={CAMPO}
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="dataFim" className={ROTULO}>Data Fim</Label>
                      <div className="relative">
                        <Calendar className={ICONE_CAMPO} aria-hidden="true" />
                        <Input
                          id="dataFim"
                          type="date"
                          value={dataFim}
                          onChange={(e) => setDataFim(e.target.value)}
                          className={CAMPO}
                        />
                      </div>
                    </div>
                  </>
                )}
                <div>
                  <Label htmlFor="tipo" className={ROTULO}>Tipo</Label>
                  <div className="relative">
                    <Tag className={ICONE_CAMPO} aria-hidden="true" />
                    <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
                      <SelectTrigger id="tipo" className={CAMPO}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="dispositivo">Dispositivos</SelectItem>
                        <SelectItem value="produto">Produtos</SelectItem>
                        <SelectItem value="servico">Serviços</SelectItem>
                        <SelectItem value="avulsa">Venda Avulsa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="pagamento" className={ROTULO}>Pagamento</Label>
                  <div className="relative">
                    <CreditCard className={ICONE_CAMPO} aria-hidden="true" />
                    <Select value={pagamentoFiltro} onValueChange={setPagamentoFiltro}>
                      <SelectTrigger id="pagamento" className={CAMPO}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="dinheiro">Dinheiro</SelectItem>
                        <SelectItem value="pix">PIX</SelectItem>
                        <SelectItem value="debito">Débito</SelectItem>
                        <SelectItem value="credito">Crédito</SelectItem>
                        <SelectItem value="credito_parcelado">Crédito Parcelado</SelectItem>
                        <SelectItem value="a_receber">A Receber</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Ações */}
              <div className="mt-6 grid grid-cols-2 gap-[11px] lg:flex lg:justify-end">
                <button
                  type="button"
                  onClick={handleFiltrar}
                  disabled={loading}
                  className={cn(BOTAO_ACAO, GRADIENTE_ATIVO, "shadow-[0_6px_15px_rgba(36,107,255,0.17)] hover:brightness-105")}
                >
                  <Filter className="h-[19px] w-[19px]" />
                  Filtrar
                </button>
                <button
                  type="button"
                  onClick={handleLimparFiltros}
                  disabled={loading}
                  className={cn(BOTAO_ACAO, "border border-border bg-background text-foreground hover:bg-muted dark:bg-muted/40 dark:hover:bg-muted")}
                >
                  <RefreshCw className="h-[19px] w-[19px]" />
                  Limpar
                </button>
              </div>
            </div>
          </section>

          {/* Card Total Vendido no Período */}
          {podeVerTotalVendas && (
            <section
              aria-label="Total vendido"
              className={cn(
                "relative min-h-[150px] overflow-hidden rounded-[20px] border p-4 min-[376px]:p-[22px] md:min-h-[175px]",
                "border-[#D0E0FF] bg-[linear-gradient(120deg,#EDF4FF,#E4EDFF)]",
                "dark:border-primary/25 dark:bg-[linear-gradient(120deg,hsl(var(--primary)/0.16),hsl(var(--primary)/0.06))]",
              )}
            >
              {/* Barrinhas decorativas */}
              <div aria-hidden="true" className="pointer-events-none absolute bottom-3.5 right-[18px] flex h-[75px] items-end gap-[7px] opacity-[0.38]">
                {[22, 43, 35, 57, 75].map((altura) => (
                  <span key={altura} className="w-3.5 rounded-[5px_5px_3px_3px] bg-[#9DBFFF] dark:bg-primary/35" style={{ height: altura }} />
                ))}
              </div>

              <div className="relative z-10 flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[15px] bg-[linear-gradient(135deg,#448BFF,#1554F5)] text-white shadow-[0_7px_18px_rgba(36,107,255,0.2)] min-[376px]:h-[55px] min-[376px]:w-[55px]">
                  <TrendingUp className="h-[29px] w-[29px]" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold min-[376px]:text-base">Total vendido</p>
                  <p className="mt-1.5 text-xs text-muted-foreground">{getPeriodoLabel()}</p>
                  {loading ? (
                    <div className="mt-[17px] h-9 w-40 animate-pulse rounded-lg bg-primary/10" />
                  ) : (
                    <TextoAjustado
                      caracteres={totalVendidoTexto.length}
                      min={18}
                      max={40}
                      classeReserva="text-[24px] md:text-[40px]"
                      className="mt-[17px] font-extrabold leading-none tracking-[-1.2px] text-primary"
                      classeContainer="pr-[68px] md:pr-0"
                    >
                      {totalVendidoTexto}
                    </TextoAjustado>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Resumo por Tipo */}
          <div className="space-y-[19px]">
            <div>
              <h2 className="text-[23px] font-extrabold leading-tight tracking-[-0.7px]">Resumo por Tipo</h2>
              <p className="mt-2 text-[13px] text-muted-foreground">
                Vendas separadas por categoria
              </p>
            </div>
            <DashboardResumoTipos vendas={vendasFiltradas} loading={loading} />
          </div>

          {/* Dashboard A Receber */}
          <div className="space-y-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold">Vendas a Receber</h2>
              <p className="text-muted-foreground text-sm">
                Valores pendentes de recebimento
              </p>
            </div>
            <DashboardAReceber
              vendas={todasVendas}
              loading={loading}
              onMarcarRecebido={marcarComoRecebido}
            />
          </div>

          {/* Tabela de Vendas */}
          <Card>
            <CardHeader className="pb-3 sm:pb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="text-base sm:text-lg">Lista de Vendas</CardTitle>
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome, modelo, código..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 sm:p-6 sm:pt-0">
              <TabelaVendas
                vendas={vendasFiltradas}
                loading={loading}
                onCancelarVenda={cancelarVenda}
                onMarcarRecebido={marcarComoRecebido}
                onMarcarPendente={marcarComoPendente}
                onExcluirVenda={excluirVenda}
                onEditarVenda={editarVenda}
                onAlterarDataVenda={alterarDataVenda}
                onCancelarContaAPrazoOS={cancelarContaAPrazoOS}
              />
            </CardContent>
          </Card>
        </div>
      </main>

      <DialogConfiguracaoLayoutVendas
        open={dialogLayoutAberto}
        onOpenChange={setDialogLayoutAberto}
      />
    </AppLayout>
  );
}
