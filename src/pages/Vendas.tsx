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
import { Filter, Calendar, Layout, Settings } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { DialogConfiguracaoLayoutVendas } from "@/components/vendas/DialogConfiguracaoLayoutVendas";

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

export default function Vendas() {
  const { vendas, todasVendas, loading, carregarVendas, cancelarVenda, editarVenda, marcarComoRecebido, marcarComoPendente, excluirVenda } = useVendas();
  const [dialogLayoutAberto, setDialogLayoutAberto] = useState(false);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState<string>("todos");
  const [pagamentoFiltro, setPagamentoFiltro] = useState<string>("todos");
  const [tipoFiltroData, setTipoFiltroData] = useState<"mes" | "periodo">("mes");
  const [mesSelecionado, setMesSelecionado] = useState<string>("");
  const [anoSelecionado, setAnoSelecionado] = useState<string>(new Date().getFullYear().toString());

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
    carregarVendas();
  };

  const vendasFiltradas = vendas.filter((venda) => {
    const tipoMatch = tipoFiltro === "todos" || venda.tipo === tipoFiltro;
    const pagamentoMatch =
      pagamentoFiltro === "todos" || 
      (venda.forma_pagamento && venda.forma_pagamento === pagamentoFiltro) ||
      (!venda.forma_pagamento && pagamentoFiltro === "todos");
    return tipoMatch && pagamentoMatch;
  });

  return (
    <AppLayout>
      <main className="flex-1 p-4 sm:p-6 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Vendas</h1>
              <p className="text-muted-foreground text-sm sm:text-base">
                Lista completa de todas as vendas realizadas
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
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
              {/* Botões rápidos */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const hoje = format(new Date(), "yyyy-MM-dd");
                    setTipoFiltroData("periodo");
                    setDataInicio(hoje);
                    setDataFim(hoje);
                    carregarVendas(hoje, hoje);
                  }}
                >
                  Hoje
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const ontem = format(subDays(new Date(), 1), "yyyy-MM-dd");
                    setTipoFiltroData("periodo");
                    setDataInicio(ontem);
                    setDataFim(ontem);
                    carregarVendas(ontem, ontem);
                  }}
                >
                  Ontem
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const hoje = format(new Date(), "yyyy-MM-dd");
                    const seteDiasAtras = format(subDays(new Date(), 7), "yyyy-MM-dd");
                    setTipoFiltroData("periodo");
                    setDataInicio(seteDiasAtras);
                    setDataFim(hoje);
                    carregarVendas(seteDiasAtras, hoje);
                  }}
                >
                  Últimos 7 dias
                </Button>
              </div>

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

              <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-6">
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
                <div className="space-y-2">
                  <Label htmlFor="tipo" className="text-sm">Tipo</Label>
                  <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
                    <SelectTrigger id="tipo" className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="dispositivo">Dispositivos</SelectItem>
                      <SelectItem value="produto">Produtos</SelectItem>
                      <SelectItem value="servico">Serviços</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pagamento" className="text-sm">Pagamento</Label>
                  <Select value={pagamentoFiltro} onValueChange={setPagamentoFiltro}>
                    <SelectTrigger id="pagamento" className="h-11">
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
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Resumo por Tipo */}
          <div className="space-y-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold">Resumo por Tipo</h2>
              <p className="text-muted-foreground text-sm">
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
              <CardTitle className="text-base sm:text-lg">Lista de Vendas</CardTitle>
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
