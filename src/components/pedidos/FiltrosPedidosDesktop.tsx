// Filtros da aba Pedidos no computador (>= 1024px): busca (cliente, descrição, telefone),
// status, "Limpar filtros" e a linha "N encontrados". Só visual: a filtragem é a de
// src/lib/pedidos/listaPedidosDesktop, feita na página. Sem filtro de datas (decisão do Adriel).
import { useTranslation } from "react-i18next";
import { Filter, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { STATUS_PEDIDO, TODOS_OS_STATUS, type FiltroStatusPedido } from "@/lib/pedidos/listaPedidosDesktop";

interface FiltrosPedidosDesktopProps {
  busca: string;
  onBusca: (v: string) => void;
  status: FiltroStatusPedido;
  onStatus: (v: FiltroStatusPedido) => void;
  temFiltrosAtivos: boolean;
  onLimparFiltros: () => void;
  quantidadeEncontrada: number;
  loading: boolean;
}

export function FiltrosPedidosDesktop(p: FiltrosPedidosDesktopProps) {
  const { t } = useTranslation("pedidos", { keyPrefix: "telaDesktop" });

  return (
    <div className="space-y-3">
      <Card className="rounded-2xl p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              placeholder={t("filtros.busca")}
              aria-label={t("filtros.buscaRotulo")}
              value={p.busca}
              onChange={(e) => p.onBusca(e.target.value)}
              className="h-11 pl-10"
            />
          </div>

          <Select value={p.status} onValueChange={(v) => p.onStatus(v as FiltroStatusPedido)}>
            <SelectTrigger className="h-11 w-[220px]" aria-label={t("filtros.statusRotulo")}>
              <div className="flex min-w-0 items-center gap-2">
                <Filter className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS_OS_STATUS}>{t("filtros.todosStatus")}</SelectItem>
              {STATUS_PEDIDO.map((status) => (
                <SelectItem key={status} value={status}>
                  {t(`status.${status}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            onClick={p.onLimparFiltros}
            disabled={!p.temFiltrosAtivos}
            className="h-11 gap-2 px-4"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            {t("filtros.limpar")}
          </Button>
        </div>
      </Card>

      {/* Com 0 a própria lista já diz "nenhum pedido cadastrado/encontrado" (como em Serviços). */}
      {p.loading ? (
        <Skeleton className="h-5 w-40" />
      ) : p.quantidadeEncontrada > 0 ? (
        <p className="text-sm text-muted-foreground">{t("filtros.encontrados", { count: p.quantidadeEncontrada })}</p>
      ) : null}
    </div>
  );
}
