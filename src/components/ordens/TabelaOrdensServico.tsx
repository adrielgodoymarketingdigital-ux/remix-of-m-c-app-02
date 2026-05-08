import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandGroup, CommandItem } from "@/components/ui/command";
import { BotoesAcaoOrdem } from "./BotoesAcaoOrdem";
import { formatCurrency, formatDate, formatTime } from "@/lib/formatters";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { OrdemServico } from "@/hooks/useOrdensServico";
import { Check, ClipboardList } from "lucide-react";
import { useState } from "react";
import { useIsMobile, useIsMobileOrTablet } from "@/hooks/use-mobile";
import { useOSStatusConfig } from "@/hooks/useOSStatusConfig";
import { useOSColunas } from "@/hooks/useOSColunas";

const fallbackColors: Record<string, string> = {
  aguardando_aprovacao: "#eab308",
  em_andamento: "#3b82f6",
  finalizado: "#22c55e",
  aguardando_retirada: "#f97316",
  entregue: "#a855f7",
  cancelada: "#ef4444",
  garantia: "#d97706",
  estornado: "#be123c",
};

const fallbackLabels: Record<string, string> = {
  aguardando_aprovacao: "Aguardando Aprovação",
  em_andamento: "Serviço em Andamento",
  finalizado: "Serviço Finalizado",
  aguardando_retirada: "Aguardando Retirada",
  entregue: "Serviço Entregue",
  cancelada: "Cancelada",
  garantia: "Em Garantia",
  estornado: "Estornado",
};

interface TabelaOrdensServicoProps {
  ordens: OrdemServico[];
  loading: boolean;
  onVisualizar: (ordem: OrdemServico) => void;
  onEditar: (ordem: OrdemServico) => void;
  onImprimir: (ordem: OrdemServico) => void;
  onExcluir: (ordem: OrdemServico) => void;
  onAtualizarStatus?: (id: string, novoStatus: string) => void;
  onEnviarWhatsApp?: (ordem: OrdemServico) => void;
  onCompartilhar?: (ordem: OrdemServico) => void;
  onImprimirTermo?: (ordem: OrdemServico) => void;
  onImprimirEtiqueta?: (ordem: OrdemServico) => void;
  termoAtivo?: boolean;
}

export const TabelaOrdensServico = ({
  ordens,
  loading,
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
}: TabelaOrdensServicoProps) => {
  const [popoverAberto, setPopoverAberto] = useState<string | null>(null);
  const isMobileOrTablet = useIsMobileOrTablet();
  const { statusList, activeStatusList } = useOSStatusConfig();
  const { config } = useOSColunas();
  const colunasAtivas = config.colunas;
  const acoesAtivas = config.acoes_principais;

  const statusColors = statusList.length > 0
    ? Object.fromEntries(statusList.map(s => [s.slug, s.cor]))
    : fallbackColors;
  const statusLabels = statusList.length > 0
    ? Object.fromEntries(statusList.map(s => [s.slug, s.nome]))
    : fallbackLabels;

  const opcoesStatus = (statusList.length > 0 ? activeStatusList : []).map(s => ({
    value: s.slug,
    label: s.nome,
  }));

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border/30 bg-muted/20">
            <Skeleton className="h-3 w-10 rounded" />
            <Skeleton className="h-3 w-28 rounded" />
            <Skeleton className="h-3 w-24 rounded" />
            <Skeleton className="h-3 w-16 rounded ml-auto" />
          </div>
        ))}
      </div>
    );
  }

  if (ordens.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground/50">
        <ClipboardList className="h-10 w-10 opacity-30" />
        <p className="text-sm font-medium">Nenhuma ordem encontrada</p>
      </div>
    );
  }

  // Mobile/Tablet
  if (isMobileOrTablet) {
    return (
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
        {ordens.map((ordem) => {
          const cor = statusColors[ordem.status as string] || "#eab308";
          const label = statusLabels[ordem.status as string] || "Aguardando";
          const isAvulso = (ordem.avarias as any)?.is_avulso;

          return (
            <div
              key={ordem.id}
              className="relative rounded-xl border bg-card overflow-hidden transition-all duration-150 hover:border-border"
              style={{ borderColor: `${cor}25` }}
            >
              {/* Linha de cor no topo */}
              <div className="h-[2px] w-full" style={{ background: `linear-gradient(90deg, ${cor}90, ${cor}20)` }} />

              <div className="p-3.5">
                <div className="flex justify-between items-start mb-2.5">
                  <div className="flex items-center gap-2">
                    {isAvulso ? (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-500 font-mono">Avulso</span>
                    ) : (
                      <span className="text-xs font-bold font-mono text-foreground/80">#{ordem.numero_os}</span>
                    )}
                    {(ordem as any).is_teste && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 font-mono">Teste</span>
                    )}
                  </div>

                  {onAtualizarStatus ? (
                    <Popover
                      open={popoverAberto === ordem.id}
                      onOpenChange={(open) => setPopoverAberto(open ? ordem.id : null)}
                    >
                      <PopoverTrigger asChild>
                        <button className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-semibold cursor-pointer transition-opacity hover:opacity-80 border"
                          style={{ color: cor, borderColor: `${cor}40`, backgroundColor: `${cor}12` }}
                        >
                          <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: cor }} />
                          {label}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-56 p-0" align="end">
                        <Command>
                          <CommandGroup>
                            {opcoesStatus.map((opcao) => (
                              <CommandItem key={opcao.value} value={opcao.value}
                                onSelect={(value) => { onAtualizarStatus(ordem.id, value); setPopoverAberto(null); }}
                                className="flex items-center gap-2 cursor-pointer"
                              >
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: statusColors[opcao.value] || "#3b82f6" }} />
                                <span className="flex-1 text-xs">{opcao.label}</span>
                                {ordem.status === opcao.value && <Check className="h-3.5 w-3.5" />}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <span className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-semibold border"
                      style={{ color: cor, borderColor: `${cor}40`, backgroundColor: `${cor}12` }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cor }} />
                      {label}
                    </span>
                  )}
                </div>

                <p className="text-sm font-medium leading-tight truncate mb-0.5">
                  {isAvulso ? ordem.defeito_relatado : (ordem.cliente?.nome || "N/A")}
                </p>
                <p className="text-xs text-muted-foreground truncate mb-2.5">
                  {isAvulso ? "Serviço Avulso" : `${ordem.dispositivo_marca} ${ordem.dispositivo_modelo}`}
                </p>

                <div className="flex items-center justify-between pt-2.5 border-t border-border/40">
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-mono text-muted-foreground">
                      {formatDate(ordem.created_at)} <span className="opacity-60">{formatTime(ordem.created_at)}</span>
                    </p>
                    <p className="text-sm font-bold font-mono">
                      <ValorMonetario valor={ordem.total} tipo="preco" />
                    </p>
                    {(() => {
                      const entrada = (ordem.avarias as any)?.dados_pagamento?.entrada;
                      return entrada > 0 ? (
                        <p className="text-[10px] text-green-500 font-mono">+<ValorMonetario valor={entrada} tipo="preco" /> entrada</p>
                      ) : null;
                    })()}
                  </div>
                  <BotoesAcaoOrdem
                    onVisualizar={() => onVisualizar(ordem)}
                    onEditar={() => onEditar(ordem)}
                    onImprimir={() => onImprimir(ordem)}
                    onExcluir={() => onExcluir(ordem)}
                    onEnviarWhatsApp={onEnviarWhatsApp ? () => onEnviarWhatsApp(ordem) : undefined}
                    onCompartilhar={() => onCompartilhar?.(ordem)}
                    onImprimirTermo={onImprimirTermo ? () => onImprimirTermo(ordem) : undefined}
                    onImprimirEtiqueta={onImprimirEtiqueta ? () => onImprimirEtiqueta(ordem) : undefined}
                    termoAtivo={termoAtivo}
                    acoesAtivas={acoesAtivas}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Desktop
  const baseWidths: Record<string, number> = {
    numero_os: 6,
    cliente: 13,
    dispositivo: 15,
    entrada: 7,
    data_saida: 7,
    defeito: 18,
    status: 12,
    valor: 7,
    acoes: 15,
  };

  const fixedWidth = baseWidths.numero_os + baseWidths.entrada + baseWidths.acoes;
  const optionalCols = ["cliente", "dispositivo", "data_saida", "defeito", "status", "valor"] as const;
  const activeOptionalBaseWidth = optionalCols
    .filter(c => colunasAtivas.includes(c))
    .reduce((acc, c) => acc + baseWidths[c], 0);
  const totalBaseWidth = fixedWidth + activeOptionalBaseWidth;
  const scale = 100 / totalBaseWidth;
  const w = (col: string) => `${(baseWidths[col] * scale).toFixed(2)}%`;

  return (
    <div className="h-[calc(100vh-24rem)] min-h-[24rem] max-h-[36rem] w-full overflow-x-hidden overflow-y-auto rounded-xl border border-border/40 bg-card">
      <Table className="w-full table-fixed text-[11px]">
        <TableHeader>
          <TableRow className="border-b border-border/50 hover:bg-transparent">
            <TableHead style={{ width: w("numero_os") }} className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70 bg-muted/30">
              OS
            </TableHead>
            {colunasAtivas.includes("cliente") && (
              <TableHead style={{ width: w("cliente") }} className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70 bg-muted/30">
                Cliente
              </TableHead>
            )}
            {colunasAtivas.includes("dispositivo") && (
              <TableHead style={{ width: w("dispositivo") }} className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70 bg-muted/30">
                Dispositivo
              </TableHead>
            )}
            <TableHead style={{ width: w("entrada") }} className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70 bg-muted/30">
              Entrada
            </TableHead>
            {colunasAtivas.includes("data_saida") && (
              <TableHead style={{ width: w("data_saida") }} className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70 bg-muted/30">
                Saída
              </TableHead>
            )}
            {colunasAtivas.includes("defeito") && (
              <TableHead style={{ width: w("defeito") }} className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70 bg-muted/30">
                Serviço
              </TableHead>
            )}
            {colunasAtivas.includes("status") && (
              <TableHead style={{ width: w("status") }} className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70 bg-muted/30">
                Status
              </TableHead>
            )}
            {colunasAtivas.includes("valor") && (
              <TableHead style={{ width: w("valor") }} className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70 bg-muted/30 text-right">
                Valor
              </TableHead>
            )}
            <TableHead style={{ width: w("acoes") }} className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70 bg-muted/30 text-right">
              Ações
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ordens.map((ordem, idx) => {
            const cor = statusColors[ordem.status as string] || "#eab308";
            const label = statusLabels[ordem.status as string] || "Aguardando";
            const isAvulso = (ordem.avarias as any)?.is_avulso;

            return (
              <TableRow
                key={ordem.id}
                className="group border-b border-border/20 transition-colors duration-100 hover:bg-muted/30 cursor-default"
              >
                {/* OS */}
                <TableCell className="px-3 py-2 font-mono">
                  {isAvulso ? (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-500">Avulso</span>
                  ) : (
                    <span className="text-xs font-bold text-foreground/75">#{ordem.numero_os}</span>
                  )}
                  {(ordem as any).is_teste && (
                    <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-amber-500/15 text-amber-600">T</span>
                  )}
                </TableCell>

                {/* Cliente */}
                {colunasAtivas.includes("cliente") && (
                  <TableCell className="px-3 py-2 overflow-hidden">
                    <span className="block truncate text-xs">
                      {isAvulso ? <span className="text-muted-foreground/40">—</span> : (ordem.cliente?.nome || "N/A")}
                    </span>
                  </TableCell>
                )}

                {/* Dispositivo */}
                {colunasAtivas.includes("dispositivo") && (
                  <TableCell className="px-3 py-2 overflow-hidden">
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium truncate text-xs">
                        {isAvulso ? ordem.defeito_relatado : `${ordem.dispositivo_marca} ${ordem.dispositivo_modelo}`}
                      </span>
                      <span className="text-[10px] text-muted-foreground/60 truncate">{ordem.dispositivo_tipo}</span>
                    </div>
                  </TableCell>
                )}

                {/* Entrada */}
                <TableCell className="px-3 py-2">
                  <div className="font-mono text-[10px] leading-tight text-foreground/70">{formatDate(ordem.created_at)}</div>
                  <div className="font-mono text-[9px] text-muted-foreground/50">{formatTime(ordem.created_at)}</div>
                </TableCell>

                {/* Saída */}
                {colunasAtivas.includes("data_saida") && (
                  <TableCell className="px-3 py-2">
                    {ordem.data_saida ? (
                      <>
                        <div className="font-mono text-[10px] leading-tight text-foreground/70">{formatDate(ordem.data_saida)}</div>
                        <div className="font-mono text-[9px] text-muted-foreground/50">{formatTime(ordem.data_saida)}</div>
                      </>
                    ) : (
                      <span className="text-muted-foreground/30 font-mono text-[10px]">—</span>
                    )}
                  </TableCell>
                )}

                {/* Defeito/Serviço */}
                {colunasAtivas.includes("defeito") && (
                  <TableCell className="max-w-0 truncate px-3 py-2 text-xs text-muted-foreground">
                    {ordem.defeito_relatado}
                  </TableCell>
                )}

                {/* Status */}
                {colunasAtivas.includes("status") && (
                  <TableCell className="overflow-hidden px-3 py-2">
                    {onAtualizarStatus ? (
                      <Popover
                        open={popoverAberto === ordem.id}
                        onOpenChange={(open) => setPopoverAberto(open ? ordem.id : null)}
                      >
                        <PopoverTrigger asChild>
                          <button
                            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-semibold cursor-pointer transition-all hover:opacity-80 border max-w-full overflow-hidden"
                            style={{ color: cor, borderColor: `${cor}35`, backgroundColor: `${cor}10` }}
                          >
                            <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: cor }} />
                            <span className="truncate">{label}</span>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-52 p-0" align="start">
                          <Command>
                            <CommandGroup>
                              {opcoesStatus.map((opcao) => (
                                <CommandItem
                                  key={opcao.value}
                                  value={opcao.value}
                                  onSelect={(value) => { onAtualizarStatus(ordem.id, value); setPopoverAberto(null); }}
                                  className="flex items-center gap-2 cursor-pointer"
                                >
                                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: statusColors[opcao.value] || "#3b82f6" }} />
                                  <span className="flex-1 text-xs">{opcao.label}</span>
                                  {ordem.status === opcao.value && <Check className="h-3.5 w-3.5 shrink-0" />}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-semibold border"
                        style={{ color: cor, borderColor: `${cor}35`, backgroundColor: `${cor}10` }}
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cor }} />
                        {label}
                      </span>
                    )}
                  </TableCell>
                )}

                {/* Valor */}
                {colunasAtivas.includes("valor") && (
                  <TableCell className="px-3 py-2 text-right">
                    <div className="font-mono text-xs font-semibold">
                      <ValorMonetario valor={ordem.total} tipo="preco" />
                    </div>
                    {(() => {
                      const entrada = (ordem.avarias as any)?.dados_pagamento?.entrada;
                      return entrada > 0 ? (
                        <div className="font-mono text-[9px] text-green-500/80">+<ValorMonetario valor={entrada} tipo="preco" /></div>
                      ) : null;
                    })()}
                  </TableCell>
                )}

                {/* Ações */}
                <TableCell className="overflow-hidden px-3 py-2 text-right">
                  <BotoesAcaoOrdem
                    onVisualizar={() => onVisualizar(ordem)}
                    onEditar={() => onEditar(ordem)}
                    onImprimir={() => onImprimir(ordem)}
                    onExcluir={() => onExcluir(ordem)}
                    onEnviarWhatsApp={onEnviarWhatsApp ? () => onEnviarWhatsApp(ordem) : undefined}
                    onCompartilhar={() => onCompartilhar?.(ordem)}
                    onImprimirTermo={onImprimirTermo ? () => onImprimirTermo(ordem) : undefined}
                    onImprimirEtiqueta={onImprimirEtiqueta ? () => onImprimirEtiqueta(ordem) : undefined}
                    termoAtivo={termoAtivo}
                    acoesAtivas={acoesAtivas}
                    compacto
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};
