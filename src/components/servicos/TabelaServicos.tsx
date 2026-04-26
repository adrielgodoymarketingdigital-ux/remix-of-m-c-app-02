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
import { Servico } from "@/types/servico";
import { formatCurrency } from "@/lib/formatters";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { useIsMobile } from "@/hooks/use-mobile";

interface TabelaServicosProps {
  servicos: Servico[];
  onEditar: (servico: Servico) => void;
  onExcluir: (id: string) => void;
}

export function TabelaServicos({
  servicos,
  onEditar,
  onExcluir,
}: TabelaServicosProps) {
  const isMobile = useIsMobile();

  if (servicos.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg">Nenhum serviço cadastrado</p>
        <p className="text-sm mt-2">
          Clique em "Novo Serviço" para começar
        </p>
      </div>
    );
  }

  // Mobile: Card-based layout
  if (isMobile) {
    return (
      <div className="space-y-3">
        {servicos.map((servico) => (
          <Card key={servico.id} className="p-4">
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1">
                <p className="font-medium">{servico.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {servico.codigo || "-"}
                </p>
              </div>
              {servico.peca_nome && (
                <Badge variant="secondary" className="text-xs">{servico.peca_nome}</Badge>
              )}
            </div>
            
            <div className="grid grid-cols-3 gap-2 text-sm mb-3">
              <div>
                <span className="text-muted-foreground text-xs">Custo</span>
                <p><ValorMonetario valor={servico.custo} tipo="custo" /></p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Preço</span>
                <p className="font-medium"><ValorMonetario valor={servico.preco} tipo="preco" /></p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Lucro</span>
                <p className={`font-semibold ${servico.lucro >= 0 ? "text-green-600" : "text-red-600"}`}>
                  <ValorMonetario valor={servico.lucro} />
                </p>
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-2 pt-3 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEditar(servico)}
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
                      Excluir o serviço "{servico.nome}"?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                    <AlertDialogCancel className="w-full sm:w-auto">Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onExcluir(servico.id)}
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
            <TableHead>Código</TableHead>
            <TableHead>Nome</TableHead>
            <TableHead>Peça Vinculada</TableHead>
            <TableHead className="text-right">Custo</TableHead>
            <TableHead className="text-right">Preço</TableHead>
            <TableHead className="text-right">Lucro</TableHead>
            <TableHead className="text-center w-[100px]">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {servicos.map((servico) => (
            <TableRow key={servico.id}>
              <TableCell className="font-medium">
                {servico.codigo || "-"}
              </TableCell>
              <TableCell>{servico.nome}</TableCell>
              <TableCell>
                {servico.peca_nome ? (
                  <Badge variant="secondary">{servico.peca_nome}</Badge>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <ValorMonetario valor={servico.custo} tipo="custo" />
              </TableCell>
              <TableCell className="text-right">
                <ValorMonetario valor={servico.preco} tipo="preco" />
              </TableCell>
              <TableCell className="text-right">
                <span
                  className={
                    servico.lucro >= 0 ? "text-green-600" : "text-red-600"
                  }
                >
                  <ValorMonetario valor={servico.lucro} tipo="lucro" />
                </span>
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEditar(servico)}
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
                          Tem certeza que deseja excluir o serviço "{servico.nome}"?
                          Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => onExcluir(servico.id)}
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
