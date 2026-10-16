import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Pencil, Trash2, CheckCircle, Receipt, Repeat, User, Wrench } from "lucide-react";
import { Conta, PagamentoConta } from "@/types/conta";
import { formatDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { DialogConfirmarBaixa } from "./DialogConfirmarBaixa";

interface TabelaContasProps {
  contas: Conta[];
  onEditar: (conta: Conta) => void;
  onExcluir: (id: string) => void;
  onMarcarComoPaga: (id: string, tipo: 'pagar' | 'receber', formaPagamento?: string) => void;
  contasSelecionadas: string[];
  onToggleSelecao: (id: string) => void;
  onToggleTodas: () => void;
  // Modelo novo (recebimento parcial) — opcionais; DialogConfirmarBaixa cai no
  // fluxo antigo quando a conta não usa histórico ou estes não são passados.
  onRegistrarPagamento?: (
    contaId: string,
    dados: { valor: number; forma?: string; data: string; observacao?: string },
  ) => Promise<{ ok: boolean; quitou: boolean }>;
  onEstornarPagamento?: (pagamentoId: string, motivo: string) => Promise<boolean>;
  listarPagamentos?: (contaId: string) => Promise<PagamentoConta[]>;
}

// Visual da lista (referência layout-contas/referencia-lista). Só classes.
const SELO = "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1.5 text-[10px] font-bold leading-none max-[390px]:px-2 max-[390px]:py-[5px] max-[390px]:text-[9px]";
const SELO_VERMELHO = "bg-[#FFE6E6] text-[#E02424] dark:bg-red-500/15 dark:text-red-400";
const SELO_VERDE = "bg-[#E1F8EA] text-[#008E50] dark:bg-emerald-500/15 dark:text-emerald-400";
const SELO_AZUL = "bg-[#E5EEFF] text-[#246BFF] dark:bg-blue-500/15 dark:text-blue-400";
const SELO_LARANJA = "bg-[#FFF0D6] text-[#A66A00] dark:bg-amber-500/15 dark:text-amber-400";
const BOTAO_ACAO = "inline-flex h-[37px] min-w-[37px] shrink-0 items-center justify-center rounded-[10px] transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#A7C8FF] focus-visible:ring-offset-1 focus-visible:ring-offset-background [&>svg]:h-[17px] [&>svg]:w-[17px]";
const BOTAO_NEUTRO = "bg-[#F4F6FA] text-[#0B1429] hover:bg-[#E9EDF4] dark:bg-muted dark:text-foreground dark:hover:bg-muted/70";
const BOTAO_EXCLUIR = "bg-[#FFF0F0] text-[#F04438] hover:bg-[#FFE2E2] dark:bg-red-500/15 dark:text-red-400 dark:hover:bg-red-500/25";
const ROTULO_INFO = "mb-2 text-[10px] leading-none text-muted-foreground";
const BOTAO_BAIXA = "bg-[#E4F8ED] text-[#00A45B] hover:bg-[#D3F3E1] dark:bg-emerald-500/15 dark:text-emerald-400 dark:hover:bg-emerald-500/25";

// Total e saldo dependem do modelo: conta antiga guarda o saldo em `valor`
// (com a entrada em `valor_pago`); conta nova guarda o total em `valor`.
function calcTotalFalta(conta: Conta) {
  const pago = Number(conta.valor_pago || 0);
  if (conta.usa_historico_pagamentos) {
    return { total: Number(conta.valor), falta: Math.max(Number(conta.valor) - pago, 0) };
  }
  return { total: Number(conta.valor) + pago, falta: Number(conta.valor) };
}

export function TabelaContas({
  contas,
  onEditar,
  onExcluir,
  onMarcarComoPaga,
  contasSelecionadas,
  onToggleSelecao,
  onToggleTodas,
  onRegistrarPagamento,
  onEstornarPagamento,
  listarPagamentos,
}: TabelaContasProps) {
  const isMobile = useIsMobile();
  const [contaBaixa, setContaBaixa] = useState<Conta | null>(null);

  const contasPendentes = contas.filter(c => c.status === "pendente");
  const todasPendentesSelecionadas = contasPendentes.length > 0 && contasPendentes.every(c => contasSelecionadas.includes(c.id));

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pago":
        return <span className={cn(SELO, SELO_AZUL)}>Pago</span>;
      case "recebido":
        return <span className={cn(SELO, SELO_AZUL)}>Recebido</span>;
      case "pendente":
        return <span className={cn(SELO, SELO_LARANJA)}>Pendente</span>;
      default:
        return <span className={cn(SELO, "bg-muted text-muted-foreground")}>{status}</span>;
    }
  };

  const getTipoBadge = (tipo: string) => {
    return tipo === "pagar" ? (
      <span className={cn(SELO, SELO_VERMELHO)}>A Pagar</span>
    ) : (
      <span className={cn(SELO, SELO_VERDE)}>A Receber</span>
    );
  };

  const getParcialBadge = (conta: Conta) =>
    conta.usa_historico_pagamentos && conta.status === "pendente" && Number(conta.valor_pago || 0) > 0 ? (
      <span className={cn(SELO, SELO_LARANJA, "ring-1 ring-inset ring-[#F5C46B] dark:ring-amber-500/40")}>Parcial</span>
    ) : null;

  if (contas.length === 0) {
    return (
      <div className="rounded-[15px] border border-border bg-card px-[15px] py-10 text-center text-[13px] leading-relaxed text-muted-foreground">
        Nenhuma conta cadastrada
      </div>
    );
  }

  // Mobile: Card-based layout
  if (isMobile) {
    return (
      <div className="flex flex-col gap-[15px]">
        {contas.map((conta) => {
          const dataVencimento = conta.data_vencimento ? new Date(conta.data_vencimento) : (conta.os_numero ? null : new Date(conta.data));
          const hoje = new Date();
          const vencida = dataVencimento ? dataVencimento < hoje && conta.status === "pendente" : false;
          const selecionada = contasSelecionadas.includes(conta.id);

          const parcial = conta.valor_pago != null && conta.valor_pago > 0 && conta.status === 'pendente';
          const textoVencimento = conta.data_vencimento ? formatDate(conta.data_vencimento) : (conta.os_numero ? "Sem prazo" : formatDate(conta.data));

          return (
            <article
              key={conta.id}
              className={cn(
                "rounded-[18px] border border-border bg-card px-[15px] pb-3 pt-[17px] shadow-[0_5px_18px_rgba(16,24,40,0.045)] max-[390px]:px-[11px] max-[390px]:py-[13px]",
                vencida && "border-red-300 bg-red-50/50 dark:border-red-500/40 dark:bg-red-950/20",
                selecionada && "ring-2 ring-primary",
              )}
            >
              {/* Cabeçalho: ícone, nome, subtítulo e selos */}
              <div className="flex items-start gap-3 max-[390px]:gap-2">
                <div
                  aria-hidden="true"
                  className="grid h-[53px] w-[53px] shrink-0 place-items-center rounded-[15px] bg-[#E8F0FF] text-[#246BFF] dark:bg-primary/15 dark:text-primary max-[390px]:h-[43px] max-[390px]:w-[43px] [&>svg]:h-[25px] [&>svg]:w-[25px] max-[390px]:[&>svg]:h-5 max-[390px]:[&>svg]:w-5"
                >
                  <Receipt />
                </div>
                <div className="min-w-0 flex-1 self-center">
                  <p className="break-words text-base font-bold leading-snug text-[#101828] dark:text-foreground max-[390px]:text-sm">{conta.nome}</p>
                  {conta.recorrente && (
                    <p className="mt-[5px] flex items-center gap-1 text-[11px] leading-snug text-muted-foreground">
                      <Repeat className="h-3 w-3 shrink-0" aria-hidden="true" />
                      Recorrente
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-[5px]">
                  {getTipoBadge(conta.tipo)}
                  {getStatusBadge(conta.status)}
                  {getParcialBadge(conta)}
                </div>
              </div>

              {/* Valor | Vencimento | Categoria */}
              <div className="mt-5 grid grid-cols-[minmax(min-content,1fr)_minmax(0,1fr)_minmax(0,1.15fr)] gap-[9px]">
                <div className="min-w-0">
                  <p className={ROTULO_INFO}>{parcial ? (conta.usa_historico_pagamentos ? 'Total' : 'Total da OS') : 'Valor'}</p>
                  <p className="whitespace-nowrap text-[13px] font-bold text-[#101828] dark:text-foreground">
                    <ValorMonetario valor={parcial ? calcTotalFalta(conta).total : conta.valor} />
                  </p>
                </div>
                <div className="min-w-0 border-l border-border pl-2.5">
                  <p className={ROTULO_INFO}>Vencimento</p>
                  <p className={cn("break-words text-[13px] font-bold max-[370px]:text-xs", vencida ? "text-red-600 dark:text-red-400" : "text-[#101828] dark:text-foreground")}>
                    {textoVencimento}
                  </p>
                </div>
                <div className="min-w-0 border-l border-border pl-2.5">
                  <p className={ROTULO_INFO}>Categoria</p>
                  <p className="break-words text-[13px] font-bold text-[#101828] [overflow-wrap:anywhere] max-[370px]:text-xs dark:text-foreground">{conta.categoria || "—"}</p>
                </div>
              </div>

              {/* Recebimento parcial / entrada da OS */}
              {parcial && (
                <div className="mt-3 grid grid-cols-2 gap-[9px] rounded-xl bg-[#F4F6FA] px-3 py-2.5 dark:bg-muted/60">
                  <div className="min-w-0">
                    <p className="mb-1 text-[10px] text-[#008E50] dark:text-emerald-400">✓ {conta.usa_historico_pagamentos ? 'Recebido' : 'Entrada paga'}</p>
                    <p className="whitespace-nowrap text-[13px] font-bold text-[#008E50] dark:text-emerald-400"><ValorMonetario valor={conta.valor_pago} /></p>
                  </div>
                  <div className="min-w-0 border-l border-border pl-2.5">
                    <p className="mb-1 text-[10px] font-medium text-orange-600 dark:text-orange-400">{conta.usa_historico_pagamentos ? `Falta ${conta.tipo === 'pagar' ? 'pagar' : 'receber'}` : 'Falta receber'}</p>
                    <p className="whitespace-nowrap text-[13px] font-bold text-orange-600 dark:text-orange-400"><ValorMonetario valor={calcTotalFalta(conta).falta} /></p>
                  </div>
                </div>
              )}

              {/* Cliente e OS (quando existem) */}
              {(conta.tipo === 'receber' || conta.os_numero) && (
                <div className="mt-3 flex flex-col gap-1.5 text-[11px]">
                  {conta.tipo === 'receber' && (
                    <p className="flex min-w-0 items-start gap-[7px]">
                      <User className="mt-px h-[15px] w-[15px] shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="shrink-0 text-muted-foreground">Cliente</span>
                      <span className="min-w-0 break-words font-semibold text-[#101828] dark:text-foreground">{conta.cliente_nome || "—"}</span>
                    </p>
                  )}
                  {conta.os_numero && (
                    <p className="flex min-w-0 items-start gap-[7px]">
                      <Wrench className="mt-px h-[15px] w-[15px] shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="shrink-0 text-muted-foreground">OS</span>
                      <span className="min-w-0 break-words font-semibold text-[#101828] dark:text-foreground">{conta.os_numero}</span>
                    </p>
                  )}
                </div>
              )}

              {/* Rodapé: seleção para baixa em massa e ações */}
              <div className="mt-[18px] flex items-center justify-between gap-2.5 border-t border-border pt-3">
                <div className="min-w-0">
                  {conta.status === "pendente" && (
                    <label htmlFor={`selecionar-${conta.id}`} className="flex cursor-pointer items-center gap-[7px] text-[11px] text-muted-foreground">
                      <Checkbox
                        id={`selecionar-${conta.id}`}
                        checked={selecionada}
                        onCheckedChange={() => onToggleSelecao(conta.id)}
                      />
                      Selecionar
                    </label>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {conta.status === "pendente" && (
                    <button
                      type="button"
                      onClick={() => setContaBaixa(conta)}
                      aria-label={conta.tipo === 'pagar' ? `Marcar "${conta.nome}" como pago` : `Marcar "${conta.nome}" como recebido`}
                      className={cn(BOTAO_ACAO, BOTAO_BAIXA, "gap-1.5 px-3 text-xs font-bold")}
                    >
                      <CheckCircle aria-hidden="true" />
                      {conta.tipo === 'pagar' ? 'Pagar' : 'Receber'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onEditar(conta)}
                    aria-label={`Editar conta "${conta.nome}"`}
                    className={cn(BOTAO_ACAO, BOTAO_NEUTRO)}
                  >
                    <Pencil aria-hidden="true" />
                  </button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button type="button" aria-label={`Excluir conta "${conta.nome}"`} className={cn(BOTAO_ACAO, BOTAO_EXCLUIR)}>
                        <Trash2 aria-hidden="true" />
                      </button>
                    </AlertDialogTrigger>
                  <AlertDialogContent className="mx-4 max-w-[calc(100%-2rem)]">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                      <AlertDialogDescription>
                        Excluir a conta "{conta.nome}"?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                      <AlertDialogCancel className="w-full sm:w-auto">Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => onExcluir(conta.id)}
                        className="w-full sm:w-auto bg-destructive text-destructive-foreground"
                      >
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </article>
          );
        })}

        <DialogConfirmarBaixa
          conta={contaBaixa}
          open={contaBaixa !== null}
          onOpenChange={(open) => { if (!open) setContaBaixa(null); }}
          onConfirmar={async (id, tipo, formaPagamento) => {
            await onMarcarComoPaga(id, tipo, formaPagamento);
            return true;
          }}
          onRegistrarPagamento={onRegistrarPagamento}
          onEstornarPagamento={onEstornarPagamento}
          listarPagamentos={listarPagamentos}
        />
      </div>
    );
  }

  // Desktop: Table layout
  return (
    <div className="overflow-hidden rounded-[18px] border border-border bg-card shadow-[0_5px_18px_rgba(16,24,40,0.045)]">
      <Table>
        <TableHeader>
          <TableRow className="bg-[#F7F9FC] hover:bg-[#F7F9FC] dark:bg-muted/40 dark:hover:bg-muted/40 [&>th]:h-11 [&>th]:px-3 [&>th]:text-[11px] [&>th]:font-semibold [&>th]:uppercase [&>th]:tracking-wide [&>th]:text-muted-foreground">
            <TableHead className="w-10">
              <Checkbox
                checked={todasPendentesSelecionadas}
                onCheckedChange={onToggleTodas}
                aria-label="Selecionar todas as contas pendentes"
              />
            </TableHead>
            <TableHead>Nome</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Vencimento</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contas.map((conta) => {
            const dataVencimento = conta.data_vencimento ? new Date(conta.data_vencimento) : (conta.os_numero ? null : new Date(conta.data));
            const hoje = new Date();
            const vencida = dataVencimento ? dataVencimento < hoje && conta.status === "pendente" : false;
            const selecionada = contasSelecionadas.includes(conta.id);

            return (
              <TableRow key={conta.id} className={cn("[&>td]:px-3 [&>td]:py-3.5", vencida && "bg-red-50 dark:bg-red-950/20", selecionada && "bg-primary/5")}>
                <TableCell>
                  {conta.status === "pendente" ? (
                    <Checkbox
                      checked={selecionada}
                      onCheckedChange={() => onToggleSelecao(conta.id)}
                      aria-label={`Selecionar conta "${conta.nome}"`}
                    />
                  ) : (
                    <div className="w-5" />
                  )}
                </TableCell>
                <TableCell className="min-w-[180px] max-w-[220px]">
                  <div className="flex min-w-0 items-center gap-3">
                    <div aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#E8F0FF] text-[#246BFF] dark:bg-primary/15 dark:text-primary">
                      <Receipt className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="break-words font-bold text-[#101828] dark:text-foreground">{conta.nome}</p>
                      {conta.recorrente && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                          <Repeat className="h-3 w-3 shrink-0" aria-hidden="true" />
                          Recorrente
                        </p>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="min-w-[90px] max-w-[130px] break-words text-sm">{conta.tipo === 'receber' ? (conta.cliente_nome || "—") : "—"}</TableCell>
                <TableCell>{getTipoBadge(conta.tipo)}</TableCell>
                <TableCell className="min-w-[80px] max-w-[120px] break-words">{conta.categoria || "-"}</TableCell>
                <TableCell>
                  {(conta.valor_pago != null && conta.valor_pago > 0 && conta.status === 'pendente') ? (
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground">Total: <span className="font-medium text-foreground"><ValorMonetario valor={calcTotalFalta(conta).total} /></span></p>
                      <p className="text-xs text-green-600">✓ {conta.usa_historico_pagamentos ? 'Pago' : 'Entrada'}: <ValorMonetario valor={conta.valor_pago} /></p>
                      <p className="font-semibold text-orange-600">Falta: <ValorMonetario valor={calcTotalFalta(conta).falta} /></p>
                    </div>
                  ) : (
                    <p className="whitespace-nowrap font-bold text-[#101828] dark:text-foreground"><ValorMonetario valor={conta.valor} /></p>
                  )}
                </TableCell>
                <TableCell>
                  <div>
                    <p>{conta.data_vencimento ? formatDate(conta.data_vencimento) : (conta.os_numero ? "Sem prazo" : formatDate(conta.data))}</p>
                    {vencida && (
                      <p className="text-xs font-medium text-red-600 dark:text-red-400">Vencida</p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col items-start gap-[5px]">
                    {getStatusBadge(conta.status)}
                    {getParcialBadge(conta)}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    {conta.status === "pendente" && (
                      <button
                        type="button"
                        onClick={() => setContaBaixa(conta)}
                        title={conta.tipo === 'pagar' ? 'Marcar como pago' : 'Marcar como recebido'}
                        aria-label={conta.tipo === 'pagar' ? `Marcar "${conta.nome}" como pago` : `Marcar "${conta.nome}" como recebido`}
                        className={cn(BOTAO_ACAO, BOTAO_BAIXA)}
                      >
                        <CheckCircle aria-hidden="true" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onEditar(conta)}
                      aria-label={`Editar conta "${conta.nome}"`}
                      className={cn(BOTAO_ACAO, BOTAO_NEUTRO)}
                    >
                      <Pencil aria-hidden="true" />
                    </button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button type="button" aria-label={`Excluir conta "${conta.nome}"`} className={cn(BOTAO_ACAO, BOTAO_EXCLUIR)}>
                          <Trash2 aria-hidden="true" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja excluir a conta "{conta.nome}"?
                            Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => onExcluir(conta.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <DialogConfirmarBaixa
        conta={contaBaixa}
        open={contaBaixa !== null}
        onOpenChange={(open) => { if (!open) setContaBaixa(null); }}
        onConfirmar={async (id, tipo, formaPagamento) => {
          await onMarcarComoPaga(id, tipo, formaPagamento);
          return true;
        }}
        onRegistrarPagamento={onRegistrarPagamento}
        onEstornarPagamento={onEstornarPagamento}
        listarPagamentos={listarPagamentos}
      />
    </div>
  );
}
