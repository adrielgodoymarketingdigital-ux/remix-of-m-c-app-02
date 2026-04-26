import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, Users, TrendingUp, Eye, CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { Button } from "@/components/ui/button";
import type { Funcionario } from "@/types/funcionario";
import { useComissoes } from "@/hooks/useComissoes";
import { PerfilDesempenhoFuncionario } from "./PerfilDesempenhoFuncionario";
import { format, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DashboardEquipeProps {
  funcionarios: Funcionario[];
}

export function DashboardEquipe({ funcionarios }: DashboardEquipeProps) {
  const [mesSelecionado, setMesSelecionado] = useState(new Date());
  const { comissoes, totalComissoes, totalVendido, carregando } = useComissoes(funcionarios, mesSelecionado);
  const [perfilAberto, setPerfilAberto] = useState(false);
  const [funcionarioSelecionado, setFuncionarioSelecionado] = useState<Funcionario | null>(null);

  const abrirPerfil = (funcionarioId: string) => {
    const f = funcionarios.find(func => func.id === funcionarioId);
    if (f) {
      setFuncionarioSelecionado(f);
      setPerfilAberto(true);
    }
  };

  const mesLabel = format(mesSelecionado, "MMMM 'de' yyyy", { locale: ptBR });
  const isAtual = format(mesSelecionado, "yyyy-MM") === format(new Date(), "yyyy-MM");

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
      <div className="flex items-center justify-center gap-2">
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

      {/* Cards resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Vendido (Equipe)</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold"><ValorMonetario valor={totalVendido} /></div>
            <p className="text-xs text-muted-foreground capitalize">{mesLabel}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Comissões a Pagar</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive"><ValorMonetario valor={totalComissoes} /></div>
            <p className="text-xs text-muted-foreground capitalize">{mesLabel}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Funcionários Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{funcionarios.filter(f => f.ativo).length}</div>
            <p className="text-xs text-muted-foreground">Com vendas/OS no mês</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela por funcionário */}
      <Card>
        <CardHeader>
          <CardTitle>Desempenho por Funcionário</CardTitle>
        </CardHeader>
        <CardContent>
          {comissoes.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum dado de vendas/OS encontrado para a equipe neste mês.</p>
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
                   {comissoes.map((c) => (
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
         </CardContent>
       </Card>

       <PerfilDesempenhoFuncionario
         funcionario={funcionarioSelecionado}
         open={perfilAberto}
         onOpenChange={setPerfilAberto}
       />
     </div>
   );
}
