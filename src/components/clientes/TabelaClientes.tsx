import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { Pencil, Trash2, Eye, Cake } from "lucide-react";
import { Cliente } from "@/types/cliente";
import { formatCPF, formatPhone } from "@/lib/formatters";
import { useIsMobile } from "@/hooks/use-mobile";
import { isAniversarioHoje, isAniversarioEsteMes, formatarDiaAniversario } from "@/hooks/useAniversariantes";

interface TabelaClientesProps {
  clientes: Cliente[];
  onEditar: (cliente: Cliente) => void;
  onExcluir: (id: string) => void;
  onVerHistorico: (cliente: Cliente) => void;
}

export function TabelaClientes({
  clientes,
  onEditar,
  onExcluir,
  onVerHistorico,
}: TabelaClientesProps) {
  const isMobile = useIsMobile();

  if (clientes.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhum cliente cadastrado
      </div>
    );
  }

  // Mobile: Card-based layout
  if (isMobile) {
    return (
      <div className="space-y-3">
        {clientes.map((cliente) => (
          <Card key={cliente.id} className="p-4">
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{cliente.nome}</p>
                  {isAniversarioHoje(cliente.data_nascimento) && (
                    <span className="inline-flex items-center text-amber-500" title="Aniversário hoje!">
                      🎂
                    </span>
                  )}
                  {isAniversarioEsteMes(cliente.data_nascimento) && !isAniversarioHoje(cliente.data_nascimento) && (
                    <span className="text-xs text-muted-foreground" title="Aniversário este mês">
                      🎈 {formatarDiaAniversario(cliente.data_nascimento)}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{formatPhone(cliente.telefone)}</p>
              </div>
            </div>
            
            <div className="text-sm space-y-1 mb-3">
              {cliente.cpf && <p className="text-muted-foreground">CPF: {formatCPF(cliente.cpf)}</p>}
              {cliente.endereco && (
                <p className="text-muted-foreground truncate">{cliente.endereco}</p>
              )}
            </div>
            
            <div className="flex items-center justify-end gap-2 pt-3 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onVerHistorico(cliente)}
                className="h-9"
              >
                <Eye className="h-4 w-4 mr-1" />
                Histórico
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEditar(cliente)}
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
                      Tem certeza que deseja excluir o cliente "{cliente.nome}"?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                    <AlertDialogCancel className="w-full sm:w-auto">Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onExcluir(cliente.id)}
                      className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  // Desktop: Table layout
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>CPF</TableHead>
            <TableHead>Telefone</TableHead>
            <TableHead>Endereço</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clientes.map((cliente) => (
            <TableRow key={cliente.id}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  {cliente.nome}
                  {isAniversarioHoje(cliente.data_nascimento) && (
                    <span className="inline-flex items-center text-amber-500" title="Aniversário hoje!">
                      🎂
                    </span>
                  )}
                  {isAniversarioEsteMes(cliente.data_nascimento) && !isAniversarioHoje(cliente.data_nascimento) && (
                    <span className="text-xs text-muted-foreground" title="Aniversário este mês">
                      🎈 {formatarDiaAniversario(cliente.data_nascimento)}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell>{formatCPF(cliente.cpf)}</TableCell>
              <TableCell>{formatPhone(cliente.telefone)}</TableCell>
              <TableCell className="max-w-[200px] truncate">
                {cliente.endereco || "-"}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onVerHistorico(cliente)}
                    title="Ver histórico"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEditar(cliente)}
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
                          Tem certeza que deseja excluir o cliente "{cliente.nome}"?
                          Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => onExcluir(cliente.id)}
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
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
