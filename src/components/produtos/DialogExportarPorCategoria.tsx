import { useEffect, useMemo, useState } from 'react';
import { Download, FileSpreadsheet, FileText, Loader2, Search, Tags } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { ItemEstoque } from '@/types/produto';
import type { CategoriaProduto } from '@/types/categoria-produto';
import type { ConfiguracaoLoja } from '@/types/configuracao-loja';
import { exportarCategoriasPDF } from '@/lib/exportarProdutosPDF';
import {
  SEM_CATEGORIA,
  agruparPorCategoria,
  alternarCategoria,
  contarComSubcategorias,
  contarItensPorCategoria,
  descendentes,
  estadoCaixa,
  filtrarItens,
  ordemDaArvore,
  selecionarTodas,
} from '@/lib/produtos/exportarPorCategoria';

type Formato = 'pdf' | 'xlsx';

interface DialogExportarPorCategoriaProps {
  aberto: boolean;
  onFechar: () => void;
  /** Os mesmos itens da tela (já com o critério de loja/funcionário do useProdutos). */
  items: ItemEstoque[];
  categorias: CategoriaProduto[];
  configLoja?: ConfiguracaoLoja | null;
  /** Começa com a escolha do menu Exportar; mudar aqui também vale para o menu (mesma preferência). */
  mostrarCustoELucro: boolean;
  onMostrarCustoELucroChange: (valor: boolean) => void;
}

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function DialogExportarPorCategoria({
  aberto,
  onFechar,
  items,
  categorias,
  configLoja,
  mostrarCustoELucro,
  onMostrarCustoELucroChange,
}: DialogExportarPorCategoriaProps) {
  const [selecao, setSelecao] = useState<Set<string>>(new Set());
  const [formato, setFormato] = useState<Formato>('pdf');
  const [somenteComEstoque, setSomenteComEstoque] = useState(false);
  const [busca, setBusca] = useState('');
  const [exportando, setExportando] = useState(false);

  // Cada abertura começa limpa.
  useEffect(() => {
    if (aberto) {
      setSelecao(new Set());
      setBusca('');
      setSomenteComEstoque(false);
    }
  }, [aberto]);

  const opcoes = useMemo(() => ({ somenteComEstoque }), [somenteComEstoque]);
  const arvore = useMemo(() => ordemDaArvore(categorias), [categorias]);
  const contagem = useMemo(() => contarItensPorCategoria(items, categorias, opcoes), [items, categorias, opcoes]);
  const temFilhas = useMemo(() => {
    const pais = new Set(categorias.map((c) => c.categoria_pai_id).filter((id): id is string => !!id));
    return (id: string) => pais.has(id);
  }, [categorias]);

  // Busca: mostra a categoria que bate e os "pais" dela, para não perder o contexto da árvore.
  const linhasVisiveis = useMemo(() => {
    const termo = normalizar(busca.trim());
    if (!termo) return arvore;
    const visiveis = new Set<string>();
    const porId = new Map(categorias.map((c) => [c.id, c]));
    for (const { categoria } of arvore) {
      if (!normalizar(categoria.nome).includes(termo)) continue;
      let atual: CategoriaProduto | undefined = categoria;
      while (atual && !visiveis.has(atual.id)) {
        visiveis.add(atual.id);
        atual = atual.categoria_pai_id ? porId.get(atual.categoria_pai_id) : undefined;
      }
    }
    return arvore.filter(({ categoria }) => visiveis.has(categoria.id));
  }, [arvore, busca, categorias]);
  const mostrarSemCategoria = !busca.trim() || normalizar('sem categoria').includes(normalizar(busca.trim()));

  const itensEscolhidos = useMemo(
    () => filtrarItens(items, selecao, categorias, opcoes),
    [items, selecao, categorias, opcoes],
  );

  const alternar = (id: string) => setSelecao((atual) => alternarCategoria(atual, id, categorias));

  const exportar = async () => {
    if (selecao.size === 0) return;
    if (itensEscolhidos.length === 0) {
      toast.error('As categorias escolhidas não têm itens', {
        description: somenteComEstoque ? 'Tente desligar "Somente itens com estoque".' : undefined,
      });
      return;
    }
    setExportando(true);
    try {
      const grupos = agruparPorCategoria(itensEscolhidos, categorias);
      if (formato === 'pdf') {
        await exportarCategoriasPDF(grupos, configLoja, {
          observacao: somenteComEstoque ? 'Somente itens com estoque' : undefined,
          mostrarCustoELucro,
        });
      } else {
        // xlsx é pesado: só carrega quando a pessoa escolhe Excel.
        const { exportarCategoriasExcel } = await import('@/lib/produtos/exportarCategoriasExcel');
        exportarCategoriasExcel(grupos, configLoja?.nome_loja || 'Minha Loja', { mostrarCustoELucro });
      }
      toast.success(formato === 'pdf' ? 'PDF exportado com sucesso!' : 'Planilha exportada com sucesso!');
      onFechar();
    } catch (error) {
      console.error('Erro ao exportar relatório por categoria:', error);
      toast.error('Não foi possível gerar o arquivo', { description: 'Tente de novo em instantes.' });
    } finally {
      setExportando(false);
    }
  };

  const linhaCategoria = (id: string, nome: string, nivel: number, cor?: string | null) => {
    const estado = estadoCaixa(selecao, id, categorias);
    const direto = contagem.get(id) ?? 0;
    const pai = id !== SEM_CATEGORIA && temFilhas(id);
    const total = pai ? contarComSubcategorias(id, contagem, categorias) : direto;
    const nFilhas = pai ? descendentes(id, categorias).length : 0;
    return (
      <label
        key={id}
        htmlFor={`exp-cat-${id}`}
        className="flex items-center gap-3 rounded-md px-2 py-2 cursor-pointer hover:bg-muted/50"
        style={{ paddingLeft: `${0.5 + nivel * 1.25}rem` }}
      >
        <Checkbox
          id={`exp-cat-${id}`}
          checked={estado}
          onCheckedChange={() => alternar(id)}
          className="h-4 w-4"
        />
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: cor || '#888888' }}
          aria-hidden
        />
        <span className="flex-1 min-w-0">
          <span className={cn('block truncate text-sm', nivel === 0 && 'font-medium')}>{nome}</span>
          {pai && (
            <span className="block text-[11px] text-muted-foreground">
              inclui {nFilhas} {nFilhas === 1 ? 'subcategoria' : 'subcategorias'} • {total} {total === 1 ? 'item' : 'itens'} no total
            </span>
          )}
        </span>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">
          {direto}
        </span>
      </label>
    );
  };

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && !exportando && onFechar()}>
      <DialogContent className="flex max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-md flex-col gap-4 p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Tags className="h-4 w-4" />
            Exportar relatório por categoria
          </DialogTitle>
          <DialogDescription className="text-xs">
            Escolha as categorias. Marcar uma categoria inclui as subcategorias dela; dá para desmarcar uma subcategoria sozinha.
          </DialogDescription>
        </DialogHeader>

        {/* Busca + atalhos */}
        <div className="space-y-2">
          {categorias.length > 8 && (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar categoria..."
                className="h-8 pl-8 text-sm"
              />
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {selecao.size === 0 ? 'Nenhuma categoria marcada' : `${selecao.size} marcada${selecao.size === 1 ? '' : 's'}`}
            </span>
            <div className="flex gap-1">
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setSelecao(selecionarTodas(categorias))}>
                Selecionar todas
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setSelecao(new Set())} disabled={selecao.size === 0}>
                Limpar
              </Button>
            </div>
          </div>
        </div>

        {/* Lista de categorias */}
        <div className="min-h-[8rem] flex-1 overflow-y-auto overscroll-contain rounded-lg border p-1">
          {linhasVisiveis.map(({ categoria, nivel }) => linhaCategoria(categoria.id, categoria.nome, nivel, categoria.cor))}
          {mostrarSemCategoria && linhaCategoria(SEM_CATEGORIA, 'Sem categoria', 0, null)}
          {linhasVisiveis.length === 0 && !mostrarSemCategoria && (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">Nenhuma categoria encontrada.</p>
          )}
        </div>

        {/* Formato + filtro */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {([
              { valor: 'pdf', rotulo: 'PDF', Icone: FileText },
              { valor: 'xlsx', rotulo: 'Excel (.xlsx)', Icone: FileSpreadsheet },
            ] as const).map(({ valor, rotulo, Icone }) => (
              <button
                key={valor}
                type="button"
                onClick={() => setFormato(valor)}
                aria-pressed={formato === valor}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
                  formato === valor ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-muted/20 hover:bg-muted/40',
                )}
              >
                <Icone className="h-4 w-4" />
                {rotulo}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="exp-cat-estoque" className="text-sm font-normal">
              Somente itens com estoque
            </Label>
            <Switch id="exp-cat-estoque" checked={somenteComEstoque} onCheckedChange={setSomenteComEstoque} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="exp-cat-custo-lucro" className="text-sm font-normal">
              Mostrar custo e lucro
            </Label>
            <Checkbox
              id="exp-cat-custo-lucro"
              checked={mostrarCustoELucro}
              onCheckedChange={(v) => onMostrarCustoELucroChange(v === true)}
              className="h-4 w-4"
            />
          </div>
        </div>

        {/* Resumo + botões */}
        <div className="flex flex-col gap-2 border-t border-border/40 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-muted-foreground">
            {selecao.size > 0 && itensEscolhidos.length === 0 ? (
              <span className="text-destructive">As categorias escolhidas não têm itens.</span>
            ) : (
              <>
                <span className="font-semibold text-foreground">{itensEscolhidos.length}</span>{' '}
                {itensEscolhidos.length === 1 ? 'item será exportado' : 'itens serão exportados'}
              </>
            )}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onFechar} disabled={exportando} className="h-9 flex-1 text-xs sm:h-8 sm:flex-none">
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={exportar}
              disabled={exportando || selecao.size === 0 || itensEscolhidos.length === 0}
              className="h-9 flex-1 gap-1.5 text-xs sm:h-8 sm:flex-none"
            >
              {exportando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              {exportando ? 'Gerando...' : formato === 'pdf' ? 'Exportar PDF' : 'Exportar Excel'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
