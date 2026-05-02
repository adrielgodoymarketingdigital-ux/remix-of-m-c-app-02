import { useMemo, useState } from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Smartphone } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useOSStatusConfig } from "@/hooks/useOSStatusConfig";
import type { OrdemServico } from "@/hooks/useOrdensServico";
import { BotoesAcaoOrdem } from "./BotoesAcaoOrdem";

interface KanbanOrdensServicoProps {
  ordens: OrdemServico[];
  loading?: boolean;
  onVisualizar: (ordem: OrdemServico) => void;
  onEditar: (ordem: OrdemServico) => void;
  onImprimir: (ordem: OrdemServico) => void;
  onExcluir: (ordem: OrdemServico) => void;
  onAtualizarStatus: (id: string, novoStatus: string) => void | Promise<void>;
  onEnviarWhatsApp?: (ordem: OrdemServico) => void;
  onCompartilhar?: (ordem: OrdemServico) => void;
  onImprimirTermo?: (ordem: OrdemServico) => void;
  onImprimirEtiqueta?: (ordem: OrdemServico) => void;
  termoAtivo?: boolean;
}

interface KanbanCardProps {
  ordem: OrdemServico;
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
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("ordemId", ordem.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className="bg-background border rounded-lg p-3 space-y-3 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="font-semibold text-sm truncate">{ordem.numero_os}</p>
          <p className="text-sm font-medium truncate">{ordem.cliente?.nome || "Cliente não informado"}</p>
        </div>
        {(ordem as any).is_teste && (
          <Badge variant="outline" className="text-[10px] shrink-0">
            Teste
          </Badge>
        )}
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

      <div className="flex items-center justify-between gap-2 pt-1 border-t">
        <span className="text-xs text-muted-foreground truncate">
          {formatDate(ordem.created_at)}
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

export function KanbanOrdensServico({
  ordens,
  loading = false,
  onVisualizar,
  onEditar,
  onImprimir,
  onExcluir,
  onAtualizarStatus,
  onEnviarWhatsApp,
  onCompartilhar,
  onImprimirTermo,
  onImprimirEtiqueta,
  termoAtivo,
}: KanbanOrdensServicoProps) {
  const { activeStatusList } = useOSStatusConfig();
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [buscasPorColuna, setBuscasPorColuna] = useState<Record<string, string>>({});
  const normalizarStatus = (status: string | null | undefined) => {
    if (!status || status === "pendente") return "aguardando_aprovacao";
    return status;
  };

  const handleDrop = (e: React.DragEvent, statusSlug: string) => {
    e.preventDefault();
    setDragOverCol(null);
    const ordemId = e.dataTransfer.getData("ordemId");
    if (!ordemId) return;

    const ordem = ordens.find((item) => item.id === ordemId);
    if (!ordem || normalizarStatus(ordem.status) === statusSlug) return;

    onAtualizarStatus(ordemId, statusSlug);
  };

  const handleDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCol(colId);
  };

  const colunas = useMemo(() => {
    return activeStatusList.map((status) => {
      const busca = (buscasPorColuna[status.slug] || "").toLowerCase().trim();
      const ordensColuna = ordens
        .filter((ordem) => normalizarStatus(ordem.status) === status.slug)
        .filter((ordem) => {
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
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

      return { ...status, ordens: ordensColuna };
    });
  }, [activeStatusList, buscasPorColuna, ordens]);

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
    <div className="w-full max-w-full overflow-hidden">
      <ScrollAreaPrimitive.Root className="relative h-[calc(100vh-22rem)] min-h-[22rem] max-h-[32rem] w-full max-w-full overflow-hidden overscroll-x-contain">
        <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
        <div className="flex w-max min-w-full h-full gap-4 items-start pr-4 pb-3">
          {colunas.map((col) => (
            <div
              key={col.slug}
              className="min-w-[280px] w-[280px] h-full flex-shrink-0"
              onDrop={(e) => handleDrop(e, col.slug)}
              onDragOver={(e) => handleDragOver(e, col.slug)}
              onDragLeave={() => setDragOverCol(null)}
            >
              <Card
                className={`flex h-full flex-col ${dragOverCol === col.slug ? "ring-2 ring-primary/50 bg-accent/30" : ""}`}
              >
                <CardHeader className="pb-2 space-y-2">
                  <CardTitle className="text-sm flex items-center gap-2 min-w-0">
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: col.cor }}
                    />
                    <span className="truncate flex-1">{col.nome}</span>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {col.ordens.length}
                    </Badge>
                  </CardTitle>

                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={buscasPorColuna[col.slug] || ""}
                      onChange={(e) =>
                        setBuscasPorColuna((prev) => ({
                          ...prev,
                          [col.slug]: e.target.value,
                        }))
                      }
                      placeholder="Buscar..."
                      className="h-8 text-xs pl-7"
                    />
                  </div>
                </CardHeader>

                <CardContent className="space-y-2 flex-1 min-h-0 overflow-y-auto">
                  {col.ordens.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-6">
                      Nenhuma ordem neste status
                    </p>
                  ) : (
                    col.ordens.map((ordem) => (
                      <KanbanCard
                        key={ordem.id}
                        ordem={ordem}
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
