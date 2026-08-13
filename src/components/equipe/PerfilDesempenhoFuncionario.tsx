import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { formatDate } from "@/lib/formatters";
import { User, Wrench, ClipboardList, CalendarIcon, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Funcionario } from "@/types/funcionario";
import { useDesempenhoFuncionario, type OSFuncionario } from "@/hooks/useDesempenhoFuncionario";
import { useOSStatusConfigContext as useOSStatusConfig } from "@/contexts/OSStatusConfigContext";

interface PerfilDesempenhoFuncionarioProps {
  funcionario: Funcionario | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mesReferencia?: Date;
}

const STATUS_COMISSIONAVEIS = ["entregue"];

function isOSComissionavel(os: OSFuncionario): boolean {
  return !!os.status && STATUS_COMISSIONAVEIS.includes(os.status.trim().toLowerCase());
}

function resolverComissaoOS(
  os: OSFuncionario,
  comissoesFallback: Record<string, { tipo: string; valor: number }>,
): number | null {
  if (!isOSComissionavel(os)) return 0;

  // OS com múltiplos serviços lançados para o mesmo funcionário (os_tecnicos)
  // têm uma comissão por linha — soma todas em vez de usar só o snapshot
  // único da OS, que reflete apenas o primeiro serviço/técnico.
  if (os.tecnicos_os && os.tecnicos_os.length > 0) {
    return os.tecnicos_os.reduce((acc, t) => acc + (t.comissao_calculada_snapshot || 0), 0);
  }

  if (os.comissao_calculada_snapshot != null) {
    return os.comissao_calculada_snapshot;
  }

  if (!os.total || !os.tipo_servico_id) return null;
  const config = comissoesFallback[os.tipo_servico_id];
  if (!config || !config.valor) return null;
  if (config.tipo === "porcentagem") return os.total * (config.valor / 100);
  return config.valor;
}

function resolverNomeTipoServico(
  os: OSFuncionario,
  tiposServico: Record<string, string>,
): string | null {
  if (os.tipo_servico_nome_snapshot) return os.tipo_servico_nome_snapshot;
  if (os.tipo_servico_id && tiposServico[os.tipo_servico_id]) return tiposServico[os.tipo_servico_id];
  return null;
}

export function PerfilDesempenhoFuncionario({ funcionario, open, onOpenChange, mesReferencia }: PerfilDesempenhoFuncionarioProps) {
  const [dataInicio, setDataInicio] = useState<Date | undefined>(startOfMonth(mesReferencia ?? new Date()));
  const [dataFim, setDataFim] = useState<Date | undefined>(endOfMonth(mesReferencia ?? new Date()));
  const [statusFiltro, setStatusFiltro] = useState("todos");
  const [buscaNumeroOS, setBuscaNumeroOS] = useState("");
  const { statusList } = useOSStatusConfig();

  // Ao abrir o dialog para um funcionário, sincroniza o período com o mês
  // selecionado no Dashboard de Equipe (em vez de sempre cair no mês atual).
  useEffect(() => {
    if (open && funcionario) {
      const ref = mesReferencia ?? new Date();
      setDataInicio(startOfMonth(ref));
      setDataFim(endOfMonth(ref));
      setStatusFiltro("todos");
      setBuscaNumeroOS("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, funcionario?.id]);

  // Usa o dia selecionado inteiro no filtro
  const dataInicioISO = dataInicio ? startOfDay(dataInicio).toISOString() : null;
  const dataFimISO = dataFim ? endOfDay(dataFim).toISOString() : null;

  const { data, isLoading } = useDesempenhoFuncionario(
    open && funcionario ? funcionario.id : null,
    dataInicioISO,
    dataFimISO,
  );

  const tiposServico = data?.tiposServico || {};
  const comissoesTipoServico = data?.comissoesTipoServico || {};

  const ordensFiltradas = useMemo(() => {
    let ordens = data?.ordens || [];
    if (statusFiltro !== "todos") {
      ordens = ordens.filter(o => {
        const s = (o.status || "").trim().toLowerCase();
        return s === statusFiltro.trim().toLowerCase();
      });
    }
    const termoBusca = buscaNumeroOS.trim().toLowerCase();
    if (termoBusca) {
      ordens = ordens.filter(o => (o.numero_os || "").toLowerCase().includes(termoBusca));
    }
    return ordens;
  }, [data?.ordens, statusFiltro, buscaNumeroOS]);

  // "Total de OS" no resumo conta apenas OS entregues, para bater com a
  // coluna "OS" da tabela de Desempenho por Funcionário (useComissoes),
  // que só soma OS comissionáveis. A tabela abaixo continua listando o
  // histórico completo (todos os status) quando nenhum filtro é aplicado.
  const ordensComissionaveis = useMemo(
    () => ordensFiltradas.filter(isOSComissionavel),
    [ordensFiltradas],
  );

  const totalOS = ordensComissionaveis.length;
  const totalValor = ordensComissionaveis.reduce((acc, o) => acc + (o.total || 0), 0);
  const totalComissao = ordensComissionaveis.reduce((acc, o) => {
    const c = resolverComissaoOS(o, comissoesTipoServico);
    return acc + (c || 0);
  }, 0);

  const limparFiltro = () => {
    setDataInicio(undefined);
    setDataFim(undefined);
    setStatusFiltro("todos");
    setBuscaNumeroOS("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] xl:max-w-6xl sm:max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Perfil de Desempenho
          </DialogTitle>
        </DialogHeader>

        {!funcionario ? null : (
          <div className="space-y-6">
            {/* Dados básicos */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Dados do Funcionário</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p><span className="font-medium">Nome:</span> {funcionario.nome}</p>
                <p><span className="font-medium">E-mail:</span> {funcionario.email}</p>
                {funcionario.cargo && (
                  <div className="flex items-center gap-1">
                    <span className="font-medium">Cargo:</span>
                    <div className="flex flex-wrap gap-1">
                      {funcionario.cargo.split(",").map(c => (
                        <Badge key={c.trim()} variant="outline" className="text-xs">{c.trim()}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                <p>
                  <span className="font-medium">Status:</span>{" "}
                  <Badge variant={funcionario.ativo ? "default" : "secondary"}>
                    {funcionario.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                </p>
              </CardContent>
            </Card>

            {/* Filtro de data */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">Filtrar por período:</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal min-w-[140px]", !dataInicio && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataInicio ? format(dataInicio, "dd/MM/yyyy") : "Data início"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dataInicio} onSelect={setDataInicio} initialFocus locale={ptBR} className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
              <span className="text-sm text-muted-foreground">até</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal min-w-[140px]", !dataFim && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataFim ? format(dataFim, "dd/MM/yyyy") : "Data fim"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dataFim} onSelect={setDataFim} initialFocus locale={ptBR} className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
              <div className="w-[180px]">
                <Select value={statusFiltro} onValueChange={setStatusFiltro}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Filtrar por status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Status</SelectItem>
                    {statusList.filter(s => s.ativo).map((status) => (
                      <SelectItem key={status.slug} value={status.slug}>
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: status.cor }} />
                          {status.nome}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {(dataInicio || dataFim || statusFiltro !== "todos" || buscaNumeroOS) && (
                <Button variant="ghost" size="sm" onClick={limparFiltro}>Limpar</Button>
              )}
            </div>

            {/* Resumo */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">OS Entregues</CardTitle>
                  <ClipboardList className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{isLoading ? "..." : totalOS}</div>
                  <p className="text-xs text-muted-foreground">Comissionáveis no período</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
                  <Wrench className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {isLoading ? "..." : <ValorMonetario valor={totalValor} />}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Comissão Total</CardTitle>
                  <Wrench className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">
                    {isLoading ? "..." : <ValorMonetario valor={totalComissao} />}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabela de OS */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Histórico de Ordens de Serviço</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative mb-4 max-w-xs">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={buscaNumeroOS}
                    onChange={(e) => setBuscaNumeroOS(e.target.value)}
                    placeholder="Buscar por número da OS..."
                    className="pl-8 h-9"
                  />
                </div>
                {isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : ordensFiltradas.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    {buscaNumeroOS.trim()
                      ? "Nenhuma OS encontrada com esse número."
                      : "Nenhuma ordem de serviço encontrada para o período selecionado."}
                  </p>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>OS</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Dispositivo</TableHead>
                          <TableHead>Tipo Serviço</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead className="text-right">Comissão</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ordensFiltradas.map((os) => {
                          const comissao = resolverComissaoOS(os, comissoesTipoServico);
                          const nomeTipo = resolverNomeTipoServico(os, tiposServico);
                          return (
                            <TableRow key={os.id}>
                              <TableCell className="font-medium">{os.numero_os}</TableCell>
                              <TableCell>{formatDate(os.created_at)}</TableCell>
                              <TableCell>{os.cliente?.nome || "—"}</TableCell>
                              <TableCell>{os.dispositivo_marca} {os.dispositivo_modelo}</TableCell>
                              <TableCell>
                                {os.tecnicos_os && os.tecnicos_os.length > 1 ? (
                                  <div className="flex flex-col gap-1">
                                    {os.tecnicos_os.map((t, idx) => (
                                      <Badge key={idx} variant="outline" className="text-xs w-fit">
                                        {t.descricao_servico || nomeTipo || "Serviço"}
                                      </Badge>
                                    ))}
                                  </div>
                                ) : nomeTipo ? (
                                  <Badge variant="outline" className="text-xs">{nomeTipo}</Badge>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="text-xs">{os.status || "—"}</Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <ValorMonetario valor={os.total} />
                              </TableCell>
                              <TableCell className="text-right">
                                {comissao !== null
                                  ? <span className="font-medium text-primary"><ValorMonetario valor={comissao} /></span>
                                  : <span className="text-muted-foreground">—</span>}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
