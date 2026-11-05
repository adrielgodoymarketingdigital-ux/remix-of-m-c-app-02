import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, CircleCheck, Clock3, Inbox, Receipt } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { TabelaContas } from "@/components/contas/TabelaContas";
import {
  FiltroPeriodoAvancado,
  type FiltrosPeriodo,
  type PresetType,
} from "@/components/financeiro/FiltroPeriodoAvancado";
import { useContasFornecedor, type PeriodoFicha } from "@/hooks/useContasFornecedor";
import { resumoFicha } from "@/lib/contas/totalConta";
import { dataBrasiliaISO } from "@/lib/dataBrasilia";
import { formatDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { Fornecedor } from "@/types/fornecedor";

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

/** Ficha do fornecedor: contas a pagar dele no período (só leitura). */
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
          // Celular: tela cheia (padrão do DialogContent); sm+: até 90dvh. Nos dois,
          // cabeçalho fixo e só o corpo rola.
          "flex flex-col gap-0 overflow-hidden p-0 sm:max-h-[90dvh] sm:max-w-4xl sm:p-0",
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
          </section>

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
            <TabelaContas contas={contas} somenteLeitura />
          )}
        </div>
      </DialogContent>
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
