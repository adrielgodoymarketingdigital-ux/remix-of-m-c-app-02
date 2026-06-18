import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Trash2, RefreshCw } from 'lucide-react';
import { TrocaGarantia } from '@/hooks/useTrocasGarantia';
import { formatDate } from '@/lib/formatters';

interface TabelaTrocasGarantiaProps {
  trocas: TrocaGarantia[];
  onExcluir: (id: string) => Promise<void>;
}

export const TabelaTrocasGarantia = ({ trocas, onExcluir }: TabelaTrocasGarantiaProps) => {
  const [trocaParaExcluir, setTrocaParaExcluir] = useState<TrocaGarantia | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const handleExcluir = async () => {
    if (!trocaParaExcluir) return;
    setExcluindo(true);
    await onExcluir(trocaParaExcluir.id);
    setExcluindo(false);
    setTrocaParaExcluir(null);
  };

  if (trocas.length === 0) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        <RefreshCw className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>Nenhuma troca em garantia registrada ainda.</p>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Produto devolvido</TableHead>
              <TableHead>Produto novo entregue</TableHead>
              <TableHead>Observação</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trocas.map((troca) => (
              <TableRow key={troca.id}>
                <TableCell className="whitespace-nowrap">{formatDate(troca.created_at)}</TableCell>
                <TableCell>
                  <Badge variant={troca.tipo === 'garantia' ? 'destructive' : 'outline'}>
                    {troca.tipo === 'garantia' ? 'Garantia' : 'Troca comercial'}
                  </Badge>
                </TableCell>
                <TableCell>{troca.cliente_nome || '—'}</TableCell>
                <TableCell>
                  <p className="font-medium">{troca.produto_defeituoso_nome}</p>
                  {troca.motivo_defeito && (
                    <p className="text-xs text-muted-foreground">{troca.motivo_defeito}</p>
                  )}
                </TableCell>
                <TableCell>{troca.produto_novo_nome}</TableCell>
                <TableCell className="max-w-xs truncate text-muted-foreground">
                  {troca.observacao || '—'}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setTrocaParaExcluir(troca)}
                    title="Excluir registro"
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <AlertDialog open={!!trocaParaExcluir} onOpenChange={(open) => !open && setTrocaParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir registro de troca?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso remove apenas o histórico da troca. O estoque do produto novo entregue não será reposto automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleExcluir} disabled={excluindo}>
              {excluindo ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
