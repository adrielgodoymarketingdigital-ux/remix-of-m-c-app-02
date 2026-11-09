// Tabela da tela Serviços no computador (>= 1024px), com paginação no rodapé.
// Só visual: recebe a página já calculada (paginar) e os mesmos handlers de
// editar/excluir da página. A exclusão (inclusive o bloqueio quando o serviço
// está em alguma OS) continua toda em useServicos.excluirServico.
// Abaixo de 1024px a página usa a TabelaServicos de sempre.
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Pencil, Plus, SearchX, Trash2, Wrench, X } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { useOcultarValores } from "@/contexts/OcultarValoresContext";
import { cn } from "@/lib/utils";
import { lucroDoServico, OPCOES_POR_PAGINA, paginasVisiveis, type PaginaServicos } from "@/lib/servicos/listaServicosDesktop";
import type { Servico } from "@/types/servico";

interface TabelaServicosDesktopProps {
  /** Página já calculada sobre a lista filtrada (paginar). */
  pagina: PaginaServicos<Servico>;
  porPagina: number;
  onPagina: (pagina: number) => void;
  onPorPagina: (porPagina: number) => void;
  loading: boolean;
  /** Serviços no catálogo inteiro: 0 = catálogo vazio; senão a lista vazia é culpa do filtro. */
  totalCatalogo: number;
  tipoNomePorId: Record<string, string>;
  onNovoServico: () => void;
  onLimparFiltros: () => void;
  onEditar: (servico: Servico) => void;
  onExcluir: (id: string) => void;
}

const VAZIO = "-";

export function TabelaServicosDesktop(p: TabelaServicosDesktopProps) {
  const { t } = useTranslation("servicos", { keyPrefix: "telaDesktop.tabela" });
  const { t: tTopo } = useTranslation("servicos", { keyPrefix: "telaDesktop" });
  const { valoresOcultos } = useOcultarValores();
  const { pagina } = p;

  if (p.loading) {
    return (
      <Card className="space-y-3 rounded-2xl p-5 shadow-sm" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        ))}
      </Card>
    );
  }

  if (pagina.total === 0) {
    const catalogoVazio = p.totalCatalogo === 0;
    const Icone = catalogoVazio ? Wrench : SearchX;
    return (
      <Card className="flex flex-col items-center justify-center gap-3 rounded-2xl px-6 py-14 text-center shadow-sm">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
          <Icone className="h-6 w-6" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <p className="font-medium">{catalogoVazio ? t("vazioTitulo") : t("semResultadoTitulo")}</p>
          <p className="text-sm text-muted-foreground">{catalogoVazio ? t("vazioTexto") : t("semResultadoTexto")}</p>
        </div>
        {catalogoVazio ? (
          <Button onClick={p.onNovoServico} className="mt-1 gap-2">
            <Plus className="h-4 w-4" aria-hidden="true" />
            {tTopo("novoServico")}
          </Button>
        ) : (
          <Button variant="outline" onClick={p.onLimparFiltros} className="mt-1 gap-2">
            <X className="h-4 w-4" aria-hidden="true" />
            {tTopo("limparFiltros")}
          </Button>
        )}
      </Card>
    );
  }

  const corLucro = (lucro: number) =>
    valoresOcultos
      ? "bg-muted text-muted-foreground"
      : lucro < 0
        ? "bg-red-500/10 text-red-700 dark:text-red-400"
        : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";

  return (
    <Card className="overflow-hidden rounded-2xl shadow-sm">
      {/* table-fixed + larguras: só o Nome estica. Colunas fixas somam 776px; em 1280px com o
          menu aberto (974px de caixa) sobram ~198px para o Nome, que corta com reticências e
          mostra o nome inteiro na dica. Abaixo de 920px de caixa a tabela rola dentro do cartão. */}
      <Table className="min-w-[920px] table-fixed">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[104px] pl-5 pr-2">{t("colunas.codigo")}</TableHead>
            <TableHead className="px-3">{t("colunas.nome")}</TableHead>
            <TableHead className="w-[124px] px-2">{t("colunas.tipo")}</TableHead>
            <TableHead className="w-[124px] px-2">{t("colunas.peca")}</TableHead>
            <TableHead className="w-[108px] px-3 text-right">{t("colunas.custo")}</TableHead>
            <TableHead className="w-[108px] px-3 text-right">{t("colunas.preco")}</TableHead>
            <TableHead className="w-[124px] px-3 text-right">{t("colunas.lucro")}</TableHead>
            <TableHead className="w-[84px] px-2 pr-4 text-center">{t("colunas.acoes")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pagina.itens.map((servico) => {
            const tipo = servico.tipo_servico_id ? p.tipoNomePorId[servico.tipo_servico_id] : undefined;
            const lucro = lucroDoServico(servico);
            return (
              <TableRow key={servico.id}>
                <TableCell className="truncate py-3 pl-5 pr-2 font-medium" title={servico.codigo || undefined}>
                  {servico.codigo || <span className="text-muted-foreground">{VAZIO}</span>}
                </TableCell>
                <TableCell className="px-3 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <Wrench className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <span className="truncate font-medium" title={servico.nome}>
                      {servico.nome}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="px-2 py-3">
                  {tipo ? (
                    <Badge variant="outline" className="inline-block max-w-full truncate align-middle" title={tipo}>
                      {tipo}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">{VAZIO}</span>
                  )}
                </TableCell>
                <TableCell className="px-2 py-3">
                  {servico.peca_nome ? (
                    <Badge variant="secondary" className="inline-block max-w-full truncate align-middle" title={servico.peca_nome}>
                      {servico.peca_nome}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">{VAZIO}</span>
                  )}
                </TableCell>
                <TableCell className="px-3 py-3 text-right tabular-nums [overflow-wrap:anywhere]">
                  <ValorMonetario valor={servico.custo} tipo="custo" />
                </TableCell>
                <TableCell className="px-3 py-3 text-right tabular-nums [overflow-wrap:anywhere]">
                  <ValorMonetario valor={servico.preco} tipo="preco" />
                </TableCell>
                <TableCell className="px-3 py-3 text-right">
                  <span
                    className={cn(
                      "inline-block max-w-full rounded-full px-2.5 py-0.5 text-sm font-semibold tabular-nums [overflow-wrap:anywhere]",
                      corLucro(lucro),
                    )}
                  >
                    {/* Preço − custo com vazio = 0: igual às colunas Custo/Preço ao lado e ao cartão
                        Lucro Total. (A coluna gerada servicos.lucro fica vazia se um dos dois faltar.) */}
                    <ValorMonetario valor={lucro} tipo="lucro" />
                  </span>
                </TableCell>
                <TableCell className="px-2 py-3 pr-4">
                  <div className="flex items-center justify-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => p.onEditar(servico)}
                      aria-label={t("editar")}
                      title={t("editar")}
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          aria-label={t("excluir")}
                          title={t("excluir")}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t("confirmarTitulo")}</AlertDialogTitle>
                          <AlertDialogDescription>{t("confirmarTexto", { nome: servico.nome })}</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t("cancelar")}</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => p.onExcluir(servico.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {t("confirmar")}
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

      <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3">
        <p className="text-sm text-muted-foreground tabular-nums">
          {t("exibindo", { inicio: pagina.inicio, fim: pagina.fim, count: pagina.total })}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {pagina.totalPaginas > 1 && (
            <nav className="flex items-center gap-1" aria-label={t("paginacao")}>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => p.onPagina(pagina.pagina - 1)}
                disabled={pagina.pagina === 1}
                aria-label={t("anterior")}
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
                    aria-label={t("pagina", { numero: n })}
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
                aria-label={t("proxima")}
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </nav>
          )}
          <Select value={String(p.porPagina)} onValueChange={(v) => p.onPorPagina(Number(v))}>
            <SelectTrigger className="h-9 w-[150px]" aria-label={t("porPaginaRotulo")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPCOES_POR_PAGINA.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {t("porPagina", { quantidade: n })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </Card>
  );
}
