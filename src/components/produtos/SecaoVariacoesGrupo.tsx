import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Pencil, Check, X, Plus, Link2Off, Loader2 } from 'lucide-react';
import { ItemEstoque, getPaiIdVariacao } from '@/types/produto';
import { formatCurrency } from '@/lib/formatters';

interface NovaVariacaoForm {
  nome: string;
  label: string;
  quantidade: number;
  custo: number;
  preco: number;
  codigo_barras: string;
}

const NOVA_VARIACAO_VAZIA: NovaVariacaoForm = {
  nome: '',
  label: '',
  quantidade: 0,
  custo: 0,
  preco: 0,
  codigo_barras: '',
};

interface SecaoVariacoesGrupoProps {
  /** Raiz + todas as variações do grupo (qualquer ordem). */
  grupo: ItemEstoque[];
  /** id do item que está aberto no dialog agora — usado só pra destacar a linha. */
  itemAtualId: string;
  tipo: 'produto' | 'peca';
  podeEditar: boolean;
  onRenomear: (id: string, tipo: 'produto' | 'peca', novoLabel: string) => Promise<boolean>;
  onAdicionar: (grupoRootId: string, tipo: 'produto' | 'peca', dados: {
    nome: string;
    label: string;
    quantidade: number;
    custo: number;
    preco: number;
    preco_atacado: number | null;
    codigo_barras?: string;
    categoria_id?: string | null;
    fornecedor_id?: string | null;
  }) => Promise<boolean>;
  onRemoverDoGrupo: (id: string, tipo: 'produto' | 'peca') => Promise<boolean>;
}

/**
 * Seção "Variações deste item" — só aparece dentro de DialogCadastroProduto
 * quando o item sendo editado é uma variação (tem produto_pai_id/peca_pai_id)
 * ou é raiz de um grupo com outras variações. Até esta seção existir,
 * variação era write-once: só dava pra criar no cadastro em lote, nunca
 * editar/adicionar/remover depois — ver comentários em useProdutos.ts.
 */
export function SecaoVariacoesGrupo({
  grupo,
  itemAtualId,
  tipo,
  podeEditar,
  onRenomear,
  onAdicionar,
  onRemoverDoGrupo,
}: SecaoVariacoesGrupoProps) {
  const raiz = grupo.find((i) => !getPaiIdVariacao(i)) ?? grupo[0];

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [labelEmEdicao, setLabelEmEdicao] = useState('');
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [removendoId, setRemovendoId] = useState<string | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [novaVariacao, setNovaVariacao] = useState<NovaVariacaoForm>(NOVA_VARIACAO_VAZIA);
  const [adicionando, setAdicionando] = useState(false);

  const iniciarEdicao = (item: ItemEstoque) => {
    setEditandoId(item.id);
    setLabelEmEdicao(item.variacao_label || '');
  };

  const salvarLabel = async (id: string) => {
    setSalvandoId(id);
    const ok = await onRenomear(id, tipo, labelEmEdicao);
    setSalvandoId(null);
    if (ok) setEditandoId(null);
  };

  const remover = async (id: string) => {
    setRemovendoId(id);
    await onRemoverDoGrupo(id, tipo);
    setRemovendoId(null);
  };

  const handleAdicionar = async () => {
    if (!novaVariacao.nome.trim()) return;
    setAdicionando(true);
    const ok = await onAdicionar(raiz.id, tipo, {
      nome: novaVariacao.nome,
      label: novaVariacao.label,
      quantidade: novaVariacao.quantidade,
      custo: novaVariacao.custo,
      preco: novaVariacao.preco,
      preco_atacado: null,
      codigo_barras: novaVariacao.codigo_barras || undefined,
      categoria_id: raiz.categoria_id,
      fornecedor_id: raiz.fornecedor_id,
    });
    setAdicionando(false);
    if (ok) {
      setNovaVariacao(NOVA_VARIACAO_VAZIA);
      setMostrarForm(false);
    }
  };

  return (
    <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
      <div>
        <Label>Variações deste item</Label>
        <p className="text-xs text-muted-foreground">
          Grupo: "{raiz.nome}" — renomeie o modelo de cada variação, adicione novas ou desvincule uma do grupo.
        </p>
      </div>

      <div className="space-y-2">
        {grupo.map((item) => {
          const ehRaiz = item.id === raiz.id;
          const ehAtual = item.id === itemAtualId;
          return (
            <div
              key={item.id}
              className={`flex items-center gap-2 rounded-md border p-2 ${ehAtual ? 'border-primary bg-primary/5' : ''}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium truncate">{item.nome}</span>
                  {ehRaiz && <Badge variant="outline" className="text-[10px]">raiz</Badge>}
                  {ehAtual && <Badge className="text-[10px]">editando</Badge>}
                </div>

                {editandoId === item.id ? (
                  <div className="flex items-center gap-1 mt-1">
                    <Input
                      value={labelEmEdicao}
                      onChange={(e) => setLabelEmEdicao(e.target.value)}
                      placeholder="Ex: iPhone 11 Pro Max"
                      className="h-8 text-sm"
                      autoFocus
                    />
                    <Button
                      type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0"
                      onClick={() => salvarLabel(item.id)}
                      disabled={salvandoId === item.id}
                    >
                      {salvandoId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-green-600" />}
                    </Button>
                    <Button
                      type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0"
                      onClick={() => setEditandoId(null)}
                      disabled={salvandoId === item.id}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {item.variacao_label || 'Sem nome de variação'} · {formatCurrency(item.preco)} · estoque: {item.quantidade}
                  </p>
                )}
              </div>

              {editandoId !== item.id && podeEditar && (
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button" variant="ghost" size="icon" className="h-8 w-8"
                    onClick={() => iniciarEdicao(item)}
                    title="Renomear variação"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {!ehRaiz && (
                    <Button
                      type="button" variant="ghost" size="icon" className="h-8 w-8"
                      onClick={() => remover(item.id)}
                      disabled={removendoId === item.id}
                      title="Desvincular do grupo (vira item avulso)"
                    >
                      {removendoId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2Off className="h-3.5 w-3.5 text-destructive" />}
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {podeEditar && (
        mostrarForm ? (
          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Nova variação</span>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMostrarForm(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nome completo</Label>
              <Input
                placeholder={`Ex: ${raiz.nome.split(' - ')[0] || raiz.nome} - iPhone 13`}
                value={novaVariacao.nome}
                onChange={(e) => setNovaVariacao((v) => ({ ...v, nome: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Modelo (rótulo da variação)</Label>
              <Input
                placeholder="Ex: iPhone 13"
                value={novaVariacao.label}
                onChange={(e) => setNovaVariacao((v) => ({ ...v, label: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Quantidade</Label>
                <Input
                  type="number" min="0"
                  value={novaVariacao.quantidade}
                  onChange={(e) => setNovaVariacao((v) => ({ ...v, quantidade: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Custo</Label>
                <Input
                  type="number" step="0.01" min="0"
                  value={novaVariacao.custo}
                  onChange={(e) => setNovaVariacao((v) => ({ ...v, custo: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Venda</Label>
                <Input
                  type="number" step="0.01" min="0"
                  value={novaVariacao.preco}
                  onChange={(e) => setNovaVariacao((v) => ({ ...v, preco: Number(e.target.value) }))}
                />
              </div>
            </div>
            <Button type="button" size="sm" className="w-full" onClick={handleAdicionar} disabled={adicionando || !novaVariacao.nome.trim()}>
              {adicionando ? 'Adicionando...' : 'Adicionar ao grupo'}
            </Button>
          </div>
        ) : (
          <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => setMostrarForm(true)}>
            <Plus className="h-4 w-4" />
            Adicionar variação a este grupo
          </Button>
        )
      )}
    </div>
  );
}
