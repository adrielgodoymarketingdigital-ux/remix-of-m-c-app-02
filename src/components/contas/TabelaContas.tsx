import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
import { Pencil, Trash2, CheckCircle } from "lucide-react";
import { Conta } from "@/types/conta";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useIsMobile } from "@/hooks/use-mobile";
import { ValorMonetario } from "@/components/ui/valor-monetario";

interface TabelaContasProps {
  contas: Conta[];
  onEditar: (conta: Conta) => void;
  onExcluir: (id: string) => void;
  onMarcarComoPaga: (id: string, tipo: 'pagar' | 'receber') => void;
  contasSelecionadas: string[];
  onToggleSelecao: (id: string) => void;
  onToggleTodas: () => void;
}

export function TabelaContas({
  contas,
  onEditar,
  onExcluir,
  onMarcarComoPaga,
  contasSelecionadas,
  onToggleSelecao,
  onToggleTodas,
}: TabelaContasProps) {
  const isMobile = useIsMobile();

  const contasPendentes = contas.filter(c => c.status === "pendente");
  const todasPendentesSelecionadas = contasPendentes.length > 0 && contasPendentes.every(c => contasSelecionadas.includes(c.id));

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pago":
        return <Badge variant="default">Pago</Badge>;
      case "recebido":
        return <Badge variant="default">Recebido</Badge>;
      case "pendente":
        return <Badge variant="secondary">Pendente</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTipoBadge = (tipo: string) => {
    return tipo === "pagar" ? (
      <Badge variant="destructive">A Pagar</Badge>
    ) : (
      <Badge className="bg-green-600">A Receber</Badge>
    );
  };

  if (contas.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhuma conta cadastrada
      </div>
    );
  }

  // Mobile: Card-based layout
  if (isMobile) {
    return (
      <div className="space-y-3">
        {contas.map((conta) => {
          const dataVencimento = conta.data_vencimento ? new Date(conta.data_vencimento) : (conta.os_numero ? null : new Date(conta.data));
          const hoje = new Date();
          const vencida = dataVencimento ? dataVencimento < hoje && conta.status === "pendente" : false;
          const selecionada = contasSelecionadas.includes(conta.id);

          return (
            <Card key={conta.id} className={`p-4 ${vencida ? "border-red-300 bg-red-50/50 dark:bg-red-950/20" : ""} ${selecionada ? "ring-2 ring-primary" : ""}`}>
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-start gap-3 flex-1">
                  {conta.status === "pendente" && (
                    <Checkbox
                      checked={selecionada}
                      onCheckedChange={() => onToggleSelecao(conta.id)}
                      className="mt-1"
                    />
                  )}
                  <div className="flex-1">
                    <p className="font-medium">{conta.nome}</p>
                    {conta.recorrente && (
                      <p className="text-xs text-muted-foreground">🔄 Recorrente</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getTipoBadge(conta.tipo)}
                  {getStatusBadge(conta.status)}
                </div>
              </div>
              
              <div className="text-sm mb-3 space-y-2">
                {(conta.valor_pago != null && conta.valor_pago > 0) ? (
                  <div className="rounded-lg border p-3 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Total da OS:</span>
                      <span className="font-semibold"><ValorMonetario valor={conta.valor + conta.valor_pago} /></span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-green-600">✓ Entrada paga:</span>
                      <span className="font-semibold text-green-600"><ValorMonetario valor={conta.valor_pago} /></span>
                    </div>
                    <div className="border-t pt-1.5 flex justify-between items-center">
                      {conta.status === 'recebido' ? (
                        <>
                          <span className="text-green-600 font-medium">✓ Restante recebido:</span>
                          <span className="font-bold text-green-600"><ValorMonetario valor={conta.valor} /></span>
                        </>
                      ) : (
                        <>
                          <span className="text-orange-600 font-medium">Falta receber:</span>
                          <span className="font-bold text-orange-600"><ValorMonetario valor={conta.valor} /></span>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Valor:</span>
                    <span className="font-semibold"><ValorMonetario valor={conta.valor} /></span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Vencimento:</span>
                  <span className={vencida ? "text-red-600 font-medium" : ""}>
                    {conta.data_vencimento ? formatDate(conta.data_vencimento) : (conta.os_numero ? "Sem prazo" : formatDate(conta.data))}
                  </span>
                </div>
                {conta.os_numero && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">OS:</span>
                    <span className="font-medium">{conta.os_numero}</span>
                  </div>
                )}
                {conta.categoria && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Categoria:</span>
                    <span>{conta.categoria}</span>
                  </div>
                )}
              </div>
              
              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                {conta.status === "pendente" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onMarcarComoPaga(conta.id, conta.tipo)}
                    className="h-9 text-green-600"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    {conta.tipo === 'pagar' ? 'Pagar' : 'Receber'}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEditar(conta)}
                  className="h-9"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-9">
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
            </Card>
          );
        })}
      </div>
    );
  }

  // Desktop: Table layout
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={todasPendentesSelecionadas}
                onCheckedChange={onToggleTodas}
              />
            </TableHead>
            <TableHead>Nome</TableHead>
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
              <TableRow key={conta.id} className={`${vencida ? "bg-red-50 dark:bg-red-950/20" : ""} ${selecionada ? "bg-primary/5" : ""}`}>
                <TableCell>
                  {conta.status === "pendente" ? (
                    <Checkbox
                      checked={selecionada}
                      onCheckedChange={() => onToggleSelecao(conta.id)}
                    />
                  ) : (
                    <div className="w-5" />
                  )}
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium">{conta.nome}</p>
                    {conta.recorrente && (
                      <p className="text-xs text-muted-foreground">🔄 Recorrente</p>
                    )}
                  </div>
                </TableCell>
                <TableCell>{getTipoBadge(conta.tipo)}</TableCell>
                <TableCell>{conta.categoria || "-"}</TableCell>
                <TableCell>
                  {(conta.valor_pago != null && conta.valor_pago > 0) ? (
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground">Total: <span className="font-medium text-foreground"><ValorMonetario valor={conta.valor + conta.valor_pago} /></span></p>
                      <p className="text-xs text-green-600">✓ Entrada: <ValorMonetario valor={conta.valor_pago} /></p>
                      {conta.status === 'recebido' ? (
                        <p className="font-semibold text-green-600">✓ Restante: <ValorMonetario valor={conta.valor} /></p>
                      ) : (
                        <p className="font-semibold text-orange-600">Falta: <ValorMonetario valor={conta.valor} /></p>
                      )}
                    </div>
                  ) : (
                    <p className="font-semibold"><ValorMonetario valor={conta.valor} /></p>
                  )}
                </TableCell>
                <TableCell>
                  <div>
                    <p>{conta.data_vencimento ? formatDate(conta.data_vencimento) : (conta.os_numero ? "Sem prazo" : formatDate(conta.data))}</p>
                    {vencida && (
                      <p className="text-xs text-red-600 font-medium">Vencida</p>
                    )}
                  </div>
                </TableCell>
                <TableCell>{getStatusBadge(conta.status)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {conta.status === "pendente" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onMarcarComoPaga(conta.id, conta.tipo)}
                        title={conta.tipo === 'pagar' ? 'Marcar como pago' : 'Marcar como recebido'}
                      >
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEditar(conta)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
    </div>
  );
}
