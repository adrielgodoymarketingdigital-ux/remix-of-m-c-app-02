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
import { Pencil, Trash2 } from "lucide-react";
import { Fornecedor } from "@/types/fornecedor";
import { useIsMobile } from "@/hooks/use-mobile";

interface TabelaFornecedoresProps {
  fornecedores: Fornecedor[];
  onEditar: (fornecedor: Fornecedor) => void;
  onExcluir: (id: string) => void;
}

export function TabelaFornecedores({
  fornecedores,
  onEditar,
  onExcluir,
}: TabelaFornecedoresProps) {
  const isMobile = useIsMobile();

  if (fornecedores.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhum fornecedor cadastrado
      </div>
    );
  }

  // Mobile: Card-based layout
  if (isMobile) {
    return (
      <div className="space-y-3">
        {fornecedores.map((fornecedor) => (
          <Card key={fornecedor.id} className="p-4">
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1">
                <p className="font-medium">{fornecedor.nome}</p>
                {fornecedor.nome_fantasia && (
                  <p className="text-sm text-muted-foreground">{fornecedor.nome_fantasia}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {fornecedor.tipo === "juridica" ? "PJ" : "PF"}
                </Badge>
                <Badge variant={fornecedor.ativo ? "default" : "secondary"}>
                  {fornecedor.ativo ? "Ativo" : "Inativo"}
                </Badge>
              </div>
            </div>
            
            <div className="text-sm space-y-1 mb-3">
              <p className="text-muted-foreground">
                {fornecedor.cnpj || fornecedor.cpf || "-"}
              </p>
              {(fornecedor.telefone || fornecedor.celular) && (
                <p>{fornecedor.telefone || fornecedor.celular}</p>
              )}
              {fornecedor.cidade && fornecedor.estado && (
                <p className="text-muted-foreground">{fornecedor.cidade}/{fornecedor.estado}</p>
              )}
            </div>
            
            <div className="flex items-center justify-end gap-2 pt-3 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEditar(fornecedor)}
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
                      Excluir o fornecedor "{fornecedor.nome}"?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                    <AlertDialogCancel className="w-full sm:w-auto">Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onExcluir(fornecedor.id)}
                      className="w-full sm:w-auto bg-destructive text-destructive-foreground"
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
            <TableHead>Tipo</TableHead>
            <TableHead>Documento</TableHead>
            <TableHead>Contato</TableHead>
            <TableHead>Cidade/UF</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fornecedores.map((fornecedor) => (
            <TableRow key={fornecedor.id}>
              <TableCell>
                <div>
                  <p className="font-medium">{fornecedor.nome}</p>
                  {fornecedor.nome_fantasia && (
                    <p className="text-sm text-muted-foreground">
                      {fornecedor.nome_fantasia}
                    </p>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline">
                  {fornecedor.tipo === "juridica" ? "PJ" : "PF"}
                </Badge>
              </TableCell>
              <TableCell>
                <p className="text-sm">
                  {fornecedor.cnpj || fornecedor.cpf || "-"}
                </p>
              </TableCell>
              <TableCell>
                <div className="text-sm">
                  {fornecedor.telefone && <p>{fornecedor.telefone}</p>}
                  {fornecedor.celular && <p>{fornecedor.celular}</p>}
                  {fornecedor.email && (
                    <p className="text-muted-foreground">{fornecedor.email}</p>
                  )}
                  {!fornecedor.telefone && !fornecedor.celular && !fornecedor.email && "-"}
                </div>
              </TableCell>
              <TableCell>
                {fornecedor.cidade && fornecedor.estado
                  ? `${fornecedor.cidade}/${fornecedor.estado}`
                  : fornecedor.cidade || fornecedor.estado || "-"}
              </TableCell>
              <TableCell>
                <Badge variant={fornecedor.ativo ? "default" : "secondary"}>
                  {fornecedor.ativo ? "Ativo" : "Inativo"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEditar(fornecedor)}
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
                          Tem certeza que deseja excluir o fornecedor "{fornecedor.nome}"?
                          Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => onExcluir(fornecedor.id)}
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
