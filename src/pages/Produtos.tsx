import { useEffect, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, FileDown, Upload, Tag, X, Package, Wrench } from 'lucide-react';
import { useProdutos } from '@/hooks/useProdutos';
import { useFuncionarioPermissoes } from '@/hooks/useFuncionarioPermissoes';
import { useCategoriasProdutos } from '@/hooks/useCategoriasProdutos';
import { useAssinatura } from '@/hooks/useAssinatura';
import { DialogCadastroProduto } from '@/components/produtos/DialogCadastroProduto';
import { DialogImportarProdutos } from '@/components/produtos/DialogImportarProdutos';
import { DialogLimiteAtingido } from '@/components/planos/DialogLimiteAtingido';
import { TabelaProdutos } from '@/components/produtos/TabelaProdutos';
import { ItemEstoque, FormularioProduto } from '@/types/produto';
import { Skeleton } from '@/components/ui/skeleton';
import { BotaoScanner } from '@/components/scanner/LeitorCodigoBarras';
import { AppLayout } from '@/components/layout/AppLayout';
import { exportarProdutosPDF } from '@/lib/exportarProdutosPDF';
import { useConfiguracaoLoja } from '@/hooks/useConfiguracaoLoja';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { DialogGerenciarCategorias } from '@/components/produtos/DialogGerenciarCategorias';
import { DialogReporEstoque } from '@/components/produtos/DialogReporEstoque';
import { CardInventario } from '@/components/produtos/CardInventario';

const Produtos = () => {
  const { items, loading, carregarTodos, criar, atualizar, excluir, excluirEmMassa, categorizarEmMassa, alterarTipoEmMassa, importarEmLote, reporEstoque } = useProdutos();
  const { categorias, carregarCategorias, criarCategoria, atualizarCategoria, excluirCategoria } = useCategoriasProdutos();
  const { isFuncionario, permissoes } = useFuncionarioPermissoes();
  const { obterContagemProdutosMes, assinatura } = useAssinatura();
  const { config: configLoja } = useConfiguracaoLoja();
  const [busca, setBusca] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState<string | null>(null);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [dialogImportarAberto, setDialogImportarAberto] = useState(false);
  const [dialogLimiteAtingido, setDialogLimiteAtingido] = useState(false);
  const [dialogCategoriasAberto, setDialogCategoriasAberto] = useState(false);
  const [contadorProdutos, setContadorProdutos] = useState({ usados: 0, limite: -1, ilimitado: true });
  const [itemParaEditar, setItemParaEditar] = useState<ItemEstoque | null>(null);
  const [itemParaRepor, setItemParaRepor] = useState<ItemEstoque | null>(null);

  useEffect(() => {
    carregarTodos();
    carregarCategorias();
    carregarContador();
  }, [carregarTodos, carregarCategorias]);

  const carregarContador = async () => {
    const dados = await obterContagemProdutosMes();
    setContadorProdutos(dados);
  };

  const resumoInventario = useMemo(() => {
    const produtos = items.filter(i => i.tipo === 'produto');
    const pecas = items.filter(i => i.tipo === 'peca');
    return {
      produtos: {
        totalItens: produtos.length,
        quantidade: produtos.reduce((s, i) => s + i.quantidade, 0),
        custo: produtos.reduce((s, i) => s + i.custo * i.quantidade, 0),
        venda: produtos.reduce((s, i) => s + i.preco * i.quantidade, 0),
        lucro: produtos.reduce((s, i) => s + (i.preco - i.custo) * i.quantidade, 0),
      },
      pecas: {
        totalItens: pecas.length,
        quantidade: pecas.reduce((s, i) => s + i.quantidade, 0),
        custo: pecas.reduce((s, i) => s + i.custo * i.quantidade, 0),
        venda: pecas.reduce((s, i) => s + i.preco * i.quantidade, 0),
        lucro: pecas.reduce((s, i) => s + (i.preco - i.custo) * i.quantidade, 0),
      },
    };
  }, [items]);

  const itemsFiltrados = items.filter((item) => {
    if (categoriaFiltro && item.categoria_id !== categoriaFiltro) return false;

    const termoBusca = busca.toLowerCase().trim();
    if (!termoBusca) return true;

    const matchNome = item.nome.toLowerCase().includes(termoBusca);
    const matchCodigo = item.tipo === 'produto' && item.sku?.toLowerCase().includes(termoBusca);
    const matchCodigoBarras = item.codigo_barras?.toLowerCase().includes(termoBusca);
    const matchTipo = item.tipo.includes(termoBusca);

    return matchNome || matchCodigo || matchCodigoBarras || matchTipo;
  });

  const handleSubmit = async (dados: FormularioProduto) => {
    if (itemParaEditar) {
      return await atualizar(itemParaEditar.id, dados);
    } else {
      return await criar(dados);
    }
  };

  const handleEdit = (item: ItemEstoque) => {
    setItemParaEditar(item);
    setDialogAberto(true);
  };

  const handleNovoItem = () => {
    // Verificar limite antes de abrir o dialog
    if (assinatura?.plano_tipo === 'free' && !contadorProdutos.ilimitado && contadorProdutos.usados >= contadorProdutos.limite) {
      setDialogLimiteAtingido(true);
      return;
    }
    setItemParaEditar(null);
    setDialogAberto(true);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogAberto(open);
    if (!open) {
      setItemParaEditar(null);
    }
  };

  return (
    <AppLayout>
      <main className="flex-1 p-4 sm:p-6 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold">Produtos e Peças</h1>
              <p className="text-muted-foreground mt-1">
                Gerencie seu estoque de produtos e peças
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDialogCategoriasAberto(true)}
              >
                <Tag className="w-4 h-4 mr-2" />
                Categorias
              </Button>
              <Button
                variant="outline"
                onClick={() => setDialogImportarAberto(true)}
              >
                <Upload className="w-4 h-4 mr-2" />
                Importar
              </Button>
              <Button 
                variant="outline" 
                onClick={async () => {
                  if (items.length === 0) {
                    toast.error('Nenhum item para exportar');
                    return;
                  }
                  await exportarProdutosPDF(items, configLoja);
                  toast.success('PDF exportado com sucesso!');
                }}
                disabled={loading}
              >
                <FileDown className="w-4 h-4 mr-2" />
                Exportar PDF
              </Button>
              <Button onClick={handleNovoItem}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Item
              </Button>
            </div>
          </div>

          {/* Barra de Busca */}
          <div className="relative flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, código ou tipo..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-10"
              />
            </div>
            <BotaoScanner onCodigoLido={(codigo) => setBusca(codigo)} />
          </div>

          {/* Cards de Inventário */}
          {(!isFuncionario || permissoes?.recursos?.ver_inventario) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <CardInventario
                titulo="Estoque de Produtos"
                icon={Package}
                iconColor="text-blue-500"
                totalItens={resumoInventario.produtos.totalItens}
                totalQuantidade={resumoInventario.produtos.quantidade}
                valorCusto={resumoInventario.produtos.custo}
                valorVenda={resumoInventario.produtos.venda}
                valorLucro={resumoInventario.produtos.lucro}
              />
              <CardInventario
                titulo="Estoque de Peças"
                icon={Wrench}
                iconColor="text-orange-500"
                totalItens={resumoInventario.pecas.totalItens}
                totalQuantidade={resumoInventario.pecas.quantidade}
                valorCusto={resumoInventario.pecas.custo}
                valorVenda={resumoInventario.pecas.venda}
                valorLucro={resumoInventario.pecas.lucro}
              />
            </div>
          )}

          {/* Filtro por Categoria */}
          {categorias.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm text-muted-foreground">Filtrar:</span>
              {categorias.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategoriaFiltro(categoriaFiltro === cat.id ? null : cat.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    categoriaFiltro === cat.id
                      ? 'border-foreground/30 bg-accent'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.cor }} />
                  {cat.nome}
                  {categoriaFiltro === cat.id && <X className="w-3 h-3" />}
                </button>
              ))}
              {categoriaFiltro && (
                <Button variant="ghost" size="sm" onClick={() => setCategoriaFiltro(null)} className="text-xs h-7">
                  Limpar filtro
                </Button>
              )}
            </div>
          )}

          {/* Tabela */}
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : (
            <TabelaProdutos
              items={itemsFiltrados}
              categorias={categorias}
              onEdit={handleEdit}
              onDelete={excluir}
              onDeleteBulk={excluirEmMassa}
              onCategorizarEmMassa={categorizarEmMassa}
              onAlterarTipoEmMassa={alterarTipoEmMassa}
              onReporEstoque={(item) => setItemParaRepor(item)}
            />
          )}

          {/* Info de resultados */}
          {!loading && busca && (
            <p className="text-sm text-muted-foreground text-center">
              {itemsFiltrados.length === 0
                ? 'Nenhum item encontrado'
                : `${itemsFiltrados.length} ${itemsFiltrados.length === 1 ? 'item encontrado' : 'itens encontrados'}`}
            </p>
          )}
        </div>
      </main>

      {/* Dialog de Cadastro/Edição */}
      <DialogCadastroProduto
        open={dialogAberto}
        onOpenChange={handleDialogClose}
        onSubmit={handleSubmit}
        itemParaEditar={itemParaEditar}
        categorias={categorias}
      />

      {/* Dialog de Importação */}
      <DialogImportarProdutos
        open={dialogImportarAberto}
        onOpenChange={setDialogImportarAberto}
        onImportar={importarEmLote}
      />

      {/* Dialog de Limite Atingido */}
      <DialogLimiteAtingido
        open={dialogLimiteAtingido}
        onOpenChange={setDialogLimiteAtingido}
        tipo="produtos"
        usados={contadorProdutos.usados}
        limite={contadorProdutos.limite}
      />

      {/* Dialog de Gerenciamento de Categorias */}
      <DialogGerenciarCategorias
        open={dialogCategoriasAberto}
        onOpenChange={setDialogCategoriasAberto}
        categorias={categorias}
        onCriar={criarCategoria}
        onAtualizar={atualizarCategoria}
        onExcluir={excluirCategoria}
      />

      {/* Dialog de Reposição de Estoque */}
      <DialogReporEstoque
        open={!!itemParaRepor}
        onOpenChange={(open) => !open && setItemParaRepor(null)}
        item={itemParaRepor}
        onConfirmar={reporEstoque}
      />
    </AppLayout>
  );
};

export default Produtos;
