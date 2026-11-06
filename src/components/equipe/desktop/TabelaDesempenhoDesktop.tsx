import { useMemo } from "react";
import { BarChart3, ChevronLeft, ChevronRight, Download, Eye, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import type { ComissaoFuncionario } from "@/hooks/useComissoes";
import type { Funcionario } from "@/types/funcionario";
import { cn } from "@/lib/utils";

/**
 * Tabela "Desempenho por Funcionário" no computador (>= 1024px). Só apresentação:
 * busca, filtro, paginação e exportação continuam no DashboardEquipe, que passa
 * o estado e as ações prontos. E-mail e status vêm da mesma lista `funcionarios`
 * que a aba Funcionários já mostra (sem consulta nova).
 */

interface TabelaDesempenhoDesktopProps {
  funcionarios: Funcionario[];
  /** Lista do mês, sem filtro (decide o estado vazio e se a busca aparece). */
  comissoes: ComissaoFuncionario[];
  comissoesFiltradas: ComissaoFuncionario[];
  linhasExibidas: ComissaoFuncionario[];
  busca: string;
  onBuscaChange: (valor: string) => void;
  onExportar: () => void;
  onAbrirPerfil: (funcionarioId: string) => void;
  opcoesPorPagina: readonly number[];
  itensPorPagina: number;
  onItensPorPaginaChange: (valor: number) => void;
  paginaAtual: number;
  totalPaginas: number;
  inicio: number;
  onPaginaAnterior: () => void;
  onProximaPagina: () => void;
}

const inicial = (nome: string) => nome.trim().charAt(0).toLocaleUpperCase("pt-BR") || "?";

function EstadoVazio({ texto }: { texto: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <BarChart3 className="h-6 w-6 text-muted-foreground" />
      </span>
      <p className="max-w-sm text-sm text-muted-foreground">{texto}</p>
    </div>
  );
}

export function TabelaDesempenhoDesktop({
  funcionarios,
  comissoes,
  comissoesFiltradas,
  linhasExibidas,
  busca,
  onBuscaChange,
  onExportar,
  onAbrirPerfil,
  opcoesPorPagina,
  itensPorPagina,
  onItensPorPaginaChange,
  paginaAtual,
  totalPaginas,
  inicio,
  onPaginaAnterior,
  onProximaPagina,
}: TabelaDesempenhoDesktopProps) {
  const porId = useMemo(() => new Map(funcionarios.map((f) => [f.id, f])), [funcionarios]);

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="min-w-0 space-y-1.5">
          <CardTitle>Desempenho por Funcionário</CardTitle>
          <CardDescription>Acompanhe as vendas, ordens de serviço e comissões da sua equipe.</CardDescription>
        </div>
        {comissoes.length > 0 && (
          <div className="flex shrink-0 items-center gap-2">
            <div className="relative w-64 xl:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar funcionário..."
                aria-label="Buscar funcionário"
                value={busca}
                onChange={(e) => onBuscaChange(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="outline" size="icon" onClick={onExportar} title="Exportar" aria-label="Exportar">
              <Download className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {comissoes.length === 0 ? (
          <EstadoVazio texto="Nenhum dado de vendas/OS encontrado para a equipe neste mês." />
        ) : comissoesFiltradas.length === 0 ? (
          <EstadoVazio texto="Nenhum funcionário encontrado. Tente ajustar a busca ou os filtros." />
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <Table className="[&_td]:px-3 [&_th]:px-3">
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead className="text-center">Vendas</TableHead>
                  <TableHead className="text-center">OS</TableHead>
                  <TableHead className="text-right">Total Vendido</TableHead>
                  <TableHead className="text-right">Comissão</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhasExibidas.map((c) => {
                  const f = porId.get(c.funcionarioId);
                  return (
                    <TableRow key={c.funcionarioId}>
                      <TableCell>
                        <div className="flex w-[11rem] items-center gap-3 xl:w-[12rem] 2xl:w-[18rem]">
                          <span
                            aria-hidden="true"
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary"
                          >
                            {inicial(c.nome)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium" title={c.nome}>{c.nome}</p>
                            {f?.email && (
                              <p className="truncate text-xs text-muted-foreground" title={f.email}>{f.email}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {c.cargo ? (
                          <div className="flex max-w-[7.5rem] flex-wrap gap-1">
                            {c.cargo.split(",").map((cg) => (
                              <Badge
                                key={cg.trim()}
                                variant="secondary"
                                className="whitespace-nowrap bg-primary/10 text-xs text-primary hover:bg-primary/10"
                              >
                                {cg.trim()}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center tabular-nums">{c.quantidadeVendas}</TableCell>
                      <TableCell className="text-center tabular-nums">{c.quantidadeOS}</TableCell>
                      <TableCell className="whitespace-nowrap text-right font-medium tabular-nums">
                        <ValorMonetario valor={c.totalVendas} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">
                        {c.comissaoCalculada > 0 ? (
                          <div>
                            <span className="font-bold text-primary"><ValorMonetario valor={c.comissaoCalculada} /></span>
                            {c.detalhePorCargo && c.detalhePorCargo.length > 1 && (
                              <div className="mt-1 space-y-0.5">
                                {c.detalhePorCargo.map((d, i) => (
                                  <p key={i} className="text-xs text-muted-foreground">
                                    {d.cargo}: <ValorMonetario valor={d.comissao} />
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        {f ? (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold",
                              f.ativo
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                            {f.ativo ? "Ativo" : "Inativo"}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => onAbrirPerfil(c.funcionarioId)}
                          title="Ver desempenho"
                          aria-label={`Ver desempenho de ${c.nome}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {comissoesFiltradas.length > 0 && (
          <div className="flex items-center justify-between gap-3 pt-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>Mostrando</span>
              <Select value={String(itensPorPagina)} onValueChange={(v) => onItensPorPaginaChange(Number(v))}>
                <SelectTrigger className="h-9 w-[76px]" aria-label="Itens por página">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {opcoesPorPagina.map((opcao) => (
                    <SelectItem key={opcao} value={String(opcao)}>{opcao}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span>por página</span>
            </div>

            <div className="flex items-center gap-4">
              <span className="tabular-nums">
                {inicio + 1}-{Math.min(inicio + itensPorPagina, comissoesFiltradas.length)} de {comissoesFiltradas.length}
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={onPaginaAnterior}
                  disabled={paginaAtual === 1}
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span
                  aria-current="page"
                  className="flex h-9 min-w-9 items-center justify-center rounded-md bg-primary px-2 text-sm font-semibold text-primary-foreground tabular-nums"
                >
                  {paginaAtual}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={onProximaPagina}
                  disabled={paginaAtual === totalPaginas}
                  aria-label="Próxima página"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Esqueleto no formato da tabela: cabeçalho com busca e 5 linhas com avatar. */
export function EsqueletoTabelaDesempenhoDesktop() {
  return (
    <Card className="shadow-sm" aria-hidden="true">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-2">
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-64 xl:w-72" />
          <Skeleton className="h-10 w-10" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-lg border">
          <Skeleton className="h-12 rounded-none" />
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 border-t px-4 py-3">
              <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-8 w-8" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
