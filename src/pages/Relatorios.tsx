import { useState, useEffect } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRelatoriosVendas } from "@/hooks/useRelatoriosVendas";
import { RelatorioDispositivosComponent } from "@/components/relatorios/RelatorioDispositivos";
import { RelatorioProdutosComponent } from "@/components/relatorios/RelatorioProdutos";
import { RelatorioServicosComponent } from "@/components/relatorios/RelatorioServicos";
import { Filter, Calendar, FileDown } from "lucide-react";
import {
  RelatorioDispositivo,
  RelatorioProduto,
  RelatorioServico,
  FiltrosRelatorioVendas,
} from "@/types/relatorio-vendas";
import { AppLayout } from "@/components/layout/AppLayout";
import { useConfiguracaoLoja } from "@/hooks/useConfiguracaoLoja";
import {
  gerarRelatorioDispositivosPDF,
  gerarRelatorioProdutosPDF,
  gerarRelatorioServicosPDF,
} from "@/lib/gerarRelatoriosPDF";

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
    buscarRelatorioDispositivos,
    buscarRelatorioProdutos,
    buscarRelatorioServicos,
  } = useRelatoriosVendas();

  const { config } = useConfiguracaoLoja();

  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [tipoFiltroData, setTipoFiltroData] = useState<"mes" | "periodo">("mes");
  const [mesSelecionado, setMesSelecionado] = useState<string>("");
  const [anoSelecionado, setAnoSelecionado] = useState<string>(new Date().getFullYear().toString());
  const [dispositivos, setDispositivos] = useState<RelatorioDispositivo[]>([]);
  const [produtos, setProdutos] = useState<RelatorioProduto[]>([]);
  const [servicos, setServicos] = useState<RelatorioServico[]>([]);
  const [activeTab, setActiveTab] = useState("dispositivos");
  const [exportando, setExportando] = useState(false);

  const anos = Array.from({ length: 2035 - 2020 + 1 }, (_, i) => (2035 - i).toString());

  useEffect(() => {
    carregarDados(tipoFiltroData, mesSelecionado, anoSelecionado, dataInicio, dataFim);
  }, []);

  const calcularDatas = (
    _tipoFiltroData: string,
    _mesSelecionado: string,
    _anoSelecionado: string,
    _dataInicio: string,
    _dataFim: string
  ) => {
    let dataInicioFiltro = _dataInicio;
    let dataFimFiltro = _dataFim;

    if (_tipoFiltroData === "mes" && _mesSelecionado && _anoSelecionado) {
      const ano = parseInt(_anoSelecionado);
      const mes = parseInt(_mesSelecionado);
      const ultimoDia = new Date(ano, mes, 0).getDate();
      dataInicioFiltro = `${_anoSelecionado}-${_mesSelecionado}-01`;
      dataFimFiltro = `${_anoSelecionado}-${_mesSelecionado}-${String(ultimoDia).padStart(2, "0")}`;
    }

    return { dataInicioFiltro, dataFimFiltro };
  };

  const carregarDados = async (
    _tipoFiltroData = tipoFiltroData,
    _mesSelecionado = mesSelecionado,
    _anoSelecionado = anoSelecionado,
    _dataInicio = dataInicio,
    _dataFim = dataFim
  ) => {
    const { dataInicioFiltro, dataFimFiltro } = calcularDatas(
      _tipoFiltroData,
      _mesSelecionado,
      _anoSelecionado,
      _dataInicio,
      _dataFim
    );

    const filtros: FiltrosRelatorioVendas = {
      dataInicio: dataInicioFiltro,
      dataFim: dataFimFiltro,
    };

    const [dispositivosData, produtosData, servicosData] = await Promise.all([
      buscarRelatorioDispositivos(filtros),
      buscarRelatorioProdutos(filtros),
      buscarRelatorioServicos(filtros),
    ]);

    setDispositivos(dispositivosData);
    setProdutos(produtosData);
    setServicos(servicosData);
  };

  const handleFiltrar = () => {
    carregarDados(tipoFiltroData, mesSelecionado, anoSelecionado, dataInicio, dataFim);
  };

  const handleLimparFiltros = () => {
    const novoMes = "";
    const novoAno = new Date().getFullYear().toString();
    const novaDataInicio = "";
    const novaDataFim = "";
    setDataInicio(novaDataInicio);
    setDataFim(novaDataFim);
    setMesSelecionado(novoMes);
    setAnoSelecionado(novoAno);
    carregarDados(tipoFiltroData, novoMes, novoAno, novaDataInicio, novaDataFim);
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

  const handleExportarPDF = async () => {
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

  return (
    <AppLayout>
      <main className="flex-1 p-4 sm:p-6 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Vendas</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Análise detalhada por tipo de item vendido
            </p>
          </div>

          {/* Filtros */}
          <Card>
            <CardHeader className="pb-3 sm:pb-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Filter className="h-4 w-4 sm:h-5 sm:w-5" />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <Label className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4" />
                  Filtrar por:
                </Label>
                <div className="flex gap-2">
                  <Button
                    variant={tipoFiltroData === "mes" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTipoFiltroData("mes")}
                    className="flex-1 sm:flex-none"
                  >
                    Mês
                  </Button>
                  <Button
                    variant={tipoFiltroData === "periodo" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTipoFiltroData("periodo")}
                    className="flex-1 sm:flex-none"
                  >
                    Período
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
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
                            <SelectItem key={mes.value} value={mes.value}>
                              {mes.label}
                            </SelectItem>
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
                            <SelectItem key={ano} value={ano}>
                              {ano}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="dataInicio" className="text-sm">Data Início</Label>
                      <Input
                        id="dataInicio"
                        type="date"
                        value={dataInicio}
                        onChange={(e) => setDataInicio(e.target.value)}
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dataFim" className="text-sm">Data Fim</Label>
                      <Input
                        id="dataFim"
                        type="date"
                        value={dataFim}
                        onChange={(e) => setDataFim(e.target.value)}
                        className="h-11"
                      />
                    </div>
                  </>
                )}
                <div className="flex items-end gap-2 sm:col-span-2">
                  <Button onClick={handleFiltrar} disabled={loading} className="flex-1 h-11">
                    Filtrar
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleLimparFiltros}
                    disabled={loading}
                    className="flex-1 h-11"
                  >
                    Limpar
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleExportarPDF}
                    disabled={loading || exportando}
                    className="flex-1 h-11 gap-2"
                  >
                    <FileDown className="h-4 w-4" />
                    {exportando ? "Exportando..." : "Exportar PDF"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabs de Relatórios */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-auto">
              <TabsTrigger value="dispositivos" className="text-xs sm:text-sm py-2 sm:py-1.5">
                Dispositivos
              </TabsTrigger>
              <TabsTrigger value="produtos" className="text-xs sm:text-sm py-2 sm:py-1.5">
                Produtos
              </TabsTrigger>
              <TabsTrigger value="servicos" className="text-xs sm:text-sm py-2 sm:py-1.5">
                Serviços
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dispositivos" className="space-y-4 mt-4 sm:mt-6">
              <RelatorioDispositivosComponent
                dispositivos={dispositivos}
                loading={loading}
              />
            </TabsContent>

            <TabsContent value="produtos" className="space-y-4 mt-4 sm:mt-6">
              <RelatorioProdutosComponent produtos={produtos} loading={loading} />
            </TabsContent>

            <TabsContent value="servicos" className="space-y-4 mt-4 sm:mt-6">
              <RelatorioServicosComponent servicos={servicos} loading={loading} />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </AppLayout>
  );
}
