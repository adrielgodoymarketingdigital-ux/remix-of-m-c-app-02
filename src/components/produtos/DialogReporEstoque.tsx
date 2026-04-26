import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ItemEstoque } from '@/types/produto';
import { PackagePlus } from 'lucide-react';

interface DialogReporEstoqueProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ItemEstoque | null;
  onConfirmar: (id: string, tipo: 'produto' | 'peca', quantidade: number) => Promise<boolean>;
}

export const DialogReporEstoque = ({ open, onOpenChange, item, onConfirmar }: DialogReporEstoqueProps) => {
  const [quantidade, setQuantidade] = useState('');
  const [salvando, setSalvando] = useState(false);

  const handleConfirmar = async () => {
    if (!item || !quantidade || Number(quantidade) <= 0) return;
    setSalvando(true);
    const ok = await onConfirmar(item.id, item.tipo, Number(quantidade));
    setSalvando(false);
    if (ok) {
      setQuantidade('');
      onOpenChange(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) setQuantidade('');
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="w-5 h-5" />
            Repor Estoque
          </DialogTitle>
          <DialogDescription>
            Adicione unidades ao estoque do item selecionado.
          </DialogDescription>
        </DialogHeader>

        {item && (
          <div className="space-y-4">
            <div>
              <Label className="text-muted-foreground">Item</Label>
              <p className="font-medium">{item.nome}</p>
            </div>

            <div>
              <Label className="text-muted-foreground">Estoque atual</Label>
              <p className="font-medium">{item.quantidade} unidades</p>
            </div>

            <div>
              <Label htmlFor="qtd-repor">Quantidade a adicionar</Label>
              <Input
                id="qtd-repor"
                type="number"
                min="1"
                placeholder="Ex: 10"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                autoFocus
              />
            </div>

            {quantidade && Number(quantidade) > 0 && (
              <p className="text-sm text-muted-foreground">
                Novo estoque: <span className="font-semibold text-foreground">{item.quantidade + Number(quantidade)}</span> unidades
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmar}
            disabled={salvando || !quantidade || Number(quantidade) <= 0}
          >
            {salvando ? 'Salvando...' : 'Confirmar Reposição'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
