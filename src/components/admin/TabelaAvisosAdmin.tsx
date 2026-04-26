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
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { MoreHorizontal, Pencil, Trash2, Copy } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TIPOS_AVISO } from '@/types/aviso';
import { cn } from '@/lib/utils';

interface AvisoSistemaDB {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: string;
  icone: string | null;
  link_url: string | null;
  link_texto: string | null;
  publico_alvo: string[];
  ativo: boolean;
  data_inicio: string;
  data_fim: string | null;
  prioridade: number;
  cor_fundo: string | null;
  cor_texto: string | null;
  cor_icone: string | null;
  cor_botao: string | null;
  imagem_url: string | null;
  imagem_posicao: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

interface TabelaAvisosAdminProps {
  avisos: AvisoSistemaDB[];
  onEditar: (aviso: AvisoSistemaDB) => void;
  onDuplicar: (aviso: AvisoSistemaDB) => void;
  onExcluir: (id: string) => Promise<boolean>;
  onToggleAtivo: (id: string, ativo: boolean) => Promise<boolean>;
}

export function TabelaAvisosAdmin({
  avisos,
  onEditar,
  onDuplicar,
  onExcluir,
  onToggleAtivo,
}: TabelaAvisosAdminProps) {
  const [avisoParaExcluir, setAvisoParaExcluir] = useState<string | null>(null);

  const getTipoBadge = (tipo: string) => {
    const tipoConfig = TIPOS_AVISO.find(t => t.value === tipo);
    const colors: Record<string, string> = {
      info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      success: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      promo: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    };
    return (
      <Badge className={cn('text-xs', colors[tipo] || colors.info)}>
        {tipoConfig?.label || tipo}
      </Badge>
    );
  };

  const getStatusBadge = (aviso: AvisoSistemaDB) => {
    const agora = new Date();
    const inicio = new Date(aviso.data_inicio);
    const fim = aviso.data_fim ? new Date(aviso.data_fim) : null;

    if (!aviso.ativo) {
      return <Badge variant="secondary">Inativo</Badge>;
    }
    if (inicio > agora) {
      return <Badge variant="outline" className="text-yellow-600">Agendado</Badge>;
    }
    if (fim && fim < agora) {
      return <Badge variant="outline" className="text-gray-500">Expirado</Badge>;
    }
    return <Badge className="bg-green-600 text-white">Ativo</Badge>;
  };

  const handleExcluir = async () => {
    if (avisoParaExcluir) {
      await onExcluir(avisoParaExcluir);
      setAvisoParaExcluir(null);
    }
  };

  if (avisos.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Nenhum aviso cadastrado.
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">Ativo</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Público</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead className="w-[80px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {avisos.map((aviso) => (
              <TableRow key={aviso.id}>
                <TableCell>
                  <Switch
                    checked={aviso.ativo}
                    onCheckedChange={(checked) => onToggleAtivo(aviso.id, checked)}
                  />
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium truncate max-w-[200px]">{aviso.titulo}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {aviso.mensagem}
                    </p>
                  </div>
                </TableCell>
                <TableCell>{getTipoBadge(aviso.tipo)}</TableCell>
                <TableCell>{getStatusBadge(aviso)}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1 max-w-[150px]">
                    {aviso.publico_alvo.slice(0, 2).map((p) => (
                      <Badge key={p} variant="outline" className="text-xs">
                        {p === 'todos' ? 'Todos' : p.replace('_', ' ')}
                      </Badge>
                    ))}
                    {aviso.publico_alvo.length > 2 && (
                      <Badge variant="outline" className="text-xs">
                        +{aviso.publico_alvo.length - 2}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{aviso.prioridade}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {format(new Date(aviso.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEditar(aviso)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onDuplicar(aviso)}>
                        <Copy className="mr-2 h-4 w-4" />
                        Duplicar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setAvisoParaExcluir(aviso.id)}
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

      <AlertDialog open={!!avisoParaExcluir} onOpenChange={() => setAvisoParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Aviso</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este aviso? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleExcluir} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
