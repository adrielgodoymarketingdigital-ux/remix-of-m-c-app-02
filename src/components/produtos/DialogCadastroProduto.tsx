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
import { ItemEstoque, FormularioProduto } from '@/types/produto';
import { CategoriaProduto } from '@/types/categoria-produto';
import { formatCurrency } from '@/lib/formatters';
import { LeitorCodigoBarras } from '@/components/scanner/LeitorCodigoBarras';
import { UploadFotosProduto } from './UploadFotosProduto';
import { useFornecedores } from '@/hooks/useFornecedores';
import { DialogCadastroFornecedor } from '@/components/fornecedores/DialogCadastroFornecedor';
import { FormularioFornecedor } from '@/types/fornecedor';
import { Plus, Lock } from 'lucide-react';
import { useFuncionarioPermissoes } from '@/hooks/useFuncionarioPermissoes';

const formSchema = z.object({
  tipo: z.enum(['produto', 'peca'], {
    required_error: 'Selecione o tipo',
  }),
  codigo: z.string().optional(),
  nome: z.string().min(1, 'Nome é obrigatório').max(200, 'Nome muito longo'),
  quantidade: z.coerce.number().int().min(0, 'Quantidade não pode ser negativa'),
  custo: z.coerce.number().min(0, 'Custo deve ser positivo'),
  preco: z.coerce.number().min(0, 'Preço deve ser positivo'),
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
  itemParaEditar?: ItemEstoque | null;
  categorias?: CategoriaProduto[];
}

export const DialogCadastroProduto = ({
  open,
  onOpenChange,
  onSubmit,
  itemParaEditar,
  categorias = [],
}: DialogCadastroProdutoProps) => {
  const [fotos, setFotos] = useState<string[]>([]);
  const [dialogFornecedorAberto, setDialogFornecedorAberto] = useState(false);
  const { fornecedores, criarFornecedor, refetch: refetchFornecedores } = useFornecedores();
  const { podeVerCustos, podeVerLucros, podeEditarProdutos, isFuncionario } = useFuncionarioPermissoes();
  
  const form = useForm<FormularioProduto>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tipo: 'produto',
      codigo: '',
      nome: '',
      quantidade: 0,
      custo: 0,
      preco: 0,
      codigo_barras: '',
      fornecedor_id: undefined,
      categoria_id: undefined,
    },
  });

  const custo = form.watch('custo');
  const preco = form.watch('preco');
  const lucro = preco - custo;

  useEffect(() => {
    if (itemParaEditar) {
      form.reset({
        tipo: itemParaEditar.tipo,
        codigo: itemParaEditar.tipo === 'produto' ? itemParaEditar.sku || '' : '',
        nome: itemParaEditar.nome,
        quantidade: itemParaEditar.quantidade,
        custo: itemParaEditar.custo,
        preco: itemParaEditar.preco,
        codigo_barras: (itemParaEditar as any).codigo_barras || '',
        fornecedor_id: itemParaEditar.fornecedor_id || undefined,
        categoria_id: itemParaEditar.categoria_id || undefined,
      });
      setFotos(itemParaEditar.fotos || []);
    } else {
      form.reset({
        tipo: 'produto',
        codigo: '',
        nome: '',
        quantidade: 0,
        custo: 0,
        preco: 0,
        codigo_barras: '',
        fornecedor_id: undefined,
        categoria_id: undefined,
      });
      setFotos([]);
    }
  }, [itemParaEditar, open, form]);

  const handleSubmit = async (dados: FormularioProduto) => {
    const sucesso = await onSubmit({ ...dados, fotos });
    if (sucesso) {
      onOpenChange(false);
    }
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
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
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
                        onValueChange={field.onChange}
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
                    <FormLabel>Nome *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome do item" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                    <FormLabel>Quantidade em Estoque</FormLabel>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {podeVerCustos ? (
                  <FormField
                    control={form.control}
                    name="custo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Preço de Custo</FormLabel>
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
                      <FormLabel>Preço de Venda</FormLabel>
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
              </div>

              {podeVerLucros && (
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
                <Button type="submit" className="w-full sm:w-auto">
                  {itemParaEditar ? 'Atualizar' : 'Cadastrar'}
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
