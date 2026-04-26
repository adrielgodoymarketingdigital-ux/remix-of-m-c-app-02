import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { buscarCEP } from "@/lib/buscarCEP";
import { aplicarMascaraCEP, removerMascara } from "@/lib/mascaras";
import { Loader2, Search } from "lucide-react";
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
import { Fornecedor, FormularioFornecedor } from "@/types/fornecedor";

const formSchema = z.object({
  nome: z.string().min(3, "Nome deve ter no mínimo 3 caracteres"),
  nome_fantasia: z.string().optional(),
  tipo: z.enum(["juridica", "fisica"]),
  cnpj: z.string().optional(),
  cpf: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  telefone: z.string().optional(),
  celular: z.string().optional(),
  endereco: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  cep: z.string().optional(),
  observacoes: z.string().optional(),
  ativo: z.boolean().default(true),
});

interface DialogCadastroFornecedorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (dados: FormularioFornecedor) => Promise<boolean>;
  fornecedor?: Fornecedor | null;
}

export function DialogCadastroFornecedor({
  open,
  onOpenChange,
  onSubmit,
  fornecedor,
}: DialogCadastroFornecedorProps) {
  const form = useForm<FormularioFornecedor>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: "",
      nome_fantasia: "",
      tipo: "juridica",
      cnpj: "",
      cpf: "",
      email: "",
      telefone: "",
      celular: "",
      endereco: "",
      cidade: "",
      estado: "",
      cep: "",
      observacoes: "",
      ativo: true,
    },
  });

  useEffect(() => {
    if (fornecedor) {
      form.reset({
        nome: fornecedor.nome,
        nome_fantasia: fornecedor.nome_fantasia || "",
        tipo: fornecedor.tipo,
        cnpj: fornecedor.cnpj || "",
        cpf: fornecedor.cpf || "",
        email: fornecedor.email || "",
        telefone: fornecedor.telefone || "",
        celular: fornecedor.celular || "",
        endereco: fornecedor.endereco || "",
        cidade: fornecedor.cidade || "",
        estado: fornecedor.estado || "",
        cep: fornecedor.cep || "",
        observacoes: fornecedor.observacoes || "",
        ativo: fornecedor.ativo,
      });
    } else {
      form.reset({
        nome: "",
        nome_fantasia: "",
        tipo: "juridica",
        cnpj: "",
        cpf: "",
        email: "",
        telefone: "",
        celular: "",
        endereco: "",
        cidade: "",
        estado: "",
        cep: "",
        observacoes: "",
        ativo: true,
      });
    }
  }, [fornecedor, form]);

  const handleSubmit = async (dados: FormularioFornecedor) => {
    const sucesso = await onSubmit(dados);
    if (sucesso) {
      onOpenChange(false);
      form.reset();
    }
  };

  const tipoFornecedor = form.watch("tipo");
  const [buscandoCEP, setBuscandoCEP] = useState(false);

  const handleBuscarCEP = async () => {
    const cep = form.getValues("cep");
    const cepLimpo = removerMascara(cep || "");
    if (cepLimpo.length !== 8) return;
    setBuscandoCEP(true);
    const dados = await buscarCEP(cepLimpo);
    setBuscandoCEP(false);
    if (dados) {
      form.setValue("endereco", dados.logradouro);
      form.setValue("cidade", dados.cidade);
      form.setValue("estado", dados.estado);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={true}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {fornecedor ? "Editar Fornecedor" : "Novo Fornecedor"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Informações Básicas */}
            <div className="space-y-4 p-4 border rounded-lg">
              <h3 className="font-semibold">Informações Básicas</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="tipo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Pessoa *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="juridica">Pessoa Jurídica</SelectItem>
                          <SelectItem value="fisica">Pessoa Física</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="ativo"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Fornecedor Ativo</FormLabel>
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
              </div>

              <FormField
                control={form.control}
                name="nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {tipoFornecedor === "juridica" ? "Razão Social" : "Nome Completo"} *
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="Nome do fornecedor" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {tipoFornecedor === "juridica" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="nome_fantasia"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome Fantasia</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome fantasia" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cnpj"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CNPJ</FormLabel>
                        <FormControl>
                          <Input placeholder="00.000.000/0000-00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {tipoFornecedor === "fisica" && (
                <FormField
                  control={form.control}
                  name="cpf"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CPF</FormLabel>
                      <FormControl>
                        <Input placeholder="000.000.000-00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Contato */}
            <div className="space-y-4 p-4 border rounded-lg">
              <h3 className="font-semibold">Contato</h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="telefone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone</FormLabel>
                      <FormControl>
                        <Input placeholder="(00) 0000-0000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="celular"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Celular</FormLabel>
                      <FormControl>
                        <Input placeholder="(00) 00000-0000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="email@exemplo.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Endereço */}
            <div className="space-y-4 p-4 border rounded-lg">
              <h3 className="font-semibold">Endereço</h3>

              <FormField
                control={form.control}
                name="endereco"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Endereço</FormLabel>
                    <FormControl>
                      <Input placeholder="Rua, número, complemento" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="cidade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cidade</FormLabel>
                      <FormControl>
                        <Input placeholder="Cidade" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="estado"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estado</FormLabel>
                      <FormControl>
                        <Input placeholder="UF" maxLength={2} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cep"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CEP</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="00000-000"
                            maxLength={9}
                            onChange={(e) => field.onChange(aplicarMascaraCEP(e.target.value))}
                            onBlur={() => { field.onBlur(); handleBuscarCEP(); }}
                          />
                        </FormControl>
                        <Button type="button" variant="outline" size="icon" onClick={handleBuscarCEP} disabled={buscandoCEP}>
                          {buscandoCEP ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Observações */}
            <div className="space-y-4 p-4 border rounded-lg">
              <h3 className="font-semibold">Observações</h3>

              <FormField
                control={form.control}
                name="observacoes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Informações adicionais sobre o fornecedor"
                        className="resize-none"
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Botões */}
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
                {fornecedor ? "Atualizar" : "Cadastrar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
