import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DollarSign, Users, TrendingUp, Eye, CalendarIcon, ChevronLeft, ChevronRight,
  Search, SlidersHorizontal, Download, ArrowUpRight, ArrowDownRight, Info,
} from "lucide-react";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { Button } from "@/components/ui/button";
import type { Funcionario } from "@/types/funcionario";
import { useComissoes, useComissoesSerieMensal } from "@/hooks/useComissoes";
import { PerfilDesempenhoFuncionario } from "./PerfilDesempenhoFuncionario";
import { format, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { useIsMobileOrTablet } from "@/hooks/use-mobile";
import { calcularVariacaoPercentual } from "@/lib/variacaoPercentual";
import { Sparkline } from "@/components/dashboard/Sparkline";

interface DashboardEquipeProps {
  funcionarios: Funcionario[];
}

type FiltroCargo = "todos" | string;

const ITENS_POR_PAGINA_OPCOES = [10, 25, 50] as const;

export function DashboardEquipe({ funcionarios }: DashboardEquipeProps) {
  const [mesSelecionado, setMesSelecionado] = useState(new Date());
  const { comissoes, totalComissoes, totalVendido, carregando } = useComissoes(funcionarios, mesSelecionado);
  const { serieMensal } = useComissoesSerieMensal(funcionarios, mesSelecionado, 6);
  const [perfilAberto, setPerfilAberto] = useState(false);
  const [funcionarioSelecionado, setFuncionarioSelecionado] = useState<Funcionario | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroCargo, setFiltroCargo] = useState<FiltroCargo>("todos");
  const [pagina, setPagina] = useState(1);
  const [itensPorPagina, setItensPorPagina] = useState<number>(10);
  const isMobileOrTablet = useIsMobileOrTablet();

  const cargosDisponiveis = useMemo(() => {
    const cargos = new Set<string>();
    comissoes.forEach((c) => {
      c.cargo?.split(",").forEach((cg) => {
        const trimmed = cg.trim();
        if (trimmed) cargos.add(trimmed);
      });
    });
    return Array.from(cargos).sort();
  }, [comissoes]);

  const comissoesFiltradas = useMemo(() => {
    const buscaLower = busca.trim().toLowerCase();
    return comissoes.filter((c) => {
      const matchBusca = !buscaLower || c.nome.toLowerCase().includes(buscaLower);
      const matchCargo = filtroCargo === "todos" || (c.cargo?.split(",").map(cg => cg.trim()).includes(filtroCargo) ?? false);
      return matchBusca && matchCargo;
    });
  }, [comissoes, busca, filtroCargo]);

  // Volta para página 1 quando busca, filtro, mês ou a lista original mudam
  useEffect(() => { setPagina(1); }, [busca, filtroCargo, comissoes]);

  const totalPaginas = Math.max(1, Math.ceil(comissoesFiltradas.length / itensPorPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const inicio = (paginaAtual - 1) * itensPorPagina;
  // Paginação é exclusiva da versão desktop (busca/filtros/rodapé usam
  // `hidden lg:flex`), igual ao padrão de TabelaFuncionarios.tsx. Em mobile
  // a tabela mostra a lista completa, preservando o comportamento anterior.
  const linhasExibidas = isMobileOrTablet
    ? comissoes
    : comissoesFiltradas.slice(inicio, inicio + itensPorPagina);

  const abrirPerfil = (funcionarioId: string) => {
    const f = funcionarios.find(func => func.id === funcionarioId);
    if (f) {
      setFuncionarioSelecionado(f);
      setPerfilAberto(true);
    }
  };

  const mesLabel = format(mesSelecionado, "MMMM 'de' yyyy", { locale: ptBR });
  const isAtual = format(mesSelecionado, "yyyy-MM") === format(new Date(), "yyyy-MM");
  const mesAnteriorLabel = format(subMonths(mesSelecionado, 1), "MMMM 'de' yyyy", { locale: ptBR });

  // Últimos 6 pontos de serieMensal: [5 meses atrás, ..., mês anterior, mês selecionado]
  const pontoMesAnterior = serieMensal.length >= 2 ? serieMensal[serieMensal.length - 2] : undefined;
  const variacaoTotalVendido = calcularVariacaoPercentual(totalVendido, pontoMesAnterior?.totalVendido ?? 0);
  const variacaoTotalComissoes = calcularVariacaoPercentual(totalComissoes, pontoMesAnterior?.totalComissoes ?? 0);
  const sparklineTotalVendido = serieMensal.map((p) => p.totalVendido);
  const sparklineTotalComissoes = serieMensal.map((p) => p.totalComissoes);

  const exportarDesempenho = () => {
    if (comissoesFiltradas.length === 0) {
      toast.error("Nenhum dado para exportar");
      return;
    }
    const dados = comissoesFiltradas.map((c) => ({
      Funcionário: c.nome,
      Cargo: c.cargo || "—",
      Vendas: c.quantidadeVendas,
      OS: c.quantidadeOS,
      "Total Vendido": c.totalVendas,
      Comissão: c.comissaoCalculada,
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(dados);
    XLSX.utils.book_append_sheet(wb, ws, "Desempenho");
    const mesRef = format(mesSelecionado, "yyyy-MM");
    XLSX.writeFile(wb, `desempenho-equipe-${mesRef}.xlsx`);
    toast.success("Exportação concluída!");
  };

  if (carregando) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filtro de mês */}
      <div className="flex items-center justify-center lg:justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setMesSelecionado(prev => subMonths(prev, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 px-4 py-2 rounded-md border bg-background min-w-[200px] justify-center">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium capitalize">{mesLabel}</span>
          </div>
          <Button variant="outline" size="icon" disabled={isAtual} onClick={() => setMesSelecionado(prev => addMonths(prev, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isAtual && (
            <Button variant="ghost" size="sm" onClick={() => setMesSelecionado(new Date())}>
              Mês atual
            </Button>
          )}
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="hidden lg:flex gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              Filtros
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56 space-y-2">
            <p className="text-sm font-medium">Cargo</p>
            <Select value={filtroCargo} onValueChange={setFiltroCargo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {cargosDisponiveis.map((cargo) => (
                  <SelectItem key={cargo} value={cargo}>{cargo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </PopoverContent>
        </Popover>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Vendido (Equipe)</CardTitle>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
              <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-300" />
            </span>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="text-2xl font-bold"><ValorMonetario valor={totalVendido} /></div>
                <p className="text-xs text-muted-foreground capitalize">{mesLabel}</p>
                <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${variacaoTotalVendido >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                  {variacaoTotalVendido >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {Math.abs(variacaoTotalVendido).toFixed(1)}% <span className="capitalize">vs {mesAnteriorLabel}</span>
                </span>
              </div>
              {sparklineTotalVendido.length > 0 && (
                <div className="w-20 shrink-0">
                  <Sparkline dados={sparklineTotalVendido} cor="#3b82f6" altura={40} destacarUltimoPonto />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-1.5">
              <CardTitle className="text-sm font-medium">Comissões a Pagar</CardTitle>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    title="Como este valor é calculado"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-80 text-xs leading-relaxed" align="start">
                  Cada OS entra com a comissão calculada <strong>no momento em que foi salva</strong>
                  {" "}(por tipo de serviço, item a item). Por isso o total de um mês anterior pode
                  mudar se uma OS daquele período for <strong>entregue</strong> ou <strong>editada</strong>
                  {" "}depois. O detalhamento por técnico está no botão <span className="font-medium">Perfil</span>.
                </PopoverContent>
              </Popover>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
              <DollarSign className="h-4 w-4 text-red-600 dark:text-red-300" />
            </span>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="text-2xl font-bold text-destructive"><ValorMonetario valor={totalComissoes} /></div>
                <p className="text-xs text-muted-foreground capitalize">{mesLabel}</p>
                <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${variacaoTotalComissoes >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                  {variacaoTotalComissoes >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {Math.abs(variacaoTotalComissoes).toFixed(1)}% <span className="capitalize">vs {mesAnteriorLabel}</span>
                </span>
              </div>
              {sparklineTotalComissoes.length > 0 && (
                <div className="w-20 shrink-0">
                  <Sparkline dados={sparklineTotalComissoes} cor="#ef4444" altura={40} destacarUltimoPonto />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Funcionários Ativos</CardTitle>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
              <Users className="h-4 w-4 text-green-600 dark:text-green-300" />
            </span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{funcionarios.filter(f => f.ativo).length}</div>
            <p className="text-xs text-muted-foreground">Com vendas/OS no mês</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela por funcionário */}
      <Card>
        <CardHeader className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <CardTitle>Desempenho por Funcionário</CardTitle>
          {comissoes.length > 0 && (
            <div className="hidden lg:flex lg:items-center gap-2">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar funcionário..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button variant="outline" size="icon" onClick={exportarDesempenho} title="Exportar">
                <Download className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {comissoes.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum dado de vendas/OS encontrado para a equipe neste mês.</p>
          ) : comissoesFiltradas.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum funcionário encontrado. Tente ajustar a busca ou os filtros.</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead className="text-right">Vendas</TableHead>
                    <TableHead className="text-right">OS</TableHead>
                    <TableHead className="text-right">Total Vendido</TableHead>
                     <TableHead className="text-right">Comissão</TableHead>
                     <TableHead className="text-right">Perfil</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {linhasExibidas.map((c) => (
                     <TableRow key={c.funcionarioId}>
                       <TableCell className="font-medium">{c.nome}</TableCell>
                       <TableCell>
                         {c.cargo ? (
                           <div className="flex flex-wrap gap-1">
                             {c.cargo.split(",").map(cg => (
                               <Badge key={cg.trim()} variant="outline" className="text-xs">{cg.trim()}</Badge>
                             ))}
                           </div>
                         ) : <span className="text-muted-foreground">—</span>}
                       </TableCell>
                       <TableCell className="text-right">{c.quantidadeVendas}</TableCell>
                       <TableCell className="text-right">{c.quantidadeOS}</TableCell>
                       <TableCell className="text-right font-medium"><ValorMonetario valor={c.totalVendas} /></TableCell>
                       <TableCell className="text-right">
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
                       <TableCell className="text-right">
                         <Button variant="ghost" size="sm" onClick={() => abrirPerfil(c.funcionarioId)}>
                           <Eye className="h-4 w-4" />
                         </Button>
                       </TableCell>
                     </TableRow>
                   ))}
                 </TableBody>
               </Table>
             </div>
           )}

          {comissoesFiltradas.length > 0 && (
            <div className="hidden lg:flex lg:items-center lg:justify-between gap-3 pt-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <span>Mostrando</span>
                <Select
                  value={String(itensPorPagina)}
                  onValueChange={(v) => setItensPorPagina(Number(v))}
                >
                  <SelectTrigger className="h-8 w-[70px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ITENS_POR_PAGINA_OPCOES.map((opcao) => (
                      <SelectItem key={opcao} value={String(opcao)}>{opcao}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span>por página</span>
              </div>

              <span>
                {inicio + 1}-{Math.min(inicio + itensPorPagina, comissoesFiltradas.length)} de {comissoesFiltradas.length}
              </span>

              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPagina((p) => Math.max(1, p - 1))}
                  disabled={paginaAtual === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="flex items-center justify-center h-8 min-w-8 px-2 rounded-md bg-primary text-primary-foreground text-sm font-medium">
                  {paginaAtual}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                  disabled={paginaAtual === totalPaginas}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
         </CardContent>
       </Card>

       <PerfilDesempenhoFuncionario
         funcionario={funcionarioSelecionado}
         open={perfilAberto}
         onOpenChange={setPerfilAberto}
         mesReferencia={mesSelecionado}
       />
     </div>
   );
}
