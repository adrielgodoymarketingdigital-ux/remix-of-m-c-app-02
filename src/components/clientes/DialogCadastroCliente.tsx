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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Cliente, FormularioCliente } from "@/types/cliente";
import { aplicarMascaraCPF, aplicarMascaraCNPJ, aplicarMascaraTelefone } from "@/lib/mascaras";

const formSchema = z.object({
  nome: z.string().min(3, "Nome deve ter no mínimo 3 caracteres").max(100, "Nome deve ter no máximo 100 caracteres"),
  cpf: z.string().max(14, "CPF inválido").optional(),
  cnpj: z.string().max(18, "CNPJ inválido").optional(),
  telefone: z.string().max(15, "Telefone inválido").optional(),
  endereco: z.string().max(200, "Endereço deve ter no máximo 200 caracteres").optional(),
  data_nascimento: z.string().optional(),
});

interface DialogCadastroClienteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (dados: FormularioCliente) => Promise<boolean>;
  cliente?: Cliente | null;
}

export function DialogCadastroCliente({
  open,
  onOpenChange,
  onSubmit,
  cliente,
}: DialogCadastroClienteProps) {
  const [tipoDocumento, setTipoDocumento] = useState<"cpf" | "cnpj">("cpf");
  
  const form = useForm<FormularioCliente>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: "",
      cpf: "",
      cnpj: "",
      telefone: "",
      endereco: "",
      data_nascimento: "",
    },
  });

  useEffect(() => {
    if (cliente) {
      // Detecta se é CNPJ baseado no valor existente
      const temCnpj = cliente.cnpj && cliente.cnpj.length > 0;
      setTipoDocumento(temCnpj ? "cnpj" : "cpf");
      
      form.reset({
        nome: cliente.nome,
        cpf: cliente.cpf || "",
        cnpj: cliente.cnpj || "",
        telefone: cliente.telefone || "",
        endereco: cliente.endereco || "",
        data_nascimento: cliente.data_nascimento || "",
      });
    } else {
      setTipoDocumento("cpf");
      form.reset({
        nome: "",
        cpf: "",
        cnpj: "",
        telefone: "",
        endereco: "",
        data_nascimento: "",
      });
    }
  }, [cliente, form]);

  const handleSubmit = async (dados: FormularioCliente) => {
    const sucesso = await onSubmit(dados);
    if (sucesso) {
      onOpenChange(false);
      form.reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {cliente ? "Editar Cliente" : "Novo Cliente"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Completo *</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome do cliente" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Label className="text-sm font-medium">Tipo de Documento:</Label>
                <RadioGroup
                  value={tipoDocumento}
                  onValueChange={(value: "cpf" | "cnpj") => {
                    setTipoDocumento(value);
                    // Limpa o campo do outro tipo ao trocar
                    if (value === "cpf") {
                      form.setValue("cnpj", "");
                    } else {
                      form.setValue("cpf", "");
                    }
                  }}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="cpf" id="cpf" />
                    <Label htmlFor="cpf" className="cursor-pointer">CPF</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="cnpj" id="cnpj" />
                    <Label htmlFor="cnpj" className="cursor-pointer">CNPJ</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {tipoDocumento === "cpf" ? (
                  <FormField
                    control={form.control}
                    name="cpf"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CPF</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="000.000.000-00" 
                            {...field}
                            onChange={(e) => field.onChange(aplicarMascaraCPF(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <FormField
                    control={form.control}
                    name="cnpj"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CNPJ</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="00.000.000/0000-00" 
                            {...field}
                            onChange={(e) => field.onChange(aplicarMascaraCNPJ(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="telefone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="(00) 00000-0000" 
                          {...field}
                          onChange={(e) => field.onChange(aplicarMascaraTelefone(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="data_nascimento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Nascimento</FormLabel>
                    <FormControl>
                      <Input 
                        type="date"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endereco"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Endereço</FormLabel>
                    <FormControl>
                      <Input placeholder="Endereço completo" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
                {cliente ? "Atualizar" : "Cadastrar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
