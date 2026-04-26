import { useState } from 'react';
import { CategoriaProduto } from '@/types/categoria-produto';
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
import { Checkbox } from '@/components/ui/checkbox';
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
import { Pencil, Trash2, Package, Wrench, ImageOff, Truck, Calendar, Lock, Tag, X, PackagePlus, ArrowRightLeft } from 'lucide-react';
import { ItemEstoque } from '@/types/produto';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { ValorMonetario } from '@/components/ui/valor-monetario';
import { useIsMobile } from '@/hooks/use-mobile';
import { useFuncionarioPermissoes } from '@/hooks/useFuncionarioPermissoes';

interface TabelaProdutosProps {
  items: ItemEstoque[];
  categorias?: CategoriaProduto[];
  onEdit: (item: ItemEstoque) => void;
  onDelete: (id: string, tipo: 'produto' | 'peca') => void;
  onDeleteBulk?: (itens: { id: string; tipo: 'produto' | 'peca' }[]) => Promise<{ excluidos: number; erros: number }>;
  onCategorizarEmMassa?: (itens: { id: string; tipo: 'produto' | 'peca' }[], categoriaId: string | null) => Promise<boolean>;
  onAlterarTipoEmMassa?: (itens: { id: string; tipo: 'produto' | 'peca' }[], novoTipo: 'produto' | 'peca') => Promise<boolean>;
  onReporEstoque?: (item: ItemEstoque) => void;
}

// Componente para exibir thumbnail da foto
const FotoProduto = ({ fotos, tamanho = 'sm' }: { fotos?: string[]; tamanho?: 'sm' | 'lg' }) => {
  const tamanhoClasses = tamanho === 'sm' 
    ? 'w-10 h-10' 
    : 'w-full h-28';
  
  if (!fotos || fotos.length === 0) {
    return (
      <div className={`${tamanhoClasses} rounded bg-muted flex items-center justify-center`}>
        <ImageOff className={tamanho === 'sm' ? 'w-4 h-4' : 'w-8 h-8'} />
      </div>
    );
  }
  
  return (
    <img 
      src={fotos[0]} 
      alt="Produto" 
      className={`${tamanhoClasses} rounded object-cover`}
    />
  );
};

export const TabelaProdutos = ({ items, categorias, onEdit, onDelete, onDeleteBulk, onCategorizarEmMassa, onAlterarTipoEmMassa, onReporEstoque }: TabelaProdutosProps) => {
  const [itemParaExcluir, setItemParaExcluir] = useState<ItemEstoque | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [confirmarExclusaoMassa, setConfirmarExclusaoMassa] = useState(false);
  const [excluindoMassa, setExcluindoMassa] = useState(false);
  const [categorizando, setCategorizando] = useState(false);
  const [mostrarSeletorCategoria, setMostrarSeletorCategoria] = useState(false);
  const [alterandoTipo, setAlterandoTipo] = useState(false);
  const isMobile = useIsMobile();
  const { podeVerCustos, podeVerLucros } = useFuncionarioPermissoes();

  const handleConfirmDelete = () => {
    if (itemParaExcluir) {
      onDelete(itemParaExcluir.id, itemParaExcluir.tipo);
      setItemParaExcluir(null);
    }
  };

  const toggleSelecionado = (id: string) => {
    setSelecionados(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleTodos = () => {
    if (selecionados.size === items.length) {
      setSelecionados(new Set());
    } else {
      setSelecionados(new Set(items.map(i => i.id)));
    }
  };

  const limparSelecao = () => setSelecionados(new Set());

  const handleExcluirEmMassa = async () => {
    if (!onDeleteBulk) return;
    setExcluindoMassa(true);
    const itensParaExcluir = items
      .filter(i => selecionados.has(i.id))
      .map(i => ({ id: i.id, tipo: i.tipo }));
    await onDeleteBulk(itensParaExcluir);
    setSelecionados(new Set());
    setConfirmarExclusaoMassa(false);
    setExcluindoMassa(false);
  };

  const todosChecked = items.length > 0 && selecionados.size === items.length;
  const algunsChecked = selecionados.size > 0 && selecionados.size < items.length;

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">Nenhum item cadastrado</h3>
        <p className="text-muted-foreground">
          Clique em "Novo Item" para começar a cadastrar produtos ou peças.
        </p>
      </div>
    );
  }

  const handleCategorizarEmMassa = async (categoriaId: string | null) => {
    if (!onCategorizarEmMassa) return;
    setCategorizando(true);
    const itens = items
      .filter(i => selecionados.has(i.id))
      .map(i => ({ id: i.id, tipo: i.tipo }));
    const ok = await onCategorizarEmMassa(itens, categoriaId);
    if (ok) {
      setSelecionados(new Set());
      setMostrarSeletorCategoria(false);
    }
    setCategorizando(false);
  };

  const handleAlterarTipoEmMassa = async (novoTipo: 'produto' | 'peca') => {
    if (!onAlterarTipoEmMassa) return;
    setAlterandoTipo(true);
    const itens = items
      .filter(i => selecionados.has(i.id))
      .map(i => ({ id: i.id, tipo: i.tipo }));
    const ok = await onAlterarTipoEmMassa(itens, novoTipo);
    if (ok) {
      setSelecionados(new Set());
    }
    setAlterandoTipo(false);
  };

  // Barra de ações em massa
  const BarraSelecao = () => {
    if (selecionados.size === 0) return null;
    return (
      <div className="space-y-2 mb-3 animate-in fade-in slide-in-from-top-2 duration-200">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-accent border border-border flex-wrap">
          <span className="text-sm font-medium">
            {selecionados.size} {selecionados.size === 1 ? 'item selecionado' : 'itens selecionados'}
          </span>
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={limparSelecao}>
            <X className="w-4 h-4 mr-1" />
            Limpar
          </Button>
          {onAlterarTipoEmMassa && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAlterarTipoEmMassa('produto')}
                disabled={alterandoTipo}
              >
                <Package className="w-4 h-4 mr-1" />
                Tornar Produto
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAlterarTipoEmMassa('peca')}
                disabled={alterandoTipo}
              >
                <Wrench className="w-4 h-4 mr-1" />
                Tornar Peça
              </Button>
            </>
          )}
          {onCategorizarEmMassa && categorias && categorias.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMostrarSeletorCategoria(!mostrarSeletorCategoria)}
              disabled={categorizando}
            >
              <Tag className="w-4 h-4 mr-1" />
              Categorizar ({selecionados.size})
            </Button>
          )}
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={() => setConfirmarExclusaoMassa(true)}
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Excluir ({selecionados.size})
          </Button>
        </div>
        {mostrarSeletorCategoria && categorias && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
            <span className="text-sm text-muted-foreground">Selecione a categoria:</span>
            <div className="flex flex-wrap gap-2">
              {categorias.map((cat) => (
                <Button
                  key={cat.id}
                  variant="outline"
                  size="sm"
                  disabled={categorizando}
                  onClick={() => handleCategorizarEmMassa(cat.id)}
                  className="gap-1.5"
                >
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.cor }} />
                  {cat.nome}
                </Button>
              ))}
              <Button
                variant="ghost"
                size="sm"
                disabled={categorizando}
                onClick={() => handleCategorizarEmMassa(null)}
                className="text-muted-foreground"
              >
                Remover categoria
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Mobile: Card-based layout
  if (isMobile) {
    return (
      <>
        <BarraSelecao />
        <div className="space-y-3">
          {items.map((item) => {
            const lucro = item.tipo === 'produto' ? item.lucro : item.preco - item.custo;
            const semEstoque = item.quantidade === 0;
            const estoqueNegativo = item.quantidade < 0;
            const estoqueBaixo = item.quantidade > 0 && item.quantidade < 5;
            const isChecked = selecionados.has(item.id);

            return (
              <Card key={item.id} className={`overflow-hidden transition-colors ${isChecked ? 'ring-2 ring-primary' : ''}`}>
                {/* Foto no topo do card */}
                <FotoProduto fotos={item.fotos} tamanho="lg" />
                
                <div className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-start gap-2 flex-1">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggleSelecionado(item.id)}
                        className="mt-1"
                      />
                      <div>
                        <p className="font-medium">{item.nome}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {item.tipo === 'produto' ? item.sku || '-' : '-'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={item.tipo === 'produto' ? 'default' : 'secondary'} className="text-xs">
                        {item.tipo === 'produto' ? <Package className="w-3 h-3 mr-1" /> : <Wrench className="w-3 h-3 mr-1" />}
                        {item.tipo === 'produto' ? 'Produto' : 'Peça'}
                      </Badge>
                      {estoqueNegativo && (
                        <Badge variant="destructive" className="text-xs">Negativo</Badge>
                      )}
                      {semEstoque && (
                        <Badge variant="outline" className="text-xs text-orange-500 border-orange-500">Sem estoque</Badge>
                      )}
                      {estoqueBaixo && (
                        <Badge variant="secondary" className="text-xs">Baixo</Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                    <div>
                      <span className="text-muted-foreground">Qtd:</span>
                      <span className="ml-1 font-medium">{item.quantidade}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Custo:</span>
                      <span className="ml-1">
                        {podeVerCustos ? <ValorMonetario valor={item.custo} /> : <Lock className="inline h-3 w-3 text-muted-foreground" />}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Preço:</span>
                      <span className="ml-1 font-medium"><ValorMonetario valor={item.preco} tipo="preco" /></span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Lucro:</span>
                      <span className={`ml-1 font-semibold ${lucro >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {podeVerLucros ? <ValorMonetario valor={lucro} /> : <Lock className="inline h-3 w-3 text-muted-foreground" />}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3 flex-wrap">
                    {item.categoria_nome && (
                      <Badge variant="outline" className="text-xs" style={{ borderColor: item.categoria_cor || undefined, color: item.categoria_cor || undefined }}>
                        <Tag className="w-3 h-3 mr-1" />
                        {item.categoria_nome}
                      </Badge>
                    )}
                    {item.fornecedor_nome && (
                      <div className="flex items-center gap-1">
                        <Truck className="w-3 h-3" />
                        <span>{item.fornecedor_nome}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>{formatDate(item.created_at)}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-end gap-2 pt-3 border-t">
                    {onReporEstoque && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onReporEstoque(item)}
                        className="h-9"
                        title="Repor Estoque"
                      >
                        <PackagePlus className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(item)}
                      className="h-9"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setItemParaExcluir(item)}
                      className="h-9"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <AlertDialog open={!!itemParaExcluir} onOpenChange={(open) => !open && setItemParaExcluir(null)}>
          <AlertDialogContent className="mx-4 max-w-[calc(100%-2rem)]">
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Excluir <strong>{itemParaExcluir?.nome}</strong>?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              <AlertDialogCancel className="w-full sm:w-auto">Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDelete} className="w-full sm:w-auto bg-destructive text-destructive-foreground">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={confirmarExclusaoMassa} onOpenChange={setConfirmarExclusaoMassa}>
          <AlertDialogContent className="mx-4 max-w-[calc(100%-2rem)]">
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir {selecionados.size} {selecionados.size === 1 ? 'item' : 'itens'}?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. Itens com vendas vinculadas não serão excluídos.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              <AlertDialogCancel disabled={excluindoMassa} className="w-full sm:w-auto">Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleExcluirEmMassa} 
                disabled={excluindoMassa}
                className="w-full sm:w-auto bg-destructive text-destructive-foreground"
              >
                {excluindoMassa ? 'Excluindo...' : `Excluir ${selecionados.size} ${selecionados.size === 1 ? 'item' : 'itens'}`}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  // Desktop: Table layout
  return (
    <>
      <BarraSelecao />
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={todosChecked}
                  ref={(el) => {
                    if (el) {
                      (el as any).indeterminate = algunsChecked;
                    }
                  }}
                  onCheckedChange={toggleTodos}
                />
              </TableHead>
              <TableHead className="w-14">Foto</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Cadastro</TableHead>
              <TableHead className="text-center">Quantidade</TableHead>
              <TableHead className="text-right">Custo</TableHead>
              <TableHead className="text-right">Preço Venda</TableHead>
              <TableHead className="text-right">Lucro</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const lucro = item.tipo === 'produto' ? item.lucro : item.preco - item.custo;
              const semEstoque = item.quantidade === 0;
              const estoqueNegativo = item.quantidade < 0;
              const estoqueBaixo = item.quantidade > 0 && item.quantidade < 5;
              const isChecked = selecionados.has(item.id);

              return (
                <TableRow key={item.id} className={isChecked ? 'bg-accent/50' : ''}>
                  <TableCell>
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => toggleSelecionado(item.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <FotoProduto fotos={item.fotos} tamanho="sm" />
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.tipo === 'produto' ? 'default' : 'secondary'}>
                      {item.tipo === 'produto' ? (
                        <Package className="w-3 h-3 mr-1" />
                      ) : (
                        <Wrench className="w-3 h-3 mr-1" />
                      )}
                      {item.tipo === 'produto' ? 'Produto' : 'Peça'}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {item.tipo === 'produto' ? item.sku || '-' : '-'}
                  </TableCell>
                  <TableCell className="font-medium">{item.nome}</TableCell>
                  <TableCell>
                    {item.categoria_nome ? (
                      <Badge variant="outline" className="text-xs" style={{ borderColor: item.categoria_cor || undefined, color: item.categoria_cor || undefined }}>
                        <Tag className="w-3 h-3 mr-1" />
                        {item.categoria_nome}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {item.fornecedor_nome ? (
                      <span className="flex items-center gap-1 text-sm">
                        <Truck className="w-3 h-3 text-muted-foreground" />
                        {item.fornecedor_nome}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(item.created_at)}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <span>{item.quantidade}</span>
                      {estoqueNegativo && (
                        <Badge variant="destructive" className="text-xs">
                          Negativo
                        </Badge>
                      )}
                      {semEstoque && (
                        <Badge variant="outline" className="text-xs text-orange-500 border-orange-500">
                          Sem estoque
                        </Badge>
                      )}
                      {estoqueBaixo && (
                        <Badge variant="secondary" className="text-xs">
                          Baixo
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {podeVerCustos
                      ? <ValorMonetario valor={item.custo} />
                      : <span className="flex items-center justify-end gap-1 text-muted-foreground"><Lock className="h-3 w-3" /></span>
                    }
                  </TableCell>
                  <TableCell className="text-right">
                    <ValorMonetario valor={item.preco} tipo="preco" />
                  </TableCell>
                  <TableCell className="text-right">
                    {podeVerLucros ? (
                      <span className={lucro >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                        <ValorMonetario valor={lucro} />
                      </span>
                    ) : (
                      <span className="flex items-center justify-end gap-1 text-muted-foreground"><Lock className="h-3 w-3" /></span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {onReporEstoque && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onReporEstoque(item)}
                          title="Repor Estoque"
                        >
                          <PackagePlus className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(item)}
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setItemParaExcluir(item)}
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!itemParaExcluir} onOpenChange={(open) => !open && setItemParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{itemParaExcluir?.nome}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmarExclusaoMassa} onOpenChange={setConfirmarExclusaoMassa}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selecionados.size} {selecionados.size === 1 ? 'item' : 'itens'}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Itens com vendas vinculadas não serão excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindoMassa}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleExcluirEmMassa} 
              disabled={excluindoMassa}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {excluindoMassa ? 'Excluindo...' : `Excluir ${selecionados.size} ${selecionados.size === 1 ? 'item' : 'itens'}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
