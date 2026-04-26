import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ConfiguracaoLoja } from "@/types/configuracao-loja";

const formSchema = z.object({
  nome_loja: z.string().min(1, "Nome da loja é obrigatório"),
  razao_social: z.string().optional(),
  cnpj: z.string().optional(),
  endereco: z.string().optional(),
  telefone: z.string().optional(),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
});

type FormData = z.infer<typeof formSchema>;

interface FormularioDadosLojaProps {
  configuracao: ConfiguracaoLoja | null;
  onSalvar: (dados: Partial<ConfiguracaoLoja>) => Promise<boolean>;
}

export const FormularioDadosLoja = ({
  configuracao,
  onSalvar,
}: FormularioDadosLojaProps) => {
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome_loja: configuracao?.nome_loja || "",
      razao_social: configuracao?.razao_social || "",
      cnpj: configuracao?.cnpj || "",
      endereco: configuracao?.endereco || "",
      telefone: configuracao?.telefone || "",
      email: configuracao?.email || "",
    },
  });

  const onSubmit = async (data: FormData) => {
    const sucesso = await onSalvar(data);
    if (sucesso) {
      toast({
        title: "Configurações salvas",
        description: "As configurações da loja foram atualizadas.",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dados da Loja</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nome_loja">Nome da Loja *</Label>
              <Input
                id="nome_loja"
                {...register("nome_loja")}
                placeholder="Nome da sua loja"
              />
              {errors.nome_loja && (
                <p className="text-sm text-destructive">{errors.nome_loja.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="razao_social">Razão Social</Label>
              <Input
                id="razao_social"
                {...register("razao_social")}
                placeholder="Razão Social da empresa"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input
                id="cnpj"
                {...register("cnpj")}
                placeholder="00.000.000/0000-00"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="endereco">Endereço Completo</Label>
              <Input
                id="endereco"
                {...register("endereco")}
                placeholder="Rua, número, bairro, cidade, estado"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                {...register("telefone")}
                placeholder="(00) 00000-0000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                {...register("email")}
                placeholder="contato@loja.com"
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
