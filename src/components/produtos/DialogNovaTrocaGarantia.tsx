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
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ItemEstoque } from '@/types/produto';
import { NovaTrocaGarantia } from '@/hooks/useTrocasGarantia';
import { RefreshCw, Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DialogNovaTrocaGarantiaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produtos: ItemEstoque[];
  onConfirmar: (dados: NovaTrocaGarantia) => Promise<boolean>;
}

const ESTADO_INICIAL = {
  clienteNome: '',
  produtoDefeituosoNome: '',
  motivoDefeito: '',
  produtoNovoId: '',
  observacao: '',
};

export const DialogNovaTrocaGarantia = ({ open, onOpenChange, produtos, onConfirmar }: DialogNovaTrocaGarantiaProps) => {
  const [form, setForm] = useState(ESTADO_INICIAL);
  const [salvando, setSalvando] = useState(false);
  const [buscaProdutoAberta, setBuscaProdutoAberta] = useState(false);

  const produtosDisponiveis = produtos.filter((p) => p.tipo === 'produto');
  const produtoSelecionado = produtosDisponiveis.find((p) => p.id === form.produtoNovoId);

  const podeConfirmar =
    form.produtoDefeituosoNome.trim().length > 0 &&
    form.produtoNovoId.length > 0 &&
    !!produtoSelecionado &&
    produtoSelecionado.quantidade > 0;

  const handleOpenChange = (open: boolean) => {
    if (!open) setForm(ESTADO_INICIAL);
    onOpenChange(open);
  };

  const handleConfirmar = async () => {
    if (!podeConfirmar || !produtoSelecionado) return;
    setSalvando(true);
    const ok = await onConfirmar({
      cliente_nome: form.clienteNome.trim() || null,
      produto_defeituoso_nome: form.produtoDefeituosoNome.trim(),
      motivo_defeito: form.motivoDefeito.trim() || null,
      produto_novo_id: produtoSelecionado.id,
      produto_novo_nome: produtoSelecionado.nome,
      observacao: form.observacao.trim() || null,
    });
    setSalvando(false);
    if (ok) handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            Nova Troca em Garantia
          </DialogTitle>
          <DialogDescription>
            Registre a devolução de um item com defeito e o produto novo entregue em substituição. O estoque do produto novo será reduzido em 1 unidade.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="cliente-nome">Cliente (opcional)</Label>
            <Input
              id="cliente-nome"
              placeholder="Nome do cliente"
              value={form.clienteNome}
              onChange={(e) => setForm((f) => ({ ...f, clienteNome: e.target.value }))}
            />
          </div>

          <div>
            <Label htmlFor="produto-defeituoso">Produto devolvido com defeito</Label>
            <Input
              id="produto-defeituoso"
              placeholder="Ex: Carregador 20W"
              value={form.produtoDefeituosoNome}
              onChange={(e) => setForm((f) => ({ ...f, produtoDefeituosoNome: e.target.value }))}
              autoFocus
            />
          </div>

          <div>
            <Label htmlFor="motivo-defeito">Motivo do defeito (opcional)</Label>
            <Input
              id="motivo-defeito"
              placeholder="Ex: não carrega"
              value={form.motivoDefeito}
              onChange={(e) => setForm((f) => ({ ...f, motivoDefeito: e.target.value }))}
            />
          </div>

          <div>
            <Label htmlFor="produto-novo">Produto novo a entregar</Label>
            <Popover open={buscaProdutoAberta} onOpenChange={setBuscaProdutoAberta}>
              <PopoverTrigger asChild>
                <Button
                  id="produto-novo"
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={buscaProdutoAberta}
                  className="w-full justify-between font-normal"
                >
                  <span className="truncate">
                    {produtoSelecionado
                      ? `${produtoSelecionado.nome} (${produtoSelecionado.quantidade} em estoque)`
                      : 'Buscar por nome ou código...'}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar por nome ou código..." />
                  <CommandList>
                    <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                    <CommandGroup>
                      {produtosDisponiveis.map((p) => (
                        <CommandItem
                          key={p.id}
                          value={`${p.nome} ${p.sku ?? ''} ${p.codigo_barras ?? ''}`}
                          disabled={p.quantidade <= 0}
                          onSelect={() => {
                            setForm((f) => ({ ...f, produtoNovoId: p.id }));
                            setBuscaProdutoAberta(false);
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              form.produtoNovoId === p.id ? 'opacity-100' : 'opacity-0'
                            )}
                          />
                          <div className="flex flex-col">
                            <span>{p.nome}</span>
                            {p.sku && <span className="text-xs text-muted-foreground">Código: {p.sku}</span>}
                          </div>
                          <span className="text-muted-foreground text-xs ml-auto">
                            ({p.quantidade} em estoque)
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label htmlFor="observacao">Observação (opcional)</Label>
            <Textarea
              id="observacao"
              placeholder="Detalhes adicionais sobre a troca"
              value={form.observacao}
              onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={handleConfirmar} disabled={salvando || !podeConfirmar}>
            {salvando ? 'Salvando...' : 'Registrar Troca'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
