import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Package, Wrench, Info } from 'lucide-react';
import { ItemEstoque } from '@/types/produto';
import { formatCurrency } from '@/lib/formatters';

interface DialogAlterarPrecoEmMassaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itensSelecionados: ItemEstoque[];
  onConfirmar: (
    itens: { id: string; tipo: 'produto' | 'peca' }[],
    novoPreco: number,
    novoPrecoAtacado: number | null
  ) => Promise<boolean>;
}

export const DialogAlterarPrecoEmMassa = ({
  open,
  onOpenChange,
  itensSelecionados,
  onConfirmar,
}: DialogAlterarPrecoEmMassaProps) => {
  const [novoPreco, setNovoPreco] = useState('');
  const [novoPrecoAtacado, setNovoPrecoAtacado] = useState('');
  const [salvando, setSalvando] = useState(false);

  // Aplica apenas nos itens explicitamente selecionados
  const itensAfetados = itensSelecionados;

  // Verificar se todos os selecionados têm o mesmo preço atual (para pré-preencher)
  useEffect(() => {
    if (!open) {
      setNovoPreco('');
      setNovoPrecoAtacado('');
      return;
    }
    if (itensSelecionados.length === 0) return;

    const precos = [...new Set(itensSelecionados.map((i) => i.preco))];
    if (precos.length === 1) {
      setNovoPreco(String(precos[0]));
    }

    const precosAtacado = [...new Set(itensSelecionados.map((i) => i.preco_atacado).filter((p) => p != null))];
    if (precosAtacado.length === 1 && precosAtacado[0] != null) {
      setNovoPrecoAtacado(String(precosAtacado[0]));
    }
  }, [open, itensSelecionados]);

  const handleConfirmar = async () => {
    const preco = parseFloat(novoPreco.replace(',', '.'));
    if (isNaN(preco) || preco < 0) return;

    const atacado = novoPrecoAtacado.trim()
      ? parseFloat(novoPrecoAtacado.replace(',', '.'))
      : null;

    setSalvando(true);
    const itens = itensAfetados.map((i) => ({ id: i.id, tipo: i.tipo }));
    const ok = await onConfirmar(itens, preco, atacado);
    setSalvando(false);
    if (ok) onOpenChange(false);
  };

  const precoValido = !isNaN(parseFloat(novoPreco.replace(',', '.'))) && parseFloat(novoPreco.replace(',', '.')) >= 0;

  // Agrupar itens afetados por código para exibir resumo
  const grupos = (() => {
    const map = new Map<string, ItemEstoque[]>();
    for (const item of itensAfetados) {
      const chave =
        (item.tipo === 'produto' && item.sku) || item.codigo_barras || item.id;
      const lista = map.get(chave) ?? [];
      lista.push(item);
      map.set(chave, lista);
    }
    return [...map.entries()];
  })();

  const totalAfetados = itensAfetados.length;
  const pluralAfetados = totalAfetados === 1 ? 'item' : 'itens';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Alterar Preço em Massa
          </DialogTitle>
          <DialogDescription>
            O novo preço será aplicado a todos os itens com o mesmo código.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Resumo dos itens afetados */}
          <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Info className="w-4 h-4 text-muted-foreground" />
              <span>{totalAfetados} {pluralAfetados} serão atualizados</span>
            </div>
            <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
              {grupos.map(([chave, grupo]) => (
                <div key={chave} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    {grupo[0].tipo === 'produto'
                      ? <Package className="w-3 h-3" />
                      : <Wrench className="w-3 h-3" />}
                  </div>
                  <span className="flex-1 truncate">
                    {grupo.length > 1
                      ? `${grupo[0].nome} (+${grupo.length - 1} com mesmo código)`
                      : grupo[0].nome}
                  </span>
                  <Badge variant="outline" className="text-xs font-mono shrink-0">
                    {formatCurrency(grupo[0].preco)}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Campo novo preço */}
          <div className="space-y-2">
            <Label htmlFor="novo-preco">Novo Preço de Venda *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
              <Input
                id="novo-preco"
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={novoPreco}
                onChange={(e) => setNovoPreco(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>
          </div>

          {/* Campo preço atacado (opcional) */}
          <div className="space-y-2">
            <Label htmlFor="novo-preco-atacado">
              Novo Preço Atacado{' '}
              <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
              <Input
                id="novo-preco-atacado"
                type="number"
                min="0"
                step="0.01"
                placeholder="Deixe vazio para não alterar"
                value={novoPrecoAtacado}
                onChange={(e) => setNovoPrecoAtacado(e.target.value)}
                className="pl-9"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Deixe vazio para manter o preço atacado atual de cada item.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={handleConfirmar} disabled={salvando || !precoValido}>
            {salvando
              ? 'Salvando...'
              : `Atualizar ${totalAfetados} ${pluralAfetados}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
