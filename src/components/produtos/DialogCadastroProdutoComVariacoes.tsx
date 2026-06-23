import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { LeitorCodigoBarras } from '@/components/scanner/LeitorCodigoBarras';
import { CategoriaProduto } from '@/types/categoria-produto';
import { VariacaoInput } from '@/types/produto';
import { useFornecedores } from '@/hooks/useFornecedores';
import { Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface DialogCadastroProdutoComVariacoesProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (nomeBase: string, variacoes: VariacaoInput[], categoriaId?: string, fornecedorId?: string) => Promise<boolean>;
  categorias?: CategoriaProduto[];
}

interface ConfigPadrao {
  nomeBase: string;
  variacoesTexto: string;
  quantidade: number;
  custo: number;
  preco: number;
  precoAtacado: string;
  categoriaId?: string;
  fornecedorId?: string;
}

const configInicial: ConfigPadrao = {
  nomeBase: '',
  variacoesTexto: '',
  quantidade: 0,
  custo: 0,
  preco: 0,
  precoAtacado: '',
  categoriaId: undefined,
  fornecedorId: undefined,
};

export const DialogCadastroProdutoComVariacoes = ({
  open,
  onOpenChange,
  onSubmit,
  categorias = [],
}: DialogCadastroProdutoComVariacoesProps) => {
  const { fornecedores } = useFornecedores();
  const [etapa, setEtapa] = useState<'config' | 'revisao'>('config');
  const [config, setConfig] = useState<ConfigPadrao>(configInicial);
  const [linhas, setLinhas] = useState<VariacaoInput[]>([]);
  const [salvando, setSalvando] = useState(false);

  const fornecedoresAtivos = fornecedores.filter(f => f.ativo);

  const resetar = () => {
    setEtapa('config');
    setConfig(configInicial);
    setLinhas([]);
  };

  const handleClose = (novoOpen: boolean) => {
    if (!novoOpen) resetar();
    onOpenChange(novoOpen);
  };

  const handleContinuar = () => {
    if (!config.nomeBase.trim()) {
      toast.error('Informe o nome base do produto');
      return;
    }

    const labels = config.variacoesTexto
      .split(/[,\n]/)
      .map(s => s.trim())
      .filter(Boolean);

    if (labels.length === 0) {
      toast.error('Informe ao menos uma variação (ex: iPhone 11, iPhone 12)');
      return;
    }

    const precoAtacadoNum = config.precoAtacado.trim() === '' ? null : Number(config.precoAtacado);

    setLinhas(labels.map(label => ({
      label,
      sku: '',
      codigo_barras: '',
      quantidade: config.quantidade,
      custo: config.custo,
      preco: config.preco,
      preco_atacado: precoAtacadoNum,
    })));
    setEtapa('revisao');
  };

  const atualizarLinha = (index: number, patch: Partial<VariacaoInput>) => {
    setLinhas(prev => prev.map((linha, i) => i === index ? { ...linha, ...patch } : linha));
  };

  const removerLinha = (index: number) => {
    setLinhas(prev => prev.filter((_, i) => i !== index));
  };

  const adicionarLinha = () => {
    setLinhas(prev => [...prev, {
      label: '',
      sku: '',
      codigo_barras: '',
      quantidade: config.quantidade,
      custo: config.custo,
      preco: config.preco,
      preco_atacado: config.precoAtacado.trim() === '' ? null : Number(config.precoAtacado),
    }]);
  };

  const handleCadastrar = async () => {
    if (linhas.length === 0) {
      toast.error('Adicione ao menos uma variação');
      return;
    }
    for (const linha of linhas) {
      if (!linha.label.trim()) {
        toast.error('Todas as variações precisam de um nome/modelo');
        return;
      }
      if (linha.preco < linha.custo) {
        toast.error(`"${linha.label}": preço de venda deve ser maior ou igual ao custo`);
        return;
      }
    }

    setSalvando(true);
    const sucesso = await onSubmit(config.nomeBase.trim(), linhas, config.categoriaId, config.fornecedorId);
    setSalvando(false);

    if (sucesso) {
      handleClose(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-3xl sm:max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cadastrar Produto com Variações</DialogTitle>
          <DialogDescription>
            Cadastre várias variações do mesmo produto de uma vez (ex: modelos de capinha)
          </DialogDescription>
        </DialogHeader>

        {etapa === 'config' ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome base do produto *</Label>
              <Input
                placeholder="Ex: Capa Space"
                value={config.nomeBase}
                onChange={e => setConfig(c => ({ ...c, nomeBase: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Variações (modelos) *</Label>
              <Textarea
                placeholder={'Separe por vírgula ou uma por linha. Ex:\niPhone 11\niPhone 12\niPhone 13'}
                value={config.variacoesTexto}
                onChange={e => setConfig(c => ({ ...c, variacoesTexto: e.target.value }))}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Cada variação será criada como "{config.nomeBase || 'Nome base'} - Modelo"
              </p>
            </div>

            <div className="space-y-2">
              <Label>Fornecedor (Opcional)</Label>
              <Select
                onValueChange={(value) => setConfig(c => ({ ...c, fornecedorId: value === 'none' ? undefined : value }))}
                value={config.fornecedorId || 'none'}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um fornecedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum fornecedor</SelectItem>
                  {fornecedoresAtivos.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Categoria (Opcional)</Label>
              <Select
                onValueChange={(value) => setConfig(c => ({ ...c, categoriaId: value === 'none' ? undefined : value }))}
                value={config.categoriaId || 'none'}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem categoria</SelectItem>
                  {categorias.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <span className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: cat.cor }} />
                        {cat.nome}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <p className="text-sm font-medium pt-2">Valores padrão (ajustáveis por variação depois)</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantidade em estoque</Label>
                <Input
                  type="number" min="0"
                  value={config.quantidade}
                  onChange={e => setConfig(c => ({ ...c, quantidade: Number(e.target.value) }))}
                />
              </div>
              <div />
              <div className="space-y-2">
                <Label>Preço de custo</Label>
                <Input
                  type="number" step="0.01" min="0"
                  value={config.custo}
                  onChange={e => setConfig(c => ({ ...c, custo: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Preço de venda</Label>
                <Input
                  type="number" step="0.01" min="0"
                  value={config.preco}
                  onChange={e => setConfig(c => ({ ...c, preco: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Preço de atacado (Opcional)</Label>
                <Input
                  type="number" step="0.01" min="0"
                  placeholder="Opcional"
                  value={config.precoAtacado}
                  onChange={e => setConfig(c => ({ ...c, precoAtacado: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
              <Button onClick={handleContinuar}>Continuar</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[160px]">Nome final</TableHead>
                    <TableHead className="min-w-[120px]">SKU</TableHead>
                    <TableHead className="min-w-[180px]">Código de barras</TableHead>
                    <TableHead className="min-w-[90px]">Qtd</TableHead>
                    <TableHead className="min-w-[110px]">Custo</TableHead>
                    <TableHead className="min-w-[110px]">Preço</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linhas.map((linha, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Input
                          value={linha.label}
                          placeholder="Modelo"
                          onChange={e => atualizarLinha(index, { label: e.target.value })}
                        />
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {config.nomeBase || 'Nome base'} - {linha.label || '...'}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={linha.sku || ''}
                          placeholder="Opcional"
                          onChange={e => atualizarLinha(index, { sku: e.target.value })}
                        />
                      </TableCell>
                      <TableCell>
                        <LeitorCodigoBarras
                          valor={linha.codigo_barras || ''}
                          onChange={(v) => atualizarLinha(index, { codigo_barras: v })}
                          onCodigoLido={(v) => atualizarLinha(index, { codigo_barras: v })}
                          placeholder="Opcional"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number" min="0"
                          value={linha.quantidade}
                          onChange={e => atualizarLinha(index, { quantidade: Number(e.target.value) })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number" step="0.01" min="0"
                          value={linha.custo}
                          onChange={e => atualizarLinha(index, { custo: Number(e.target.value) })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number" step="0.01" min="0"
                          value={linha.preco}
                          onChange={e => atualizarLinha(index, { preco: Number(e.target.value) })}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button" variant="ghost" size="icon"
                          onClick={() => removerLinha(index)}
                          title="Remover variação"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Button type="button" variant="outline" size="sm" onClick={adicionarLinha} className="gap-2">
              <Plus className="h-4 w-4" />
              Adicionar variação
            </Button>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setEtapa('config')}>Voltar</Button>
              <Button onClick={handleCadastrar} disabled={salvando}>
                {salvando ? 'Cadastrando...' : `Cadastrar ${linhas.length} variação(ões)`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
