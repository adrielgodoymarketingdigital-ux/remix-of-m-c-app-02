import { useEffect, useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, FileDown, Upload, Tag, X, Package, Wrench, ArrowUpDown, TrendingDown, TrendingUp, ListFilter, ChevronDown, RefreshCw, Settings } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useProdutos } from '@/hooks/useProdutos';
import { useFuncionarioPermissoes } from '@/hooks/useFuncionarioPermissoes';
import { useCategoriasProdutos } from '@/hooks/useCategoriasProdutos';
import { useAssinatura } from '@/hooks/useAssinatura';
import { useColunasVisiveis } from '@/hooks/useColunasVisiveis';
import { DialogCadastroProduto } from '@/components/produtos/DialogCadastroProduto';
import { DialogImportarProdutos } from '@/components/produtos/DialogImportarProdutos';
import { DialogLimiteAtingido } from '@/components/planos/DialogLimiteAtingido';
import { DialogConfiguracoesProdutos } from '@/components/produtos/DialogConfiguracoesProdutos';
import { TabelaProdutos } from '@/components/produtos/TabelaProdutos';
import { ItemEstoque, FormularioProduto } from '@/types/produto';
import { Skeleton } from '@/components/ui/skeleton';
import { BotaoScanner } from '@/components/scanner/LeitorCodigoBarras';
import { AppLayout } from '@/components/layout/AppLayout';
import { exportarProdutosPDF, exportarMenosEstoquePDF, exportarMaisVendidosPDF } from '@/lib/exportarProdutosPDF';
import { useConfiguracaoLoja } from '@/hooks/useConfiguracaoLoja';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { DialogReporEstoque } from '@/components/produtos/DialogReporEstoque';
import { CardInventario } from '@/components/produtos/CardInventario';
import { TabelaTrocasGarantia } from '@/components/produtos/TabelaTrocasGarantia';
import { RankingProdutosDefeito } from '@/components/produtos/RankingProdutosDefeito';
import { DialogNovaTrocaGarantia } from '@/components/produtos/DialogNovaTrocaGarantia';
import { useTrocasGarantia } from '@/hooks/useTrocasGarantia';

const Produtos = () => {
  const { items, loading, carregarTodos, criar, atualizar, excluir, excluirEmMassa, categorizarEmMassa, alterarTipoEmMassa, alterarPrecoEmMassa, importarEmLote, criarProdutoComVariacoes, criarPecaComVariacoes, reporEstoque } = useProdutos();
  const { categorias, categoriasArvore, carregarCategorias, criarCategoria, atualizarCategoria, excluirCategoria } = useCategoriasProdutos();
  const { isFuncionario, permissoes } = useFuncionarioPermissoes();
  const { obterContagemProdutosMes, assinatura } = useAssinatura();
  const { config: configLoja } = useConfiguracaoLoja();
  const { trocas, criar: criarTroca, excluir: excluirTroca } = useTrocasGarantia();
  const { colunasVisiveis, toggleColuna, resetarColunas } = useColunasVisiveis();
  const [abaAtiva, setAbaAtiva] = useState<'estoque' | 'trocas'>('estoque');
  const [dialogTrocaAberto, setDialogTrocaAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [categoriasSelecionadas, setCategoriasSelecionadas] = useState<string[]>([]);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [dialogImportarAberto, setDialogImportarAberto] = useState(false);
  const [dialogLimiteAtingido, setDialogLimiteAtingido] = useState(false);
  const [dialogConfiguracoesAberto, setDialogConfiguracoesAberto] = useState(false);
  const [contadorProdutos, setContadorProdutos] = useState({ usados: 0, limite: -1, ilimitado: true });
  const [itemParaEditar, setItemParaEditar] = useState<ItemEstoque | null>(null);
  const [itemParaRepor, setItemParaRepor] = useState<ItemEstoque | null>(null);
  type OrdemFiltro = 'padrao' | 'menos_estoque' | 'mais_vendido';
  const [ordemFiltro, setOrdemFiltro] = useState<OrdemFiltro>('padrao');
  const [contagemVendas, setContagemVendas] = useState<Record<string, number>>({});

  const carregarContagemVendas = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const [{ data: vendasProdutos }, { data: vendasPecas }] = await Promise.all([
      supabase
        .from('vendas')
        .select('produto_id')
        .eq('user_id', session.user.id)
        .not('produto_id', 'is', null),
      supabase
        .from('vendas')
        .select('peca_id')
        .eq('user_id', session.user.id)
        .not('peca_id', 'is', null),
    ]);

    const contagem: Record<string, number> = {};
    (vendasProdutos || []).forEach(v => {
      if (v.produto_id) contagem[v.produto_id] = (contagem[v.produto_id] ?? 0) + 1;
    });
    (vendasPecas || []).forEach(v => {
      if (v.peca_id) contagem[v.peca_id] = (contagem[v.peca_id] ?? 0) + 1;
    });
    setContagemVendas(contagem);
  }, []);

  useEffect(() => {
    carregarTodos();
    carregarCategorias();
    carregarContador();
  }, [carregarTodos, carregarCategorias]);

  useEffect(() => {
    if (ordemFiltro === 'mais_vendido') carregarContagemVendas();
  }, [ordemFiltro, carregarContagemVendas]);

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

  const categoriasComNivel = useMemo(() => {
    const resultado: { categoria: typeof categorias[number]; nivel: number }[] = [];
    const percorrer = (lista: typeof categorias, nivel: number) => {
      lista.forEach((cat) => {
        resultado.push({ categoria: cat, nivel });
        if (cat.subcategorias?.length) percorrer(cat.subcategorias, nivel + 1);
      });
    };
    percorrer(categoriasArvore, 0);
    return resultado;
  }, [categoriasArvore]);

  const idsCategoriaFiltro = useMemo(() => {
    if (categoriasSelecionadas.length === 0) return [];
    const ids = new Set<string>();
    const buscarFilhos = (paiId: string) => {
      categorias
        .filter((c) => c.categoria_pai_id === paiId)
        .forEach((c) => {
          ids.add(c.id);
          buscarFilhos(c.id);
        });
    };
    categoriasSelecionadas.forEach((categoriaId) => {
      ids.add(categoriaId);
      buscarFilhos(categoriaId);
    });
    return Array.from(ids);
  }, [categoriasSelecionadas, categorias]);

  const itemsFiltrados = useMemo(() => {
    const filtrados = items.filter((item) => {
      if (idsCategoriaFiltro.length > 0 && (!item.categoria_id || !idsCategoriaFiltro.includes(item.categoria_id))) return false;
      const termoBusca = busca.toLowerCase().trim();
      if (!termoBusca) return true;
      const matchNome = item.nome.toLowerCase().includes(termoBusca);
      const matchCodigo = item.tipo === 'produto' && item.sku?.toLowerCase().includes(termoBusca);
      const matchCodigoBarras = item.codigo_barras?.toLowerCase().includes(termoBusca);
      const matchTipo = item.tipo.includes(termoBusca);
      return matchNome || matchCodigo || matchCodigoBarras || matchTipo;
    });

    if (ordemFiltro === 'menos_estoque') {
      return [...filtrados].sort((a, b) => a.quantidade - b.quantidade);
    }
    if (ordemFiltro === 'mais_vendido') {
      return [...filtrados].sort((a, b) => (contagemVendas[b.id] ?? 0) - (contagemVendas[a.id] ?? 0));
    }
    return filtrados;
  }, [items, busca, idsCategoriaFiltro, ordemFiltro, contagemVendas]);

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
      <main className="flex-1 min-w-0 p-4 sm:p-6 md:p-8">
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
                onClick={() => setDialogConfiguracoesAberto(true)}
              >
                <Settings className="w-4 h-4 mr-2" />
                Configurações
              </Button>
              <Button
                variant="outline"
                onClick={() => setDialogImportarAberto(true)}
              >
                <Upload className="w-4 h-4 mr-2" />
                Importar
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" disabled={loading}>
                    <FileDown className="w-4 h-4 mr-2" />
                    Exportar PDF
                    <ChevronDown className="w-3 h-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem
                    onClick={async () => {
                      if (items.length === 0) { toast.error('Nenhum item para exportar'); return; }
                      await exportarProdutosPDF(items, configLoja);
                      toast.success('PDF exportado com sucesso!');
                    }}
                  >
                    <Package className="w-4 h-4 mr-2 text-muted-foreground" />
                    Relatório completo
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={async () => {
                      if (items.length === 0) { toast.error('Nenhum item para exportar'); return; }
                      await exportarMenosEstoquePDF(items, configLoja);
                      toast.success('PDF de menor estoque exportado!');
                    }}
                  >
                    <TrendingDown className="w-4 h-4 mr-2 text-orange-500" />
                    Menor estoque
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={async () => {
                      if (items.length === 0) { toast.error('Nenhum item para exportar'); return; }
                      if (ordemFiltro !== 'mais_vendido' && Object.keys(contagemVendas).length === 0) {
                        await carregarContagemVendas();
                      }
                      await exportarMaisVendidosPDF(items, contagemVendas, configLoja);
                      toast.success('PDF de mais vendidos exportado!');
                    }}
                  >
                    <TrendingUp className="w-4 h-4 mr-2 text-green-500" />
                    Mais vendidos
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {abaAtiva === 'estoque' ? (
                <Button onClick={handleNovoItem}>
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Item
                </Button>
              ) : (
                <Button onClick={() => setDialogTrocaAberto(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Troca
                </Button>
              )}
            </div>
          </div>

          <Tabs value={abaAtiva} onValueChange={(v) => setAbaAtiva(v as 'estoque' | 'trocas')}>
            <TabsList>
              <TabsTrigger value="estoque">Estoque</TabsTrigger>
              <TabsTrigger value="trocas">
                <RefreshCw className="w-4 h-4 mr-2" />
                Trocas em Garantia
              </TabsTrigger>
            </TabsList>

            <TabsContent value="estoque" className="space-y-6 mt-6">
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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant={ordemFiltro !== 'padrao' ? 'default' : 'outline'}
                      size="icon"
                      title="Ordenar"
                    >
                      {ordemFiltro === 'menos_estoque' ? (
                        <TrendingDown className="w-4 h-4" />
                      ) : ordemFiltro === 'mais_vendido' ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : (
                        <ListFilter className="w-4 h-4" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuRadioGroup value={ordemFiltro} onValueChange={(v) => setOrdemFiltro(v as OrdemFiltro)}>
                      <DropdownMenuRadioItem value="padrao">
                        <ArrowUpDown className="w-4 h-4 mr-2 text-muted-foreground" />
                        Padrão
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="menos_estoque">
                        <TrendingDown className="w-4 h-4 mr-2 text-orange-500" />
                        Menor estoque primeiro
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="mais_vendido">
                        <TrendingUp className="w-4 h-4 mr-2 text-green-500" />
                        Mais vendidos primeiro
                      </DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
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
                  <span className="text-sm text-muted-foreground">Filtrar por categoria:</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 text-xs justify-between w-[220px]">
                        <span className="truncate">
                          {categoriasSelecionadas.length === 0
                            ? 'Todas as categorias'
                            : categoriasSelecionadas.length === 1
                              ? categorias.find((c) => c.id === categoriasSelecionadas[0])?.nome
                              : `${categoriasSelecionadas.length} categorias selecionadas`}
                        </span>
                        <ChevronDown className="w-3 h-3 ml-1 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[260px] p-2" align="start">
                      <div className="max-h-72 overflow-y-auto space-y-0.5">
                        {categoriasComNivel.map(({ categoria: cat, nivel }) => {
                          const marcada = categoriasSelecionadas.includes(cat.id);
                          return (
                            <label
                              key={cat.id}
                              className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer text-sm"
                              style={{ paddingLeft: nivel > 0 ? `${0.5 + nivel * 0.75}rem` : undefined }}
                            >
                              <Checkbox
                                checked={marcada}
                                onCheckedChange={(checked) => {
                                  setCategoriasSelecionadas((prev) =>
                                    checked ? [...prev, cat.id] : prev.filter((id) => id !== cat.id)
                                  );
                                }}
                              />
                              {nivel > 0 && <span className="text-muted-foreground">→</span>}
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.cor }} />
                              <span className="truncate">{cat.nome}</span>
                            </label>
                          );
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>
                  {categoriasSelecionadas.length > 1 && (
                    <Badge variant="secondary" className="text-xs">
                      {categoriasSelecionadas.length} categorias selecionadas
                    </Badge>
                  )}
                  {categoriasSelecionadas.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => setCategoriasSelecionadas([])} className="text-xs h-7">
                      <X className="w-3 h-3 mr-1" />
                      Limpar
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
                  todosItems={items}
                  categorias={categorias}
                  colunasVisiveis={colunasVisiveis}
                  onEdit={handleEdit}
                  onDelete={excluir}
                  onDeleteBulk={excluirEmMassa}
                  onCategorizarEmMassa={categorizarEmMassa}
                  onAlterarTipoEmMassa={alterarTipoEmMassa}
                  onAlterarPrecoEmMassa={alterarPrecoEmMassa}
                  onReporEstoque={(item) => setItemParaRepor(item)}
                  onAtualizado={carregarTodos}
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
            </TabsContent>

            <TabsContent value="trocas" className="space-y-6 mt-6">
              <RankingProdutosDefeito trocas={trocas} />
              <TabelaTrocasGarantia trocas={trocas} onExcluir={excluirTroca} />
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Dialog de Cadastro/Edição */}
      <DialogCadastroProduto
        open={dialogAberto}
        onOpenChange={handleDialogClose}
        onSubmit={handleSubmit}
        onSubmitComVariacoes={criarProdutoComVariacoes}
        onSubmitPecaComVariacoes={criarPecaComVariacoes}
        itemParaEditar={itemParaEditar}
        categorias={categorias}
      />

      {/* Dialog de Importação */}
      <DialogImportarProdutos
        open={dialogImportarAberto}
        onOpenChange={setDialogImportarAberto}
        onImportar={importarEmLote}
        categorias={categorias}
      />

      {/* Dialog de Limite Atingido */}
      <DialogLimiteAtingido
        open={dialogLimiteAtingido}
        onOpenChange={setDialogLimiteAtingido}
        tipo="produtos"
        usados={contadorProdutos.usados}
        limite={contadorProdutos.limite}
      />

      {/* Dialog de Configurações (Categorias e Colunas) */}
      <DialogConfiguracoesProdutos
        open={dialogConfiguracoesAberto}
        onOpenChange={setDialogConfiguracoesAberto}
        categorias={categorias}
        onCriarCategoria={criarCategoria}
        onAtualizarCategoria={atualizarCategoria}
        onExcluirCategoria={excluirCategoria}
        colunasVisiveis={colunasVisiveis}
        onToggleColuna={toggleColuna}
        onResetarColunas={resetarColunas}
      />

      {/* Dialog de Reposição de Estoque */}
      <DialogReporEstoque
        open={!!itemParaRepor}
        onOpenChange={(open) => !open && setItemParaRepor(null)}
        item={itemParaRepor}
        onConfirmar={reporEstoque}
      />

      {/* Dialog de Nova Troca em Garantia */}
      <DialogNovaTrocaGarantia
        open={dialogTrocaAberto}
        onOpenChange={setDialogTrocaAberto}
        produtos={items}
        onConfirmar={criarTroca}
      />
    </AppLayout>
  );
};

export default Produtos;
