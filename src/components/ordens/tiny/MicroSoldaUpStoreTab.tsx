import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CalendarIcon,
  RefreshCw,
  Plug,
  ChevronRight,
} from "lucide-react";
import {
  TinyIntegration,
  TinyOS,
  diasParados,
  mapSituacaoTiny,
  useTinyDados,
} from "@/hooks/useTinyIntegration";
import type { OrdemServico } from "@/hooks/useOrdensServico";
import { DialogBoasVindasTiny } from "./DialogBoasVindasTiny";

const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// OS unificada para exibição no kanban combinado
interface OSUnificada {
  id: string;
  numero: string;
  cliente: string;
  situacaoLabel: string;
  dias: number;
  valor: number;
  origem: "tiny" | "sistema";
  dataAbertura: string;
}

function corBordaKanban(dias: number) {
  if (dias > 7) return "border-l-4 border-l-destructive";
  if (dias >= 4) return "border-l-4 border-l-yellow-500";
  return "border-l-4 border-l-green-500";
}

function CardOSUnificada({ os, onAbrir }: { os: OSUnificada; onAbrir?: (os: OSUnificada) => void }) {
  return (
    <div
      onClick={() => onAbrir?.(os)}
      className={cn(
        "rounded-lg border bg-muted/10 p-3 text-sm cursor-pointer hover:bg-muted/20 transition-colors",
        corBordaKanban(os.dias)
      )}
    >
      <div className="flex items-start justify-between gap-1 mb-1">
        <span className="font-mono text-xs font-bold text-foreground">OS #{os.numero}</span>
        <span className="font-semibold text-xs shrink-0">{BRL(os.valor)}</span>
      </div>
      <p className="text-xs text-muted-foreground truncate mb-1.5">{os.cliente}</p>
      <div className="flex items-center gap-1.5 flex-wrap">
        <Badge
          variant="outline"
          className={cn("text-[10px] h-4 px-1.5", os.origem === "tiny" ? "border-blue-500/50 text-blue-600" : "border-purple-500/50 text-purple-600")}
        >
          {os.origem === "tiny" ? "Tiny" : "Sistema"}
        </Badge>
        <span className="text-[10px] text-muted-foreground">{os.situacaoLabel}</span>
        <span className="text-[10px] text-muted-foreground">
          {os.dias === 0 ? "Hoje" : `${os.dias}d`}
        </span>
      </div>
    </div>
  );
}

interface KanbanUnificadoProps {
  colunas: { ate3: OSUnificada[]; de4a7: OSUnificada[]; mais7: OSUnificada[] };
  onAbrir?: (os: OSUnificada) => void;
}

function KanbanUnificado({ colunas, onAbrir }: KanbanUnificadoProps) {
  const somaVal = (lista: OSUnificada[]) => lista.reduce((a, o) => a + o.valor, 0);

  const cols = [
    { label: "1 – 3 dias", cor: "border-t-green-500", corText: "text-green-600", items: colunas.ate3 },
    { label: "4 – 7 dias", cor: "border-t-yellow-500", corText: "text-yellow-600", items: colunas.de4a7 },
    { label: "+ 7 dias", cor: "border-t-destructive", corText: "text-destructive", items: colunas.mais7 },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {cols.map((col) => (
        <div key={col.label} className={cn("rounded-lg border border-t-2 border-border/40 bg-muted/5", col.cor)}>
          <div className="flex items-center justify-between px-3 pt-3 pb-2 border-b border-border/30">
            <span className={cn("text-xs font-semibold", col.corText)}>{col.label}</span>
            <span className="text-[10px] text-muted-foreground font-mono">
              {col.items.length} OS · {BRL(somaVal(col.items))}
            </span>
          </div>
          <div className="p-2 space-y-2 min-h-[60px]">
            {col.items.length === 0 ? (
              <p className="text-[11px] text-muted-foreground text-center py-4">Nenhuma OS</p>
            ) : (
              col.items.map((o) => (
                <CardOSUnificada key={`${o.origem}-${o.id}`} os={o} onAbrir={onAbrir} />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

interface Props {
  integration: TinyIntegration | null;
  integrationLoading: boolean;
  onConectar: () => void;
  ordensLocal: OrdemServico[];
  loadingLocal: boolean;
}

const SITUACOES_ABERTAS_TINY = ["em_aberto", "em_manutencao", "concluido"];
const STATUS_ATIVOS_LOCAL = ["em_aberto", "em_andamento", "aguardando_peca", "em_manutencao", "orcamento"];

export function MicroSoldaUpStoreTab({
  integration,
  integrationLoading,
  onConectar,
  ordensLocal,
  loadingLocal,
}: Props) {
  const hoje = new Date();
  const [dataInicio, setDataInicio] = useState<Date>(startOfMonth(hoje));
  const [dataFim, setDataFim] = useState<Date>(endOfMonth(hoje));
  const [modalBoasVindas, setModalBoasVindas] = useState(false);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const temIntegracao = !!integration;

  const { ordensRaw, loading: loadingTiny, buscarDados } = useTinyDados(
    dataInicio,
    dataFim,
    temIntegracao
  );

  useEffect(() => {
    if (!temIntegracao) return;
    const mins = integration?.auto_refresh_interval ?? 15;
    autoRefreshRef.current = setInterval(buscarDados, mins * 60 * 1000);
    return () => { if (autoRefreshRef.current) clearInterval(autoRefreshRef.current); };
  }, [integration?.auto_refresh_interval, temIntegracao, buscarDados]);

  useEffect(() => {
    if (!integrationLoading && !temIntegracao) setModalBoasVindas(true);
  }, [integrationLoading, temIntegracao]);

  // Processar OS do Tiny
  const ordensTiny = useMemo<OSUnificada[]>(() => {
    return ordensRaw
      .map((raw) => {
        const r = raw as Record<string, unknown>;
        const clienteObj = r.cliente as Record<string, unknown> | undefined;
        const situacaoRaw = String(r.situacao ?? "0");
        const situacao = mapSituacaoTiny(situacaoRaw);
        const dataAbertura = String(r.data ?? "");
        return {
          id: String(r.id ?? ""),
          numero: String(r.numeroOrdemServico ?? r.id ?? ""),
          cliente: String(clienteObj?.nome ?? "—"),
          situacaoLabel: situacaoRaw,
          situacao,
          dias: dataAbertura ? diasParados(dataAbertura) : 0,
          valor: Number(r.valor ?? 0),
          origem: "tiny" as const,
          dataAbertura,
        };
      })
      .filter((o) => SITUACOES_ABERTAS_TINY.includes(o.situacao));
  }, [ordensRaw]);

  // Processar OS do sistema local (apenas abertas/em andamento)
  const ordensSistema = useMemo<OSUnificada[]>(() => {
    return ordensLocal
      .filter((o) => {
        const s = (o.status ?? "").toLowerCase();
        return STATUS_ATIVOS_LOCAL.some((k) => s.includes(k)) || (s !== "finalizado" && s !== "entregue" && s !== "cancelado");
      })
      .map((o) => ({
        id: o.id,
        numero: o.numero_os,
        cliente: o.cliente?.nome ?? "—",
        situacaoLabel: o.status ?? "em_aberto",
        dias: diasParados(o.created_at),
        valor: o.total ?? 0,
        origem: "sistema" as const,
        dataAbertura: o.created_at,
      }));
  }, [ordensLocal]);

  // Unificar e distribuir em colunas
  const todasOS = useMemo(() => [...ordensTiny, ...ordensSistema].sort((a, b) => b.dias - a.dias), [ordensTiny, ordensSistema]);

  const colunas = useMemo(() => ({
    ate3: todasOS.filter((o) => o.dias <= 3),
    de4a7: todasOS.filter((o) => o.dias >= 4 && o.dias <= 7),
    mais7: todasOS.filter((o) => o.dias > 7),
  }), [todasOS]);

  const osUrgentes = todasOS.filter((o) => o.dias > 7);
  const loading = loadingTiny || loadingLocal;

  if (integrationLoading) {
    return (
      <div className="grid grid-cols-3 gap-3 mt-4">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
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
            <p className="font-semibold text-base">Integração Tiny necessária</p>
            <p className="text-sm text-muted-foreground max-w-sm">
              Conecte ao Tiny para visualizar as OS da MicroSolda e UpStore junto com as do sistema.
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
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div>
          <p className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase mb-0.5">
            MicroSolda + UpStore
          </p>
          <h2 className="text-lg font-bold leading-tight">Visão unificada de OS</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            OS do Tiny (MicroSolda/UpStore) + OS do seu sistema, em um kanban por prazo.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
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
            disabled={loadingTiny}
          >
            <RefreshCw className={cn("h-3 w-3", loadingTiny && "animate-spin")} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Banner de urgência */}
      {osUrgentes.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 mb-4">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-destructive">Atenção imediata</p>
            <p className="text-xs text-destructive/80 mt-0.5">
              {osUrgentes.length} OS com mais de 7 dias aguardando ação.
            </p>
          </div>
        </div>
      )}

      {/* Totalizadores */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[
          { label: "Total unificado", qtd: todasOS.length, val: todasOS.reduce((a, o) => a + o.valor, 0), cls: "bg-muted/30 border-border/40" },
          { label: "Do Tiny", qtd: ordensTiny.length, val: ordensTiny.reduce((a, o) => a + o.valor, 0), cls: "bg-blue-500/5 border-blue-500/20" },
          { label: "Do sistema", qtd: ordensSistema.length, val: ordensSistema.reduce((a, o) => a + o.valor, 0), cls: "bg-purple-500/5 border-purple-500/20" },
          { label: "Urgentes (+7d)", qtd: osUrgentes.length, val: osUrgentes.reduce((a, o) => a + o.valor, 0), cls: "bg-destructive/5 border-destructive/20" },
        ].map((item) => (
          <div key={item.label} className={cn("rounded-lg border p-3", item.cls)}>
            <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wide">{item.label}</p>
            <p className="text-lg font-bold mt-1">{item.qtd}</p>
            <p className="text-[11px] text-muted-foreground">{BRL(item.val)}</p>
          </div>
        ))}
      </div>

      {/* Kanban unificado */}
      <div className="mb-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div>
            <p className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">Kanban por Tempo Parado</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tiny <span className="text-blue-500">●</span> + Sistema <span className="text-purple-500">●</span> distribuídos por prazo.
            </p>
          </div>
          <div className="text-[11px] text-muted-foreground font-mono">
            {todasOS.length} OS no total
          </div>
        </div>
        {loading ? (
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
          </div>
        ) : todasOS.length === 0 ? (
          <Card className="border-border/40">
            <CardContent className="py-12 text-center">
              <p className="text-sm text-muted-foreground">Nenhuma OS em aberto encontrada no período</p>
            </CardContent>
          </Card>
        ) : (
          <KanbanUnificado colunas={colunas} />
        )}
      </div>

      <DialogBoasVindasTiny
        open={modalBoasVindas}
        onClose={() => setModalBoasVindas(false)}
        onConectar={onConectar}
      />
    </>
  );
}
