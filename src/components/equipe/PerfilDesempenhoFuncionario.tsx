import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { formatDate } from "@/lib/formatters";
import { User, Wrench, ClipboardList, CalendarIcon, Search, Eye, AlertTriangle } from "lucide-react";
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
import {
  type ComissaoConfig,
  type TipoServicoResumo,
  encontrarComissaoPorNomeServico,
  formatarMotivoComissao,
} from "@/lib/ordemServico/comissaoPorTipoServico";

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

interface AlertaComissaoItem {
  nome: string;
  motivo: string;
}

/**
 * Reavalia, com a configuração de comissão ATUAL, se algum item da OS
 * ficaria sem comissão configurada ou ambíguo — mesma lógica usada ao
 * salvar a OS (calcularComissaoPorServico), reaplicada aqui só para
 * exibição. Só faz sentido quando a comissão foi calculada por soma de
 * múltiplos serviços do Técnico Principal (2+ itens em
 * avarias.servicos_realizados, sem "Técnicos por Serviço" vinculado) —
 * para OS de um serviço só, ou que já usam os_tecnicos, o snapshot
 * gravado já reflete o item certo e não há ambiguidade a reavaliar.
 *
 * Como usa o catálogo/config de HOJE (não o que existia quando a OS foi
 * salva), é um "melhor esforço": se a configuração mudou desde então, a
 * explicação pode não bater 100% com o que gerou o valor gravado — mas é
 * a mesma informação que o dono veria se editasse a OS agora.
 */
function avaliarAlertasComissaoOS(
  os: OSFuncionario,
  tiposServico: Record<string, string>,
  comissoesTipoServico: Record<string, { tipo: string; valor: number }>,
): AlertaComissaoItem[] {
  if (os.tecnicos_os && os.tecnicos_os.length > 0) return [];

  const servicosRealizados: { nome?: string }[] = Array.isArray(os.avarias?.servicos_realizados)
    ? os.avarias.servicos_realizados
    : [];
  if (servicosRealizados.length < 2) return [];

  const tiposComComissao: TipoServicoResumo[] = Object.entries(tiposServico)
    .filter(([id]) => id in comissoesTipoServico)
    .map(([id, nome]) => ({ id, nome }));

  const comissaoPorTipoServicoId = new Map<string, ComissaoConfig>(
    Object.entries(comissoesTipoServico).map(([id, c]) => [
      id,
      { tipo_servico_id: id, comissao_tipo: c.tipo, comissao_valor: c.valor },
    ]),
  );

  const alertas: AlertaComissaoItem[] = [];
  for (const item of servicosRealizados) {
    if (!item?.nome) continue;
    const resultado = encontrarComissaoPorNomeServico(
      item.nome, tiposComComissao, comissaoPorTipoServicoId, os.dispositivo_marca,
    );
    if (resultado.ambiguo) {
      alertas.push({ nome: item.nome, motivo: formatarMotivoComissao(item.nome, resultado) });
    } else if (!resultado.config) {
      alertas.push({ nome: item.nome, motivo: formatarMotivoComissao(item.nome, { ambiguo: false }) });
    }
  }
  return alertas;
}

/**
 * Ícone de alerta clicável (funciona em touch) ao lado de um valor de
 * comissão — ao clicar, mostra em um popover quais itens da OS ficaram
 * sem comissão configurada ou ambíguos, e por quê.
 */
function AlertaComissaoIndicador({ alertas }: { alertas: AlertaComissaoItem[] }) {
  if (alertas.length === 0) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center text-amber-500 hover:text-amber-600"
          title="Comissão precisa de revisão"
          onClick={(e) => e.stopPropagation()}
        >
          <AlertTriangle className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 text-sm" align="end">
        <p className="font-medium mb-2 flex items-center gap-1.5 text-amber-600">
          <AlertTriangle className="h-4 w-4" />
          Comissão pode estar incompleta
        </p>
        <ul className="space-y-2 text-muted-foreground">
          {alertas.map((a, idx) => (
            <li key={idx}>{a.motivo}</li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

export function PerfilDesempenhoFuncionario({ funcionario, open, onOpenChange, mesReferencia }: PerfilDesempenhoFuncionarioProps) {
  const [dataInicio, setDataInicio] = useState<Date | undefined>(startOfMonth(mesReferencia ?? new Date()));
  const [dataFim, setDataFim] = useState<Date | undefined>(endOfMonth(mesReferencia ?? new Date()));
  const [statusFiltro, setStatusFiltro] = useState("todos");
  const [buscaNumeroOS, setBuscaNumeroOS] = useState("");
  const [osDetalhe, setOsDetalhe] = useState<OSFuncionario | null>(null);
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
                          <TableHead className="text-center">Detalhes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ordensFiltradas.map((os) => {
                          const comissao = resolverComissaoOS(os, comissoesTipoServico);
                          const nomeTipo = resolverNomeTipoServico(os, tiposServico);
                          const alertasComissao = avaliarAlertasComissaoOS(os, tiposServico, comissoesTipoServico);
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
                                        {t.servico_nome_snapshot || t.descricao_servico || nomeTipo || "Serviço"}
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
                                <div className="flex items-center justify-end gap-1.5">
                                  {comissao !== null
                                    ? <span className="font-medium text-primary"><ValorMonetario valor={comissao} /></span>
                                    : <span className="text-muted-foreground">—</span>}
                                  <AlertaComissaoIndicador alertas={alertasComissao} />
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => setOsDetalhe(os)}
                                  title="Ver serviços e comissões desta OS"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
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

      {/* Detalhe de serviços e comissões de uma OS específica */}
      <Dialog open={!!osDetalhe} onOpenChange={(v) => !v && setOsDetalhe(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              OS {osDetalhe?.numero_os}
            </DialogTitle>
          </DialogHeader>
          {osDetalhe && (() => {
            const nomeTipo = resolverNomeTipoServico(osDetalhe, tiposServico);
            const linhas = osDetalhe.tecnicos_os && osDetalhe.tecnicos_os.length > 0
              ? osDetalhe.tecnicos_os.map((t, idx) => ({
                  key: idx,
                  descricao: t.servico_nome_snapshot || t.descricao_servico || nomeTipo || "Serviço",
                  valorServico: t.preco_servico_snapshot,
                  comissao: t.comissao_calculada_snapshot,
                }))
              : [{
                  key: 0,
                  descricao: nomeTipo || "Serviço",
                  valorServico: osDetalhe.total,
                  comissao: resolverComissaoOS(osDetalhe, comissoesTipoServico),
                }];
            const totalComissaoOS = linhas.reduce((acc, l) => acc + (l.comissao || 0), 0);
            const alertasComissaoOS = avaliarAlertasComissaoOS(osDetalhe, tiposServico, comissoesTipoServico);
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p><span className="font-medium">Cliente:</span> {osDetalhe.cliente?.nome || "—"}</p>
                  <p><span className="font-medium">Data:</span> {formatDate(osDetalhe.created_at)}</p>
                  <p><span className="font-medium">Dispositivo:</span> {osDetalhe.dispositivo_marca} {osDetalhe.dispositivo_modelo}</p>
                  <p>
                    <span className="font-medium">Status:</span>{" "}
                    <Badge variant="secondary" className="text-xs">{osDetalhe.status || "—"}</Badge>
                  </p>
                  <p><span className="font-medium">Valor Total da OS:</span> <ValorMonetario valor={osDetalhe.total} /></p>
                </div>

                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Serviço Realizado</TableHead>
                        <TableHead className="text-right">Valor do Serviço</TableHead>
                        <TableHead className="text-right">Comissão</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {linhas.map((l) => (
                        <TableRow key={l.key}>
                          <TableCell>{l.descricao}</TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {l.valorServico != null
                              ? <ValorMonetario valor={l.valorServico} />
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {l.comissao !== null
                              ? <span className="font-medium text-primary"><ValorMonetario valor={l.comissao} /></span>
                              : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {alertasComissaoOS.length > 0 && (
                  <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-800 dark:text-amber-300">
                    <p className="font-medium flex items-center gap-1.5 mb-1.5">
                      <AlertTriangle className="h-4 w-4" />
                      Comissão desta OS pode estar incompleta
                    </p>
                    <ul className="space-y-1 list-disc pl-5">
                      {alertasComissaoOS.map((a, idx) => (
                        <li key={idx}>{a.motivo}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex justify-end">
                  <div className="text-sm flex items-center gap-1.5">
                    <span className="font-medium">Comissão Total da OS: </span>
                    <span className="font-bold text-primary"><ValorMonetario valor={totalComissaoOS} /></span>
                    <AlertaComissaoIndicador alertas={alertasComissaoOS} />
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
