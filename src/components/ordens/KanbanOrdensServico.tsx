import { useMemo, useState } from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search } from "lucide-react";
import { formatDate, formatTime } from "@/lib/formatters";
import { useOSStatusConfigContext as useOSStatusConfig } from "@/contexts/OSStatusConfigContext";
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
  cor: string;
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
  cor,
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
      onClick={() => onVisualizar(ordem)}
      className="group relative bg-card rounded-xl p-2.5 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="font-bold font-mono text-xs text-foreground truncate">#{ordem.numero_os}</span>
        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: cor }} />
      </div>

      {((ordem as any).is_teste || (ordem as any).tipo_os === "simplificada") && (
        <div className="flex items-center gap-1 mb-1">
          {(ordem as any).is_teste && (
            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 shrink-0">Teste</Badge>
          )}
          {(ordem as any).tipo_os === "simplificada" && (
            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 shrink-0">Simpl.</Badge>
          )}
        </div>
      )}

      <p className="text-sm font-bold text-foreground leading-tight truncate">
        {ordem.cliente?.nome || "Cliente não informado"}
      </p>
      <p className="text-xs text-muted-foreground truncate">
        {ordem.dispositivo_marca} {ordem.dispositivo_modelo}
      </p>
      {ordem.defeito_relatado && (
        <p className="text-xs text-muted-foreground/70 italic truncate">
          {ordem.defeito_relatado}
        </p>
      )}

      <span
        className="inline-block text-[11px] font-medium px-2 py-0.5 rounded-full mt-1.5"
        style={{
          color: ordem.origem_remessa_corporativa ? "#7c3aed" : "#2563eb",
          backgroundColor: ordem.origem_remessa_corporativa ? "#7c3aed18" : "#2563eb18",
        }}
      >
        {ordem.origem_remessa_corporativa ? "Remessa" : "Balcão"}
      </span>

      <p className="text-[11px] text-muted-foreground font-mono mt-1">
        {formatDate(ordem.created_at)} · {formatTime(ordem.created_at)}
      </p>

      {/* Ações — ocultas por padrão, aparecem no hover/toque para não poluir o card */}
      <div
        className="absolute top-2 right-2 rounded-lg bg-card shadow-md border border-border/50 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
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
          compacto
          corIconesNeutros="text-foreground"
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
          <div key={index} className="rounded-xl border border-border/50 bg-card">
            <div className="p-3 space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-8 w-full" />
            </div>
            <div className="p-3 space-y-3">
              {Array.from({ length: 3 }).map((__, cardIndex) => (
                <Skeleton key={cardIndex} className="h-32 w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="w-full max-w-full overflow-hidden">
      <ScrollAreaPrimitive.Root className="relative h-[calc(100dvh-22rem)] min-h-[22rem] max-h-[32rem] w-full max-w-full overflow-hidden overscroll-x-contain">
        <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
        <div className="flex w-max min-w-full h-full gap-2 items-start pr-4 pb-3">
          {colunas.map((col) => (
            <div
              key={col.slug}
              className="min-w-[196px] w-[196px] h-full flex-shrink-0"
              onDrop={(e) => handleDrop(e, col.slug)}
              onDragOver={(e) => handleDragOver(e, col.slug)}
              onDragLeave={() => setDragOverCol(null)}
            >
              <div
                className={`flex h-full flex-col rounded-xl border overflow-hidden transition-colors ${dragOverCol === col.slug ? "ring-2 ring-primary/50 bg-accent/30 border-primary/40" : "border-border/50 bg-card"}`}
                style={{ borderTop: `2px solid ${col.cor}` }}
              >
                <div className="p-3 space-y-2 border-b border-border/40">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: col.cor }}
                    />
                    <span className="truncate flex-1 text-sm font-semibold text-foreground">{col.nome}</span>
                    <span
                      className="text-[11px] font-bold rounded-full px-2 py-0.5 shrink-0"
                      style={{ color: col.cor, backgroundColor: `${col.cor}18` }}
                    >
                      {col.ordens.length}
                    </span>
                  </div>

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
                </div>

                <div className="space-y-2 flex-1 min-h-0 overflow-y-auto p-2">
                  {col.ordens.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-6">
                      Nenhuma ordem neste status
                    </p>
                  ) : (
                    col.ordens.map((ordem) => (
                      <KanbanCard
                        key={ordem.id}
                        ordem={ordem}
                        cor={col.cor}
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
                </div>
              </div>
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
