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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ItemEstoque } from '@/types/produto';
import { NovaTrocaGarantia, TipoTrocaGarantia } from '@/hooks/useTrocasGarantia';
import { RefreshCw, Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DialogNovaTrocaGarantiaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produtos: ItemEstoque[];
  onConfirmar: (dados: NovaTrocaGarantia) => Promise<boolean>;
}

const ESTADO_INICIAL = {
  tipo: 'garantia' as TipoTrocaGarantia,
  clienteNome: '',
  produtoDevolvidoId: '',
  motivoDefeito: '',
  produtoNovoId: '',
  observacao: '',
};

const DESCRICAO_POR_TIPO: Record<TipoTrocaGarantia, string> = {
  garantia: 'O produto devolvido não retorna ao estoque (assume-se defeituoso). O estoque do produto novo será reduzido em 1 unidade.',
  troca_comercial: 'O produto devolvido retorna ao estoque (+1) e o produto novo entregue sai do estoque (-1).',
};

export const DialogNovaTrocaGarantia = ({ open, onOpenChange, produtos, onConfirmar }: DialogNovaTrocaGarantiaProps) => {
  const [form, setForm] = useState(ESTADO_INICIAL);
  const [salvando, setSalvando] = useState(false);
  const [buscaDevolvidoAberta, setBuscaDevolvidoAberta] = useState(false);
  const [buscaNovoAberta, setBuscaNovoAberta] = useState(false);

  const produtosDisponiveis = produtos.filter((p) => p.tipo === 'produto');
  const produtoDevolvido = produtosDisponiveis.find((p) => p.id === form.produtoDevolvidoId);
  const produtoNovo = produtosDisponiveis.find((p) => p.id === form.produtoNovoId);

  const mesmoProdutoSelecionado =
    !!form.produtoDevolvidoId && form.produtoDevolvidoId === form.produtoNovoId;

  const podeConfirmar =
    !!produtoDevolvido &&
    !!produtoNovo &&
    !mesmoProdutoSelecionado &&
    produtoNovo.quantidade > 0;

  const handleOpenChange = (open: boolean) => {
    if (!open) setForm(ESTADO_INICIAL);
    onOpenChange(open);
  };

  const handleConfirmar = async () => {
    if (!podeConfirmar || !produtoDevolvido || !produtoNovo) return;
    setSalvando(true);
    const ok = await onConfirmar({
      tipo: form.tipo,
      cliente_nome: form.clienteNome.trim() || null,
      produto_devolvido_id: produtoDevolvido.id,
      produto_devolvido_nome: produtoDevolvido.nome,
      motivo_defeito: form.tipo === 'garantia' ? form.motivoDefeito.trim() || null : null,
      produto_novo_id: produtoNovo.id,
      produto_novo_nome: produtoNovo.nome,
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
            Nova Troca
          </DialogTitle>
          <DialogDescription>{DESCRICAO_POR_TIPO[form.tipo]}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Tipo de troca</Label>
            <ToggleGroup
              type="single"
              value={form.tipo}
              onValueChange={(v) => v && setForm((f) => ({ ...f, tipo: v as TipoTrocaGarantia }))}
              className="grid grid-cols-2 w-full"
            >
              <ToggleGroupItem value="garantia" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                Garantia
              </ToggleGroupItem>
              <ToggleGroupItem value="troca_comercial" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                Troca comercial
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

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
            <Label htmlFor="produto-devolvido">Produto sendo devolvido</Label>
            <Popover open={buscaDevolvidoAberta} onOpenChange={setBuscaDevolvidoAberta}>
              <PopoverTrigger asChild>
                <Button
                  id="produto-devolvido"
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={buscaDevolvidoAberta}
                  className="w-full justify-between font-normal"
                >
                  <span className="truncate">
                    {produtoDevolvido ? produtoDevolvido.nome : 'Buscar por nome ou código...'}
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
                          onSelect={() => {
                            setForm((f) => ({ ...f, produtoDevolvidoId: p.id }));
                            setBuscaDevolvidoAberta(false);
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              form.produtoDevolvidoId === p.id ? 'opacity-100' : 'opacity-0'
                            )}
                          />
                          <div className="flex flex-col">
                            <span>{p.nome}</span>
                            {p.sku && <span className="text-xs text-muted-foreground">Código: {p.sku}</span>}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {form.tipo === 'garantia' && (
            <div>
              <Label htmlFor="motivo-defeito">Motivo do defeito (opcional)</Label>
              <Input
                id="motivo-defeito"
                placeholder="Ex: não carrega"
                value={form.motivoDefeito}
                onChange={(e) => setForm((f) => ({ ...f, motivoDefeito: e.target.value }))}
              />
            </div>
          )}

          <div>
            <Label htmlFor="produto-novo">Produto novo a entregar</Label>
            <Popover open={buscaNovoAberta} onOpenChange={setBuscaNovoAberta}>
              <PopoverTrigger asChild>
                <Button
                  id="produto-novo"
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={buscaNovoAberta}
                  className="w-full justify-between font-normal"
                >
                  <span className="truncate">
                    {produtoNovo
                      ? `${produtoNovo.nome} (${produtoNovo.quantidade} em estoque)`
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
                            setBuscaNovoAberta(false);
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
            {mesmoProdutoSelecionado && (
              <p className="text-xs text-destructive mt-1">Selecione produtos diferentes para devolução e entrega.</p>
            )}
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
