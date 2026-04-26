import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { CategoriaProduto, FormularioCategoria } from '@/types/categoria-produto';
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

interface DialogGerenciarCategoriasProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categorias: CategoriaProduto[];
  onCriar: (dados: FormularioCategoria) => Promise<boolean>;
  onAtualizar: (id: string, dados: FormularioCategoria) => Promise<boolean>;
  onExcluir: (id: string) => Promise<boolean>;
}

const CORES_PREDEFINIDAS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6',
];

export const DialogGerenciarCategorias = ({
  open,
  onOpenChange,
  categorias,
  onCriar,
  onAtualizar,
  onExcluir,
}: DialogGerenciarCategoriasProps) => {
  const [nome, setNome] = useState('');
  const [cor, setCor] = useState('#3b82f6');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [categoriaParaExcluir, setCategoriaParaExcluir] = useState<CategoriaProduto | null>(null);

  const handleSubmit = async () => {
    if (!nome.trim()) return;

    let sucesso: boolean;
    if (editandoId) {
      sucesso = await onAtualizar(editandoId, { nome: nome.trim(), cor });
    } else {
      sucesso = await onCriar({ nome: nome.trim(), cor });
    }

    if (sucesso) {
      setNome('');
      setCor('#3b82f6');
      setEditandoId(null);
    }
  };

  const handleEditar = (cat: CategoriaProduto) => {
    setNome(cat.nome);
    setCor(cat.cor);
    setEditandoId(cat.id);
  };

  const handleCancelarEdicao = () => {
    setNome('');
    setCor('#3b82f6');
    setEditandoId(null);
  };

  const handleConfirmExcluir = async () => {
    if (categoriaParaExcluir) {
      await onExcluir(categoriaParaExcluir.id);
      setCategoriaParaExcluir(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Gerenciar Categorias</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Formulário */}
            <div className="space-y-3">
              <div>
                <Label>Nome da Categoria</Label>
                <Input
                  placeholder="Ex: Acessórios"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                />
              </div>
              <div>
                <Label>Cor</Label>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {CORES_PREDEFINIDAS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${cor === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                      onClick={() => setCor(c)}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSubmit} size="sm" className="flex-1">
                  <Plus className="w-4 h-4 mr-1" />
                  {editandoId ? 'Atualizar' : 'Criar'}
                </Button>
                {editandoId && (
                  <Button onClick={handleCancelarEdicao} size="sm" variant="outline">
                    Cancelar
                  </Button>
                )}
              </div>
            </div>

            {/* Lista */}
            <div className="border-t pt-3 space-y-2 max-h-60 overflow-y-auto">
              {categorias.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma categoria criada ainda.
                </p>
              ) : (
                categorias.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full" style={{ backgroundColor: cat.cor }} />
                      <span className="text-sm font-medium">{cat.nome}</span>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleEditar(cat)}
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setCategoriaParaExcluir(cat)}
                      >
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!categoriaParaExcluir} onOpenChange={(open) => !open && setCategoriaParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Categoria</AlertDialogTitle>
            <AlertDialogDescription>
              Excluir <strong>{categoriaParaExcluir?.nome}</strong>? Os itens vinculados ficarão sem categoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmExcluir} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
