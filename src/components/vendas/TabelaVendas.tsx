import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Venda } from "@/types/venda";
import { DialogEditarVenda } from "./DialogEditarVenda";
import { formatCurrency, formatDateTime, formatDate } from "@/lib/formatters";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { Skeleton } from "@/components/ui/skeleton";
import { Printer, Ban, CheckCircle, Clock, Trash2, Pencil, Undo2, ChevronDown, ChevronRight, ShoppingCart } from "lucide-react";
import { DialogReimpressaoRecibo } from "./DialogReimpressaoRecibo";
import { DialogCancelarVenda } from "./DialogCancelarVenda";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface TabelaVendasProps {
  vendas: Venda[];
  loading: boolean;
  onCancelarVenda?: (vendaId: string, estornarEstoque: boolean, motivo: string) => Promise<boolean>;
  onMarcarRecebido?: (vendaId: string) => Promise<boolean>;
  onExcluirVenda?: (vendaId: string) => Promise<boolean>;
  onMarcarPendente?: (vendaId: string) => Promise<boolean>;
  onEditarVenda?: (vendaId: string, dados: {
    forma_pagamento: string;
    data_prevista_recebimento?: string | null;
    parcela_numero?: number | null;
    total_parcelas?: number | null;
  }) => Promise<boolean>;
}

const tipoLabels: Record<string, string> = {
  dispositivo: "Dispositivo",
  produto: "Produto",
  servico: "Serviço",
};

const formaPagamentoLabels: Record<string, string> = {
  dinheiro: "Dinheiro",
  credito: "Cartão de Crédito",
  credito_parcelado: "Cartão Parcelado",
  debito: "Cartão de Débito",
  pix: "PIX",
  a_receber: "A Receber",
};

const tipoColors: Record<string, string> = {
  dispositivo: "bg-blue-500",
  produto: "bg-green-500",
  servico: "bg-purple-500",
};

// Represents either a single sale or a group of sales
interface VendaOuGrupo {
  tipo: "individual" | "grupo";
  venda?: Venda; // for individual
  grupoId?: string; // for grupo
  vendas?: Venda[]; // for grupo
  totalGrupo?: number;
  quantidadeItens?: number;
}

function agruparVendas(vendas: Venda[]): VendaOuGrupo[] {
  const grupoMap = new Map<string, Venda[]>();
  const individuais: Venda[] = [];

  for (const venda of vendas) {
    if (venda.grupo_venda) {
      const existing = grupoMap.get(venda.grupo_venda);
      if (existing) {
        existing.push(venda);
      } else {
        grupoMap.set(venda.grupo_venda, [venda]);
      }
    } else {
      individuais.push(venda);
    }
  }

  const resultado: VendaOuGrupo[] = [];

  // Process groups - keep track of position by first item's data
  const grupos: VendaOuGrupo[] = [];
  for (const [grupoId, vendasDoGrupo] of grupoMap.entries()) {
    if (vendasDoGrupo.length === 1) {
      // Single item in group, treat as individual
      grupos.push({ tipo: "individual", venda: vendasDoGrupo[0] });
    } else {
      const totalGrupo = vendasDoGrupo.reduce((acc, v) => {
        const total = Number(v.total) - Number(v.valor_desconto_manual || 0) - Number(v.valor_desconto_cupom || 0);
        return acc + total;
      }, 0);
      grupos.push({
        tipo: "grupo",
        grupoId,
        vendas: vendasDoGrupo,
        totalGrupo,
        quantidadeItens: vendasDoGrupo.length,
      });
    }
  }

  // Merge all into a single list, sorted by date (first item date for groups)
  const allItems: { date: Date; item: VendaOuGrupo }[] = [];

  for (const ind of individuais) {
    allItems.push({ date: new Date(ind.data), item: { tipo: "individual", venda: ind } });
  }

  for (const grupo of grupos) {
    const date = grupo.tipo === "grupo"
      ? new Date(grupo.vendas![0].data)
      : new Date(grupo.venda!.data);
    allItems.push({ date, item: grupo });
  }

  allItems.sort((a, b) => b.date.getTime() - a.date.getTime());
  return allItems.map(i => i.item);
}

function getNomeItem(venda: Venda): string {
  if (venda.tipo === "dispositivo" && venda.dispositivos) {
    return `${venda.dispositivos.marca} ${venda.dispositivos.modelo}`;
  }
  if (venda.tipo === "servico" && venda.ordens_servico) {
    return `OS ${venda.ordens_servico.numero_os}`;
  }
  return venda.produtos?.nome || venda.pecas?.nome || "-";
}

function getResumoGrupo(vendas: Venda[]): string {
  const nomes = vendas.map(v => getNomeItem(v));
  if (nomes.length <= 3) return nomes.join(", ");
  return `${nomes.slice(0, 2).join(", ")} +${nomes.length - 2} itens`;
}

export const TabelaVendas = ({ vendas, loading, onCancelarVenda, onMarcarRecebido, onExcluirVenda, onMarcarPendente, onEditarVenda }: TabelaVendasProps) => {
  const [vendaSelecionada, setVendaSelecionada] = useState<Venda | null>(null);
  const [dialogReciboAberto, setDialogReciboAberto] = useState(false);
  const [dialogCancelarAberto, setDialogCancelarAberto] = useState(false);
  const [dialogExcluirAberto, setDialogExcluirAberto] = useState(false);
  const [dialogEditarAberto, setDialogEditarAberto] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [gruposExpandidos, setGruposExpandidos] = useState<Set<string>>(new Set());
  const isMobile = useIsMobile();

  const vendasAgrupadas = useMemo(() => agruparVendas(vendas), [vendas]);

  const toggleGrupo = (grupoId: string) => {
    setGruposExpandidos(prev => {
      const next = new Set(prev);
      if (next.has(grupoId)) next.delete(grupoId);
      else next.add(grupoId);
      return next;
    });
  };

  const handleImprimirRecibo = (venda: Venda) => {
    setVendaSelecionada(venda);
    setDialogReciboAberto(true);
  };

  const handleAbrirCancelar = (venda: Venda) => {
    setVendaSelecionada(venda);
    setDialogCancelarAberto(true);
  };

  const handleAbrirExcluir = (venda: Venda) => {
    setVendaSelecionada(venda);
    setDialogExcluirAberto(true);
  };

  const handleAbrirEditar = (venda: Venda) => {
    setVendaSelecionada(venda);
    setDialogEditarAberto(true);
  };

  const handleSalvarEdicao = async (vendaId: string, dados: any) => {
    if (!onEditarVenda) return false;
    setSalvandoEdicao(true);
    try {
      const sucesso = await onEditarVenda(vendaId, dados);
      if (sucesso) {
        setDialogEditarAberto(false);
        setVendaSelecionada(null);
      }
      return sucesso;
    } finally {
      setSalvandoEdicao(false);
    }
  };

  const handleConfirmarExclusao = async () => {
    if (!vendaSelecionada || !onExcluirVenda) return;
    
    setExcluindo(true);
    try {
      const sucesso = await onExcluirVenda(vendaSelecionada.id);
      if (sucesso) {
        setDialogExcluirAberto(false);
        setVendaSelecionada(null);
      }
    } finally {
      setExcluindo(false);
    }
  };

  const handleConfirmarCancelamento = async (estornarEstoque: boolean, motivo: string) => {
    if (!vendaSelecionada || !onCancelarVenda) return;
    
    setCancelando(true);
    try {
      const sucesso = await onCancelarVenda(vendaSelecionada.id, estornarEstoque, motivo);
      if (sucesso) {
        setDialogCancelarAberto(false);
        setVendaSelecionada(null);
      }
    } finally {
      setCancelando(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (vendas.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhuma venda encontrada
      </div>
    );
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const em3Dias = new Date(hoje);
  em3Dias.setDate(hoje.getDate() + 3);

  const renderStatusBadge = (venda: Venda) => {
    const isAReceber = venda.forma_pagamento === "a_receber" && !venda.recebido && !venda.cancelada;
    const dataVencimento = venda.data_prevista_recebimento ? new Date(venda.data_prevista_recebimento) : null;
    if (dataVencimento) dataVencimento.setHours(0, 0, 0, 0);
    const isVencida = dataVencimento && dataVencimento < hoje;
    const isVencendo = dataVencimento && dataVencimento >= hoje && dataVencimento <= em3Dias;

    if (venda.cancelada) return <Badge variant="destructive" className="text-xs">Cancelada</Badge>;
    if (venda.forma_pagamento === "a_receber") {
      if (venda.recebido) return <Badge className="bg-green-500 text-xs text-white">Recebido</Badge>;
      if (isVencida) return <Badge variant="destructive" className="text-xs">A Receber - Vencida</Badge>;
      if (isVencendo) return <Badge className="bg-orange-500 text-xs text-white">A Receber</Badge>;
      return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30 text-xs">A Receber</Badge>;
    }
    return <Badge className="bg-green-500 text-xs text-white">Pago</Badge>;
  };

  const renderAcoesVenda = (venda: Venda) => {
    const isAReceber = venda.forma_pagamento === "a_receber" && !venda.recebido && !venda.cancelada;
    return (
      <div className="flex items-center gap-1">
        {isAReceber && onMarcarRecebido && (
          <Button variant="ghost" size="sm" onClick={() => onMarcarRecebido(venda.id)} className="h-8 w-8 p-0 text-green-600 hover:text-green-700" title="Marcar como Recebido">
            <CheckCircle className="h-4 w-4" />
          </Button>
        )}
        {!venda.cancelada && venda.forma_pagamento === "a_receber" && venda.recebido && onMarcarPendente && (
          <Button variant="ghost" size="sm" onClick={() => onMarcarPendente(venda.id)} className="h-8 w-8 p-0 text-orange-600 hover:text-orange-700" title="Voltar para Pendente">
            <Undo2 className="h-4 w-4" />
          </Button>
        )}
        {!venda.cancelada && venda.tipo !== "servico" && onEditarVenda && (
          <Button variant="ghost" size="sm" onClick={() => handleAbrirEditar(venda)} className="h-8 w-8 p-0" title="Editar Venda">
            <Pencil className="h-4 w-4" />
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => handleImprimirRecibo(venda)} className="h-8 w-8 p-0" title="Imprimir Recibo">
          <Printer className="h-4 w-4" />
        </Button>
        {!venda.cancelada && onCancelarVenda && (
          <Button variant="ghost" size="sm" onClick={() => handleAbrirCancelar(venda)} className="h-8 w-8 p-0 text-destructive hover:text-destructive" title="Cancelar Venda">
            <Ban className="h-4 w-4" />
          </Button>
        )}
        {venda.cancelada && onExcluirVenda && venda.tipo !== "servico" && (
          <Button variant="ghost" size="sm" onClick={() => handleAbrirExcluir(venda)} className="h-8 w-8 p-0 text-destructive hover:text-destructive" title="Excluir Venda">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  };

  // Mobile: Card-based layout
  if (isMobile) {
    return (
      <>
        <div className="space-y-3">
          {vendasAgrupadas.map((item, idx) => {
            if (item.tipo === "individual" && item.venda) {
              const venda = item.venda;
              return (
                <Card key={venda.id} className={`p-4 ${venda.cancelada ? 'opacity-60 bg-muted/30' : ''}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{getNomeItem(venda)}</p>
                      <p className="text-xs text-muted-foreground">{venda.clientes?.nome || "Cliente não informado"}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge className={`${tipoColors[venda.tipo]} text-xs`}>{tipoLabels[venda.tipo]}</Badge>
                      {renderStatusBadge(venda)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">{formatDateTime(venda.data)}</p>
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-xs">{formaPagamentoLabels[venda.forma_pagamento] || "-"}</span>
                        {venda.parcela_numero && venda.total_parcelas && (
                          <span className="text-xs text-muted-foreground">({venda.parcela_numero}/{venda.total_parcelas})</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold ${venda.cancelada ? 'line-through text-muted-foreground' : ''}`}>
                        <ValorMonetario valor={venda.total - (venda.valor_desconto_manual || 0) - (venda.valor_desconto_cupom || 0)} tipo="preco" />
                      </span>
                      {renderAcoesVenda(venda)}
                    </div>
                  </div>
                </Card>
              );
            }

            if (item.tipo === "grupo" && item.vendas && item.grupoId) {
              const grupoId = item.grupoId;
              const vendasDoGrupo = item.vendas;
              const expandido = gruposExpandidos.has(grupoId);
              const primeiraVenda = vendasDoGrupo[0];
              const todasCanceladas = vendasDoGrupo.every(v => v.cancelada);

              return (
                <div key={grupoId}>
                  <Card
                    className={`p-4 cursor-pointer border-l-4 border-l-primary ${todasCanceladas ? 'opacity-60 bg-muted/30' : ''}`}
                    onClick={() => toggleGrupo(grupoId)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          {expandido ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          <ShoppingCart className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{getResumoGrupo(vendasDoGrupo)}</p>
                          <p className="text-xs text-muted-foreground">{primeiraVenda.clientes?.nome || "Cliente não informado"}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant="outline" className="text-xs border-primary text-primary">
                          {vendasDoGrupo.length} itens
                        </Badge>
                        {renderStatusBadge(primeiraVenda)}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">{formatDateTime(primeiraVenda.data)}</p>
                        <span className="text-xs">{formaPagamentoLabels[primeiraVenda.forma_pagamento] || "-"}</span>
                      </div>
                      <span className={`font-semibold ${todasCanceladas ? 'line-through text-muted-foreground' : ''}`}>
                         <ValorMonetario valor={item.totalGrupo || 0} tipo="preco" />
                      </span>
                    </div>
                  </Card>

                  {expandido && (
                    <div className="ml-4 mt-1 space-y-2 border-l-2 border-muted pl-3">
                      {vendasDoGrupo.map(venda => (
                        <Card key={venda.id} className={`p-3 ${venda.cancelada ? 'opacity-60 bg-muted/30' : ''}`}>
                          <div className="flex justify-between items-start mb-1">
                            <div className="flex-1">
                              <p className="font-medium text-xs">{getNomeItem(venda)}</p>
                            </div>
                            <Badge className={`${tipoColors[venda.tipo]} text-xs`}>{tipoLabels[venda.tipo]}</Badge>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-xs text-muted-foreground">Qtd: {venda.quantidade}</span>
                            <div className="flex items-center gap-2">
                              <span className={`font-medium text-sm ${venda.cancelada ? 'line-through text-muted-foreground' : ''}`}>
                                <ValorMonetario valor={venda.total - (venda.valor_desconto_manual || 0) - (venda.valor_desconto_cupom || 0)} tipo="preco" />
                              </span>
                              {renderAcoesVenda(venda)}
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              );
            }
            return null;
          })}
        </div>

        <DialogReimpressaoRecibo open={dialogReciboAberto} onOpenChange={setDialogReciboAberto} venda={vendaSelecionada} />
        <DialogCancelarVenda open={dialogCancelarAberto} onOpenChange={setDialogCancelarAberto} venda={vendaSelecionada} onConfirmar={handleConfirmarCancelamento} cancelando={cancelando} />
        <AlertDialog open={dialogExcluirAberto} onOpenChange={setDialogExcluirAberto}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir venda cancelada</AlertDialogTitle>
              <AlertDialogDescription>Tem certeza que deseja excluir permanentemente esta venda cancelada? Esta ação não pode ser desfeita.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmarExclusao} disabled={excluindo} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {excluindo ? "Excluindo..." : "Excluir"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <DialogEditarVenda open={dialogEditarAberto} onOpenChange={setDialogEditarAberto} venda={vendaSelecionada} onSalvar={handleSalvarEdicao} salvando={salvandoEdicao} />
      </>
    );
  }

  // Desktop: Table layout
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8"></TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Item</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Quantidade</TableHead>
            <TableHead>Pagamento</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-center">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {vendasAgrupadas.map((item, idx) => {
            if (item.tipo === "individual" && item.venda) {
              const venda = item.venda;
              const isAReceber = venda.forma_pagamento === "a_receber" && !venda.recebido && !venda.cancelada;
              return (
                <TableRow key={venda.id} className={venda.cancelada ? 'opacity-60 bg-muted/30' : ''}>
                  <TableCell></TableCell>
                  <TableCell>{formatDateTime(venda.data)}</TableCell>
                  <TableCell><Badge className={tipoColors[venda.tipo]}>{tipoLabels[venda.tipo]}</Badge></TableCell>
                  <TableCell>{getNomeItem(venda)}</TableCell>
                  <TableCell>{venda.clientes?.nome || "Cliente não informado"}</TableCell>
                  <TableCell>{venda.quantidade}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span>
                        {venda.forma_pagamento ? formaPagamentoLabels[venda.forma_pagamento] : "Não informado"}
                        {venda.parcela_numero && venda.total_parcelas && (
                          <span className="text-muted-foreground ml-1">({venda.parcela_numero}/{venda.total_parcelas})</span>
                        )}
                      </span>
                      {isAReceber && venda.data_prevista_recebimento && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(venda.data_prevista_recebimento)}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className={`text-right font-medium ${venda.cancelada ? 'line-through text-muted-foreground' : ''}`}>
                    <ValorMonetario valor={venda.total - (venda.valor_desconto_manual || 0) - (venda.valor_desconto_cupom || 0)} tipo="preco" />
                  </TableCell>
                  <TableCell>{renderStatusBadge(venda)}</TableCell>
                  <TableCell className="text-center">{renderAcoesVenda(venda)}</TableCell>
                </TableRow>
              );
            }

            if (item.tipo === "grupo" && item.vendas && item.grupoId) {
              const grupoId = item.grupoId;
              const vendasDoGrupo = item.vendas;
              const expandido = gruposExpandidos.has(grupoId);
              const primeiraVenda = vendasDoGrupo[0];
              const todasCanceladas = vendasDoGrupo.every(v => v.cancelada);
              const totalQuantidade = vendasDoGrupo.reduce((acc, v) => acc + (v.quantidade || 1), 0);

              return (
                <>
                  <TableRow
                    key={grupoId}
                    className={`cursor-pointer hover:bg-muted/50 ${todasCanceladas ? 'opacity-60 bg-muted/30' : 'bg-primary/5'}`}
                    onClick={() => toggleGrupo(grupoId)}
                  >
                    <TableCell className="w-8">
                      <div className="flex items-center gap-1">
                        {expandido ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </TableCell>
                    <TableCell>{formatDateTime(primeiraVenda.data)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-primary text-primary">
                        <ShoppingCart className="h-3 w-3 mr-1" />
                        {vendasDoGrupo.length} itens
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{getResumoGrupo(vendasDoGrupo)}</TableCell>
                    <TableCell>{primeiraVenda.clientes?.nome || "Cliente não informado"}</TableCell>
                    <TableCell>{totalQuantidade}</TableCell>
                    <TableCell>
                      {primeiraVenda.forma_pagamento ? formaPagamentoLabels[primeiraVenda.forma_pagamento] : "Não informado"}
                    </TableCell>
                    <TableCell className={`text-right font-semibold ${todasCanceladas ? 'line-through text-muted-foreground' : ''}`}>
                      <ValorMonetario valor={item.totalGrupo || 0} tipo="preco" />
                    </TableCell>
                    <TableCell>{renderStatusBadge(primeiraVenda)}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                  {expandido && vendasDoGrupo.map(venda => {
                    const isAReceber = venda.forma_pagamento === "a_receber" && !venda.recebido && !venda.cancelada;
                    return (
                      <TableRow key={venda.id} className={`${venda.cancelada ? 'opacity-60 bg-muted/30' : 'bg-muted/20'}`}>
                        <TableCell className="w-8 pl-6">
                          <div className="w-2 h-2 rounded-full bg-muted-foreground/30"></div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{formatDateTime(venda.data)}</TableCell>
                        <TableCell><Badge className={`${tipoColors[venda.tipo]} text-xs`}>{tipoLabels[venda.tipo]}</Badge></TableCell>
                        <TableCell className="text-sm">{getNomeItem(venda)}</TableCell>
                        <TableCell></TableCell>
                        <TableCell className="text-sm">{venda.quantidade}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span className="text-sm">
                              {venda.forma_pagamento ? formaPagamentoLabels[venda.forma_pagamento] : "Não informado"}
                              {venda.parcela_numero && venda.total_parcelas && (
                                <span className="text-muted-foreground ml-1">({venda.parcela_numero}/{venda.total_parcelas})</span>
                              )}
                            </span>
                            {isAReceber && venda.data_prevista_recebimento && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDate(venda.data_prevista_recebimento)}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className={`text-right font-medium text-sm ${venda.cancelada ? 'line-through text-muted-foreground' : ''}`}>
                          <ValorMonetario valor={venda.total - (venda.valor_desconto_manual || 0) - (venda.valor_desconto_cupom || 0)} tipo="preco" />
                        </TableCell>
                        <TableCell>{renderStatusBadge(venda)}</TableCell>
                        <TableCell className="text-center">{renderAcoesVenda(venda)}</TableCell>
                      </TableRow>
                    );
                  })}
                </>
              );
            }
            return null;
          })}
        </TableBody>
      </Table>

      <DialogReimpressaoRecibo open={dialogReciboAberto} onOpenChange={setDialogReciboAberto} venda={vendaSelecionada} />
      <DialogCancelarVenda open={dialogCancelarAberto} onOpenChange={setDialogCancelarAberto} venda={vendaSelecionada} onConfirmar={handleConfirmarCancelamento} cancelando={cancelando} />
      <AlertDialog open={dialogExcluirAberto} onOpenChange={setDialogExcluirAberto}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir venda cancelada</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir permanentemente esta venda cancelada? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmarExclusao} disabled={excluindo} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {excluindo ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <DialogEditarVenda open={dialogEditarAberto} onOpenChange={setDialogEditarAberto} venda={vendaSelecionada} onSalvar={handleSalvarEdicao} salvando={salvandoEdicao} />
    </>
  );
};
