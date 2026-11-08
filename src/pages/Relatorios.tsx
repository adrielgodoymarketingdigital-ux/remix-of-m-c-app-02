import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useRelatoriosVendas } from "@/hooks/useRelatoriosVendas";
import { useRelatorios } from "@/hooks/useRelatorios";
import { AvisoCustoNaoConfirmado } from "@/components/financeiro/AvisoCustoNaoConfirmado";
import { RelatorioDispositivosComponent } from "@/components/relatorios/RelatorioDispositivos";
import { RelatorioProdutosComponent } from "@/components/relatorios/RelatorioProdutos";
import { RelatorioServicosComponent } from "@/components/relatorios/RelatorioServicos";
import { RelatorioVendasAvulsasComponent } from "@/components/relatorios/RelatorioVendasAvulsas";
import { Filter, Calendar, FileDown, ClipboardList, ShoppingCart, TrendingUp, Users, Loader2, Download, BarChart3, ChevronRight, Smartphone, Package, Wrench, Receipt } from "lucide-react";
import { useIsDesktop } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  RelatorioDispositivo,
  RelatorioProduto,
  RelatorioServico,
  RelatorioVendaAvulsa,
  FiltrosRelatorioVendas,
} from "@/types/relatorio-vendas";
import { FiltrosRelatorio } from "@/types/relatorio";
import { AppLayout } from "@/components/layout/AppLayout";
import { useConfiguracaoLoja } from "@/hooks/useConfiguracaoLoja";
import { useIdentidadeLeitura } from "@/hooks/useResolvedUserId";
import { supabase } from "@/integrations/supabase/client";
import { limitesDiaBrasilia } from "@/lib/dataBrasilia";
import {
  gerarRelatorioDispositivosPDF,
  gerarRelatorioProdutosPDF,
  gerarRelatorioServicosPDF,
} from "@/lib/gerarRelatoriosPDF";
import {
  gerarRelatorioOSPDF,
  gerarRelatorioVendasCompletoPDF,
  gerarRelatorioFinanceiroPDF,
  gerarRelatorioClientesPDF,
  OSExportItem,
  VendaExportItem,
  ClienteExportItem,
} from "@/lib/gerarRelatoriosExportPDF";

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

// Só o layout do computador: acento de cada cartão de exportação (transparência, vale nos dois temas).
const ACENTO_EXPORTACAO_DESKTOP: Record<string, { icone: string; cartao: string; botao: string }> = {
  os: {
    icone: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    cartao: "hover:border-blue-500/40",
    botao: "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300 group-hover:bg-blue-500/15",
  },
  vendas: {
    icone: "bg-green-500/10 text-green-600 dark:text-green-400",
    cartao: "hover:border-green-500/40",
    botao: "border-green-500/20 bg-green-500/10 text-green-700 dark:text-green-300 group-hover:bg-green-500/15",
  },
  financeiro: {
    icone: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    cartao: "hover:border-purple-500/40",
    botao: "border-purple-500/20 bg-purple-500/10 text-purple-700 dark:text-purple-300 group-hover:bg-purple-500/15",
  },
  clientes: {
    icone: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    cartao: "hover:border-orange-500/40",
    botao: "border-orange-500/20 bg-orange-500/10 text-orange-700 dark:text-orange-300 group-hover:bg-orange-500/15",
  },
};

const ABAS_DESKTOP = [
  { value: "dispositivos", label: "Dispositivos", icon: Smartphone },
  { value: "produtos", label: "Produtos", icon: Package },
  { value: "servicos", label: "Serviços", icon: Wrench },
  { value: "avulsas", label: "Venda Avulsa", icon: Receipt },
];

const IconeSecao = ({ icon: Icon }: { icon: typeof Filter }) => (
  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
    <Icon className="h-5 w-5" />
  </div>
);

export default function Relatorios() {
  const {
    loading,
    resolvedUserId,
    buscarRelatorioDispositivos,
    buscarRelatorioProdutos,
    buscarRelatorioServicos,
    buscarRelatorioVendasAvulsas,
  } = useRelatoriosVendas();

  const { calcularResumo, calcularEvolucaoMensal } = useRelatorios();
  const { config } = useConfiguracaoLoja();
  // Loja da visão (filtroLeituraLoja): filial = só a loja; matriz = matriz + sem loja.
  const { userId: identidadeUserId, empresaId: empresaFiltro, isFilial } = useIdentidadeLeitura();
  const isDesktop = useIsDesktop();

  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [tipoFiltroData, setTipoFiltroData] = useState<"mes" | "periodo">("mes");
  const [mesSelecionado, setMesSelecionado] = useState<string>("");
  const [anoSelecionado, setAnoSelecionado] = useState<string>(new Date().getFullYear().toString());
  const [dispositivos, setDispositivos] = useState<RelatorioDispositivo[]>([]);
  const [produtos, setProdutos] = useState<RelatorioProduto[]>([]);
  const [servicos, setServicos] = useState<RelatorioServico[]>([]);
  const [vendasAvulsas, setVendasAvulsas] = useState<RelatorioVendaAvulsa[]>([]);
  const [activeTab, setActiveTab] = useState("dispositivos");
  const [exportando, setExportando] = useState(false);
  const [exportandoTipo, setExportandoTipo] = useState<string | null>(null);

  const anos = Array.from({ length: 2035 - 2020 + 1 }, (_, i) => (2035 - i).toString());

  useEffect(() => {
    if (resolvedUserId === null) return;
    carregarDados(tipoFiltroData, mesSelecionado, anoSelecionado, dataInicio, dataFim);
  }, [resolvedUserId]);

  useEffect(() => {
    const handler = () => {
      carregarDados(tipoFiltroData, mesSelecionado, anoSelecionado, dataInicio, dataFim);
    };
    window.addEventListener("os-salva", handler);
    return () => window.removeEventListener("os-salva", handler);
  }, [tipoFiltroData, mesSelecionado, anoSelecionado, dataInicio, dataFim]);

  const calcularDatas = (
    _tipo: string,
    _mes: string,
    _ano: string,
    _inicio: string,
    _fim: string
  ) => {
    let dataInicioFiltro = _inicio;
    let dataFimFiltro = _fim;
    if (_tipo === "mes" && _mes && _ano) {
      const ano = parseInt(_ano);
      const mes = parseInt(_mes);
      const ultimoDia = new Date(ano, mes, 0).getDate();
      dataInicioFiltro = `${_ano}-${_mes}-01`;
      dataFimFiltro = `${_ano}-${_mes}-${String(ultimoDia).padStart(2, "0")}`;
    }
    return { dataInicioFiltro, dataFimFiltro };
  };

  const carregarDados = async (
    _tipo = tipoFiltroData,
    _mes = mesSelecionado,
    _ano = anoSelecionado,
    _inicio = dataInicio,
    _fim = dataFim
  ) => {
    const { dataInicioFiltro, dataFimFiltro } = calcularDatas(_tipo, _mes, _ano, _inicio, _fim);
    const filtros: FiltrosRelatorioVendas = { dataInicio: dataInicioFiltro, dataFim: dataFimFiltro };
    const [dispositivosData, produtosData, servicosData, vendasAvulsasData] = await Promise.all([
      buscarRelatorioDispositivos(filtros),
      buscarRelatorioProdutos(filtros),
      buscarRelatorioServicos(filtros),
      buscarRelatorioVendasAvulsas(filtros),
    ]);
    setDispositivos(dispositivosData);
    setProdutos(produtosData);
    setServicos(servicosData);
    setVendasAvulsas(vendasAvulsasData);
  };

  const handleFiltrar = () => {
    carregarDados(tipoFiltroData, mesSelecionado, anoSelecionado, dataInicio, dataFim);
  };

  const handleLimparFiltros = () => {
    const novoMes = "";
    const novoAno = new Date().getFullYear().toString();
    setDataInicio("");
    setDataFim("");
    setMesSelecionado(novoMes);
    setAnoSelecionado(novoAno);
    carregarDados(tipoFiltroData, novoMes, novoAno, "", "");
  };

  const getPeriodoTexto = () => {
    if (tipoFiltroData === "mes" && mesSelecionado && anoSelecionado) {
      const mesLabel = MESES.find((m) => m.value === mesSelecionado)?.label || mesSelecionado;
      return `${mesLabel} de ${anoSelecionado}`;
    }
    if (tipoFiltroData === "periodo" && dataInicio && dataFim) {
      const inicio = new Date(dataInicio + "T00:00:00").toLocaleDateString("pt-BR");
      const fim = new Date(dataFim + "T00:00:00").toLocaleDateString("pt-BR");
      return `${inicio} a ${fim}`;
    }
    return "Todo o período";
  };

  const getFiltrosRelatorio = (): FiltrosRelatorio => {
    const { dataInicioFiltro, dataFimFiltro } = calcularDatas(
      tipoFiltroData, mesSelecionado, anoSelecionado, dataInicio, dataFim
    );
    return { dataInicio: dataInicioFiltro, dataFim: dataFimFiltro };
  };

  // ── Exportar abas de análise ──────────────────────────────────────────────
  const handleExportarAnalise = async () => {
    setExportando(true);
    try {
      const periodo = getPeriodoTexto();
      if (activeTab === "dispositivos") {
        await gerarRelatorioDispositivosPDF(dispositivos, config, periodo);
      } else if (activeTab === "produtos") {
        await gerarRelatorioProdutosPDF(produtos, config, periodo);
      } else if (activeTab === "servicos") {
        await gerarRelatorioServicosPDF(servicos, config, periodo);
      }
    } finally {
      setExportando(false);
    }
  };

  // ── Exportações da seção Relatórios ──────────────────────────────────────
  const exportarOS = async () => {
    setExportandoTipo("os");
    try {
      const { dataInicioFiltro, dataFimFiltro } = calcularDatas(
        tipoFiltroData, mesSelecionado, anoSelecionado, dataInicio, dataFim
      );
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;
      const userId = identidadeUserId ?? user.id;

      let query = supabase
        .from("ordens_servico")
        .select(`
          numero_os, status, total, created_at, data_saida,
          cliente:clientes(nome),
          servico:servicos!ordens_servico_servico_id_fkey(nome)
        `)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      // Limites do dia em Brasília (em UTC): "AAAA-MM-DD"/"…T23:59:59" crus eram lidos em UTC pelo banco.
      if (dataInicioFiltro) query = query.gte("created_at", limitesDiaBrasilia(dataInicioFiltro).inicioISO);
      if (dataFimFiltro) query = query.lte("created_at", limitesDiaBrasilia(dataFimFiltro).fimISO);
      if (empresaFiltro) query = isFilial ? query.eq("empresa_id", empresaFiltro) : query.or(`empresa_id.eq.${empresaFiltro},empresa_id.is.null`);

      const { data, error } = await query;
      if (error) throw error;

      const ordens: OSExportItem[] = (data ?? []).map((o: any) => ({
        numero_os: o.numero_os ?? "-",
        cliente: o.cliente?.nome ?? "Sem cliente",
        servico: o.servico?.nome ?? "Sem serviço",
        status: o.status ?? "-",
        total: Number(o.total ?? 0),
        data_entrada: o.created_at,
        data_saida: o.data_saida,
      }));

      await gerarRelatorioOSPDF(ordens, config, getPeriodoTexto());
    } finally {
      setExportandoTipo(null);
    }
  };

  const exportarVendasCompleto = async () => {
    setExportandoTipo("vendas");
    try {
      const { dataInicioFiltro, dataFimFiltro } = calcularDatas(
        tipoFiltroData, mesSelecionado, anoSelecionado, dataInicio, dataFim
      );
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;
      const userId = identidadeUserId ?? user.id;

      let vendasPromise = supabase
        .from("vendas")
        .select("*, dispositivos(marca, modelo), produtos(nome)")
        .eq("user_id", userId)
        .neq("cancelada", true)
        .is("deleted_at", null)
        .neq("observacoes", "pagamento_duplo_secundario");
      // Período em Brasília: venda das 21h às 23:59 entra no dia em que foi feita.
      if (dataInicioFiltro) vendasPromise = vendasPromise.gte("data", limitesDiaBrasilia(dataInicioFiltro).inicioISO);
      if (dataFimFiltro) vendasPromise = vendasPromise.lte("data", limitesDiaBrasilia(dataFimFiltro).fimISO);
      if (empresaFiltro) vendasPromise = isFilial ? vendasPromise.eq("empresa_id", empresaFiltro) : vendasPromise.or(`empresa_id.eq.${empresaFiltro},empresa_id.is.null`);

      let avulsasPromise = supabase
        .from("vendas_avulsas" as any)
        .select("descricao, valor, forma_pagamento, created_at")
        .eq("user_id", userId)
        .is("deleted_at", null);
      if (dataInicioFiltro) avulsasPromise = avulsasPromise.gte("created_at", limitesDiaBrasilia(dataInicioFiltro).inicioISO);
      if (dataFimFiltro) avulsasPromise = avulsasPromise.lte("created_at", limitesDiaBrasilia(dataFimFiltro).fimISO);

      const [{ data: vendas }, { data: avulsas }] = await Promise.all([vendasPromise, avulsasPromise]);

      const itens: VendaExportItem[] = [];

      (vendas ?? []).forEach((v: any) => {
        if (v.observacoes?.includes("utilizado na OS")) return;
        if (v.peca_id) return;
        let descricao = "Venda";
        if (v.tipo === "dispositivo") descricao = [v.dispositivos?.marca, v.dispositivos?.modelo].filter(Boolean).join(" ");
        else if (v.tipo === "produto") descricao = v.produtos?.nome ?? "Produto";
        else if (v.tipo === "servico") descricao = "Serviço";
        itens.push({ tipo: v.tipo, descricao, formaPagamento: v.forma_pagamento ?? "-", valor: Number(v.total ?? 0), data: v.data });
      });

      ((avulsas ?? []) as any[]).forEach((va) => {
        itens.push({ tipo: "avulsa", descricao: va.descricao, formaPagamento: va.forma_pagamento ?? "-", valor: Number(va.valor ?? 0), data: va.created_at });
      });

      itens.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
      await gerarRelatorioVendasCompletoPDF(itens, config, getPeriodoTexto());
    } finally {
      setExportandoTipo(null);
    }
  };

  const exportarFinanceiro = async () => {
    setExportandoTipo("financeiro");
    try {
      const filtros = getFiltrosRelatorio();
      const [resumo, evolucao] = await Promise.all([
        calcularResumo(filtros),
        calcularEvolucaoMensal(filtros),
      ]);
      await gerarRelatorioFinanceiroPDF(
        { ...resumo, evolucaoMensal: evolucao },
        config,
        getPeriodoTexto()
      );
    } finally {
      setExportandoTipo(null);
    }
  };

  const exportarClientes = async () => {
    setExportandoTipo("clientes");
    try {
      const { dataInicioFiltro, dataFimFiltro } = calcularDatas(
        tipoFiltroData, mesSelecionado, anoSelecionado, dataInicio, dataFim
      );
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;
      const userId = identidadeUserId ?? user.id;

      let query = supabase
        .from("clientes")
        .select("nome, telefone, email, cidade, created_at")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("nome");
      if (empresaFiltro) query = query.eq("empresa_id", empresaFiltro);

      let queryOS = supabase
        .from("ordens_servico")
        .select("cliente_id, total")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .in("status", ["finalizado", "entregue"]);
      if (dataInicioFiltro) queryOS = queryOS.gte("created_at", limitesDiaBrasilia(dataInicioFiltro).inicioISO);
      if (dataFimFiltro) queryOS = queryOS.lte("created_at", limitesDiaBrasilia(dataFimFiltro).fimISO);

      const [{ data: clientesData }, { data: ordensData }] = await Promise.all([query, queryOS]);

      const osPorCliente = new Map<string, { total: number; count: number; ultima: string }>();
      (ordensData ?? []).forEach((o: any) => {
        if (!o.cliente_id) return;
        const atual = osPorCliente.get(o.cliente_id) ?? { total: 0, count: 0, ultima: "" };
        atual.total += Number(o.total ?? 0);
        atual.count += 1;
        osPorCliente.set(o.cliente_id, atual);
      });

      const clientes: ClienteExportItem[] = (clientesData ?? []).map((c: any) => {
        const stats = osPorCliente.get(c.id) ?? { total: 0, count: 0, ultima: "" };
        return {
          nome: c.nome,
          telefone: c.telefone,
          email: c.email,
          cidade: c.cidade,
          totalOS: stats.count,
          totalGasto: stats.total,
          ultimaVisita: stats.ultima || c.created_at,
        };
      });

      clientes.sort((a, b) => b.totalGasto - a.totalGasto);
      await gerarRelatorioClientesPDF(clientes, config, getPeriodoTexto());
    } finally {
      setExportandoTipo(null);
    }
  };

  const isExportando = exportandoTipo !== null;

  const relatoriosExportacao = [
    {
      id: "os",
      titulo: "Ordens de Serviço",
      descricao: "Lista completa de OS com cliente, serviço, status e valores do período.",
      icon: ClipboardList,
      cor: "text-blue-400",
      bg: "bg-blue-500/10",
      acao: exportarOS,
    },
    {
      id: "vendas",
      titulo: "Vendas Completas",
      descricao: "Todas as vendas (produtos, dispositivos, serviços e avulsas) agrupadas por tipo.",
      icon: ShoppingCart,
      cor: "text-green-400",
      bg: "bg-green-500/10",
      acao: exportarVendasCompleto,
    },
    {
      id: "financeiro",
      titulo: "Relatório Financeiro (DRE)",
      descricao: "Demonstração de resultado com receita, custos, lucro bruto, operacional e margem.",
      icon: TrendingUp,
      cor: "text-purple-400",
      bg: "bg-purple-500/10",
      acao: exportarFinanceiro,
    },
    {
      id: "clientes",
      titulo: "Relatório de Clientes",
      descricao: "Listagem de clientes com total de OS, valor gasto e última visita.",
      icon: Users,
      cor: "text-orange-400",
      bg: "bg-orange-500/10",
      acao: exportarClientes,
    },
  ];

  // Computador (>= 1024px): mesmo estado e mesmos handlers, só o visual muda. Celular segue no return de baixo.
  if (isDesktop) {
    return (
      <AppLayout>
        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          <div className="mx-auto max-w-none space-y-5">
            <AvisoCustoNaoConfirmado />
            <div className="flex items-center gap-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-500 text-white shadow-lg shadow-blue-500/20">
                <BarChart3 className="h-7 w-7" />
              </div>
              <div className="min-w-0">
                <h1 className="text-[28px] font-bold leading-9 tracking-tight">Relatórios</h1>
                <p className="text-sm leading-5 text-muted-foreground">
                  Análise de vendas e exportação de relatórios em PDF
                </p>
              </div>
            </div>

            {/* Filtros */}
            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <IconeSecao icon={Filter} />
                <div className="min-w-0">
                  <h2 className="text-base font-semibold leading-6">Filtros</h2>
                  <p className="text-xs leading-5 text-muted-foreground">
                    Aplicados em todas as análises e exportações
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-end gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4" />
                    Filtrar por:
                  </Label>
                  <div className="flex h-11 items-center gap-1 rounded-xl border border-border bg-muted/50 p-1">
                    {([
                      { valor: "mes", texto: "Mês" },
                      { valor: "periodo", texto: "Período" },
                    ] as const).map((opcao) => (
                      <button
                        key={opcao.valor}
                        type="button"
                        aria-pressed={tipoFiltroData === opcao.valor}
                        onClick={() => setTipoFiltroData(opcao.valor)}
                        className={cn(
                          "h-full rounded-lg px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          tipoFiltroData === opcao.valor
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:bg-background hover:text-foreground"
                        )}
                      >
                        {opcao.texto}
                      </button>
                    ))}
                  </div>
                </div>

                {tipoFiltroData === "mes" ? (
                  <>
                    <div className="min-w-[180px] flex-1 space-y-2">
                      <Label htmlFor="mes" className="text-sm">Mês</Label>
                      <Select value={mesSelecionado} onValueChange={setMesSelecionado}>
                        <SelectTrigger id="mes" className="h-11">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {MESES.map((mes) => (
                            <SelectItem key={mes.value} value={mes.value}>{mes.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="min-w-[180px] flex-1 space-y-2">
                      <Label htmlFor="ano" className="text-sm">Ano</Label>
                      <Select value={anoSelecionado} onValueChange={setAnoSelecionado}>
                        <SelectTrigger id="ano" className="h-11">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {anos.map((ano) => (
                            <SelectItem key={ano} value={ano}>{ano}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="min-w-[180px] flex-1 space-y-2">
                      <Label htmlFor="dataInicio" className="text-sm">Data Início</Label>
                      <Input id="dataInicio" type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="h-11" />
                    </div>
                    <div className="min-w-[180px] flex-1 space-y-2">
                      <Label htmlFor="dataFim" className="text-sm">Data Fim</Label>
                      <Input id="dataFim" type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="h-11" />
                    </div>
                  </>
                )}

                <div className="flex gap-2">
                  <Button onClick={handleFiltrar} disabled={loading} className="h-11 w-40">
                    Filtrar
                  </Button>
                  <Button variant="outline" onClick={handleLimparFiltros} disabled={loading} className="h-11 w-32">
                    Limpar
                  </Button>
                </div>
              </div>
            </section>

            {/* Seção de Exportação */}
            <section className="space-y-3">
              <div className="flex items-center gap-3">
                <IconeSecao icon={Download} />
                <div className="min-w-0">
                  <h2 className="text-base font-semibold leading-6">Exportar Relatórios em PDF</h2>
                  <p className="text-xs leading-5 text-muted-foreground">
                    Clique em qualquer relatório para gerar e baixar o PDF com os dados do período selecionado.
                  </p>
                </div>
              </div>
              {/* 4 numa linha só a partir de 1400px: abaixo disso, com a sidebar aberta, o texto ficava espremido. */}
              <div className="grid gap-4 lg:grid-cols-2 min-[1400px]:grid-cols-4">
                {relatoriosExportacao.map((rel) => {
                  const acento = ACENTO_EXPORTACAO_DESKTOP[rel.id];
                  const gerando = exportandoTipo === rel.id;
                  return (
                    <button
                      key={rel.id}
                      type="button"
                      onClick={!isExportando ? rel.acao : undefined}
                      aria-disabled={isExportando}
                      aria-busy={gerando}
                      className={cn(
                        "group flex h-full flex-col rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                        isExportando ? "cursor-default" : cn("cursor-pointer", acento.cartao)
                      )}
                    >
                      <div className="flex w-full items-start gap-3">
                        <div className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-xl", acento.icone)}>
                          {gerando ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <rel.icon className="h-5 w-5" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-semibold leading-5 text-foreground">{rel.titulo}</h3>
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{rel.descricao}</p>
                        </div>
                        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                      </div>
                      <span className="mt-auto block w-full pt-4">
                        <span
                          className={cn(
                            "flex h-10 w-full items-center justify-center gap-2 rounded-lg border text-sm font-medium transition-colors",
                            acento.botao,
                            isExportando && !gerando && "opacity-50"
                          )}
                        >
                          {gerando ? (
                            <><Loader2 className="h-4 w-4 animate-spin" /> Gerando PDF...</>
                          ) : (
                            <><FileDown className="h-4 w-4" /> Exportar PDF</>
                          )}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Análise por Tipo */}
            <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <IconeSecao icon={BarChart3} />
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold leading-6">Análise por Tipo de Venda</h2>
                    <p className="text-xs leading-5 text-muted-foreground">Detalhamento e comparativo por categoria</p>
                  </div>
                </div>
                {activeTab !== "avulsas" && (
                  <Button
                    variant="outline"
                    onClick={handleExportarAnalise}
                    disabled={loading || exportando}
                    className="h-10 shrink-0 gap-2"
                  >
                    <FileDown className="h-4 w-4" />
                    {exportando ? "Exportando..." : "Exportar aba"}
                  </Button>
                )}
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid h-auto w-full grid-cols-4 rounded-xl p-1">
                  {ABAS_DESKTOP.map((aba) => (
                    <TabsTrigger
                      key={aba.value}
                      value={aba.value}
                      className="gap-2 rounded-lg py-2.5 text-sm data-[state=active]:text-primary data-[state=active]:shadow-sm"
                    >
                      <aba.icon className="h-4 w-4" />
                      {aba.label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                <TabsContent value="dispositivos" className="mt-5 space-y-4">
                  <RelatorioDispositivosComponent dispositivos={dispositivos} loading={loading} />
                </TabsContent>
                <TabsContent value="produtos" className="mt-5 space-y-4">
                  <RelatorioProdutosComponent produtos={produtos} loading={loading} />
                </TabsContent>
                <TabsContent value="servicos" className="mt-5 space-y-4">
                  <RelatorioServicosComponent servicos={servicos} loading={loading} />
                </TabsContent>
                <TabsContent value="avulsas" className="mt-5 space-y-4">
                  <RelatorioVendasAvulsasComponent vendas={vendasAvulsas} loading={loading} />
                </TabsContent>
              </Tabs>
            </section>
          </div>
        </main>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <main className="flex-1 p-4 sm:p-6 overflow-auto">
        <div className="max-w-7xl lg:max-w-none mx-auto space-y-6">
          <AvisoCustoNaoConfirmado />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Relatórios</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Análise de vendas e exportação de relatórios em PDF
            </p>
          </div>

          {/* Filtros */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Filter className="h-4 w-4 sm:h-5 sm:w-5" />
                Filtros — aplicados em todas as análises e exportações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <Label className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4" />
                  Filtrar por:
                </Label>
                <div className="flex gap-2">
                  <Button
                    variant={tipoFiltroData === "mes" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTipoFiltroData("mes")}
                  >
                    Mês
                  </Button>
                  <Button
                    variant={tipoFiltroData === "periodo" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTipoFiltroData("periodo")}
                  >
                    Período
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                {tipoFiltroData === "mes" ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="mes" className="text-sm">Mês</Label>
                      <Select value={mesSelecionado} onValueChange={setMesSelecionado}>
                        <SelectTrigger id="mes" className="h-11">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {MESES.map((mes) => (
                            <SelectItem key={mes.value} value={mes.value}>{mes.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ano" className="text-sm">Ano</Label>
                      <Select value={anoSelecionado} onValueChange={setAnoSelecionado}>
                        <SelectTrigger id="ano" className="h-11">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {anos.map((ano) => (
                            <SelectItem key={ano} value={ano}>{ano}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="dataInicio" className="text-sm">Data Início</Label>
                      <Input id="dataInicio" type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="h-11" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dataFim" className="text-sm">Data Fim</Label>
                      <Input id="dataFim" type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="h-11" />
                    </div>
                  </>
                )}
                <div className="flex items-end gap-2 sm:col-span-2">
                  <Button onClick={handleFiltrar} disabled={loading} className="flex-1 lg:flex-none lg:w-40 h-11">
                    Filtrar
                  </Button>
                  <Button variant="outline" onClick={handleLimparFiltros} disabled={loading} className="flex-1 lg:flex-none lg:w-40 h-11">
                    Limpar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Seção de Exportação */}
          <div className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Download className="h-5 w-5 text-muted-foreground" />
                Exportar Relatórios em PDF
              </h2>
              <p className="text-sm text-muted-foreground">
                Clique em qualquer relatório para gerar e baixar o PDF com os dados do período selecionado.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {relatoriosExportacao.map((rel) => (
                <Card
                  key={rel.id}
                  className="cursor-pointer hover:border-white/20 transition-colors group"
                  onClick={!isExportando ? rel.acao : undefined}
                >
                  <CardHeader className="pb-2">
                    <div className={`w-10 h-10 rounded-lg ${rel.bg} flex items-center justify-center mb-2`}>
                      {exportandoTipo === rel.id ? (
                        <Loader2 className={`h-5 w-5 ${rel.cor} animate-spin`} />
                      ) : (
                        <rel.icon className={`h-5 w-5 ${rel.cor}`} />
                      )}
                    </div>
                    <CardTitle className="text-sm font-semibold">{rel.titulo}</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <CardDescription className="text-xs leading-relaxed">{rel.descricao}</CardDescription>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`mt-3 w-full gap-2 text-xs ${rel.cor} hover:bg-white/5`}
                      disabled={isExportando}
                    >
                      {exportandoTipo === rel.id ? (
                        <><Loader2 className="h-3 w-3 animate-spin" /> Gerando PDF...</>
                      ) : (
                        <><FileDown className="h-3 w-3" /> Exportar PDF</>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <Separator />

          {/* Análise por Tipo */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Análise por Tipo de Venda</h2>
                <p className="text-sm text-muted-foreground">Detalhamento e comparativo por categoria</p>
              </div>
              {activeTab !== "avulsas" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportarAnalise}
                  disabled={loading || exportando}
                  className="gap-2"
                >
                  <FileDown className="h-4 w-4" />
                  {exportando ? "Exportando..." : "Exportar aba"}
                </Button>
              )}
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-4 h-auto">
                <TabsTrigger value="dispositivos" className="text-xs sm:text-sm py-2 sm:py-1.5">
                  Dispositivos
                </TabsTrigger>
                <TabsTrigger value="produtos" className="text-xs sm:text-sm py-2 sm:py-1.5">
                  Produtos
                </TabsTrigger>
                <TabsTrigger value="servicos" className="text-xs sm:text-sm py-2 sm:py-1.5">
                  Serviços
                </TabsTrigger>
                <TabsTrigger value="avulsas" className="text-xs sm:text-sm py-2 sm:py-1.5">
                  Venda Avulsa
                </TabsTrigger>
              </TabsList>

              <TabsContent value="dispositivos" className="space-y-4 mt-4 sm:mt-6">
                <RelatorioDispositivosComponent dispositivos={dispositivos} loading={loading} />
              </TabsContent>
              <TabsContent value="produtos" className="space-y-4 mt-4 sm:mt-6">
                <RelatorioProdutosComponent produtos={produtos} loading={loading} />
              </TabsContent>
              <TabsContent value="servicos" className="space-y-4 mt-4 sm:mt-6">
                <RelatorioServicosComponent servicos={servicos} loading={loading} />
              </TabsContent>
              <TabsContent value="avulsas" className="space-y-4 mt-4 sm:mt-6">
                <RelatorioVendasAvulsasComponent vendas={vendasAvulsas} loading={loading} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
    </AppLayout>
  );
}
