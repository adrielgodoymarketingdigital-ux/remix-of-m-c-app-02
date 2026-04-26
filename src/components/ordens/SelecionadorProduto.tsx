import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Minus, X, Package, Check, ChevronsUpDown } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { useProdutos } from "@/hooks/useProdutos";
import { ProdutoUtilizado } from "@/types/ordem-servico";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { DialogCadastroProduto } from "@/components/produtos/DialogCadastroProduto";
import { FormularioProduto } from "@/types/produto";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface SelecionadorProdutoProps {
  value: ProdutoUtilizado[];
  onChange: (produtos: ProdutoUtilizado[]) => void;
}

export const SelecionadorProduto = ({ value, onChange }: SelecionadorProdutoProps) => {
  const { items, loading, carregarTodos, criar } = useProdutos();
  const [open, setOpen] = useState(false);
  const [itemSelecionado, setItemSelecionado] = useState("");
  const [dialogCadastroOpen, setDialogCadastroOpen] = useState(false);

  // Carregar produtos/peças ao montar o componente
  useEffect(() => {
    carregarTodos();
  }, [carregarTodos]);

  const handleCriarProduto = async (dados: FormularioProduto): Promise<boolean> => {
    const result = await criar(dados);
    if (result) {
      await carregarTodos();
    }
    return !!result;
  };

  const handleAdicionarProduto = (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (item && !value.find(p => p.id === item.id)) {
      // Verificar se há estoque disponível
      if ((item.quantidade || 0) < 1) {
        return; // Não permitir adicionar item sem estoque
      }
      
      const novoProduto: ProdutoUtilizado = {
        id: item.id,
        nome: item.nome,
        tipo: item.tipo,
        quantidade: 1,
        preco_unitario: item.preco || 0,
        custo_unitario: item.custo || 0,
        preco_total: item.preco || 0,
        estoque_disponivel: item.quantidade || 0,
      };
      onChange([...value, novoProduto]);
      setItemSelecionado("");
      setOpen(false);
    }
  };

  const handleRemoverProduto = (id: string) => {
    onChange(value.filter(p => p.id !== id));
  };

  const handleAlterarQuantidade = (id: string, novaQuantidade: number) => {
    if (novaQuantidade < 1) return;
    
    // Verificar estoque disponível
    const item = items.find(i => i.id === id);
    const estoqueDisponivel = item?.quantidade || 0;
    
    // Limitar quantidade ao estoque disponível
    const quantidadeFinal = Math.min(novaQuantidade, estoqueDisponivel);
    
    onChange(value.map(p => 
      p.id === id 
        ? { ...p, quantidade: quantidadeFinal, preco_total: p.preco_unitario * quantidadeFinal }
        : p
    ));
  };

  const total = value.reduce((sum, p) => sum + p.preco_total, 0);

  // Filtrar itens já adicionados e com estoque > 0
  const itensDisponiveis = items.filter(item => 
    !value.find(p => p.id === item.id) && (item.quantidade || 0) > 0
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Label htmlFor="produto">Selecionar Produto/Peça</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-6 w-6"
                  onClick={() => setDialogCadastroOpen(true)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Cadastrar novo produto/peça</TooltipContent>
            </Tooltip>
          </div>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-full justify-between font-normal"
                disabled={loading}
              >
                {loading ? "Carregando..." : "Digite para buscar produto ou peça..."}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar produto ou peça..." />
                <CommandList>
                  <CommandEmpty>Nenhum produto ou peça encontrado.</CommandEmpty>
                  <CommandGroup>
                    {itensDisponiveis.map((item) => (
                      <CommandItem
                        key={item.id}
                        value={`${item.nome} ${item.tipo}`}
                        onSelect={() => handleAdicionarProduto(item.id)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            itemSelecionado === item.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex items-center gap-2 flex-1">
                          <Badge variant="outline" className="text-xs">
                            {item.tipo === 'peca' ? 'Peça' : 'Produto'}
                          </Badge>
                          <span>{item.nome}</span>
                          <span className="text-muted-foreground">
                            - <ValorMonetario valor={item.preco || 0} tipo="preco" />
                          </span>
                          <span className="text-muted-foreground text-xs ml-auto">
                            (Est: {item.quantidade})
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {value.length > 0 && (
        <Card className="p-4">
          <Label className="mb-3 block flex items-center gap-2">
            <Package className="w-4 h-4" />
            Produtos/Peças Selecionados
          </Label>
          <div className="space-y-2">
            {value.map((produto) => (
              <div key={produto.id} className="flex items-center justify-between p-3 bg-muted rounded-lg gap-2">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {produto.tipo === 'peca' ? 'Peça' : 'Produto'}
                    </Badge>
                    <p className="font-medium truncate">{produto.nome}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm text-muted-foreground">
                      <ValorMonetario valor={produto.preco_unitario} tipo="preco" /> × {produto.quantidade} = <ValorMonetario valor={produto.preco_total} tipo="preco" />
                    </p>
                    {produto.estoque_disponivel !== undefined && (
                      <span className="text-xs text-muted-foreground">
                        (Estoque: {produto.estoque_disponivel})
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {/* Controle de quantidade */}
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    onClick={() => handleAlterarQuantidade(produto.id, produto.quantidade - 1)}
                    disabled={produto.quantidade <= 1}
                  >
                    <Minus className="w-3 h-3" />
                  </Button>
                  <Input
                    type="number"
                    min="1"
                    value={produto.quantidade}
                    onChange={(e) => handleAlterarQuantidade(produto.id, parseInt(e.target.value) || 1)}
                    className="h-8 w-14 text-center"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    onClick={() => handleAlterarQuantidade(produto.id, produto.quantidade + 1)}
                    disabled={produto.quantidade >= (produto.estoque_disponivel || 999)}
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                  <button
                    type="button"
                    onClick={() => handleRemoverProduto(produto.id)}
                    className="text-red-500 hover:text-red-700 p-1 ml-2"
                    title="Remover produto"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t">
            <div className="flex justify-between items-center">
              <span className="font-semibold">Total Produtos/Peças:</span>
              <span className="text-lg font-bold"><ValorMonetario valor={total} tipo="preco" /></span>
            </div>
          </div>
        </Card>
      )}

      <DialogCadastroProduto
        open={dialogCadastroOpen}
        onOpenChange={setDialogCadastroOpen}
        onSubmit={handleCriarProduto}
      />
    </div>
  );
};
