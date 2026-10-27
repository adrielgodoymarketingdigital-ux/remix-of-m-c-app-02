import { useState } from "react";
import { useTranslation } from "react-i18next";
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
import { FormatoMoedaProvider } from "@/components/ui/valor-monetario";
import { useFormatadores } from "@/hooks/useFormatadores";
import { useNomesFormaPagamento } from "@/hooks/useNomesFormaPagamento";
import { AppLayout } from "@/components/layout/AppLayout";
import { DialogConfiguracaoLayoutVendas } from "@/components/vendas/DialogConfiguracaoLayoutVendas";
import { dataBrasiliaISO } from "@/lib/dataBrasilia";

const VALORES_MESES = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"] as const;

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
  // Textos: namespace "vendas"; moeda e datas: useFormatadores (conta).
  const { t } = useTranslation("vendas");
  const fmt = useFormatadores();
  const nomesForma = useNomesFormaPagamento();
  const nomesMeses = t("pagina.meses", { returnObjects: true }) as readonly string[];
  const MESES = VALORES_MESES.map((value, i) => ({ value, label: nomesMeses[i] }));
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
      return t("pagina.periodoMes", { mes, ano: anoSelecionado });
    }
    if (tipoFiltroData === "periodo" && dataInicio && dataFim) {
      if (dataInicio === dataFim) return fmt.data(dataInicio);
      return t("pagina.periodoIntervalo", { inicio: fmt.data(dataInicio), fim: fmt.data(dataFim) });
    }
    return t("pagina.todosPeriodos");
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
  const totalVendidoTexto = fmt.moeda(
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
      <FormatoMoedaProvider value={fmt.moeda}>
      <main className="flex-1 p-4 sm:p-6 overflow-auto">
        <div className="max-w-7xl lg:max-w-none mx-auto space-y-4 sm:space-y-6">
          {/* Cabeçalho da página */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 pt-1">
              <h1 className="text-[27px] min-[391px]:text-[30px] md:text-[35px] font-extrabold leading-[1.2] tracking-[-1px]">{t("pagina.titulo")}</h1>
              <p className="mt-2 max-w-[205px] min-[391px]:max-w-[245px] md:max-w-[500px] text-xs min-[391px]:text-[13px] leading-[1.6] text-muted-foreground">
                {t("pagina.subtitulo")}
              </p>
            </div>
            {/* md:mr-11: deixa livre o botão flutuante de privacidade (olho) do layout */}
            <div className="flex shrink-0 items-start gap-2 md:mr-11">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 w-9 gap-2 rounded-xl px-0 sm:w-auto sm:px-3" aria-label={t("pagina.configuracoes")}>
                    <Settings className="h-4 w-4" />
                    <span className="hidden sm:inline">{t("pagina.configuracoes")}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setDialogLayoutAberto(true)}>
                    <Layout className="h-4 w-4 mr-2" />
                    {t("pagina.layoutImpressao")}
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
                  <h2 id="filtros-vendas-titulo" className="text-[17px] font-extrabold leading-tight">{t("pagina.filtros.titulo")}</h2>
                  <p className="mt-[5px] text-xs text-muted-foreground">{t("pagina.filtros.subtitulo")}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFiltrosAbertos((v) => !v)}
                aria-expanded={filtrosAbertos}
                aria-controls="filtros-vendas-conteudo"
                aria-label={filtrosAbertos ? t("pagina.filtros.recolher") : t("pagina.filtros.expandir")}
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
                    label: t("pagina.filtros.hoje"),
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
                    label: t("pagina.filtros.ontem"),
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
                    label: t("pagina.filtros.ultimos7Dias"),
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
                {t("pagina.filtros.filtrarPor")}
              </p>
              <div className="grid grid-cols-2 gap-[5px] rounded-[13px] border border-border bg-background p-1 dark:bg-muted/40 md:max-w-md">
                {([
                  { valor: "mes", label: t("pagina.filtros.mes"), Icone: Calendar },
                  { valor: "periodo", label: t("pagina.filtros.periodo"), Icone: CalendarRange },
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
                      <Label htmlFor="mes" className={ROTULO}>{t("pagina.filtros.mes")}</Label>
                      <div className="relative">
                        <Calendar className={ICONE_CAMPO} aria-hidden="true" />
                        <Select value={mesSelecionado} onValueChange={setMesSelecionado}>
                          <SelectTrigger id="mes" className={CAMPO}>
                            <SelectValue placeholder={t("pagina.filtros.selecioneMes")} />
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
                      <Label htmlFor="ano" className={ROTULO}>{t("pagina.filtros.ano")}</Label>
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
                      <Label htmlFor="dataInicio" className={ROTULO}>{t("pagina.filtros.dataInicio")}</Label>
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
                      <Label htmlFor="dataFim" className={ROTULO}>{t("pagina.filtros.dataFim")}</Label>
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
                  <Label htmlFor="tipo" className={ROTULO}>{t("pagina.filtros.tipo")}</Label>
                  <div className="relative">
                    <Tag className={ICONE_CAMPO} aria-hidden="true" />
                    <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
                      <SelectTrigger id="tipo" className={CAMPO}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">{t("pagina.filtros.todos")}</SelectItem>
                        <SelectItem value="dispositivo">{t("pagina.tipos.dispositivo")}</SelectItem>
                        <SelectItem value="produto">{t("pagina.tipos.produto")}</SelectItem>
                        <SelectItem value="servico">{t("pagina.tipos.servico")}</SelectItem>
                        <SelectItem value="avulsa">{t("pagina.tipos.avulsa")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="pagamento" className={ROTULO}>{t("pagina.filtros.pagamento")}</Label>
                  <div className="relative">
                    <CreditCard className={ICONE_CAMPO} aria-hidden="true" />
                    <Select value={pagamentoFiltro} onValueChange={setPagamentoFiltro}>
                      <SelectTrigger id="pagamento" className={CAMPO}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">{t("pagina.filtros.todos")}</SelectItem>
                        {(["dinheiro", "pix", "debito", "credito", "credito_parcelado", "a_receber"] as const).map((forma) => (
                          <SelectItem key={forma} value={forma}>{nomesForma.curto[forma]}</SelectItem>
                        ))}
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
                  {t("pagina.filtros.filtrar")}
                </button>
                <button
                  type="button"
                  onClick={handleLimparFiltros}
                  disabled={loading}
                  className={cn(BOTAO_ACAO, "border border-border bg-background text-foreground hover:bg-muted dark:bg-muted/40 dark:hover:bg-muted")}
                >
                  <RefreshCw className="h-[19px] w-[19px]" />
                  {t("pagina.filtros.limpar")}
                </button>
              </div>
            </div>
          </section>

          {/* Card Total Vendido no Período */}
          {podeVerTotalVendas && (
            <section
              aria-label={t("pagina.totalVendido")}
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
                  <p className="text-sm font-bold min-[376px]:text-base">{t("pagina.totalVendido")}</p>
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
              <h2 className="text-[23px] font-extrabold leading-tight tracking-[-0.7px]">{t("pagina.resumoPorTipo")}</h2>
              <p className="mt-2 text-[13px] text-muted-foreground">
                {t("pagina.resumoPorTipoDescricao")}
              </p>
            </div>
            <DashboardResumoTipos vendas={vendasFiltradas} loading={loading} />
          </div>

          {/* Dashboard A Receber */}
          <div className="space-y-[18px]">
            <div>
              <h2 className="text-[23px] font-extrabold leading-tight tracking-[-0.7px]">{t("pagina.aReceber")}</h2>
              <p className="mt-[7px] text-[13px] text-muted-foreground">
                {t("pagina.aReceberDescricao")}
              </p>
            </div>
            <DashboardAReceber
              vendas={todasVendas}
              loading={loading}
              onMarcarRecebido={marcarComoRecebido}
            />
          </div>

          {/* Tabela de Vendas */}
          <section
            aria-labelledby="lista-vendas-titulo"
            className="rounded-[19px] border border-border bg-card px-3.5 py-[17px] shadow-[0_5px_18px_rgba(16,24,40,0.035)] dark:shadow-none md:p-[22px]"
          >
            <div className="mb-[18px] flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 id="lista-vendas-titulo" className="text-xl font-extrabold tracking-[-0.5px]">{t("pagina.lista")}</h2>
              <div className="relative w-full sm:w-80">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[19px] w-[19px] -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  placeholder={t("pagina.buscarPlaceholder")}
                  aria-label={t("pagina.buscarRotulo")}
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="h-[49px] rounded-xl border-border bg-background pl-[43px] text-[13px] placeholder:text-[#7A879A] focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/15 focus-visible:ring-offset-0 dark:bg-muted/40 dark:placeholder:text-muted-foreground sm:h-11"
                />
              </div>
            </div>
            <div>
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
            </div>
          </section>
        </div>
      </main>
      </FormatoMoedaProvider>

      <DialogConfiguracaoLayoutVendas
        open={dialogLayoutAberto}
        onOpenChange={setDialogLayoutAberto}
      />
    </AppLayout>
  );
}
