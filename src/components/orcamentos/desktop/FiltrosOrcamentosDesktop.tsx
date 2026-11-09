// Filtros da tela Orçamentos no computador (>= 1024px): busca, status (efetivo),
// período pela data de criação, contador e "Limpar filtros". Só visual: recebe o
// estado e os handlers da página; o filtro em si é filtrarOrcamentos (src/lib/orcamentos).
// Abaixo de 1024px a página não usa este componente.
import { useTranslation } from "react-i18next";
import { Calendar, Filter, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { TODOS_OS_STATUS, type FiltroStatus, type StatusDoOrcamento } from "@/lib/orcamentos/listaOrcamentosDesktop";

/** Ordem das opções do filtro de status (decisão do Adriel). */
const OPCOES_STATUS: StatusDoOrcamento[] = ["pendente", "expirado", "aprovado", "convertido", "rejeitado"];

interface FiltrosOrcamentosDesktopProps {
  busca: string;
  onBusca: (v: string) => void;
  status: FiltroStatus;
  onStatus: (v: FiltroStatus) => void;
  dataInicio: string;
  onDataInicio: (v: string) => void;
  dataFim: string;
  onDataFim: (v: string) => void;
  temFiltrosAtivos: boolean;
  onLimparFiltros: () => void;
  carregando: boolean;
  quantidadeEncontrada: number;
}

export function FiltrosOrcamentosDesktop(p: FiltrosOrcamentosDesktopProps) {
  const { t } = useTranslation("comum", { keyPrefix: "orcamentos.filtros" });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder={t("busca")}
            aria-label={t("buscaRotulo")}
            value={p.busca}
            onChange={(e) => p.onBusca(e.target.value)}
            className="h-11 rounded-xl bg-card pl-10 shadow-sm"
          />
        </div>

        <Select value={p.status} onValueChange={(v) => p.onStatus(v as FiltroStatus)}>
          <SelectTrigger className="h-11 w-[200px] rounded-xl bg-card shadow-sm" aria-label={t("statusRotulo")}>
            <div className="flex min-w-0 items-center gap-2">
              <Filter className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS_OS_STATUS}>{t("todosStatus")}</SelectItem>
            {OPCOES_STATUS.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`statusPlural.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Período pela data de criação; vazio = todos. Dias de calendário de Brasília. */}
        <div className="flex h-11 items-center gap-1 rounded-xl border bg-card px-3 shadow-sm">
          <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <Input
            type="date"
            aria-label={t("dataInicial")}
            title={t("dataInicial")}
            value={p.dataInicio}
            onChange={(e) => p.onDataInicio(e.target.value)}
            className="h-9 w-[136px] border-0 bg-transparent px-1.5 shadow-none focus-visible:ring-1 focus-visible:ring-offset-0"
          />
          <span className="text-sm text-muted-foreground">{t("ate")}</span>
          <Input
            type="date"
            aria-label={t("dataFinal")}
            title={t("dataFinal")}
            value={p.dataFim}
            onChange={(e) => p.onDataFim(e.target.value)}
            className="h-9 w-[136px] border-0 bg-transparent px-1.5 shadow-none focus-visible:ring-1 focus-visible:ring-offset-0"
          />
        </div>
      </div>

      <div className="flex min-h-9 items-center justify-between gap-3">
        {p.carregando ? (
          <Skeleton className="h-5 w-44" />
        ) : (
          <p className="text-sm text-muted-foreground tabular-nums">
            {t("encontrados", { count: p.quantidadeEncontrada })}
          </p>
        )}
        {p.temFiltrosAtivos && (
          <Button variant="ghost" size="sm" onClick={p.onLimparFiltros} className="h-9 gap-2">
            <X className="h-4 w-4" aria-hidden="true" />
            {t("limparFiltros")}
          </Button>
        )}
      </div>
    </div>
  );
}
