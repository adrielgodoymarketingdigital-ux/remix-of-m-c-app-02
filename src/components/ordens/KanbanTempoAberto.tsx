import { useMemo, useState } from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Smartphone, AlertTriangle } from "lucide-react";
import { formatCurrency, formatDate, formatTime } from "@/lib/formatters";
import { useOSStatusConfigContext as useOSStatusConfig } from "@/contexts/OSStatusConfigContext";
import type { OrdemServico } from "@/hooks/useOrdensServico";
import { BotoesAcaoOrdem } from "./BotoesAcaoOrdem";

interface KanbanTempoAbertoProps {
  ordens: OrdemServico[];
  loading?: boolean;
  onVisualizar: (ordem: OrdemServico) => void;
  onEditar: (ordem: OrdemServico) => void;
  onImprimir: (ordem: OrdemServico) => void;
  onExcluir: (ordem: OrdemServico) => void;
  onEnviarWhatsApp?: (ordem: OrdemServico) => void;
  onCompartilhar?: (ordem: OrdemServico) => void;
  onImprimirTermo?: (ordem: OrdemServico) => void;
  onImprimirEtiqueta?: (ordem: OrdemServico) => void;
  termoAtivo?: boolean;
}

// Status que ainda não concluíram o ciclo com o cliente
const STATUS_ABERTOS = new Set([
  "aguardando_aprovacao",
  "em_andamento",
  "finalizado",
  "aguardando_retirada",
  "garantia",
  "pendente",
]);

interface FaixaTempo {
  id: string;
  nome: string;
  cor: string;
  min: number;
  max: number | null;
}

const FAIXAS: FaixaTempo[] = [
  { id: "1-3", nome: "1 a 3 dias", cor: "#22c55e", min: 0, max: 3 },
  { id: "3-7", nome: "3 a 7 dias", cor: "#eab308", min: 3, max: 7 },
  { id: "7-15", nome: "7 a 15 dias", cor: "#f97316", min: 7, max: 15 },
  { id: "15-30", nome: "15 a 30 dias", cor: "#ef4444", min: 15, max: 30 },
  { id: "30+", nome: "30+ dias", cor: "#be123c", min: 30, max: null },
];

function diasEmAberto(dataCriacao: string): number {
  const inicio = new Date(dataCriacao).getTime();
  const agora = Date.now();
  return Math.floor((agora - inicio) / (1000 * 60 * 60 * 24));
}

function faixaPorDias(dias: number): FaixaTempo {
  return FAIXAS.find((f) => dias >= f.min && (f.max === null || dias < f.max)) || FAIXAS[FAIXAS.length - 1];
}

interface KanbanCardProps {
  ordem: OrdemServico;
  dias: number;
  onVisualizar: (ordem: OrdemServico) => void;
  onEditar: (ordem: OrdemServico) => void;
  onImprimir: (ordem: OrdemServico) => void;
  onExcluir: (ordem: OrdemServico) => void;
  onEnviarWhatsApp?: (ordem: OrdemServico) => void;
  onCompartilhar?: (ordem: OrdemServico) => void;
  onImprimirTermo?: (ordem: OrdemServico) => void;
  onImprimirEtiqueta?: (ordem: OrdemServico) => void;
  termoAtivo?: boolean;
}

function KanbanCard({
  ordem,
  dias,
  onVisualizar,
  onEditar,
  onImprimir,
  onExcluir,
  onEnviarWhatsApp,
  onCompartilhar,
  onImprimirTermo,
  onImprimirEtiqueta,
  termoAtivo,
}: KanbanCardProps) {
  const { getStatusBySlug } = useOSStatusConfig();
  const statusConfig = getStatusBySlug(ordem.status || "aguardando_aprovacao");

  return (
    <div className="bg-background border rounded-lg p-3 space-y-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="font-semibold text-sm truncate">{ordem.numero_os}</p>
          <p className="text-sm font-medium truncate">{ordem.cliente?.nome || "Cliente não informado"}</p>
        </div>
        <Badge
          className="text-[10px] shrink-0 font-mono"
          style={{ backgroundColor: `${faixaPorDias(dias).cor}20`, color: faixaPorDias(dias).cor, borderColor: `${faixaPorDias(dias).cor}40` }}
          variant="outline"
        >
          {dias}d
        </Badge>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
        <Smartphone className="h-3 w-3 flex-shrink-0" />
        <span className="truncate">
          {ordem.dispositivo_marca} {ordem.dispositivo_modelo}
        </span>
      </div>

      <p className="text-xs text-muted-foreground line-clamp-2">
        {ordem.defeito_relatado}
      </p>

      {statusConfig && (
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: statusConfig.cor }} />
          <span className="text-xs text-muted-foreground truncate">{statusConfig.nome}</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-1 border-t">
        <span className="text-xs text-muted-foreground truncate">
          {formatDate(ordem.created_at)}
          <span className="block text-[10px]">{formatTime(ordem.created_at)}</span>
        </span>
        {ordem.total != null && ordem.total > 0 && (
          <span className="text-xs font-semibold text-foreground shrink-0">
            {formatCurrency(ordem.total)}
          </span>
        )}
      </div>

      <div className="pt-1 border-t">
        <BotoesAcaoOrdem
          onVisualizar={() => onVisualizar(ordem)}
          onEditar={() => onEditar(ordem)}
          onImprimir={() => onImprimir(ordem)}
          onExcluir={() => onExcluir(ordem)}
          onEnviarWhatsApp={onEnviarWhatsApp ? () => onEnviarWhatsApp(ordem) : undefined}
          onCompartilhar={onCompartilhar ? () => onCompartilhar(ordem) : undefined}
          onImprimirTermo={onImprimirTermo ? () => onImprimirTermo(ordem) : undefined}
          onImprimirEtiqueta={onImprimirEtiqueta ? () => onImprimirEtiqueta(ordem) : undefined}
          termoAtivo={termoAtivo}
        />
      </div>
    </div>
  );
}

export function KanbanTempoAberto({
  ordens,
  loading = false,
  onVisualizar,
  onEditar,
  onImprimir,
  onExcluir,
  onEnviarWhatsApp,
  onCompartilhar,
  onImprimirTermo,
  onImprimirEtiqueta,
  termoAtivo,
}: KanbanTempoAbertoProps) {
  const [buscasPorColuna, setBuscasPorColuna] = useState<Record<string, string>>({});

  const colunas = useMemo(() => {
    const ordensAbertas = ordens
      .filter((ordem) => STATUS_ABERTOS.has(ordem.status || "aguardando_aprovacao"))
      .map((ordem) => ({ ordem, dias: diasEmAberto(ordem.created_at) }));

    return FAIXAS.map((faixa) => {
      const busca = (buscasPorColuna[faixa.id] || "").toLowerCase().trim();
      const itensColuna = ordensAbertas
        .filter(({ dias }) => dias >= faixa.min && (faixa.max === null || dias < faixa.max))
        .filter(({ ordem }) => {
          if (!busca) return true;
          return [
            ordem.numero_os,
            ordem.cliente?.nome,
            ordem.dispositivo_modelo,
            ordem.dispositivo_marca,
            ordem.defeito_relatado,
          ]
            .filter(Boolean)
            .some((valor) => valor?.toLowerCase().includes(busca));
        })
        .sort((a, b) => b.dias - a.dias);

      return { ...faixa, itens: itensColuna };
    });
  }, [ordens, buscasPorColuna]);

  const totalAbertas = colunas.reduce((acc, col) => acc + col.itens.length, 0);
  const totalCriticas = colunas.find((c) => c.id === "30+")?.itens.length || 0;

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index}>
            <CardHeader className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-8 w-full" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 3 }).map((__, cardIndex) => (
                <Skeleton key={cardIndex} className="h-32 w-full" />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="w-full max-w-full overflow-hidden space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2 px-1">
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{totalAbertas}</span> ordem(ns) em aberto
        </p>
        {totalCriticas > 0 && (
          <Badge variant="outline" className="text-[11px] gap-1.5 border-destructive/40 text-destructive bg-destructive/5">
            <AlertTriangle className="h-3 w-3" />
            {totalCriticas} crítica(s) há 30+ dias
          </Badge>
        )}
      </div>

      <ScrollAreaPrimitive.Root className="relative h-[calc(100vh-22rem)] min-h-[22rem] max-h-[32rem] w-full max-w-full overflow-hidden overscroll-x-contain">
        <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
          <div className="flex w-max min-w-full h-full gap-4 items-start pr-4 pb-3">
            {colunas.map((col) => (
              <div key={col.id} className="min-w-[280px] w-[280px] h-full flex-shrink-0">
                <Card
                  className="flex h-full flex-col"
                  style={col.id === "30+" ? { borderColor: `${col.cor}40` } : undefined}
                >
                  <CardHeader className="pb-2 space-y-2">
                    <CardTitle className="text-sm flex items-center gap-2 min-w-0">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: col.cor }} />
                      <span className="truncate flex-1">{col.nome}</span>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {col.itens.length}
                      </Badge>
                    </CardTitle>

                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        value={buscasPorColuna[col.id] || ""}
                        onChange={(e) =>
                          setBuscasPorColuna((prev) => ({
                            ...prev,
                            [col.id]: e.target.value,
                          }))
                        }
                        placeholder="Buscar..."
                        className="h-8 text-xs pl-7"
                      />
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-2 flex-1 min-h-0 overflow-y-auto">
                    {col.itens.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-6">
                        Nenhuma ordem nessa faixa
                      </p>
                    ) : (
                      col.itens.map(({ ordem, dias }) => (
                        <KanbanCard
                          key={ordem.id}
                          ordem={ordem}
                          dias={dias}
                          onVisualizar={onVisualizar}
                          onEditar={onEditar}
                          onImprimir={onImprimir}
                          onExcluir={onExcluir}
                          onEnviarWhatsApp={onEnviarWhatsApp}
                          onCompartilhar={onCompartilhar}
                          onImprimirTermo={onImprimirTermo}
                          onImprimirEtiqueta={onImprimirEtiqueta}
                          termoAtivo={termoAtivo}
                        />
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </ScrollAreaPrimitive.Viewport>
        <ScrollAreaPrimitive.ScrollAreaScrollbar
          orientation="horizontal"
          className="flex h-2.5 touch-none select-none border-t border-t-transparent bg-background/95 p-[1px]"
        >
          <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border" />
        </ScrollAreaPrimitive.ScrollAreaScrollbar>
        <ScrollAreaPrimitive.ScrollAreaScrollbar
          orientation="vertical"
          className="flex h-full w-2.5 touch-none select-none border-l border-l-transparent p-[1px]"
        >
          <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border" />
        </ScrollAreaPrimitive.ScrollAreaScrollbar>
        <ScrollAreaPrimitive.Corner />
      </ScrollAreaPrimitive.Root>
    </div>
  );
}
