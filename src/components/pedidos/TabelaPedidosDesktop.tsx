// Tabela da aba Pedidos no computador (>= 1024px), com paginação no rodapé (a de Serviços).
// Só visual: recebe a página já calculada (paginar) e os MESMOS handlers da página —
// Editar abre o diálogo de sempre e Excluir abre o AlertDialog de sempre (pedidoExcluindo).
// Abaixo de 1024px a página usa a lista de cartões de sempre.
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, CheckCircle2, PackageOpen, Pencil, Plus, SearchX, Trash2, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { useFormatadores } from "@/hooks/useFormatadores";
import { cn } from "@/lib/utils";
import {
  diaCriacaoBrasilia,
  OPCOES_POR_PAGINA,
  paginasVisiveis,
  type PaginaPedidos,
  type StatusDoPedido,
} from "@/lib/pedidos/listaPedidosDesktop";
import type { Pedido } from "@/hooks/usePedidos";

interface TabelaPedidosDesktopProps {
  /** Página já calculada sobre a lista filtrada (paginar). */
  pagina: PaginaPedidos<Pedido>;
  porPagina: number;
  onPagina: (pagina: number) => void;
  onPorPagina: (porPagina: number) => void;
  loading: boolean;
  /** Pedidos cadastrados (todos): 0 = nenhum cadastrado; senão a lista vazia é culpa do filtro. */
  totalCadastrados: number;
  onNovoPedido: () => void;
  onLimparFiltros: () => void;
  onEditar: (pedido: Pedido) => void;
  onExcluir: (pedido: Pedido) => void;
}

const VAZIO = "—";

// Mesmas cores dos selos de sempre (STATUS_CORES), com variante para o modo escuro.
const COR_STATUS: Record<StatusDoPedido, string> = {
  aguardando: "bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-300",
  confirmado: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300",
  chegou: "bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-300",
  entregue: "bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300",
  cancelado: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300",
};
const SELO = "inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold";

/** Ilustração do vazio (a caixa aberta do mockup), só com CSS e ícone. */
function CaixaVazia() {
  return (
    <div className="relative mb-1 grid h-28 w-36 place-items-end justify-center" aria-hidden="true">
      <span className="absolute left-1/2 top-0 h-5 w-1 -translate-x-1/2 rounded-full bg-primary/60" />
      <span className="absolute left-[38%] top-3 h-4 w-1 -rotate-[40deg] rounded-full bg-primary/50" />
      <span className="absolute right-[38%] top-3 h-4 w-1 rotate-[40deg] rounded-full bg-primary/50" />
      <div className="grid h-20 w-24 place-items-center rounded-2xl bg-primary/10 text-primary">
        <PackageOpen className="h-11 w-11" strokeWidth={1.5} />
      </div>
    </div>
  );
}

export function TabelaPedidosDesktop(p: TabelaPedidosDesktopProps) {
  const { t } = useTranslation("pedidos", { keyPrefix: "telaDesktop" });
  const { data } = useFormatadores();
  const { pagina } = p;

  if (p.loading) {
    return (
      <Card className="space-y-3 rounded-2xl p-5 shadow-sm" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </Card>
    );
  }

  if (pagina.total === 0) {
    const nenhumCadastrado = p.totalCadastrados === 0;
    return (
      <Card className="flex flex-col items-center justify-center gap-3 rounded-2xl px-6 py-14 text-center shadow-sm">
        {nenhumCadastrado ? (
          <CaixaVazia />
        ) : (
          <div className="grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
            <SearchX className="h-6 w-6" aria-hidden="true" />
          </div>
        )}
        <div className="space-y-1">
          <p className="text-lg font-semibold">{nenhumCadastrado ? t("tabela.vazioTitulo") : t("tabela.semResultadoTitulo")}</p>
          <p className="text-sm text-muted-foreground">{nenhumCadastrado ? t("tabela.vazioTexto") : t("tabela.semResultadoTexto")}</p>
        </div>
        {nenhumCadastrado ? (
          <Button onClick={p.onNovoPedido} className="mt-1 h-11 gap-2 rounded-xl px-5">
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t("novoPedido")}
          </Button>
        ) : (
          <Button variant="outline" onClick={p.onLimparFiltros} className="mt-1 gap-2">
            <X className="h-4 w-4" aria-hidden="true" />
            {t("filtros.limpar")}
          </Button>
        )}
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden rounded-2xl shadow-sm">
      {/* O Table do shadcn já vem num div com overflow-auto: rola dentro do cartão quando a
          caixa é menor que a tabela (1024px com menu aberto). */}
      {/* table-fixed + larguras: só a Descrição estica. Colunas fixas somam 800px; em 1280px com o
            menu aberto (974px de caixa) sobram ~174px para a Descrição, que corta com reticências e
            mostra o texto inteiro ao passar o mouse. Abaixo de 940px de caixa a tabela rola. */}
        <Table className="min-w-[940px] table-fixed">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[176px] pl-5 pr-3">{t("tabela.colunas.cliente")}</TableHead>
              <TableHead className="px-3">{t("tabela.colunas.descricao")}</TableHead>
              <TableHead className="w-[100px] px-2" title={t("tabela.previsaoDica")}>{t("tabela.colunas.previsao")}</TableHead>
              <TableHead className="w-[100px] px-2" title={t("tabela.dataDica")}>{t("tabela.colunas.data")}</TableHead>
              <TableHead className="w-[116px] px-3 text-right">{t("tabela.colunas.valor")}</TableHead>
              <TableHead className="w-[116px] px-2">{t("tabela.colunas.status")}</TableHead>
              <TableHead className="w-[104px] px-2">{t("tabela.colunas.pagamento")}</TableHead>
              <TableHead className="w-[88px] px-2 pr-4 text-center">{t("tabela.colunas.acoes")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagina.itens.map((pedido) => {
              const dia = diaCriacaoBrasilia(pedido.created_at);
              return (
                <TableRow key={pedido.id}>
                  <TableCell className="py-3 pl-5 pr-3">
                    <p className="truncate font-medium" title={pedido.cliente_nome}>{pedido.cliente_nome}</p>
                    <p className="truncate text-xs text-muted-foreground tabular-nums" title={pedido.cliente_telefone || undefined}>
                      {pedido.cliente_telefone || VAZIO}
                    </p>
                  </TableCell>
                  <TableCell className="px-3 py-3">
                    {/* Descrição corta com "…"; o texto inteiro aparece ao passar o mouse. As
                        observações ficam na linha de baixo, do mesmo jeito (sem coluna própria). */}
                    <p className="truncate" title={pedido.descricao}>{pedido.descricao}</p>
                    {pedido.observacoes && (
                      <p className="truncate text-xs italic text-muted-foreground" title={pedido.observacoes}>
                        {pedido.observacoes}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="px-2 py-3 tabular-nums">
                    {pedido.previsao_chegada ? data(pedido.previsao_chegada) : <span className="text-muted-foreground">{VAZIO}</span>}
                  </TableCell>
                  <TableCell className="px-2 py-3 tabular-nums">
                    {dia ? data(dia) : <span className="text-muted-foreground">{VAZIO}</span>}
                  </TableCell>
                  <TableCell className="px-3 py-3 text-right font-medium tabular-nums [overflow-wrap:anywhere]">
                    {pedido.valor_total != null ? (
                      <ValorMonetario valor={pedido.valor_total} tipo="preco" />
                    ) : (
                      <span className="font-normal text-muted-foreground">{VAZIO}</span>
                    )}
                  </TableCell>
                  <TableCell className="px-2 py-3">
                    <span className={cn(SELO, COR_STATUS[pedido.status])}>{t(`status.${pedido.status}`)}</span>
                  </TableCell>
                  <TableCell className="px-2 py-3">
                    {pedido.pago ? (
                      <span className={cn(SELO, "bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300")}>
                        <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden="true" />
                        {t("tabela.pago")}
                      </span>
                    ) : (
                      <span className={cn(SELO, "bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300")}>
                        <XCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
                        {t("tabela.naoPago")}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="px-2 py-3 pr-4">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => p.onEditar(pedido)}
                        aria-label={t("tabela.editar")}
                        title={t("tabela.editar")}
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => p.onExcluir(pedido)}
                        aria-label={t("tabela.excluir")}
                        title={t("tabela.excluir")}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3">
        <p className="text-sm text-muted-foreground tabular-nums">
          {t("tabela.exibindo", { inicio: pagina.inicio, fim: pagina.fim, count: pagina.total })}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {pagina.totalPaginas > 1 && (
            <nav className="flex items-center gap-1" aria-label={t("tabela.paginacao")}>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => p.onPagina(pagina.pagina - 1)}
                disabled={pagina.pagina === 1}
                aria-label={t("tabela.anterior")}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </Button>
              {paginasVisiveis(pagina.pagina, pagina.totalPaginas).map((n, i) =>
                n === "…" ? (
                  <span key={`buraco-${i}`} className="px-1 text-sm text-muted-foreground" aria-hidden="true">
                    …
                  </span>
                ) : (
                  <Button
                    key={n}
                    variant={n === pagina.pagina ? "default" : "outline"}
                    size="icon"
                    className="h-9 w-9 tabular-nums"
                    onClick={() => p.onPagina(n)}
                    aria-label={t("tabela.pagina", { numero: n })}
                    aria-current={n === pagina.pagina ? "page" : undefined}
                  >
                    {n}
                  </Button>
                ),
              )}
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => p.onPagina(pagina.pagina + 1)}
                disabled={pagina.pagina === pagina.totalPaginas}
                aria-label={t("tabela.proxima")}
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </nav>
          )}
          <Select value={String(p.porPagina)} onValueChange={(v) => p.onPorPagina(Number(v))}>
            <SelectTrigger className="h-9 w-[150px]" aria-label={t("tabela.porPaginaRotulo")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPCOES_POR_PAGINA.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {t("tabela.porPagina", { quantidade: n })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </Card>
  );
}
