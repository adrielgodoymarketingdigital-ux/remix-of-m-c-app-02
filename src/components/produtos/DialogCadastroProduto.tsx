import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ItemEstoque, FormularioProduto, VariacaoInput } from '@/types/produto';
import { CategoriaProduto } from '@/types/categoria-produto';
import { ordenarCategoriasHierarquicamente } from '@/lib/categorias';
import { formatCurrency } from '@/lib/formatters';
import { LeitorCodigoBarras } from '@/components/scanner/LeitorCodigoBarras';
import { UploadFotosProduto } from './UploadFotosProduto';
import { useFornecedores } from '@/hooks/useFornecedores';
import { DialogCadastroFornecedor } from '@/components/fornecedores/DialogCadastroFornecedor';
import { FormularioFornecedor } from '@/types/fornecedor';
import { Plus, Lock, Trash2, ArrowDownToLine } from 'lucide-react';
import { useFuncionarioPermissoes } from '@/hooks/useFuncionarioPermissoes';
import { toast } from 'sonner';

const formSchema = z.object({
  tipo: z.enum(['produto', 'peca'], {
    required_error: 'Selecione o tipo',
  }),
  codigo: z.string().optional(),
  nome: z.string().min(1, 'Nome é obrigatório').max(200, 'Nome muito longo'),
  quantidade: z.coerce.number().int().min(0, 'Quantidade não pode ser negativa'),
  custo: z.coerce.number().min(0, 'Custo deve ser positivo'),
  preco: z.coerce.number().min(0, 'Preço deve ser positivo'),
  preco_atacado: z.coerce.number().min(0, 'Preço de atacado deve ser positivo').nullable().optional(),
  codigo_barras: z.string().optional(),
  fornecedor_id: z.string().optional(),
  categoria_id: z.string().optional(),
}).refine(data => data.preco >= data.custo, {
  message: 'Preço de venda deve ser maior ou igual ao custo',
  path: ['preco'],
});

interface DialogCadastroProdutoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (dados: FormularioProduto) => Promise<boolean>;
  onSubmitComVariacoes: (nomeBase: string, variacoes: VariacaoInput[], categoriaId?: string, fornecedorId?: string) => Promise<boolean>;
  onSubmitPecaComVariacoes?: (nomeBase: string, variacoes: VariacaoInput[], categoriaId?: string, fornecedorId?: string) => Promise<boolean>;
  itemParaEditar?: ItemEstoque | null;
  categorias?: CategoriaProduto[];
}

export const DialogCadastroProduto = ({
  open,
  onOpenChange,
  onSubmit,
  onSubmitComVariacoes,
  onSubmitPecaComVariacoes,
  itemParaEditar,
  categorias = [],
}: DialogCadastroProdutoProps) => {
  const [fotos, setFotos] = useState<string[]>([]);
  const [dialogFornecedorAberto, setDialogFornecedorAberto] = useState(false);
  const { fornecedores, criarFornecedor, refetch: refetchFornecedores } = useFornecedores();
  const { podeVerCustos, podeVerLucros, podeEditarProdutos, isFuncionario } = useFuncionarioPermissoes();
  const [temVariacoes, setTemVariacoes] = useState(false);
  const [variacoes, setVariacoes] = useState<VariacaoInput[]>([]);
  const [enviando, setEnviando] = useState(false);

  const form = useForm<FormularioProduto>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tipo: 'produto',
      codigo: '',
      nome: '',
      quantidade: 0,
      custo: 0,
      preco: 0,
      preco_atacado: null,
      codigo_barras: '',
      fornecedor_id: undefined,
      categoria_id: undefined,
    },
  });

  const custo = form.watch('custo');
  const preco = form.watch('preco');
  const lucro = preco - custo;

  useEffect(() => {
    if (!open) return;
    if (itemParaEditar) {
      form.reset({
        tipo: itemParaEditar.tipo,
        codigo: itemParaEditar.tipo === 'produto' ? itemParaEditar.sku || '' : '',
        nome: itemParaEditar.nome,
        quantidade: itemParaEditar.quantidade,
        custo: itemParaEditar.custo,
        preco: itemParaEditar.preco,
        preco_atacado: itemParaEditar.preco_atacado ?? null,
        codigo_barras: (itemParaEditar as any).codigo_barras || '',
        fornecedor_id: itemParaEditar.fornecedor_id || undefined,
        categoria_id: itemParaEditar.categoria_id || undefined,
      });
      setFotos(itemParaEditar.fotos || []);
      setTemVariacoes(false);
      setVariacoes([]);
    } else {
      form.reset({
        tipo: 'produto',
        codigo: '',
        nome: '',
        quantidade: 0,
        custo: 0,
        preco: 0,
        preco_atacado: null,
        codigo_barras: '',
        fornecedor_id: undefined,
        categoria_id: undefined,
      });
      setFotos([]);
      setTemVariacoes(false);
      setVariacoes([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemParaEditar, open]);

  const handleSubmit = async (dados: FormularioProduto) => {
    if (temVariacoes && !itemParaEditar) {
      if (variacoes.length === 0) {
        toast.error('Adicione ao menos uma variação (ex: iPhone 11, iPhone 12)');
        return;
      }
      for (const v of variacoes) {
        if (!v.label.trim()) {
          toast.error('Todas as variações precisam de um nome/modelo');
          return;
        }
        if (v.preco < v.custo) {
          toast.error(`"${v.label}": preço de venda deve ser maior ou igual ao custo`);
          return;
        }
      }
      setEnviando(true);
      const callbackVariacoes = dados.tipo === 'peca' && onSubmitPecaComVariacoes
        ? onSubmitPecaComVariacoes
        : onSubmitComVariacoes;
      const sucesso = await callbackVariacoes(dados.nome, variacoes, dados.categoria_id, dados.fornecedor_id);
      setEnviando(false);
      if (sucesso) {
        onOpenChange(false);
      }
      return;
    }

    const sucesso = await onSubmit({ ...dados, fotos });
    if (sucesso) {
      onOpenChange(false);
    }
  };

  const adicionarVariacao = () => {
    setVariacoes(prev => [...prev, {
      label: '',
      sku: '',
      codigo_barras: '',
      quantidade: form.getValues('quantidade') || 0,
      custo: form.getValues('custo') || 0,
      preco: form.getValues('preco') || 0,
      preco_atacado: form.getValues('preco_atacado') ?? null,
    }]);
  };

  const atualizarVariacao = (index: number, patch: Partial<VariacaoInput>) => {
    setVariacoes(prev => prev.map((v, i) => i === index ? { ...v, ...patch } : v));
  };

  const usarValorDoPai = (index: number) => {
    atualizarVariacao(index, {
      quantidade: form.getValues('quantidade') || 0,
      custo: form.getValues('custo') || 0,
      preco: form.getValues('preco') || 0,
      preco_atacado: form.getValues('preco_atacado') ?? null,
    });
  };

  const removerVariacao = (index: number) => {
    setVariacoes(prev => prev.filter((_, i) => i !== index));
  };

  const handleCriarFornecedor = async (dados: FormularioFornecedor) => {
    const sucesso = await criarFornecedor(dados);
    if (sucesso) {
      await refetchFornecedores();
      // After refresh, we can't easily get the new ID, but the list will be updated
    }
    return sucesso;
  };

  const fornecedoresAtivos = fornecedores.filter(f => f.ativo);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl sm:max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {itemParaEditar ? 'Editar Item' : 'Cadastrar Novo Item'}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Item</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={(v) => { field.onChange(v); setTemVariacoes(false); setVariacoes([]); }}
                        value={field.value}
                        className="flex gap-4"
                        disabled={!!itemParaEditar}
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="produto" id="produto" />
                          <Label htmlFor="produto">Produto</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="peca" id="peca" />
                          <Label htmlFor="peca">Peça</Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {form.watch('tipo') === 'produto' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="codigo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SKU (Código Interno)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ex: PRD-001"
                            value={field.value || ''}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="codigo_barras"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código de Barras (EAN/UPC)</FormLabel>
                        <FormControl>
                          <LeitorCodigoBarras
                            valor={field.value || ''}
                            onChange={field.onChange}
                            onCodigoLido={field.onChange}
                            placeholder="Escaneie ou digite"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {form.watch('tipo') === 'peca' && (
                <FormField
                  control={form.control}
                  name="codigo_barras"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código de Barras</FormLabel>
                      <FormControl>
                        <LeitorCodigoBarras
                          valor={field.value || ''}
                          onChange={field.onChange}
                          onCodigoLido={field.onChange}
                          placeholder="Escaneie ou digite"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{temVariacoes ? 'Nome base *' : 'Nome *'}</FormLabel>
                    <FormControl>
                      <Input placeholder={temVariacoes ? 'Ex: Capa Space' : 'Nome do item'} {...field} />
                    </FormControl>
                    {temVariacoes && (
                      <p className="text-xs text-muted-foreground">
                        Cada variação será criada como "{field.value || 'Nome base'} - Modelo"
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {!itemParaEditar && (
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="tem-variacoes"
                    checked={temVariacoes}
                    onCheckedChange={(checked) => setTemVariacoes(checked === true)}
                  />
                  <div>
                    <Label htmlFor="tem-variacoes" className="cursor-pointer">
                      {form.watch('tipo') === 'peca'
                        ? 'Essa peça tem variações (ex: modelos)?'
                        : 'Esse produto tem variações (ex: modelos)?'}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {form.watch('tipo') === 'peca'
                        ? 'Cadastre de uma vez várias variações da mesma peça (ex: tela para iPhone 11, 12, 13)'
                        : 'Cadastre de uma vez várias variações do mesmo produto (ex: capinha para iPhone 11, 12, 13)'}
                    </p>
                  </div>
                </div>
              )}

              {temVariacoes && (
                <div className="space-y-3 border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <Label>Variações (modelos) *</Label>
                    <Button type="button" variant="outline" size="sm" onClick={adicionarVariacao} className="gap-2">
                      <Plus className="h-4 w-4" />
                      Adicionar variação
                    </Button>
                  </div>

                  {variacoes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhuma variação ainda. Clique em "Adicionar variação" para começar.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {variacoes.map((v, index) => (
                        <div key={index} className="rounded-lg border p-3 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-muted-foreground">Variação {index + 1}</span>
                            <div className="flex items-center gap-1">
                              <Button
                                type="button" variant="ghost" size="icon"
                                onClick={() => usarValorDoPai(index)}
                                title="Usar valor do produto pai"
                              >
                                <ArrowDownToLine className="h-4 w-4 text-muted-foreground" />
                              </Button>
                              <Button
                                type="button" variant="ghost" size="icon"
                                onClick={() => removerVariacao(index)}
                                title="Remover variação"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs">Modelo</Label>
                            <Input
                              placeholder="Ex: iPhone 11"
                              value={v.label}
                              onChange={e => atualizarVariacao(index, { label: e.target.value })}
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs">Código de Barras</Label>
                            <Input
                              placeholder="Código de barras (opcional)"
                              value={v.codigo_barras || ''}
                              onChange={e => atualizarVariacao(index, { codigo_barras: e.target.value })}
                            />
                          </div>

                          <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1.5">
                              <Label className="text-xs">Quantidade</Label>
                              <Input
                                type="number" min="0"
                                value={v.quantidade}
                                onChange={e => atualizarVariacao(index, { quantidade: Number(e.target.value) })}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">Custo</Label>
                              <Input
                                type="number" step="0.01" min="0"
                                value={v.custo}
                                onChange={e => atualizarVariacao(index, { custo: Number(e.target.value) })}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">Venda</Label>
                              <Input
                                type="number" step="0.01" min="0"
                                value={v.preco}
                                onChange={e => atualizarVariacao(index, { preco: Number(e.target.value) })}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Fornecedor */}
              <FormField
                control={form.control}
                name="fornecedor_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fornecedor (Opcional)</FormLabel>
                    <div className="flex gap-2">
                      <Select
                        onValueChange={(value) => field.onChange(value === "none" ? undefined : value)}
                        value={field.value || "none"}
                      >
                        <FormControl>
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Selecione um fornecedor" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Nenhum fornecedor</SelectItem>
                          {fornecedoresAtivos.map((f) => (
                            <SelectItem key={f.id} value={f.id}>
                              {f.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setDialogFornecedorAberto(true)}
                        title="Cadastrar novo fornecedor"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Categoria */}
              <FormField
                control={form.control}
                name="categoria_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria (Opcional)</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value === "none" ? undefined : value)}
                      value={field.value || "none"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma categoria" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Sem categoria</SelectItem>
                        {ordenarCategoriasHierarquicamente(categorias).map(({ categoria: cat, nivel }) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            <span
                              className="flex items-center gap-2"
                              style={{ paddingLeft: nivel > 0 ? `${nivel * 0.75}rem` : undefined }}
                            >
                              <span className="w-3 h-3 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: cat.cor }} />
                              {cat.nome}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <UploadFotosProduto
                fotos={fotos}
                onFotosChange={setFotos}
                maxFotos={5}
              />

              <FormField
                control={form.control}
                name="quantidade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{temVariacoes ? 'Quantidade (valor padrão)' : 'Quantidade em Estoque'}</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" {...field} disabled={isFuncionario && !podeEditarProdutos} />
                    </FormControl>
                    {isFuncionario && !podeEditarProdutos && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Lock className="h-3 w-3" /> Edição bloqueada pelo dono da loja
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {podeVerCustos ? (
                  <FormField
                    control={form.control}
                    name="custo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{temVariacoes ? 'Custo (valor padrão)' : 'Preço de Custo'}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            disabled={isFuncionario && !podeEditarProdutos}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground pt-6">
                    <Lock className="h-4 w-4" />
                    <span className="text-sm">Custo oculto</span>
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="preco"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{temVariacoes ? 'Venda (valor padrão)' : 'Preço de Venda'}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          disabled={isFuncionario && !podeEditarProdutos}
                          {...field}
                        />
                      </FormControl>
                      {isFuncionario && !podeEditarProdutos && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Lock className="h-3 w-3" /> Edição bloqueada
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="preco_atacado"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{temVariacoes ? 'Atacado (valor padrão)' : 'Preço Atacado'}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Opcional"
                          disabled={isFuncionario && !podeEditarProdutos}
                          value={field.value ?? ''}
                          onChange={e => field.onChange(e.target.value === '' ? null : e.target.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {podeVerLucros && !temVariacoes && (
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Lucro Calculado:</span>
                    <span className={`text-lg font-bold ${lucro >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(lucro)}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="w-full sm:w-auto"
                >
                  Cancelar
                </Button>
                <Button type="submit" className="w-full sm:w-auto" disabled={enviando}>
                  {enviando
                    ? 'Cadastrando...'
                    : temVariacoes
                      ? `Cadastrar ${variacoes.length || ''} variação(ões)`.replace('  ', ' ')
                      : itemParaEditar ? 'Atualizar' : 'Cadastrar'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <DialogCadastroFornecedor
        open={dialogFornecedorAberto}
        onOpenChange={setDialogFornecedorAberto}
        onSubmit={handleCriarFornecedor}
      />
    </>
  );
};
