import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CalendarIcon,
  RefreshCw,
  Settings,
  Plug,
  ChevronRight,
  Phone,
  Mail,
  MapPin,
  User,
  Wrench,
  Tag,
  Loader2,
  Target,
} from "lucide-react";
import {
  TinyIntegration,
  TinyOS,
  calcularDiasUteis,
  diasParados,
  mapSituacaoTiny,
  useTinyDados,
  fetchTinyOSDetalhe,
} from "@/hooks/useTinyIntegration";
import { DialogBoasVindasTiny } from "./DialogBoasVindasTiny";
import { DialogConfiguracoesTiny } from "./DialogConfiguracoesTiny";

interface Props {
  integration: TinyIntegration | null;
  integrationLoading: boolean;
  onConectar: () => void;
  onDesconectar: () => void;
  onReconectar: () => void;
  onAtualizarIntervalo: (v: number) => void;
}

const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function CardSkeleton() {
  return (
    <Card className="border-border/40">
      <CardContent className="p-4 space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-3 w-32" />
      </CardContent>
    </Card>
  );
}

function corBorda(dias: number) {
  if (dias >= 3) return "border-l-4 border-l-destructive";
  if (dias >= 1) return "border-l-4 border-l-yellow-500";
  return "border-l-4 border-l-green-500";
}

export function TerceirizadaTab({
  integration,
  integrationLoading,
  onConectar,
  onDesconectar,
  onReconectar,
  onAtualizarIntervalo,
}: Props) {
  const hoje = new Date();
  const [dataInicio, setDataInicio] = useState<Date>(startOfMonth(hoje));
  const [dataFim, setDataFim] = useState<Date>(endOfMonth(hoje));
  const [modalBoasVindas, setModalBoasVindas] = useState(false);
  const [modalConfigs, setModalConfigs] = useState(false);
  const [osSelecionada, setOsSelecionada] = useState<TinyOS | null>(null);
  const [detalhe, setDetalhe] = useState<Record<string, unknown> | null>(null);
  const [detalheLoading, setDetalheLoading] = useState(false);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const STORAGE_KEY = "tiny_meta_faturamento";
  const [metaFaturamento, setMetaFaturamento] = useState<number>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? Number(saved) : 0;
  });
  const [modalMeta, setModalMeta] = useState(false);
  const [metaInput, setMetaInput] = useState("");

  const temIntegracao = !!integration;

  const { ordensRaw, loading, error, ultimaSinc, buscarDados } = useTinyDados(
    dataInicio,
    dataFim,
    temIntegracao
  );

  // Auto refresh
  useEffect(() => {
    if (!temIntegracao) return;
    const mins = integration?.auto_refresh_interval ?? 15;
    autoRefreshRef.current = setInterval(buscarDados, mins * 60 * 1000);
    return () => { if (autoRefreshRef.current) clearInterval(autoRefreshRef.current); };
  }, [integration?.auto_refresh_interval, temIntegracao, buscarDados]);

  // Abrir modal de boas-vindas ao montar sem integração
  useEffect(() => {
    if (!integrationLoading && !temIntegracao) setModalBoasVindas(true);
  }, [integrationLoading, temIntegracao]);

  const abrirDetalhe = useCallback(async (os: TinyOS) => {
    setOsSelecionada(os);
    setDetalhe(null);
    setDetalheLoading(true);
    const data = await fetchTinyOSDetalhe(os.id);
    setDetalhe(data);
    setDetalheLoading(false);
  }, []);

  // Processar ordens — campos da API V3
  const ordens = useMemo(() => {
    return ordensRaw.map((raw) => {
      const r = raw as Record<string, unknown>;
      const clienteObj = r.cliente as Record<string, unknown> | undefined;
      const situacaoRaw = String(r.situacao ?? "0");
      const marcadores = Array.isArray(r.marcadores)
        ? (r.marcadores as Record<string, unknown>[]).map((m) => String(m.descricao ?? ""))
        : [];
      return {
        id: String(r.id ?? ""),
        numero: String(r.numeroOrdemServico ?? r.id ?? ""),
        cliente: String(clienteObj?.nome ?? "—"),
        clienteObj: clienteObj ? {
          id: clienteObj.id as number | undefined,
          nome: String(clienteObj.nome ?? ""),
          cpfCnpj: String(clienteObj.cpfCnpj ?? ""),
          celular: String(clienteObj.celular ?? ""),
          email: String(clienteObj.email ?? ""),
          endereco: clienteObj.endereco as TinyOS["clienteObj"],
        } : undefined,
        situacao: mapSituacaoTiny(situacaoRaw),
        situacaoRaw,
        data_pedido: String(r.data ?? ""),
        dataPrevista: r.dataPrevista ? String(r.dataPrevista).split(" ")[0] : undefined,
        valor: Number(r.valor ?? 0),
        marcadores,
      } as TinyOS;
    });
  }, [ordensRaw]);

  const ordensEmAberto = useMemo(
    () => ordens.filter((o) => o.situacao === "em_aberto"),
    [ordens]
  );
  const ordensEmManutencao = useMemo(
    () => ordens.filter((o) => o.situacao === "em_manutencao"),
    [ordens]
  );
  const ordensConcluido = useMemo(
    () => ordens.filter((o) => o.situacao === "concluido"),
    [ordens]
  );
  const ordensFinalizado = useMemo(
    () => ordens.filter((o) => o.situacao === "finalizado"),
    [ordens]
  );

  const somaValores = useCallback(
    (lista: typeof ordens) => lista.reduce((acc, o) => acc + o.valor, 0),
    []
  );

  const valorRealizado = somaValores([...ordensEmManutencao, ...ordensConcluido, ...ordensFinalizado]);
  const valorEmFluxo = somaValores([...ordensEmAberto, ...ordensEmManutencao]);
  const metaPeriodo = metaFaturamento;

  // Dias úteis
  const diasUteisTotal = calcularDiasUteis(startOfMonth(dataInicio), endOfMonth(dataFim));
  const diasUteisPassados = calcularDiasUteis(startOfMonth(dataInicio), hoje > dataFim ? dataFim : hoje);
  const percentEsperado = diasUteisTotal > 0 ? (diasUteisPassados / diasUteisTotal) * 100 : 0;
  const percentReal = metaPeriodo > 0 ? (valorRealizado / metaPeriodo) * 100 : 0;
  const ritmoDiario = diasUteisPassados > 0 ? valorRealizado / diasUteisPassados : 0;
  const projecao = ritmoDiario * diasUteisTotal;

  // Semáforo: com meta compara percentReal vs percentEsperado.
  // Sem meta, compara a proporção do realizado sobre a projeção vs o esperado do mês.
  const percentEfetivo = metaPeriodo > 0
    ? percentReal
    : (projecao > 0 ? (valorRealizado / projecao) * 100 : 0);

  const semaforo =
    percentEfetivo >= percentEsperado ? "verde"
    : percentEfetivo >= percentEsperado * 0.7 ? "amarelo"
    : "vermelho";

  const semaforoCor: Record<string, string> = {
    verde: "text-green-600",
    amarelo: "text-yellow-600",
    vermelho: "text-destructive",
  };
  const semaforoLabel: Record<string, string> = {
    verde: "No ritmo",
    amarelo: "Atenção",
    vermelho: "Crítico",
  };

  // Kanban por tempo parado
  const kanban = useMemo(() => {
    return [...ordensEmAberto, ...ordensEmManutencao]
      .map((o) => ({ ...o, dias: diasParados(o.data_pedido) }))
      .sort((a, b) => b.dias - a.dias);
  }, [ordensEmAberto, ordensEmManutencao]);

  const osPausadas3dias = kanban.filter((o) => o.dias >= 3);

  // Maiores pendentes
  const maioresPendentes = useMemo(
    () =>
      [...ordensEmAberto, ...ordensEmManutencao]
        .map((o) => ({ ...o, dias: diasParados(o.data_pedido) }))
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 10),
    [ordensEmAberto, ordensEmManutencao]
  );

  if (integrationLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 mt-4">
        {Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)}
      </div>
    );
  }

  if (!temIntegracao) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-20 gap-5">
          <div className="h-14 w-14 rounded-2xl bg-muted border border-border/50 flex items-center justify-center">
            <Plug className="h-7 w-7 text-muted-foreground" />
          </div>
          <div className="text-center space-y-1">
            <p className="font-semibold text-base">Nenhuma integração configurada</p>
            <p className="text-sm text-muted-foreground max-w-sm">
              Conecte ao sistema Tiny da sua assistência parceira para ver os dados em tempo real aqui.
            </p>
          </div>
          <Button onClick={() => setModalBoasVindas(true)} className="gap-2">
            <Plug className="h-4 w-4" />
            Conectar com Tiny
          </Button>
        </div>

        <DialogBoasVindasTiny
          open={modalBoasVindas}
          onClose={() => setModalBoasVindas(false)}
          onConectar={onConectar}
        />
      </>
    );
  }

  return (
    <>
      {/* Cabeçalho do dashboard */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div>
          <p className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase mb-0.5">
            Gestão Terceirizada
          </p>
          <h2 className="text-lg font-bold leading-tight">Dashboard de ordens de serviço</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Visão gerencial do mês, fila aberta no Tiny e urgências por tempo parado.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Filtro de período */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1 px-2.5 font-mono border-border/50">
                <CalendarIcon className="h-3 w-3" />
                {format(dataInicio, "dd/MM")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar mode="single" selected={dataInicio} onSelect={(d) => d && setDataInicio(d)} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>

          <span className="text-xs text-muted-foreground/40 font-mono">→</span>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1 px-2.5 font-mono border-border/50">
                <CalendarIcon className="h-3 w-3" />
                {format(dataFim, "dd/MM")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar mode="single" selected={dataFim} onSelect={(d) => d && setDataFim(d)} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>

          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5 px-2.5 border-border/50"
            onClick={buscarDados}
            disabled={loading}
          >
            <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
            Atualizar
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-7 w-7 p-0 border-border/50"
            onClick={() => setModalConfigs(true)}
          >
            <Settings className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Banner de alerta */}
      {osPausadas3dias.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 mb-4">
          <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-400">Atenção imediata</p>
            <p className="text-xs text-yellow-700 dark:text-yellow-500 mt-0.5">
              Existem {osPausadas3dias.length} OS com 3 dias ou mais paradas na terceirizada. Elas precisam de ação agora.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 mb-4">
          <p className="text-sm text-destructive flex-1">{error}</p>
          <Button variant="outline" size="sm" onClick={buscarDados} className="text-xs h-7">
            Tentar novamente
          </Button>
        </div>
      )}

      {/* 5 cards gerenciais */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
        {/* Card META OS */}
        <Card className="border-border/40 col-span-2 sm:col-span-1">
          <CardContent className="p-4">
            {loading ? <CardSkeleton /> : (
              <>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">Meta OS</p>
                  <button
                    onClick={() => { setMetaInput(metaFaturamento > 0 ? String(metaFaturamento) : ""); setModalMeta(true); }}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title="Definir meta de faturamento"
                  >
                    <Target className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="text-xl font-bold">{BRL(valorRealizado)}</p>
                {metaPeriodo > 0 ? (
                  <>
                    <div className="h-1.5 rounded-full bg-muted mt-2 mb-1 overflow-hidden">
                      <div
                        className={cn("h-full rounded-full", percentReal >= 80 ? "bg-green-500" : percentReal >= 50 ? "bg-yellow-500" : "bg-destructive")}
                        style={{ width: `${Math.min(percentReal, 100)}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {percentReal.toFixed(0)}% — Faltam {BRL(Math.max(metaPeriodo - valorRealizado, 0))}
                    </p>
                  </>
                ) : (
                  <button
                    onClick={() => { setMetaInput(""); setModalMeta(true); }}
                    className="text-[11px] text-primary hover:underline mt-1 block"
                  >
                    + Definir meta de faturamento
                  </button>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Card OS EM FLUXO */}
        <Card className="border-border/40">
          <CardContent className="p-4">
            {loading ? <CardSkeleton /> : (
              <>
                <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest mb-1">OS em Fluxo</p>
                <p className="text-xl font-bold">{BRL(valorEmFluxo)}</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {ordensEmAberto.length + ordensEmManutencao.length} OS ainda não finalizadas
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Card SEMÁFORO */}
        <Card className="border-border/40">
          <CardContent className="p-4">
            {loading ? <CardSkeleton /> : (
              <>
                <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest mb-1">Semáforo</p>
                {metaPeriodo > 0 ? (
                  <>
                    <p className={cn("text-xl font-bold", semaforoCor[semaforo])}>
                      {semaforoLabel[semaforo]}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Real {percentReal.toFixed(0)}% — Esperado {percentEsperado.toFixed(0)}%
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-xl font-bold text-muted-foreground">—</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Configure a meta para ativar
                    </p>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Card RITMO DIÁRIO */}
        <Card className="border-border/40">
          <CardContent className="p-4">
            {loading ? <CardSkeleton /> : (
              <>
                <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest mb-1">Ritmo Diário</p>
                <p className="text-xl font-bold">{BRL(ritmoDiario)}</p>
                <p className="text-[11px] text-muted-foreground mt-1">Meta realizada por dia útil</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Card PROJEÇÃO */}
        <Card className="border-border/40">
          <CardContent className="p-4">
            {loading ? <CardSkeleton /> : (
              <>
                <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest mb-1">Projeção</p>
                <p className={cn("text-xl font-bold",
                  metaPeriodo > 0
                    ? projecao >= metaPeriodo ? "text-green-600" : projecao >= metaPeriodo * 0.8 ? "text-yellow-600" : "text-destructive"
                    : ""
                )}>
                  {BRL(projecao)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">Se mantiver o ritmo do mês</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Indicadores reais do Tiny */}
      <Card className="border-border/40 mb-4">
        <CardHeader className="p-4 pb-2 border-b border-border/30">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">Indicadores Reais do Tiny</p>
              <p className="text-xs text-muted-foreground mt-0.5">Lidos do período filtrado com a legenda operacional.</p>
            </div>
            {ultimaSinc && (
              <p className="text-[10px] text-muted-foreground font-mono">
                Sincronizado {format(ultimaSinc, "HH:mm 'de' dd/MM", { locale: ptBR })}
              </p>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                  { label: "Total", qtd: ordens.length, val: somaValores(ordens), cls: "bg-muted/30 border-border/40" },
                  { label: "Em aberto", qtd: ordensEmAberto.length, val: somaValores(ordensEmAberto), cls: "bg-blue-500/5 border-blue-500/20" },
                  { label: "Em manutenção", qtd: ordensEmManutencao.length, val: somaValores(ordensEmManutencao), cls: "bg-purple-500/5 border-purple-500/20" },
                  { label: "Serv. concluído", qtd: ordensConcluido.length, val: somaValores(ordensConcluido), cls: "bg-green-500/5 border-green-500/20" },
                  { label: "Finalizada", qtd: ordensFinalizado.length, val: somaValores(ordensFinalizado), cls: "bg-muted/20 border-border/30" },
                ].map((item) => (
                  <div key={item.label} className={cn("rounded-lg border p-3", item.cls)}>
                    <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wide">{item.label}</p>
                    <p className="text-lg font-bold mt-1">{item.qtd}</p>
                    <p className="text-[11px] text-muted-foreground">{BRL(item.val)}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-border/30">
                <p className="text-[11px] text-muted-foreground">
                  <strong>Em aberto:</strong> ainda não foi para o laboratório ·{" "}
                  <strong>Em manutenção:</strong> está no laboratório ·{" "}
                  <strong>Serv. concluído:</strong> concluído, ainda não pago ·{" "}
                  <strong>Finalizada:</strong> paga / faturada
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Kanban por tempo parado */}
      <Card className="border-border/40 mb-4">
        <CardHeader className="p-4 pb-2 border-b border-border/30">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">Kanban por Tempo Parado</p>
              <p className="text-xs text-muted-foreground mt-0.5">Só entram aqui OS em aberto e em manutenção, usando a data real de abertura no Tiny.</p>
            </div>
            <div className="text-[11px] text-muted-foreground font-mono">
              {kanban.length} OS · {BRL(somaValores(kanban))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : kanban.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum registro encontrado para o período selecionado</p>
          ) : (
            <div className="space-y-2">
              {kanban.map((o) => (
                <div
                  key={o.id}
                  onClick={() => abrirDetalhe(o)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border bg-muted/10 p-3 text-sm cursor-pointer hover:bg-muted/20 transition-colors",
                    corBorda(o.dias)
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">#{o.numero}</span>
                      <span className="font-medium truncate">{o.cliente}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                        {o.situacaoRaw}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {o.dias === 0 ? "Hoje" : `${o.dias} dia${o.dias > 1 ? "s" : ""} parada`}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-semibold text-sm">{BRL(o.valor)}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Maiores OS abertas / em manutenção */}
      <Card className="border-border/40 mb-4">
        <CardHeader className="p-4 pb-2 border-b border-border/30">
          <p className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">Maiores Abertas / Em Manutenção</p>
          <p className="text-xs text-muted-foreground mt-0.5">OS de maior valor ainda pendentes, ordenadas do maior para o menor.</p>
        </CardHeader>
        <CardContent className="p-4">
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : maioresPendentes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma OS pendente no período</p>
          ) : (
            <div className="space-y-2">
              {maioresPendentes.map((o, idx) => (
                <div
                  key={o.id}
                  onClick={() => abrirDetalhe(o)}
                  className="flex items-center gap-3 rounded-lg border border-border/40 bg-muted/10 p-3 text-sm cursor-pointer hover:bg-muted/20 transition-colors"
                >
                  <span className="text-xs font-mono text-muted-foreground w-5 shrink-0">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">#{o.numero}</span>
                      <span className="font-medium truncate">{o.cliente}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5">{o.situacaoRaw}</Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {o.dias === 0 ? "Hoje" : `${o.dias} dia${o.dias > 1 ? "s" : ""} parada`}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-bold">{BRL(o.valor)}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sheet de detalhes da OS */}
      <Sheet open={!!osSelecionada} onOpenChange={(open) => { if (!open) setOsSelecionada(null); }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {osSelecionada && (
            <>
              <SheetHeader className="pb-4">
                <SheetTitle className="flex items-center gap-2">
                  <span className="font-mono text-muted-foreground text-sm font-normal">OS #{osSelecionada.numero}</span>
                </SheetTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">{osSelecionada.situacaoRaw}</Badge>
                  {osSelecionada.marcadores?.map((m) => (
                    <Badge key={m} variant="secondary" className="text-[10px]">
                      <Tag className="h-2.5 w-2.5 mr-1" />{m}
                    </Badge>
                  ))}
                </div>
              </SheetHeader>

              <div className="space-y-5">
                {/* Valor e datas */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-muted/30 border border-border/40 p-3">
                    <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wide mb-1">Valor</p>
                    <p className="text-lg font-bold">{BRL(osSelecionada.valor)}</p>
                  </div>
                  <div className="rounded-lg bg-muted/30 border border-border/40 p-3">
                    <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wide mb-1">Abertura</p>
                    <p className="text-sm font-semibold">
                      {osSelecionada.data_pedido
                        ? format(new Date(osSelecionada.data_pedido), "dd/MM/yyyy")
                        : "—"}
                    </p>
                  </div>
                  {osSelecionada.dataPrevista && (
                    <div className="rounded-lg bg-muted/30 border border-border/40 p-3 col-span-2">
                      <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wide mb-1">Previsão de entrega</p>
                      <p className="text-sm font-semibold">
                        {format(new Date(osSelecionada.dataPrevista), "dd/MM/yyyy")}
                      </p>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Cliente */}
                <div>
                  <p className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase mb-2">Cliente</p>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <User className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium">{osSelecionada.cliente}</p>
                        {osSelecionada.clienteObj?.cpfCnpj && (
                          <p className="text-xs text-muted-foreground">{osSelecionada.clienteObj.cpfCnpj}</p>
                        )}
                      </div>
                    </div>
                    {osSelecionada.clienteObj?.celular && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <a href={`tel:${osSelecionada.clienteObj.celular}`} className="text-sm hover:underline">
                          {osSelecionada.clienteObj.celular}
                        </a>
                      </div>
                    )}
                    {osSelecionada.clienteObj?.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <a href={`mailto:${osSelecionada.clienteObj.email}`} className="text-sm hover:underline truncate">
                          {osSelecionada.clienteObj.email}
                        </a>
                      </div>
                    )}
                    {osSelecionada.clienteObj?.endereco && (osSelecionada.clienteObj.endereco as Record<string, unknown>)?.municipio && (
                      <div className="flex items-start gap-2">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                        <p className="text-sm text-muted-foreground">
                          {[
                            (osSelecionada.clienteObj.endereco as Record<string, unknown>).endereco,
                            (osSelecionada.clienteObj.endereco as Record<string, unknown>).numero,
                            (osSelecionada.clienteObj.endereco as Record<string, unknown>).bairro,
                            (osSelecionada.clienteObj.endereco as Record<string, unknown>).municipio,
                            (osSelecionada.clienteObj.endereco as Record<string, unknown>).uf,
                          ].filter(Boolean).join(", ")}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Detalhe completo carregado da API */}
                {detalheLoading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Carregando detalhes...
                  </div>
                )}

                {!detalheLoading && detalhe && (
                  <>
                    {detalhe.equipamento && (
                      <>
                        <Separator />
                        <div>
                          <p className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase mb-2">Equipamento</p>
                          <div className="flex items-start gap-2">
                            <Wrench className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium">{String(detalhe.equipamento)}</p>
                              {detalhe.equipamentoSerie && (
                                <p className="text-xs text-muted-foreground">Série: {String(detalhe.equipamentoSerie)}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {detalhe.descricaoProblema && (
                      <>
                        <Separator />
                        <div>
                          <p className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase mb-2">Descrição do Problema</p>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{String(detalhe.descricaoProblema)}</p>
                        </div>
                      </>
                    )}

                    {detalhe.observacoes && (
                      <>
                        <Separator />
                        <div>
                          <p className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase mb-2">Observações</p>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{String(detalhe.observacoes)}</p>
                        </div>
                      </>
                    )}

                    {detalhe.tecnico && (
                      <>
                        <Separator />
                        <div>
                          <p className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase mb-2">Técnico</p>
                          <p className="text-sm">{String(detalhe.tecnico)}</p>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Modal de meta de faturamento */}
      <Sheet open={modalMeta} onOpenChange={setModalMeta}>
        <SheetContent side="bottom" className="pb-8">
          <SheetHeader className="pb-4">
            <SheetTitle className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Meta de faturamento mensal
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-4 max-w-sm">
            <div className="space-y-1.5">
              <Label htmlFor="meta-input" className="text-xs text-muted-foreground font-mono uppercase tracking-wide">
                Valor da meta (R$)
              </Label>
              <Input
                id="meta-input"
                type="number"
                min="0"
                step="100"
                placeholder="Ex: 10000"
                value={metaInput}
                onChange={(e) => setMetaInput(e.target.value)}
                className="text-base"
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground">
                O semáforo vai comparar o realizado com a proporção esperada para hoje no mês.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  const val = Number(metaInput);
                  if (!isNaN(val) && val >= 0) {
                    setMetaFaturamento(val);
                    localStorage.setItem(STORAGE_KEY, String(val));
                  }
                  setModalMeta(false);
                }}
              >
                Salvar meta
              </Button>
              {metaFaturamento > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setMetaFaturamento(0);
                    localStorage.removeItem(STORAGE_KEY);
                    setModalMeta(false);
                  }}
                >
                  Remover meta
                </Button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Modais */}
      <DialogBoasVindasTiny
        open={modalBoasVindas}
        onClose={() => setModalBoasVindas(false)}
        onConectar={onConectar}
      />

      <DialogConfiguracoesTiny
        open={modalConfigs}
        onClose={() => setModalConfigs(false)}
        integration={integration}
        onReconectar={onReconectar}
        onDesconectar={onDesconectar}
        onAtualizarIntervalo={onAtualizarIntervalo}
      />
    </>
  );
}
