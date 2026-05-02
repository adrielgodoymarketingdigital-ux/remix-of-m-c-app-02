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
import { formatCurrency, formatDate } from "@/lib/formatters";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { OrdemServico } from "@/hooks/useOrdensServico";
import { Check } from "lucide-react";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { useIsMobile, useIsMobileOrTablet } from "@/hooks/use-mobile";
import { useOSStatusConfig } from "@/hooks/useOSStatusConfig";
import { useOSColunas } from "@/hooks/useOSColunas";

// Fallback colors/labels for when config hasn't loaded yet
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

  // Build dynamic colors/labels from config, with fallback
  // Use full statusList for colors/labels (so existing OS with inactive status still display correctly)
  const statusColors = statusList.length > 0
    ? Object.fromEntries(statusList.map(s => [s.slug, s.cor]))
    : fallbackColors;
  const statusLabels = statusList.length > 0
    ? Object.fromEntries(statusList.map(s => [s.slug, s.nome]))
    : fallbackLabels;

  // Only active statuses appear as selectable options
  const opcoesStatus = (statusList.length > 0 ? activeStatusList : []).map(s => ({
    value: s.slug,
    label: s.nome,
  }));

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (ordens.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Nenhuma ordem de serviço encontrada.
      </div>
    );
  }

  // Mobile/Tablet: Card-based layout
  if (isMobileOrTablet) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        {ordens.map((ordem) => (
          <Card key={ordem.id} className="p-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="font-semibold text-base">
                  {(ordem.avarias as any)?.is_avulso ? (
                    <Badge className="bg-violet-600 hover:bg-violet-700 text-white text-[10px]">Avulso</Badge>
                  ) : (
                    <>OS {ordem.numero_os}</>
                  )}
                  {(ordem as any).is_teste && (
                    <Badge variant="outline" className="ml-2 text-[10px] bg-amber-100 text-amber-800 border-amber-300">Teste</Badge>
                  )}
                </p>
                <p className="text-sm text-muted-foreground">{(ordem.avarias as any)?.is_avulso ? ordem.defeito_relatado : (ordem.cliente?.nome || "N/A")}</p>
              </div>
              {onAtualizarStatus ? (
                <Popover
                  open={popoverAberto === ordem.id}
                  onOpenChange={(open) => setPopoverAberto(open ? ordem.id : null)}
                >
                  <PopoverTrigger asChild>
                    <button
                      className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold text-white border-0 cursor-pointer"
                      style={{ backgroundColor: statusColors[ordem.status as string] || '#eab308' }}
                    >
                      {statusLabels[ordem.status as string] || "Aguardando"}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-0" align="end">
                    <Command>
                      <CommandGroup>
                        {opcoesStatus.map((opcao) => (
                          <CommandItem
                            key={opcao.value}
                            value={opcao.value}
                            onSelect={(value) => {
                              onAtualizarStatus(ordem.id, value);
                              setPopoverAberto(null);
                            }}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: statusColors[opcao.value] || '#3b82f6' }} />
                            <span className="flex-1">{opcao.label}</span>
                            {ordem.status === opcao.value && (
                              <Check className="h-4 w-4" />
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              ) : (
                <Badge
                  variant="outline"
                  className="text-white border-0"
                  style={{ backgroundColor: statusColors[ordem.status as string] || '#eab308' }}
                >
                  {statusLabels[ordem.status as string] || "Aguardando"}
                </Badge>
              )}
            </div>

            <div className="text-sm space-y-1 mb-3">
              <p className="font-medium">{ordem.dispositivo_marca} {ordem.dispositivo_modelo}</p>
              <p className="text-muted-foreground text-xs">{ordem.dispositivo_tipo}</p>
              <p className="text-muted-foreground truncate">{ordem.defeito_relatado}</p>
            </div>

            <div className="flex items-center justify-between pt-3 border-t">
              <div className="text-sm space-y-0.5">
                <div className="text-muted-foreground">
                  <span>Entrada: {formatDate(ordem.created_at)}</span>
                </div>
                {ordem.data_saida && (
                  <div className="text-muted-foreground">
                    <span>Saída: {formatDate(ordem.data_saida)}</span>
                  </div>
                )}
                <span className="font-semibold"><ValorMonetario valor={ordem.total} tipo="preco" /></span>
                {(() => {
                  const entrada = (ordem.avarias as any)?.dados_pagamento?.entrada;
                  return entrada > 0 ? (
                    <span className="ml-1 text-xs text-green-600">(Entrada: <ValorMonetario valor={entrada} tipo="preco" />)</span>
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
          </Card>
        ))}
      </div>
    );
  }

  // Desktop: Table layout
  // Base widths for each column (percentage points)
  const baseWidths: Record<string, number> = {
    numero_os: 6,
    cliente: 13,
    dispositivo: 15,
    entrada: 7,   // always visible
    data_saida: 7,
    defeito: 18,
    status: 12,
    valor: 7,
    acoes: 15,    // always visible
  };

  // Sum of always-visible columns
  const fixedWidth = baseWidths.numero_os + baseWidths.entrada + baseWidths.acoes;
  // Sum of optional columns that are currently active
  const optionalCols = ['cliente', 'dispositivo', 'data_saida', 'defeito', 'status', 'valor'] as const;
  const activeOptionalBaseWidth = optionalCols
    .filter(c => colunasAtivas.includes(c))
    .reduce((acc, c) => acc + baseWidths[c], 0);
  const totalBaseWidth = fixedWidth + activeOptionalBaseWidth;

  // Scale factor so all widths add up to 100%
  const scale = 100 / totalBaseWidth;

  const w = (col: string) => `${(baseWidths[col] * scale).toFixed(2)}%`;

  return (
    <div className="h-[calc(100vh-24rem)] min-h-[24rem] max-h-[36rem] w-full overflow-x-hidden overflow-y-auto rounded-md border [&_.overflow-auto]:overflow-hidden">
      <Table className="w-full table-fixed text-[11px]">
        <TableHeader>
          <TableRow>
            <TableHead style={{ width: w('numero_os') }} className="px-1.5">OS</TableHead>
            {colunasAtivas.includes('cliente') && (
              <TableHead style={{ width: w('cliente') }} className="px-1.5">Cliente</TableHead>
            )}
            {colunasAtivas.includes('dispositivo') && (
              <TableHead style={{ width: w('dispositivo') }} className="px-1.5">Dispositivo</TableHead>
            )}
            <TableHead style={{ width: w('entrada') }} className="px-1.5">Entrada</TableHead>
            {colunasAtivas.includes('data_saida') && (
              <TableHead style={{ width: w('data_saida') }} className="px-1.5">Saída</TableHead>
            )}
            {colunasAtivas.includes('defeito') && (
              <TableHead style={{ width: w('defeito') }} className="px-1.5">Serviço</TableHead>
            )}
            {colunasAtivas.includes('status') && (
              <TableHead style={{ width: w('status') }} className="px-1.5">Status</TableHead>
            )}
            {colunasAtivas.includes('valor') && (
              <TableHead style={{ width: w('valor') }} className="px-1.5 text-right">Valor</TableHead>
            )}
            <TableHead style={{ width: w('acoes') }} className="px-1.5 text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ordens.map((ordem) => (
            <TableRow key={ordem.id}>
              <TableCell className="px-1.5 py-1.5 font-medium">
                {(ordem.avarias as any)?.is_avulso ? (
                  <Badge className="bg-violet-600 hover:bg-violet-700 text-white text-[10px]">Avulso</Badge>
                ) : (
                  <span className="block truncate">{ordem.numero_os}</span>
                )}
                {(ordem as any).is_teste && (
                  <Badge variant="outline" className="ml-2 text-[10px] bg-amber-100 text-amber-800 border-amber-300">Teste</Badge>
                )}
              </TableCell>
              {colunasAtivas.includes('cliente') && (
                <TableCell className="overflow-hidden truncate px-1.5 py-1.5">{(ordem.avarias as any)?.is_avulso ? "—" : (ordem.cliente?.nome || "N/A")}</TableCell>
              )}
              {colunasAtivas.includes('dispositivo') && (
                <TableCell className="overflow-hidden px-1.5 py-1.5">
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium truncate">
                      {(ordem.avarias as any)?.is_avulso ? ordem.defeito_relatado : `${ordem.dispositivo_marca} ${ordem.dispositivo_modelo}`}
                    </span>
                    <span className="text-[10px] text-muted-foreground truncate">
                      {ordem.dispositivo_tipo}
                    </span>
                  </div>
                </TableCell>
              )}
              <TableCell className="whitespace-nowrap px-1.5 py-1.5">{formatDate(ordem.created_at)}</TableCell>
              {colunasAtivas.includes('data_saida') && (
                <TableCell className="whitespace-nowrap px-1.5 py-1.5">
                  {ordem.data_saida ? formatDate(ordem.data_saida) : <span className="text-muted-foreground">—</span>}
                </TableCell>
              )}
              {colunasAtivas.includes('defeito') && (
                <TableCell className="max-w-0 truncate px-1.5 py-1.5">
                  {ordem.defeito_relatado}
                </TableCell>
              )}
              {colunasAtivas.includes('status') && (
                <TableCell className="overflow-hidden px-1.5 py-1.5">
                  {onAtualizarStatus ? (
                    <Popover
                      open={popoverAberto === ordem.id}
                      onOpenChange={(open) => setPopoverAberto(open ? ordem.id : null)}
                    >
                      <PopoverTrigger asChild>
                        <button
                          className="inline-flex max-w-full cursor-pointer items-center overflow-hidden rounded-md border-0 px-1.5 py-0.5 text-[10px] font-semibold text-white transition-opacity hover:opacity-80"
                          style={{ backgroundColor: statusColors[ordem.status as string] || '#eab308' }}
                        >
                          <span className="truncate">{statusLabels[ordem.status as string] || "Aguardando Aprovação"}</span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-56 p-0" align="start">
                        <Command>
                          <CommandGroup>
                            {opcoesStatus.map((opcao) => (
                              <CommandItem
                                key={opcao.value}
                                value={opcao.value}
                                onSelect={(value) => {
                                  onAtualizarStatus(ordem.id, value);
                                  setPopoverAberto(null);
                                }}
                                className="flex items-center gap-2 cursor-pointer"
                              >
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: statusColors[opcao.value] || '#3b82f6' }} />
                                <span className="flex-1">{opcao.label}</span>
                                {ordem.status === opcao.value && (
                                  <Check className="h-4 w-4" />
                                )}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-white border-0"
                      style={{ backgroundColor: statusColors[ordem.status as string] || '#eab308' }}
                    >
                      {statusLabels[ordem.status as string] || "Aguardando Aprovação"}
                    </Badge>
                  )}
                </TableCell>
              )}
              {colunasAtivas.includes('valor') && (
                <TableCell className="whitespace-nowrap px-1.5 py-1.5 text-right">
                  <div>
                    <ValorMonetario valor={ordem.total} tipo="preco" />
                    {(() => {
                      const entrada = (ordem.avarias as any)?.dados_pagamento?.entrada;
                      return entrada > 0 ? (
                        <div className="text-[10px] text-green-600">Entrada: <ValorMonetario valor={entrada} tipo="preco" /></div>
                      ) : null;
                    })()}
                  </div>
                </TableCell>
              )}
              <TableCell className="overflow-hidden px-1.5 py-1.5 text-right">
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
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
