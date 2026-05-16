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
import { RelatorioDispositivosComponent } from "@/components/relatorios/RelatorioDispositivos";
import { RelatorioProdutosComponent } from "@/components/relatorios/RelatorioProdutos";
import { RelatorioServicosComponent } from "@/components/relatorios/RelatorioServicos";
import { RelatorioVendasAvulsasComponent } from "@/components/relatorios/RelatorioVendasAvulsas";
import { Filter, Calendar, FileDown, ClipboardList, ShoppingCart, TrendingUp, Users, Loader2, Download } from "lucide-react";
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
import { useIdentidade } from "@/hooks/useResolvedUserId";
import { supabase } from "@/integrations/supabase/client";
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
  const { userId: identidadeUserId, empresaId: empresaFiltro } = useIdentidade();

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

      if (dataInicioFiltro) query = query.gte("created_at", dataInicioFiltro);
      if (dataFimFiltro) query = query.lte("created_at", `${dataFimFiltro}T23:59:59`);
      if (empresaFiltro) query = query.eq("empresa_id", empresaFiltro);

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

      const vendasPromise = supabase
        .from("vendas")
        .select("*, dispositivos(marca, modelo), produtos(nome)")
        .eq("user_id", userId)
        .neq("cancelada", true)
        .gte("data", dataInicioFiltro || "2020-01-01")
        .lte("data", dataFimFiltro ? `${dataFimFiltro}T23:59:59` : "2099-12-31");

      const avulsasPromise = supabase
        .from("vendas_avulsas" as any)
        .select("descricao, valor, forma_pagamento, created_at")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .gte("created_at", dataInicioFiltro ? `${dataInicioFiltro}T00:00:00` : "2020-01-01T00:00:00")
        .lte("created_at", dataFimFiltro ? `${dataFimFiltro}T23:59:59` : "2099-12-31T23:59:59");

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
      if (dataInicioFiltro) queryOS = queryOS.gte("created_at", dataInicioFiltro);
      if (dataFimFiltro) queryOS = queryOS.lte("created_at", `${dataFimFiltro}T23:59:59`);

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

  return (
    <AppLayout>
      <main className="flex-1 p-4 sm:p-6 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-6">
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
                  <Button onClick={handleFiltrar} disabled={loading} className="flex-1 h-11">
                    Filtrar
                  </Button>
                  <Button variant="outline" onClick={handleLimparFiltros} disabled={loading} className="flex-1 h-11">
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
