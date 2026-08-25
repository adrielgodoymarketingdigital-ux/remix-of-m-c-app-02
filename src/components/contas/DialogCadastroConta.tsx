import { useEffect, useState } from "react";
import { useFornecedores } from "@/hooks/useFornecedores";
import { useClientes } from "@/hooks/useClientes";
import { useFormasPagamentoCustomizadas } from "@/hooks/useFormasPagamentoCustomizadas";
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
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { Conta, FormularioConta, CATEGORIAS_CONTA } from "@/types/conta";

const FORMAS_PAGAMENTO_ENTRADA = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "debito", label: "Débito" },
  { value: "credito", label: "Crédito" },
];

const formSchema = z.object({
  nome: z.string().min(3, "Nome deve ter no mínimo 3 caracteres").max(100, "Nome deve ter no máximo 100 caracteres"),
  tipo: z.enum(["pagar", "receber"]),
  valor: z.coerce.number().min(0.01, "Valor deve ser maior que zero"),
  data: z.string().min(1, "Data é obrigatória"),
  status: z.enum(["pendente", "pago", "recebido"]),
  recorrente: z.boolean().default(false),
  categoria: z.string().optional(),
  descricao: z.string().max(500, "Descrição deve ter no máximo 500 caracteres").optional(),
  fornecedor_id: z.string().optional(),
  cliente_id: z.string().optional(),
});

interface DialogCadastroContaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (dados: FormularioConta) => Promise<boolean>;
  conta?: Conta | null;
  categoriasExtras?: string[];
  /** Tipo pré-selecionado ao abrir para cadastro (ex: aba "A Receber" ativa) */
  tipoInicial?: "pagar" | "receber";
}

export function DialogCadastroConta({
  open,
  onOpenChange,
  onSubmit,
  conta,
  categoriasExtras = [],
  tipoInicial = "pagar",
}: DialogCadastroContaProps) {
  const { fornecedores } = useFornecedores();
  const { clientes } = useClientes({ modoSilencioso: true });
  const { formas: formasCustomizadas } = useFormasPagamentoCustomizadas();
  const [registrarEntrada, setRegistrarEntrada] = useState(false);
  const [valorEntrada, setValorEntrada] = useState("");
  const [formaPagamentoEntrada, setFormaPagamentoEntrada] = useState("dinheiro");

  const form = useForm<FormularioConta>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: "",
      tipo: "pagar",
      valor: 0,
      data: new Date().toISOString().split("T")[0],
      status: "pendente",
      recorrente: false,
      categoria: "",
      descricao: "",
      fornecedor_id: "",
      cliente_id: "",
    },
  });

  const tipoSelecionado = form.watch("tipo");

  useEffect(() => {
    if (conta) {
      form.reset({
        nome: conta.nome,
        tipo: conta.tipo,
        valor: conta.valor,
        data: conta.data,
        status: conta.status,
        recorrente: conta.recorrente,
        categoria: conta.categoria || "",
        descricao: conta.descricao || "",
        fornecedor_id: conta.fornecedor_id || "",
        cliente_id: conta.cliente_id || "",
      });
      const jaTemEntrada = !!conta.valor_pago && conta.valor_pago > 0;
      setRegistrarEntrada(jaTemEntrada);
      setValorEntrada(jaTemEntrada ? String(conta.valor_pago) : "");
      setFormaPagamentoEntrada(conta.forma_pagamento_entrada || "dinheiro");
    } else {
      form.reset({
        nome: "",
        tipo: tipoInicial,
        valor: 0,
        data: new Date().toISOString().split("T")[0],
        status: "pendente",
        recorrente: false,
        categoria: "",
        descricao: "",
        fornecedor_id: "",
        cliente_id: "",
      });
      setRegistrarEntrada(false);
      setValorEntrada("");
      setFormaPagamentoEntrada("dinheiro");
    }
  }, [conta, form, open, tipoInicial]);

  const valorTotalForm = form.watch("valor");
  const valorEntradaNumero = parseFloat(valorEntrada.replace(",", ".")) || 0;
  const saldoRestante = Math.max(Number(valorTotalForm || 0) - valorEntradaNumero, 0);

  const handleSubmit = async (dados: FormularioConta) => {
    // Converter fornecedor_id/cliente_id vazios para undefined e manter só o
    // vínculo relevante ao tipo escolhido (pagar -> fornecedor, receber -> cliente)
    const dadosLimpos: FormularioConta = {
      ...dados,
      fornecedor_id: dados.tipo === "pagar" && dados.fornecedor_id && dados.fornecedor_id !== "nenhum"
        ? dados.fornecedor_id
        : undefined,
      cliente_id: dados.tipo === "receber" && dados.cliente_id && dados.cliente_id !== "nenhum"
        ? dados.cliente_id
        : undefined,
    };

    if (registrarEntrada && valorEntradaNumero > 0) {
      dadosLimpos.valor_pago = valorEntradaNumero;
      dadosLimpos.forma_pagamento_entrada = formaPagamentoEntrada;
      // Entrada cobre o valor total: marca a conta como quitada automaticamente.
      dadosLimpos.status = valorEntradaNumero >= Number(dados.valor)
        ? (dados.tipo === "pagar" ? "pago" : "recebido")
        : "pendente";
    } else {
      dadosLimpos.valor_pago = 0;
      dadosLimpos.forma_pagamento_entrada = undefined;
    }

    const sucesso = await onSubmit(dadosLimpos);
    if (sucesso) {
      onOpenChange(false);
      form.reset();
      setRegistrarEntrada(false);
      setValorEntrada("");
      setFormaPagamentoEntrada("dinheiro");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {conta ? "Editar Conta" : "Nova Conta"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pagar">Conta a Pagar</SelectItem>
                        <SelectItem value="receber">Conta a Receber</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pendente">Pendente</SelectItem>
                        <SelectItem value="pago">Pago</SelectItem>
                        <SelectItem value="recebido">Recebido</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Conta *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Aluguel Janeiro 2025" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="valor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0,00"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="data"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Vencimento *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="categoria"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(() => {
                          const set = new Set<string>(CATEGORIAS_CONTA);
                          categoriasExtras.forEach((c) => set.add(c));
                          return Array.from(set).sort();
                        })().map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {tipoSelecionado === "receber" ? (
              <FormField
                control={form.control}
                name="cliente_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cliente</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um cliente (opcional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="nenhum">Nenhum</SelectItem>
                        {clientes.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
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
                          <SelectValue placeholder="Selecione um fornecedor (opcional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="nenhum">Nenhum</SelectItem>
                        {fornecedores.map((f) => (
                          <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="recorrente"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Conta Recorrente</FormLabel>
                    <p className="text-xs text-muted-foreground">
                      Esta conta se repete mensalmente
                    </p>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {conta && (
              <div className="rounded-lg border p-3 space-y-3">
                <div className="flex flex-row items-center justify-between">
                  <div className="space-y-0.5">
                    <FormLabel>Registrar entrada parcial</FormLabel>
                    <p className="text-xs text-muted-foreground">
                      Registre um pagamento parcial e acompanhe o saldo restante
                    </p>
                  </div>
                  <Checkbox
                    checked={registrarEntrada}
                    onCheckedChange={(checked) => setRegistrarEntrada(checked === true)}
                  />
                </div>

                {registrarEntrada && (
                  <div className="space-y-3 pt-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <FormLabel>Valor da entrada (R$)</FormLabel>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0,00"
                          value={valorEntrada}
                          onChange={(e) => setValorEntrada(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <FormLabel>Forma de pagamento da entrada</FormLabel>
                        <Select value={formaPagamentoEntrada} onValueChange={setFormaPagamentoEntrada}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {FORMAS_PAGAMENTO_ENTRADA.map((f) => (
                              <SelectItem key={f.value} value={f.value}>
                                {f.label}
                              </SelectItem>
                            ))}
                            {formasCustomizadas.length > 0 && (
                              <>
                                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-2">
                                  Personalizadas
                                </div>
                                {formasCustomizadas.map((f) => (
                                  <SelectItem key={f.id} value={`custom_${f.id}`}>
                                    {f.nome}
                                  </SelectItem>
                                ))}
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm">
                      <span className="text-muted-foreground">Saldo restante:</span>
                      <span className="font-semibold">
                        <ValorMonetario valor={saldoRestante} tipo="preco" />
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <FormField
              control={form.control}
              name="descricao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Informações adicionais sobre esta conta"
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                {conta ? "Atualizar" : "Cadastrar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
