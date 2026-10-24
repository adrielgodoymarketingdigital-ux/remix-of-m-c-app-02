import { Fragment, useState, useMemo } from "react";
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
import { getNomeItem } from "@/lib/vendas/itensVenda";
import { DialogEditarVenda } from "./DialogEditarVenda";
import { formatDateTime, formatDate, formatDataVenda, extrairDataLocal } from "@/lib/formatters";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { Skeleton } from "@/components/ui/skeleton";
import { Printer, Ban, CheckCircle, Clock, Trash2, Pencil, Undo2, ChevronDown, ChevronRight, ShoppingCart, CalendarClock, CalendarDays, MoreHorizontal, Smartphone, Package, Wrench, ShoppingBag, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import { TextoAjustado } from "@/components/vendas/TextoAjustado";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DialogAlterarDataVenda } from "./DialogAlterarDataVenda";
import { isVendaDeItemOS } from "@/lib/caixa/servicosCaixa";
import { DialogReimpressaoRecibo } from "./DialogReimpressaoRecibo";
import { DialogCancelarVenda } from "./DialogCancelarVenda";
import { parcelasComTrocaNaTela, type AcaoAparelhoTroca } from "@/lib/vendas/trocaPDV";
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
  onCancelarVenda?: (vendaId: string, estornarEstoque: boolean, motivo: string, acaoAparelhoTroca?: AcaoAparelhoTroca | null) => Promise<boolean>;
  onMarcarRecebido?: (vendaId: string) => Promise<boolean>;
  onExcluirVenda?: (vendaId: string) => Promise<boolean>;
  onMarcarPendente?: (vendaId: string) => Promise<boolean>;
  onEditarVenda?: (vendaId: string, dados: {
    forma_pagamento: string;
    data_prevista_recebimento?: string | null;
    parcela_numero?: number | null;
    total_parcelas?: number | null;
    total?: number;
  }) => Promise<boolean>;
  onCancelarContaAPrazoOS?: (contaId: string, ordemId: string) => Promise<boolean>;
  onAlterarDataVenda?: (vendaId: string, novaDataISO: string) => Promise<boolean>;
}

const tipoLabels: Record<string, string> = {
  dispositivo: "Dispositivo",
  produto: "Produto",
  servico: "Serviço",
  avulsa: "Venda Avulsa",
};

const formaPagamentoLabels: Record<string, string> = {
  dinheiro: "Dinheiro",
  credito: "Cartão de Crédito",
  credito_parcelado: "Cartão Parcelado",
  debito: "Cartão de Débito",
  pix: "PIX",
  a_receber: "A Receber",
  a_prazo: "A Prazo",
};

const tipoColors: Record<string, string> = {
  dispositivo: "bg-[#246BFF] hover:bg-[#246BFF] text-white",
  produto: "bg-orange-500 hover:bg-orange-500 text-white",
  servico: "bg-purple-500 hover:bg-purple-500 text-white",
  avulsa: "bg-violet-500 hover:bg-violet-500 text-white",
};

// Selo (tipo e status) no formato da referência: canto 7px, texto 10px seminegrito.
const SELO = "rounded-[7px] px-2 py-[3px] text-[10px] font-semibold";
const CARD_VENDA = "rounded-[17px] border border-border bg-card px-[13px] pt-4 shadow-[0_3px_12px_rgba(16,24,40,0.035)] dark:shadow-none";

const iconeTipo: Record<string, LucideIcon> = {
  dispositivo: Smartphone,
  produto: Package,
  servico: Wrench,
  avulsa: ShoppingBag,
};

// Preço do card (celular): fonte ajustada para nunca estourar; riscado se cancelada.
function PrecoVenda({ valor, cancelada }: { valor: number; cancelada?: boolean }) {
  const caracteres = formatCurrency(valor).length;
  return (
    // Largura = o que o valor precisa a 15px (≈9px por caractere), limitada a 44% do card
    <div
      className={cn("shrink-0 text-right font-extrabold tracking-[-0.4px]", cancelada && "line-through text-muted-foreground")}
      style={{ width: `min(44%, ${caracteres * 9}px)` }}
    >
      <TextoAjustado caracteres={caracteres} min={11} max={15} classeReserva="text-[13px] min-[381px]:text-[15px]">
        <ValorMonetario valor={valor} tipo="preco" />
      </TextoAjustado>
    </div>
  );
}

// Padding enxuto das células da tabela desktop (o padrão do shadcn é p-4).
const TH = "h-11 px-2.5";
const TD = "px-2.5 py-3";

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

  // Process groups - keep track of position by first item's data
  const grupos: VendaOuGrupo[] = [];
  for (const [grupoId, vendasDoGrupo] of grupoMap.entries()) {
    if (vendasDoGrupo.length === 1) {
      // Grupo com apenas um registro — exibe como individual
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
  const allItems: { date: string; item: VendaOuGrupo }[] = [];

  for (const ind of individuais) {
    allItems.push({ date: ind.data, item: { tipo: "individual", venda: ind } });
  }

  for (const grupo of grupos) {
    const date = grupo.tipo === "grupo"
      ? grupo.vendas![0].data
      : grupo.venda!.data;
    allItems.push({ date, item: grupo });
  }

  allItems.sort((a, b) => extrairDataLocal(b.date).localeCompare(extrairDataLocal(a.date)));
  return allItems.map(i => i.item);
}

function getResumoGrupo(vendas: Venda[]): string {
  const nomes = vendas.map(v => getNomeItem(v));
  if (nomes.length <= 3) return nomes.join(", ");
  return `${nomes.slice(0, 2).join(", ")} +${nomes.length - 2} itens`;
}

// Texto de uma linha que corta com "…" e mostra o valor completo no tooltip (tabela desktop).
function TextoTruncado({ texto, tooltip, className = "" }: { texto: string; tooltip?: string; className?: string }) {
  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <span className={`block truncate ${className}`}>{texto}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm break-words">{tooltip ?? texto}</TooltipContent>
    </Tooltip>
  );
}

// Data em duas linhas (dia / hora) para caber numa coluna estreita.
function DataVendaCompacta({ data, className = "" }: { data: string; className?: string }) {
  const [dia, hora] = formatDataVenda(data).split(" ");
  return (
    <div className={`leading-tight ${className}`}>
      <div className="whitespace-nowrap">{dia}</div>
      {hora && <div className="text-xs text-muted-foreground">{hora}</div>}
    </div>
  );
}

export const TabelaVendas = ({ vendas, loading, onCancelarVenda, onMarcarRecebido, onExcluirVenda, onMarcarPendente, onEditarVenda, onCancelarContaAPrazoOS, onAlterarDataVenda }: TabelaVendasProps) => {
  const [vendaSelecionada, setVendaSelecionada] = useState<Venda | null>(null);
  const [vendasGrupoSelecionado, setVendasGrupoSelecionado] = useState<Venda[] | null>(null);
  const [dialogReciboAberto, setDialogReciboAberto] = useState(false);
  const [dialogCancelarAberto, setDialogCancelarAberto] = useState(false);
  const [dialogExcluirAberto, setDialogExcluirAberto] = useState(false);
  const [dialogEditarAberto, setDialogEditarAberto] = useState(false);
  const [dialogCancelarSaldoAberto, setDialogCancelarSaldoAberto] = useState(false);
  const [cancelandoSaldo, setCancelandoSaldo] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [gruposExpandidos, setGruposExpandidos] = useState<Set<string>>(new Set());
  const [alvoAlterarData, setAlvoAlterarData] = useState<{ venda: Venda; descricao: string; quantidadeItens: number } | null>(null);
  const isMobile = useIsMobile();

  const vendasAgrupadas = useMemo(() => agruparVendas(vendas), [vendas]);
  // Venda com troca parcelada: o que o cliente paga por parcela (sem troca, fora do mapa: valor de sempre).
  const parcelasComTroca = useMemo(() => parcelasComTrocaNaTela(vendas), [vendas]);
  const indicacaoTroca = (venda: Venda) => {
    const comTroca = parcelasComTroca.get(venda.id);
    return comTroca ? <span className="block text-[10px] font-normal text-amber-600">troca −{formatCurrency(comTroca.trocaVenda)}</span> : null;
  };

  const toggleGrupo = (grupoId: string) => {
    setGruposExpandidos(prev => {
      const next = new Set(prev);
      if (next.has(grupoId)) next.delete(grupoId);
      else next.add(grupoId);
      return next;
    });
  };

  const handleImprimirRecibo = (venda: Venda, vendasDoGrupo?: Venda[]) => {
    setVendaSelecionada(venda);
    setVendasGrupoSelecionado(vendasDoGrupo && vendasDoGrupo.length > 1 ? vendasDoGrupo : null);
    setDialogReciboAberto(true);
  };

  const handleAbrirCancelar = (venda: Venda) => {
    setVendaSelecionada(venda);
    setDialogCancelarAberto(true);
  };

  const handleAbrirCancelarSaldo = (venda: Venda) => {
    setVendaSelecionada(venda);
    setDialogCancelarSaldoAberto(true);
  };

  const handleConfirmarCancelamentoSaldo = async () => {
    if (!vendaSelecionada?.contaAPrazoPendente || !onCancelarContaAPrazoOS) return;

    setCancelandoSaldo(true);
    try {
      const sucesso = await onCancelarContaAPrazoOS(vendaSelecionada.contaAPrazoPendente.id, vendaSelecionada.id);
      if (sucesso) {
        setDialogCancelarSaldoAberto(false);
        setVendaSelecionada(null);
      }
    } finally {
      setCancelandoSaldo(false);
    }
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

  const handleConfirmarCancelamento = async (estornarEstoque: boolean, motivo: string, acaoAparelhoTroca: AcaoAparelhoTroca | null) => {
    if (!vendaSelecionada || !onCancelarVenda) return;
    
    setCancelando(true);
    try {
      const sucesso = await onCancelarVenda(vendaSelecionada.id, estornarEstoque, motivo, acaoAparelhoTroca);
      if (sucesso) {
        setDialogCancelarAberto(false);
        setVendaSelecionada(null);
      }
    } finally {
      setCancelando(false);
    }
  };

  // Serviço (data = entrega da OS), item usado em OS e venda cancelada não têm a data alterada aqui.
  const podeAlterarData = (venda: Venda) =>
    !!onAlterarDataVenda && !venda.cancelada && venda.tipo !== "servico" && !isVendaDeItemOS(venda.observacoes);

  // Motivo exibido no tooltip do calendário desativado (mesmas mensagens de alterarDataVenda.ts).
  const motivoSemAlterarData = (venda: Venda): string => {
    if (venda.cancelada) return "Vendas canceladas não podem ter a data alterada.";
    if (venda.tipo === "servico") return "A data de serviço segue a entrega da OS — altere pela Ordem de Serviço.";
    if (isVendaDeItemOS(venda.observacoes)) return "Este item foi usado em uma OS — a data acompanha a Ordem de Serviço.";
    return "A data desta venda não pode ser alterada.";
  };

  // Tabela desktop: calendário ativo ou, quando a regra não permite, desativado com o motivo no tooltip.
  const botaoAlterarDataCompacto = (venda: Venda) => {
    if (!onAlterarDataVenda) return null;
    if (podeAlterarData(venda)) {
      return (
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleAbrirAlterarData(venda); }} className="h-7 w-7 p-0" title="Alterar data da venda">
          <CalendarDays className="h-4 w-4" />
        </Button>
      );
    }
    // Botão desativado não dispara eventos de mouse — o span recebe o hover do tooltip.
    return (
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <span tabIndex={0} onClick={(e) => e.stopPropagation()} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/40 cursor-not-allowed">
            <CalendarDays className="h-4 w-4" />
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">{motivoSemAlterarData(venda)}</TooltipContent>
      </Tooltip>
    );
  };

  // A data muda para a venda inteira (todas as linhas do grupo) — o diálogo mostra isso.
  const handleAbrirAlterarData = (venda: Venda) => {
    const doGrupo = venda.grupo_venda ? vendas.filter((v) => v.grupo_venda === venda.grupo_venda) : [venda];
    setAlvoAlterarData({
      venda,
      descricao: doGrupo.length > 1 ? getResumoGrupo(doGrupo) : getNomeItem(venda),
      quantidadeItens: doGrupo.length,
    });
  };

  const botaoAlterarData = (venda: Venda) =>
    podeAlterarData(venda) ? (
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => { e.stopPropagation(); handleAbrirAlterarData(venda); }}
        className="h-8 w-8 p-0"
        title="Alterar data da venda"
        aria-label="Alterar data da venda"
      >
        <CalendarDays className="h-4 w-4" />
      </Button>
    ) : null;

  const dialogAlterarData = onAlterarDataVenda ? (
    <DialogAlterarDataVenda
      open={!!alvoAlterarData}
      onOpenChange={(aberto) => { if (!aberto) setAlvoAlterarData(null); }}
      venda={alvoAlterarData?.venda ?? null}
      descricao={alvoAlterarData?.descricao ?? ""}
      quantidadeItens={alvoAlterarData?.quantidadeItens ?? 1}
      onSalvar={onAlterarDataVenda}
    />
  ) : null;

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

  // compacto: versão da tabela desktop — rótulos curtos, valor do saldo vai para o tooltip.
  const renderStatusBadge = (venda: Venda, compacto = false) => {
    const dataVencimento = venda.data_prevista_recebimento ? new Date(venda.data_prevista_recebimento) : null;
    if (dataVencimento) dataVencimento.setHours(0, 0, 0, 0);
    const isVencida = dataVencimento && dataVencimento < hoje;
    const isVencendo = dataVencimento && dataVencimento >= hoje && dataVencimento <= em3Dias;

    if (venda.cancelada) return <Badge variant="outline" className={cn(SELO, "border-transparent bg-[#FEECEC] text-[#D92D20] dark:bg-red-500/15 dark:text-red-400")}>Cancelada</Badge>;
    if (compacto && venda.tipo === "servico" && (venda.contaAPrazoPendente || venda.saldoCancelado)) {
      const pendente = !!venda.contaAPrazoPendente;
      const valor = venda.contaAPrazoPendente?.valor ?? venda.saldoCancelado?.valor ?? 0;
      return (
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className={`${SELO} max-w-full ${pendente
                ? "bg-orange-500/10 text-orange-600 border-orange-500/30"
                : "bg-muted text-muted-foreground border-muted-foreground/30"}`}
            >
              {pendente ? <CalendarClock className="h-3 w-3 mr-1 shrink-0" /> : <Ban className="h-3 w-3 mr-1 shrink-0" />}
              <span className="truncate">{pendente ? "Saldo a prazo" : "Saldo não receb."}</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            {pendente ? "Saldo a prazo" : "Saldo não recebido"}: <ValorMonetario valor={valor} tipo="preco" />
          </TooltipContent>
        </Tooltip>
      );
    }
    if (venda.tipo === "servico" && venda.contaAPrazoPendente) {
      return (
        <Badge variant="outline" className={cn(SELO, "bg-orange-500/10 text-orange-600 border-orange-500/30 whitespace-nowrap")}>
          <CalendarClock className="h-3 w-3 mr-1" />
          Saldo a prazo: <ValorMonetario valor={venda.contaAPrazoPendente.valor} tipo="preco" />
        </Badge>
      );
    }
    if (venda.tipo === "servico" && venda.saldoCancelado) {
      return (
        <Badge variant="outline" className={cn(SELO, "bg-muted text-muted-foreground border-muted-foreground/30 whitespace-nowrap")}>
          <Ban className="h-3 w-3 mr-1" />
          Saldo não recebido: <ValorMonetario valor={venda.saldoCancelado.valor} tipo="preco" />
        </Badge>
      );
    }
    if (venda.forma_pagamento === "a_receber" || venda.forma_pagamento === "a_prazo") {
      if (venda.recebido) return <Badge className={cn(SELO, "bg-[#12B76A] text-white hover:bg-[#12B76A]")}>Recebido</Badge>;
      if (isVencida) return <Badge variant="outline" className={cn(SELO, "border-transparent bg-[#FEECEC] text-[#D92D20] dark:bg-red-500/15 dark:text-red-400")}>{compacto ? "Vencida" : "A Receber - Vencida"}</Badge>;
      if (isVencendo) return <Badge variant="outline" className={cn(SELO, "border-transparent bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400")}>A Receber</Badge>;
      return <Badge variant="outline" className={cn(SELO, "border-transparent bg-[#FFF1DA] text-[#A66A00] dark:bg-amber-500/15 dark:text-amber-400")}>A Receber</Badge>;
    }
    return <Badge className={cn(SELO, "bg-[#12B76A] text-white hover:bg-[#12B76A]")}>Pago</Badge>;
  };

  // Ações do card (celular): mesmas condições, ordem e handlers de antes;
  // só o desenho mudou — faixa embaixo do card, dividida por linhas finas.
  const renderAcoesVenda = (venda: Venda) => {
    const isAReceber = (venda.forma_pagamento === "a_receber" || venda.forma_pagamento === "a_prazo") && !venda.recebido && !venda.cancelada;
    const acoes: { chave: string; titulo: string; Icone: LucideIcon; onClick: () => void; cor?: string }[] = [];
    if (isAReceber && onMarcarRecebido) acoes.push({ chave: "recebido", titulo: "Marcar como Recebido", Icone: CheckCircle, onClick: () => onMarcarRecebido(venda.id), cor: "text-green-600 hover:text-green-700 dark:text-green-400" });
    if (!venda.cancelada && (venda.forma_pagamento === "a_receber" || venda.forma_pagamento === "a_prazo") && venda.recebido && onMarcarPendente) acoes.push({ chave: "pendente", titulo: "Voltar para Pendente", Icone: Undo2, onClick: () => onMarcarPendente(venda.id), cor: "text-orange-600 hover:text-orange-700 dark:text-orange-400" });
    if (!venda.cancelada && venda.tipo !== "servico" && onEditarVenda) acoes.push({ chave: "editar", titulo: "Editar Venda", Icone: Pencil, onClick: () => handleAbrirEditar(venda) });
    if (podeAlterarData(venda)) acoes.push({ chave: "data", titulo: "Alterar data da venda", Icone: CalendarDays, onClick: () => handleAbrirAlterarData(venda) });
    acoes.push({ chave: "imprimir", titulo: "Imprimir Recibo", Icone: Printer, onClick: () => handleImprimirRecibo(venda) });
    if (venda.tipo === "servico" && venda.contaAPrazoPendente && onCancelarContaAPrazoOS) acoes.push({ chave: "saldo", titulo: "Cancelar Saldo a Prazo", Icone: CalendarClock, onClick: () => handleAbrirCancelarSaldo(venda), cor: "text-destructive hover:text-destructive dark:text-red-400" });
    if (!venda.cancelada && venda.tipo !== "servico" && onCancelarVenda) acoes.push({ chave: "cancelar", titulo: "Cancelar Venda", Icone: Ban, onClick: () => handleAbrirCancelar(venda), cor: "text-destructive hover:text-destructive dark:text-red-400" });
    if (venda.cancelada && onExcluirVenda && venda.tipo !== "servico") acoes.push({ chave: "excluir", titulo: "Excluir Venda", Icone: Trash2, onClick: () => handleAbrirExcluir(venda), cor: "text-destructive hover:text-destructive dark:text-red-400" });

    return (
      <div className="mt-[18px] flex border-t border-border py-3">
        {acoes.map(({ chave, titulo, Icone, onClick, cor }) => (
          <div key={chave} className="flex flex-1 justify-center border-r border-border last:border-r-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => { e.stopPropagation(); onClick(); }}
              className={cn("h-[34px] w-full max-w-[64px] p-0", cor ?? "text-[#0B1429] dark:text-foreground")}
              title={titulo}
              aria-label={titulo}
            >
              <Icone className="h-[19px] w-[19px]" />
            </Button>
          </div>
        ))}
      </div>
    );
  };

  // Tabela desktop: a antiga coluna "Quantidade" virou prefixo "N×" no item (só quando > 1).
  const renderItemCompacto = (venda: Venda) => {
    const nome = getNomeItem(venda);
    const qtd = venda.quantidade > 1 ? `${venda.quantidade}× ` : "";
    return <TextoTruncado texto={`${qtd}${nome}`} tooltip={qtd ? `${nome} — Qtd: ${venda.quantidade}` : nome} />;
  };

  // Tabela desktop: status + forma de pagamento numa coluna só; detalhes (parcela,
  // segunda forma, previsão de recebimento) aparecem inteiros no tooltip.
  const renderPagamentoCompacto = (venda: Venda, comDetalhes = true) => {
    const isAReceber = (venda.forma_pagamento === "a_receber" || venda.forma_pagamento === "a_prazo") && !venda.recebido && !venda.cancelada;
    const forma = venda.forma_pagamento ? (formaPagamentoLabels[venda.forma_pagamento] || venda.forma_pagamento) : "Não informado";
    const parcela = comDetalhes && venda.parcela_numero && venda.total_parcelas ? ` (${venda.parcela_numero}/${venda.total_parcelas})` : "";
    const segundaForma = comDetalhes && venda.segunda_forma_pagamento
      ? `+ ${formaPagamentoLabels[venda.segunda_forma_pagamento] || venda.segunda_forma_pagamento}${venda.valor_segunda_forma ? ` (R$${Number(venda.valor_segunda_forma).toFixed(2).replace('.', ',')})` : ""}`
      : null;
    const previsao = comDetalhes && isAReceber && venda.data_prevista_recebimento ? formatDate(venda.data_prevista_recebimento) : null;

    return (
      <div className="flex flex-col items-start gap-1 min-w-0">
        {renderStatusBadge(venda, true)}
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <span className="flex items-center gap-1 max-w-full text-xs text-muted-foreground">
              <span className="truncate">{forma}{parcela}{segundaForma ? " +1" : ""}</span>
              {previsao && <Clock className="h-3 w-3 shrink-0" />}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-0.5 text-xs">
              <p>{forma}{parcela}</p>
              {segundaForma && <p>{segundaForma}</p>}
              {previsao && <p>Previsão de recebimento: {previsao}</p>}
            </div>
          </TooltipContent>
        </Tooltip>
      </div>
    );
  };

  // Tabela desktop: ações frequentes (receber, imprimir) ficam à mostra; o resto vai para o menu "⋯".
  const renderAcoesVendaCompacto = (venda: Venda) => {
    const ehAReceber = venda.forma_pagamento === "a_receber" || venda.forma_pagamento === "a_prazo";
    const podeMarcarRecebido = ehAReceber && !venda.recebido && !venda.cancelada && !!onMarcarRecebido;
    const podeVoltarPendente = ehAReceber && !venda.cancelada && !!venda.recebido && !!onMarcarPendente;
    const podeEditar = !venda.cancelada && venda.tipo !== "servico" && !!onEditarVenda;
    const podeCancelarSaldo = venda.tipo === "servico" && !!venda.contaAPrazoPendente && !!onCancelarContaAPrazoOS;
    const podeCancelar = !venda.cancelada && venda.tipo !== "servico" && !!onCancelarVenda;
    const podeExcluir = !!venda.cancelada && venda.tipo !== "servico" && !!onExcluirVenda;
    const temMenu = podeVoltarPendente || podeEditar || podeCancelarSaldo || podeCancelar || podeExcluir;
    const temDestrutiva = podeCancelarSaldo || podeCancelar || podeExcluir;

    return (
      <div className="flex items-center justify-center gap-1">
        {podeMarcarRecebido && (
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onMarcarRecebido?.(venda.id); }} className="h-7 w-7 p-0 text-green-600 hover:text-green-700" title="Marcar como Recebido">
            <CheckCircle className="h-4 w-4" />
          </Button>
        )}
        {botaoAlterarDataCompacto(venda)}
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleImprimirRecibo(venda); }} className="h-7 w-7 p-0" title="Imprimir Recibo">
          <Printer className="h-4 w-4" />
        </Button>
        {temMenu && (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()} className="h-7 w-7 p-0" title="Mais ações">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              {podeVoltarPendente && (
                <DropdownMenuItem onClick={() => onMarcarPendente?.(venda.id)} className="text-orange-600 focus:text-orange-700">
                  <Undo2 className="h-4 w-4 mr-2" />
                  Voltar para Pendente
                </DropdownMenuItem>
              )}
              {podeEditar && (
                <DropdownMenuItem onClick={() => handleAbrirEditar(venda)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Editar Venda
                </DropdownMenuItem>
              )}
              {temDestrutiva && (podeVoltarPendente || podeEditar) && <DropdownMenuSeparator />}
              {podeCancelarSaldo && (
                <DropdownMenuItem onClick={() => handleAbrirCancelarSaldo(venda)} className="text-destructive focus:text-destructive">
                  <CalendarClock className="h-4 w-4 mr-2" />
                  Cancelar Saldo a Prazo
                </DropdownMenuItem>
              )}
              {podeCancelar && (
                <DropdownMenuItem onClick={() => handleAbrirCancelar(venda)} className="text-destructive focus:text-destructive">
                  <Ban className="h-4 w-4 mr-2" />
                  Cancelar Venda
                </DropdownMenuItem>
              )}
              {podeExcluir && (
                <DropdownMenuItem onClick={() => handleAbrirExcluir(venda)} className="text-destructive focus:text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir Venda
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    );
  };

  const dialogCancelarSaldo = (
    <AlertDialog open={dialogCancelarSaldoAberto} onOpenChange={setDialogCancelarSaldoAberto}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar saldo a prazo</AlertDialogTitle>
          <AlertDialogDescription>
            {vendaSelecionada?.contaAPrazoPendente && (
              <>
                Tem certeza que deseja cancelar o saldo a prazo
                {vendaSelecionada.contaAPrazoPendente.data_vencimento ? (
                  <>
                    {" "}de <strong>{formatDate(vendaSelecionada.contaAPrazoPendente.data_vencimento)}</strong>
                  </>
                ) : (
                  <> (sem data de vencimento definida)</>
                )}{" "}
                no valor de{" "}
                <strong>
                  {vendaSelecionada.contaAPrazoPendente.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </strong>
                ? A OS será marcada como "saldo não recebido" e o lançamento pendente será removido.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={cancelandoSaldo}>Voltar</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirmarCancelamentoSaldo} disabled={cancelandoSaldo} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {cancelandoSaldo ? "Cancelando..." : "Cancelar saldo"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  // Mobile: Card-based layout
  if (isMobile) {
    return (
      <>
        <div className="space-y-3">
          {vendasAgrupadas.map((item) => {
            if (item.tipo === "individual" && item.venda) {
              const venda = item.venda;
              const IconeTipo = iconeTipo[venda.tipo] ?? Package;
              return (
                <article key={venda.id} className={cn(CARD_VENDA, venda.cancelada && "opacity-60 bg-muted/30")}>
                  <div className="flex gap-[9px] min-[381px]:gap-3">
                    {/* A lista não carrega foto da venda: ícone do tipo, como no resto do app */}
                    <div className="grid h-[75px] w-[55px] shrink-0 place-items-center rounded-xl border border-border bg-background min-[381px]:w-[66px] dark:bg-muted/40">
                      <IconeTipo className="h-9 w-9 text-muted-foreground" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="break-words text-[13px] font-bold leading-[1.4]">
                            {getNomeItem(venda)}
                            {venda.numero_venda && <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">#{venda.numero_venda}</span>}
                          </p>
                          <p className="mt-[5px] break-words text-[11px] leading-normal text-muted-foreground">{venda.clientes?.nome || "Cliente não informado"}</p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-[5px]">
                          <Badge className={cn(SELO, tipoColors[venda.tipo])}>{tipoLabels[venda.tipo]}</Badge>
                          {renderStatusBadge(venda)}
                        </div>
                      </div>
                      <div className="mt-[17px] flex items-end justify-between gap-2.5">
                        <div className="min-w-0 space-y-1.5">
                          <p className="flex items-center gap-[5px] text-[11px] text-muted-foreground">
                            <CalendarDays className="h-[13px] w-[13px] shrink-0" aria-hidden="true" />
                            {formatDataVenda(venda.data)}
                          </p>
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="text-xs text-[#344054] dark:text-foreground/80">{formaPagamentoLabels[venda.forma_pagamento] || "-"}</span>
                            {venda.parcela_numero && venda.total_parcelas && (
                              <span className="text-xs text-muted-foreground">({venda.parcela_numero}/{venda.total_parcelas})</span>
                            )}
                            {indicacaoTroca(venda)}
                            {venda.segunda_forma_pagamento && (
                              <span className="text-xs text-muted-foreground">
                                + {formaPagamentoLabels[venda.segunda_forma_pagamento] || venda.segunda_forma_pagamento}
                                {venda.valor_segunda_forma ? ` (R$${Number(venda.valor_segunda_forma).toFixed(2).replace('.', ',')})` : ""}
                              </span>
                            )}
                          </div>
                        </div>
                        <PrecoVenda valor={parcelasComTroca.get(venda.id)?.valor ?? (Number(venda.total) - Number(venda.valor_desconto_manual || 0) - Number(venda.valor_desconto_cupom || 0))} cancelada={venda.cancelada} />
                      </div>
                    </div>
                  </div>
                  {renderAcoesVenda(venda)}
                </article>
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
                    className={cn(CARD_VENDA, "cursor-pointer border-l-4 border-l-primary pb-4", todasCanceladas && "opacity-60 bg-muted/30")}
                    onClick={() => toggleGrupo(grupoId)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          {expandido ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          <ShoppingCart className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium text-sm">{getResumoGrupo(vendasDoGrupo)}</p>
                            {primeiraVenda.numero_venda && <span className="text-xs text-muted-foreground">#{primeiraVenda.numero_venda}</span>}
                          </div>
                          <p className="text-xs text-muted-foreground">{primeiraVenda.clientes?.nome || "Cliente não informado"}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant="outline" className={cn(SELO, "border-primary text-primary")}>
                          {vendasDoGrupo.length} itens
                        </Badge>
                        {renderStatusBadge(primeiraVenda)}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">{formatDataVenda(primeiraVenda.data)}</p>
                        <span className="text-xs">{formaPagamentoLabels[primeiraVenda.forma_pagamento] || "-"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold ${todasCanceladas ? 'line-through text-muted-foreground' : ''}`}>
                          <ValorMonetario valor={item.totalGrupo || 0} tipo="preco" />
                        </span>
                        {botaoAlterarData(primeiraVenda)}
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleImprimirRecibo(primeiraVenda, vendasDoGrupo); }} className="h-8 w-8 p-0" title="Imprimir Recibo" aria-label="Imprimir Recibo">
                          <Printer className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>

                  {expandido && (
                    <div className="ml-4 mt-1 space-y-2 border-l-2 border-muted pl-3">
                      {vendasDoGrupo.map(venda => (
                        <Card key={venda.id} className={cn(CARD_VENDA, "px-3 pt-3", venda.cancelada && "opacity-60 bg-muted/30")}>
                          <div className="flex justify-between items-start mb-1">
                            <div className="flex-1">
                              <p className="font-medium text-xs">{getNomeItem(venda)}</p>
                            </div>
                            <Badge className={cn(SELO, tipoColors[venda.tipo])}>{tipoLabels[venda.tipo]}</Badge>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-xs text-muted-foreground">Qtd: {venda.quantidade}</span>
                            <span className={`font-medium text-sm ${venda.cancelada ? 'line-through text-muted-foreground' : ''}`}>
                              <ValorMonetario valor={parcelasComTroca.get(venda.id)?.valor ?? (Number(venda.total) - Number(venda.valor_desconto_manual || 0) - Number(venda.valor_desconto_cupom || 0))} tipo="preco" />
                              {indicacaoTroca(venda)}
                            </span>
                          </div>
                          {renderAcoesVenda(venda)}
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

        <DialogReimpressaoRecibo open={dialogReciboAberto} onOpenChange={setDialogReciboAberto} venda={vendaSelecionada} vendasGrupo={vendasGrupoSelecionado} />
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
        {dialogCancelarSaldo}
        {dialogAlterarData}
      </>
    );
  }

  // Desktop: Table layout
  return (
    <>
      {/* table-fixed + larguras fixas: Item e Cliente dividem o espaço que sobra e truncam,
          então a tabela cabe na largura do card sem scroll horizontal em desktop. */}
      <Table className="table-fixed min-w-[780px]">
        <TableHeader>
          <TableRow>
            <TableHead className={`${TH} w-8`}></TableHead>
            <TableHead className={`${TH} w-16`}>Nº</TableHead>
            <TableHead className={`${TH} w-[92px]`}>Data</TableHead>
            <TableHead className={`${TH} w-[120px]`}>Tipo</TableHead>
            <TableHead className={TH}>Item</TableHead>
            <TableHead className={TH}>Cliente</TableHead>
            <TableHead className={`${TH} w-[112px] text-right`}>Valor</TableHead>
            <TableHead className={`${TH} w-[136px]`}>Pagamento</TableHead>
            <TableHead className={`${TH} w-[144px] text-center`}>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {vendasAgrupadas.map((item) => {
            if (item.tipo === "individual" && item.venda) {
              const venda = item.venda;
              return (
                <TableRow key={venda.id} className={venda.cancelada ? 'opacity-60 bg-muted/30' : ''}>
                  <TableCell className={TD}></TableCell>
                  <TableCell className={`${TD} text-muted-foreground`}>
                    <TextoTruncado texto={venda.numero_venda || "-"} />
                  </TableCell>
                  <TableCell className={TD}><DataVendaCompacta data={venda.data} /></TableCell>
                  <TableCell className={TD}>
                    <Badge className={cn(SELO, tipoColors[venda.tipo], "max-w-full")}>
                      <span className="truncate">{tipoLabels[venda.tipo]}</span>
                    </Badge>
                  </TableCell>
                  <TableCell className={TD}>{renderItemCompacto(venda)}</TableCell>
                  <TableCell className={TD}>
                    <TextoTruncado texto={venda.clientes?.nome || "Cliente não informado"} />
                  </TableCell>
                  <TableCell className={`${TD} text-right font-medium whitespace-nowrap ${venda.cancelada ? 'line-through text-muted-foreground' : ''}`}>
                    <ValorMonetario valor={parcelasComTroca.get(venda.id)?.valor ?? (Number(venda.total) - Number(venda.valor_desconto_manual || 0) - Number(venda.valor_desconto_cupom || 0))} tipo="preco" />
                    {indicacaoTroca(venda)}
                  </TableCell>
                  <TableCell className={TD}>{renderPagamentoCompacto(venda)}</TableCell>
                  <TableCell className={TD}>{renderAcoesVendaCompacto(venda)}</TableCell>
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
              const listaItens = vendasDoGrupo.map(v => `${v.quantidade > 1 ? `${v.quantidade}× ` : ""}${getNomeItem(v)}`).join(", ");

              return (
                <Fragment key={grupoId}>
                  <TableRow
                    className={`cursor-pointer hover:bg-muted/50 ${todasCanceladas ? 'opacity-60 bg-muted/30' : 'bg-primary/5'}`}
                    onClick={() => toggleGrupo(grupoId)}
                  >
                    <TableCell className={TD}>
                      {expandido ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    </TableCell>
                    <TableCell className={TD}>
                      <TextoTruncado texto={primeiraVenda.numero_venda || "-"} />
                    </TableCell>
                    <TableCell className={TD}><DataVendaCompacta data={primeiraVenda.data} /></TableCell>
                    <TableCell className={TD}>
                      <Badge variant="outline" className="border-primary text-primary max-w-full px-2">
                        <ShoppingCart className="h-3 w-3 mr-1 shrink-0" />
                        <span className="truncate">{vendasDoGrupo.length} itens</span>
                      </Badge>
                    </TableCell>
                    <TableCell className={`${TD} font-medium`}>
                      <TextoTruncado texto={getResumoGrupo(vendasDoGrupo)} tooltip={`${listaItens} — ${totalQuantidade} un.`} />
                    </TableCell>
                    <TableCell className={TD}>
                      <TextoTruncado texto={primeiraVenda.clientes?.nome || "Cliente não informado"} />
                    </TableCell>
                    <TableCell className={`${TD} text-right font-semibold whitespace-nowrap ${todasCanceladas ? 'line-through text-muted-foreground' : ''}`}>
                      <ValorMonetario valor={item.totalGrupo || 0} tipo="preco" />
                    </TableCell>
                    <TableCell className={TD}>{renderPagamentoCompacto(primeiraVenda, false)}</TableCell>
                    <TableCell className={TD}>
                      <div className="flex items-center justify-center gap-1">
                        {botaoAlterarDataCompacto(primeiraVenda)}
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleImprimirRecibo(primeiraVenda, vendasDoGrupo); }} className="h-7 w-7 p-0" title="Imprimir Recibo">
                          <Printer className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {expandido && vendasDoGrupo.map(venda => (
                    <TableRow key={venda.id} className={`${venda.cancelada ? 'opacity-60 bg-muted/30' : 'bg-muted/20'}`}>
                      <TableCell className={`${TD} pl-4`}>
                        <div className="w-2 h-2 rounded-full bg-muted-foreground/30"></div>
                      </TableCell>
                      <TableCell className={TD}></TableCell>
                      <TableCell className={TD}><DataVendaCompacta data={venda.data} className="text-muted-foreground" /></TableCell>
                      <TableCell className={TD}>
                        <Badge className={cn(SELO, tipoColors[venda.tipo], "max-w-full")}>
                          <span className="truncate">{tipoLabels[venda.tipo]}</span>
                        </Badge>
                      </TableCell>
                      <TableCell className={TD}>{renderItemCompacto(venda)}</TableCell>
                      <TableCell className={TD}></TableCell>
                      <TableCell className={`${TD} text-right font-medium whitespace-nowrap ${venda.cancelada ? 'line-through text-muted-foreground' : ''}`}>
                        <ValorMonetario valor={parcelasComTroca.get(venda.id)?.valor ?? (Number(venda.total) - Number(venda.valor_desconto_manual || 0) - Number(venda.valor_desconto_cupom || 0))} tipo="preco" />
                        {indicacaoTroca(venda)}
                      </TableCell>
                      <TableCell className={TD}>{renderPagamentoCompacto(venda)}</TableCell>
                      <TableCell className={TD}>{renderAcoesVendaCompacto(venda)}</TableCell>
                    </TableRow>
                  ))}
                </Fragment>
              );
            }
            return null;
          })}
        </TableBody>
      </Table>

      <DialogReimpressaoRecibo open={dialogReciboAberto} onOpenChange={setDialogReciboAberto} venda={vendaSelecionada} vendasGrupo={vendasGrupoSelecionado} />
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
      {dialogCancelarSaldo}
      {dialogAlterarData}
    </>
  );
};
