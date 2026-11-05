import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCheck, CheckCircle, CircleCheck, Clock3, Inbox, Loader2, Receipt } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { TabelaContas } from "@/components/contas/TabelaContas";
import {
  FiltroPeriodoAvancado,
  type FiltrosPeriodo,
  type PresetType,
} from "@/components/financeiro/FiltroPeriodoAvancado";
import { useContasFornecedor, type PeriodoFicha } from "@/hooks/useContasFornecedor";
import { useContas } from "@/hooks/useContas";
import { resumoFicha } from "@/lib/contas/totalConta";
import { dataBrasiliaISO } from "@/lib/dataBrasilia";
import { formatDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { Fornecedor } from "@/types/fornecedor";
import type { PagamentoConta } from "@/types/conta";

// A ficha tem a própria consulta: o useContas entra só pelas ações de baixa.
const SEM_LISTA = { carregar: false } as const;

const OPCOES_PERIODO: { value: PresetType; label: string }[] = [
  { value: "mes_atual", label: "Este mês" },
  { value: "por_mes", label: "Mês" },
  { value: "7dias", label: "Últimos 7 dias" },
  { value: "personalizado", label: "Personalizado" },
];

/** Este mês em Brasília — o mesmo cálculo do preset "mes_atual" do FiltroPeriodoAvancado. */
function periodoEsteMes(): PeriodoFicha {
  const hoje = dataBrasiliaISO(); // "YYYY-MM-DD" de Brasília
  const [ano, mes] = hoje.split("-").map(Number);
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const prefixo = hoje.slice(0, 8); // "YYYY-MM-"
  return { inicio: `${prefixo}01`, fim: `${prefixo}${String(ultimoDia).padStart(2, "0")}` };
}

interface DialogFichaFornecedorProps {
  fornecedor: Fornecedor | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * Ficha do fornecedor: contas a pagar dele no período. Dá baixa como o menu
 * Contas (uma conta, as selecionadas ou todas as pendentes), com as mesmas
 * funções do useContas; editar e excluir continuam só no menu Contas.
 */
export function DialogFichaFornecedor({ fornecedor, onOpenChange }: DialogFichaFornecedorProps) {
  const [periodo, setPeriodo] = useState<PeriodoFicha>(periodoEsteMes);
  const [avisoPeriodo, setAvisoPeriodo] = useState<string | null>(null);

  // Cada abertura começa em "Este mês" (o filtro também remonta pela key abaixo).
  useEffect(() => {
    if (fornecedor) {
      setPeriodo(periodoEsteMes());
      setAvisoPeriodo(null);
    }
  }, [fornecedor]);

  const { data: contas = [], isLoading, isError } = useContasFornecedor(fornecedor?.id ?? null, periodo);
  const resumo = useMemo(() => resumoFicha(contas), [contas]);
  const pendentes = useMemo(() => contas.filter((c) => c.status === "pendente"), [contas]);

  const queryClient = useQueryClient();
  const { marcarComoPaga, marcarVariasComoPaga, registrarPagamentoParcial, estornarPagamento, listarPagamentos } =
    useContas(undefined, SEM_LISTA);
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [confirmarTodas, setConfirmarTodas] = useState(false);
  const [baixando, setBaixando] = useState(false);

  // Seleção só com contas pendentes que estão na lista atual (troca de período, baixa feita).
  useEffect(() => {
    setSelecionadas((atual) => {
      const validas = atual.filter((id) => pendentes.some((c) => c.id === id));
      return validas.length === atual.length ? atual : validas;
    });
  }, [pendentes]);

  const atualizarFicha = () => queryClient.invalidateQueries({ queryKey: ["contas-fornecedor"] });

  const handleMarcarComoPaga = async (id: string, tipo: "pagar" | "receber", formaPagamento?: string) => {
    await marcarComoPaga(id, tipo, formaPagamento, contas.find((c) => c.id === id));
    await atualizarFicha();
  };
  const handleRegistrarPagamento = async (
    contaId: string,
    dados: { valor: number; forma?: string; data: string; observacao?: string },
  ) => {
    const r = await registrarPagamentoParcial(contaId, dados);
    await atualizarFicha();
    return r;
  };
  const handleEstornarPagamento = async (pagamentoId: string, motivo: string) => {
    const r = await estornarPagamento(pagamentoId, motivo);
    await atualizarFicha();
    return r;
  };
  const handleListarPagamentos = (contaId: string): Promise<PagamentoConta[]> => listarPagamentos(contaId);

  const darBaixa = async (ids: string[]) => {
    if (ids.length === 0 || baixando) return;
    setBaixando(true);
    try {
      const ok = await marcarVariasComoPaga(ids, contas);
      if (ok) setSelecionadas([]);
      await atualizarFicha();
    } finally {
      setBaixando(false);
      setConfirmarTodas(false);
    }
  };

  const handleToggleSelecao = (id: string) =>
    setSelecionadas((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]));
  const handleToggleTodas = () =>
    setSelecionadas((atual) => (pendentes.length > 0 && pendentes.every((c) => atual.includes(c.id)) ? [] : pendentes.map((c) => c.id)));

  const handleFiltrar = ({ dataInicio, dataFim }: FiltrosPeriodo) => {
    if (!dataInicio || !dataFim) {
      setAvisoPeriodo("Escolha a data inicial e a final.");
      return;
    }
    setAvisoPeriodo(null);
    // Datas trocadas: usa na ordem certa em vez de devolver vazio.
    setPeriodo(dataInicio <= dataFim ? { inicio: dataInicio, fim: dataFim } : { inicio: dataFim, fim: dataInicio });
  };

  const documento = fornecedor?.cnpj || fornecedor?.cpf;

  return (
    <Dialog open={fornecedor !== null} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          // Celular: tela cheia (padrão do DialogContent); sm+: até 90dvh; lg: mais largo
          // para caber seleção e Pagar na tabela. Nos dois,
          // cabeçalho fixo e só o corpo rola.
          "flex flex-col gap-0 overflow-hidden p-0 sm:max-h-[90dvh] sm:max-w-4xl sm:p-0 lg:max-w-6xl",
        )}
      >
        <DialogHeader className="shrink-0 border-b border-border px-4 pb-4 pr-12 pt-5 text-left sm:px-6">
          <DialogTitle className="break-words text-lg font-bold leading-snug">
            {fornecedor?.nome}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="flex flex-col gap-0.5 text-[13px]">
              {fornecedor?.nome_fantasia && <span className="break-words">{fornecedor.nome_fantasia}</span>}
              <span>{documento || "Sem documento"} · Contas a pagar</span>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
          {fornecedor && (
            <FiltroPeriodoAvancado
              key={fornecedor.id}
              onFiltrar={handleFiltrar}
              loading={isLoading}
              opcoes={OPCOES_PERIODO}
              ocultarLimpar
              opcoesEmGrade
            />
          )}
          {avisoPeriodo && (
            <p role="alert" className="text-[13px] font-medium text-orange-600 dark:text-orange-400">{avisoPeriodo}</p>
          )}

          {/* Totais */}
          <section aria-label="Totais do período" className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Período: {formatDate(periodo.inicio)} a {formatDate(periodo.fim)}
              {!isLoading && !isError && ` · ${resumo.quantidade} ${resumo.quantidade === 1 ? "conta" : "contas"}`}
            </p>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <CardTotal rotulo="Total" icone={<Receipt />} cor="azul" carregando={isLoading} valor={resumo.total} />
              <CardTotal rotulo="Pago" icone={<CircleCheck />} cor="verde" carregando={isLoading} valor={resumo.pago} />
              <CardTotal
                rotulo="Em aberto"
                icone={<Clock3 />}
                cor="laranja"
                carregando={isLoading}
                valor={resumo.emAberto}
                extra={
                  resumo.vencido > 0 ? (
                    <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>
                        Vencido: <ValorMonetario valor={resumo.vencido} />
                        {` (${resumo.quantidadeVencidas} ${resumo.quantidadeVencidas === 1 ? "conta" : "contas"})`}
                      </span>
                    </p>
                  ) : null
                }
              />
            </div>
            {!isLoading && !isError && pendentes.length > 0 && (
              <Button
                type="button"
                onClick={() => setConfirmarTodas(true)}
                disabled={baixando}
                className="h-11 w-full gap-2 sm:w-auto"
              >
                {baixando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCheck className="h-4 w-4" aria-hidden="true" />}
                Pagar todas as pendentes ({pendentes.length})
              </Button>
            )}
          </section>

          {/* Barra da baixa das selecionadas (como no menu Contas) */}
          {selecionadas.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/20 bg-primary/10 p-3">
              <span className="text-sm font-medium">
                {selecionadas.length} conta(s) selecionada(s)
              </span>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => darBaixa(selecionadas)} disabled={baixando}>
                  {baixando ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-1 h-4 w-4" />}
                  Dar Baixa
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelecionadas([])} disabled={baixando}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* Lista */}
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full rounded-[18px]" />
              <Skeleton className="h-24 w-full rounded-[18px]" />
            </div>
          ) : isError ? (
            <p className="rounded-[15px] border border-border bg-card px-4 py-8 text-center text-[13px] text-muted-foreground">
              Não foi possível carregar as contas. Feche e abra a ficha de novo.
            </p>
          ) : contas.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-[15px] border border-dashed border-border bg-card px-4 py-8 text-center">
              <Inbox className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
              <p className="max-w-sm text-[13px] leading-relaxed text-muted-foreground">
                Nenhuma conta ligada a este fornecedor neste período. Contas antigas sem fornecedor escolhido não aparecem aqui.
              </p>
            </div>
          ) : (
            <TabelaContas
              contas={contas}
              ocultarEditarExcluir
              onMarcarComoPaga={handleMarcarComoPaga}
              contasSelecionadas={selecionadas}
              onToggleSelecao={handleToggleSelecao}
              onToggleTodas={handleToggleTodas}
              onRegistrarPagamento={handleRegistrarPagamento}
              onEstornarPagamento={handleEstornarPagamento}
              listarPagamentos={handleListarPagamentos}
            />
          )}
        </div>
      </DialogContent>

      <AlertDialog open={confirmarTodas} onOpenChange={(aberto) => { if (!baixando) setConfirmarTodas(aberto); }}>
        <AlertDialogContent className="mx-4 max-w-[calc(100%-2rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Pagar todas as pendentes?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-1.5">
                <p>
                  {pendentes.length} {pendentes.length === 1 ? "conta pendente" : "contas pendentes"} de {fornecedor?.nome} neste período,
                  somando <ValorMonetario valor={resumo.emAberto} className="font-semibold text-foreground" />.
                </p>
                <p>Cada conta é quitada pelo saldo que falta, com a data de hoje, como o "Dar Baixa" do menu Contas.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel className="w-full sm:w-auto" disabled={baixando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="w-full sm:w-auto"
              disabled={baixando}
              onClick={(e) => { e.preventDefault(); darBaixa(pendentes.map((c) => c.id)); }}
            >
              {baixando && <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" />}
              Pagar todas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

const CORES = {
  azul: "bg-[#E8F0FF] text-[#246BFF] dark:bg-primary/15 dark:text-primary",
  verde: "bg-[#E1F8EA] text-[#008E50] dark:bg-emerald-500/15 dark:text-emerald-400",
  laranja: "bg-[#FFF0D6] text-[#A66A00] dark:bg-amber-500/15 dark:text-amber-400",
} as const;

function CardTotal({
  rotulo,
  icone,
  cor,
  valor,
  carregando,
  extra,
}: {
  rotulo: string;
  icone: ReactNode;
  cor: keyof typeof CORES;
  valor: number;
  carregando: boolean;
  extra?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-[15px] border border-border bg-card px-3.5 py-3 shadow-[0_2px_8px_rgba(16,24,40,0.03)]">
      <div aria-hidden="true" className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl [&>svg]:h-[18px] [&>svg]:w-[18px]", CORES[cor])}>
        {icone}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{rotulo}</p>
        {carregando ? (
          <Skeleton className="mt-1 h-6 w-24" />
        ) : (
          <p className="mt-0.5 whitespace-nowrap text-lg font-bold text-foreground">
            <ValorMonetario valor={valor} />
          </p>
        )}
        {!carregando && extra}
      </div>
    </div>
  );
}
