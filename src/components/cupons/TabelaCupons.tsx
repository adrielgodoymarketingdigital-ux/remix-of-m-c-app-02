import { Cupom } from "@/types/cupom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
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
import { useCupons } from "@/hooks/useCupons";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card } from "@/components/ui/card";

interface TabelaCuponsProps {
  cupons: Cupom[];
  loading: boolean;
  onEditar: (cupom: Cupom) => void;
}

const statusColors = {
  ativo: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  inativo: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
  expirado: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const statusLabels = {
  ativo: "Ativo",
  inativo: "Inativo",
  expirado: "Expirado",
};

export const TabelaCupons = ({ cupons, loading, onEditar }: TabelaCuponsProps) => {
  const { excluirCupom } = useCupons();
  const isMobile = useIsMobile();

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (cupons.length === 0) {
    return (
      <div className="text-center py-12 border-2 border-dashed rounded-lg">
        <p className="text-muted-foreground">Nenhum cupom cadastrado</p>
      </div>
    );
  }

  // Mobile: Card layout
  if (isMobile) {
    return (
      <div className="space-y-3">
        {cupons.map((cupom) => (
          <Card key={cupom.id} className="p-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="font-mono font-semibold text-lg">{cupom.codigo}</p>
                <p className="text-sm text-muted-foreground">{cupom.descricao || "-"}</p>
              </div>
              <Badge className={statusColors[cupom.status]}>
                {statusLabels[cupom.status]}
              </Badge>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-sm mb-3">
              <div>
                <span className="text-muted-foreground">Tipo: </span>
                <span>{cupom.tipo_desconto === "percentual" ? "Percentual" : "Valor Fixo"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Valor: </span>
                <span className="font-medium">
                  {cupom.tipo_desconto === "percentual" 
                    ? `${cupom.valor}%` 
                    : `R$ ${cupom.valor.toFixed(2)}`
                  }
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Uso: </span>
                <span>{cupom.quantidade_usada}/{cupom.quantidade_maxima_uso || "∞"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Validade: </span>
                <span>
                  {cupom.data_validade 
                    ? new Date(cupom.data_validade).toLocaleDateString() 
                    : "Sem limite"}
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => onEditar(cupom)}
              >
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="flex-1 text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir cupom?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja excluir o cupom <strong>{cupom.codigo}</strong>?
                      Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => excluirCupom(cupom.id)}
                      className="bg-destructive hover:bg-destructive/90"
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
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Uso</TableHead>
            <TableHead>Validade</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cupons.map((cupom) => (
            <TableRow key={cupom.id}>
              <TableCell className="font-mono font-semibold">
                {cupom.codigo}
              </TableCell>
              <TableCell className="max-w-xs truncate">
                {cupom.descricao || "-"}
              </TableCell>
              <TableCell>
                {cupom.tipo_desconto === "percentual" ? "Percentual" : "Valor Fixo"}
              </TableCell>
              <TableCell>
                {cupom.tipo_desconto === "percentual" 
                  ? `${cupom.valor}%` 
                  : `R$ ${cupom.valor.toFixed(2)}`
                }
              </TableCell>
              <TableCell>
                {cupom.quantidade_usada}/{cupom.quantidade_maxima_uso || "∞"}
              </TableCell>
              <TableCell>
                {cupom.data_validade 
                  ? new Date(cupom.data_validade).toLocaleDateString() 
                  : "Sem limite"}
              </TableCell>
              <TableCell>
                <Badge className={statusColors[cupom.status]}>
                  {statusLabels[cupom.status]}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEditar(cupom)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir cupom?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Tem certeza que deseja excluir o cupom <strong>{cupom.codigo}</strong>?
                          Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => excluirCupom(cupom.id)}
                          className="bg-destructive hover:bg-destructive/90"
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
};
