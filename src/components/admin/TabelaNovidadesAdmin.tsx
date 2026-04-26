import { Novidade } from "@/types/novidade";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MoreHorizontal, Pencil, Copy, Trash2, Image as ImageIcon } from "lucide-react";
import { useState } from "react";

interface TabelaNovidadesAdminProps {
  novidades: Novidade[];
  onEditar: (novidade: Novidade) => void;
  onDuplicar: (novidade: Novidade) => void;
  onExcluir: (id: string) => void;
  onToggleAtivo: (id: string, ativo: boolean) => void;
}

export function TabelaNovidadesAdmin({ 
  novidades, 
  onEditar, 
  onDuplicar, 
  onExcluir,
  onToggleAtivo 
}: TabelaNovidadesAdminProps) {
  const [novidadeParaExcluir, setNovidadeParaExcluir] = useState<string | null>(null);

  const getStatusBadge = (novidade: Novidade) => {
    const agora = new Date();
    const inicio = new Date(novidade.data_inicio);
    const fim = novidade.data_fim ? new Date(novidade.data_fim) : null;

    if (!novidade.ativo) {
      return <Badge variant="secondary">Rascunho</Badge>;
    }
    if (inicio > agora) {
      return <Badge variant="outline" className="text-orange-600 border-orange-600">Agendado</Badge>;
    }
    if (fim && fim < agora) {
      return <Badge variant="outline" className="text-red-600 border-red-600">Expirado</Badge>;
    }
    return <Badge className="bg-green-600">Publicado</Badge>;
  };

  if (novidades.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Nenhuma novidade cadastrada
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Ativo</TableHead>
              <TableHead className="w-16">Thumb</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Seções</TableHead>
              <TableHead>Público</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {novidades.map((novidade) => (
              <TableRow key={novidade.id}>
                <TableCell>
                  <Switch
                    checked={novidade.ativo}
                    onCheckedChange={(checked) => onToggleAtivo(novidade.id, checked)}
                  />
                </TableCell>
                <TableCell>
                  {novidade.thumbnail_url ? (
                    <img 
                      src={novidade.thumbnail_url} 
                      alt=""
                      className="w-12 h-12 object-cover rounded"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium">{novidade.titulo}</p>
                    {novidade.descricao && (
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {novidade.descricao}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell>{getStatusBadge(novidade)}</TableCell>
                <TableCell>
                  <Badge variant="outline">{novidade.conteudo.length}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {novidade.publico_alvo.slice(0, 2).map((p) => (
                      <Badge key={p} variant="secondary" className="text-xs">
                        {p.replace('_', ' ')}
                      </Badge>
                    ))}
                    {novidade.publico_alvo.length > 2 && (
                      <Badge variant="secondary" className="text-xs">
                        +{novidade.publico_alvo.length - 2}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {format(new Date(novidade.created_at), "dd/MM/yyyy", { locale: ptBR })}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEditar(novidade)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onDuplicar(novidade)}>
                        <Copy className="mr-2 h-4 w-4" />
                        Duplicar
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => setNovidadeParaExcluir(novidade.id)}
                        className="text-red-600"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog 
        open={!!novidadeParaExcluir} 
        onOpenChange={(open) => !open && setNovidadeParaExcluir(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta novidade? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (novidadeParaExcluir) {
                  onExcluir(novidadeParaExcluir);
                  setNovidadeParaExcluir(null);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
