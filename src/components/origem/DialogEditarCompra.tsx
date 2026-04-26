import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CompraDispositivo, FormularioCompraDispositivo } from "@/types/origem";
import { useOrigemPessoas } from "@/hooks/useOrigemPessoas";
import { useFornecedores } from "@/hooks/useFornecedores";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const formSchema = z.object({
  tipo_origem: z.enum(['terceiro', 'fornecedor']),
  pessoa_id: z.string().optional(),
  fornecedor_id: z.string().optional(),
  data_compra: z.string().min(1, "Data é obrigatória"),
  valor_pago: z.coerce.number().min(0, "Valor deve ser maior que zero"),
  forma_pagamento: z.enum(['pix', 'dinheiro', 'cartao_debito', 'cartao_credito', 'transferencia', 'boleto']),
  funcionario_responsavel: z.string().optional(),
  unidade: z.string().optional(),
  condicao_aparelho: z.string().min(1, "Condição é obrigatória"),
  situacao_conta: z.string().optional(),
  observacoes: z.string().optional(),
}).refine(data => {
  if (data.tipo_origem === 'terceiro') {
    return !!data.pessoa_id;
  }
  if (data.tipo_origem === 'fornecedor') {
    return !!data.fornecedor_id;
  }
  return true;
}, {
  message: "Selecione uma pessoa ou fornecedor",
  path: ["pessoa_id"]
});

type FormValues = z.infer<typeof formSchema>;

interface DialogEditarCompraProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (id: string, dados: Partial<FormularioCompraDispositivo>) => Promise<void>;
  compra: CompraDispositivo | null;
}

export function DialogEditarCompra({
  open,
  onOpenChange,
  onSubmit,
  compra,
}: DialogEditarCompraProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { pessoas } = useOrigemPessoas();
  const { fornecedores } = useFornecedores();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tipo_origem: 'terceiro',
      pessoa_id: "",
      fornecedor_id: "",
      data_compra: new Date().toISOString().split('T')[0],
      valor_pago: 0,
      forma_pagamento: 'pix',
      funcionario_responsavel: "",
      unidade: "",
      condicao_aparelho: "usado",
      situacao_conta: "",
      observacoes: "",
    },
  });

  const tipoOrigemWatch = form.watch("tipo_origem");

  useEffect(() => {
    if (compra && open) {
      const tipo_origem = compra.pessoa_id ? 'terceiro' : 'fornecedor';
      form.reset({
        tipo_origem,
        pessoa_id: compra.pessoa_id || "",
        fornecedor_id: compra.fornecedor_id || "",
        data_compra: compra.data_compra,
        valor_pago: compra.valor_pago,
        forma_pagamento: compra.forma_pagamento as any,
        funcionario_responsavel: compra.funcionario_responsavel || "",
        unidade: compra.unidade || "",
        condicao_aparelho: compra.condicao_aparelho,
        situacao_conta: compra.situacao_conta || "",
        observacoes: compra.observacoes || "",
      });
    }
  }, [compra, open, form]);

  const handleSubmit = async (values: FormValues) => {
    if (!compra) return;

    setIsSubmitting(true);
    try {
      const dadosCompra: Partial<FormularioCompraDispositivo> = {
        pessoa_id: values.tipo_origem === 'terceiro' ? values.pessoa_id : undefined,
        fornecedor_id: values.tipo_origem === 'fornecedor' ? values.fornecedor_id : undefined,
        data_compra: values.data_compra,
        valor_pago: values.valor_pago,
        forma_pagamento: values.forma_pagamento as any,
        funcionario_responsavel: values.funcionario_responsavel,
        unidade: values.unidade,
        condicao_aparelho: values.condicao_aparelho,
        situacao_conta: values.situacao_conta,
        observacoes: values.observacoes,
      };

      await onSubmit(compra.id, dadosCompra);
      onOpenChange(false);
      form.reset();
    } catch (error: any) {
      console.error("Erro ao atualizar compra:", error);
      toast.error(error.message || "Erro ao atualizar compra");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Compra de Dispositivo</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="tipo_origem"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Origem</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="terceiro" id="terceiro-edit" />
                        <Label htmlFor="terceiro-edit">Pessoa Física/Jurídica</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="fornecedor" id="fornecedor-edit" />
                        <Label htmlFor="fornecedor-edit">Fornecedor</Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {tipoOrigemWatch === 'terceiro' ? (
              <FormField
                control={form.control}
                name="pessoa_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pessoa</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a pessoa" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {pessoas.filter(p => p.ativo).map((pessoa) => (
                          <SelectItem key={pessoa.id} value={pessoa.id}>
                            {pessoa.nome} {pessoa.cpf_cnpj && `- ${pessoa.cpf_cnpj}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <FormField
                control={form.control}
                name="fornecedor_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fornecedor</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o fornecedor" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {fornecedores.filter(f => f.ativo).map((fornecedor) => (
                          <SelectItem key={fornecedor.id} value={fornecedor.id}>
                            {fornecedor.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="data_compra"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data da Compra</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="valor_pago"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor Pago (R$)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="forma_pagamento"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Forma de Pagamento</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a forma de pagamento" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                      <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                      <SelectItem value="transferencia">Transferência</SelectItem>
                      <SelectItem value="boleto">Boleto</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="funcionario_responsavel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Funcionário Responsável</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome do funcionário" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="unidade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unidade</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Loja Centro" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="condicao_aparelho"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Condição do Aparelho</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a condição" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="novo">Novo</SelectItem>
                        <SelectItem value="semi_novo">Semi-novo</SelectItem>
                        <SelectItem value="usado">Usado</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="situacao_conta"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Situação da Conta</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Pago, Pendente" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="observacoes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Observações sobre a compra..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Atualizar
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
