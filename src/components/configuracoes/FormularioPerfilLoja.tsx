import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfiguracaoLoja } from "@/types/configuracao-loja";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import {
  aplicarMascaraCNPJ,
  aplicarMascaraCEP,
  aplicarMascaraTelefone,
  removerMascara,
} from "@/lib/mascaras";
import { buscarCEP } from "@/lib/buscarCEP";
import { Loader2, Search } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const formSchema = z.object({
  nome_loja: z.string().min(1, "Nome da loja é obrigatório"),
  razao_social: z.string().min(1, "Razão social é obrigatória"),
  cnpj: z.string().min(14, "CNPJ inválido"),
  cep: z.string().min(8, "CEP é obrigatório"),
  logradouro: z.string().min(1, "Logradouro é obrigatório"),
  numero: z.string().min(1, "Número é obrigatório"),
  complemento: z.string().optional(),
  bairro: z.string().min(1, "Bairro é obrigatório"),
  cidade: z.string().min(1, "Cidade é obrigatória"),
  estado: z.string().length(2, "Estado deve ter 2 caracteres").toUpperCase(),
  telefone: z.string().min(10, "Telefone é obrigatório"),
  whatsapp: z.string().optional(),
  email: z.string().email("E-mail inválido"),
  inscricao_estadual: z.string().optional(),
  inscricao_municipal: z.string().optional(),
  site: z.string().url("URL inválida").optional().or(z.literal("")),
  horario_funcionamento: z.string().optional(),
  instagram: z.string().optional(),
  facebook: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface FormularioPerfilLojaProps {
  configuracao: ConfiguracaoLoja | null;
  onSalvar: (dados: Partial<ConfiguracaoLoja>) => Promise<boolean>;
}

export function FormularioPerfilLoja({
  configuracao,
  onSalvar,
}: FormularioPerfilLojaProps) {
  const { toast } = useToast();
  const [buscandoCEP, setBuscandoCEP] = useState(false);
  const [dadosOpcionaisAberto, setDadosOpcionaisAberto] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome_loja: configuracao?.nome_loja || "",
      razao_social: configuracao?.razao_social || "",
      cnpj: configuracao?.cnpj || "",
      cep: configuracao?.cep || "",
      logradouro: configuracao?.logradouro || "",
      numero: configuracao?.numero || "",
      complemento: configuracao?.complemento || "",
      bairro: configuracao?.bairro || "",
      cidade: configuracao?.cidade || "",
      estado: configuracao?.estado || "",
      telefone: configuracao?.telefone || "",
      whatsapp: configuracao?.whatsapp || "",
      email: configuracao?.email || "",
      inscricao_estadual: configuracao?.inscricao_estadual || "",
      inscricao_municipal: configuracao?.inscricao_municipal || "",
      site: configuracao?.site || "",
      horario_funcionamento: configuracao?.horario_funcionamento || "",
      instagram: configuracao?.instagram || "",
      facebook: configuracao?.facebook || "",
    },
  });

  const handleBuscarCEP = async () => {
    const cep = form.getValues("cep");
    const cepLimpo = removerMascara(cep);

    if (cepLimpo.length !== 8) {
      toast({
        title: "CEP inválido",
        description: "Digite um CEP válido com 8 dígitos",
        variant: "destructive",
      });
      return;
    }

    setBuscandoCEP(true);
    const dados = await buscarCEP(cepLimpo);
    setBuscandoCEP(false);

    if (dados) {
      form.setValue("logradouro", dados.logradouro);
      form.setValue("bairro", dados.bairro);
      form.setValue("cidade", dados.cidade);
      form.setValue("estado", dados.estado);
      toast({
        title: "CEP encontrado",
        description: "Endereço preenchido automaticamente",
      });
    } else {
      toast({
        title: "CEP não encontrado",
        description: "Verifique o CEP digitado e tente novamente",
        variant: "destructive",
      });
    }
  };

  const onSubmit = async (data: FormData) => {
    const dadosParaSalvar = {
      ...data,
      cnpj: removerMascara(data.cnpj),
      cep: removerMascara(data.cep),
      telefone: removerMascara(data.telefone),
      whatsapp: data.whatsapp ? removerMascara(data.whatsapp) : undefined,
    };

    const sucesso = await onSalvar(dadosParaSalvar);

    if (sucesso) {
      toast({
        title: "Dados salvos",
        description: "As informações da loja foram atualizadas com sucesso.",
      });
    } else {
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as informações. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Dados Básicos */}
        <Card>
          <CardHeader>
            <CardTitle>Dados Básicos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="nome_loja"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome da Loja *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Nome fantasia" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="razao_social"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Razão Social *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Razão social da empresa" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="cnpj"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CNPJ *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="00.000.000/0000-00"
                      onChange={(e) =>
                        field.onChange(aplicarMascaraCNPJ(e.target.value))
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Endereço */}
        <Card>
          <CardHeader>
            <CardTitle>Endereço</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <FormField
                control={form.control}
                name="cep"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>CEP *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="00000-000"
                        onChange={(e) =>
                          field.onChange(aplicarMascaraCEP(e.target.value))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBuscarCEP}
                  disabled={buscandoCEP}
                >
                  {buscandoCEP ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  Buscar
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="logradouro"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Logradouro *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Rua, Avenida..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="numero"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="123" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="complemento"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Complemento</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Sala, Bloco, Andar..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="bairro"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bairro *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Centro" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cidade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cidade *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="São Paulo" />
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
                    <FormLabel>Estado *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="SP"
                        maxLength={2}
                        onChange={(e) =>
                          field.onChange(e.target.value.toUpperCase())
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Contatos */}
        <Card>
          <CardHeader>
            <CardTitle>Contatos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="telefone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="(00) 0000-0000"
                        onChange={(e) =>
                          field.onChange(aplicarMascaraTelefone(e.target.value))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="whatsapp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>WhatsApp</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="(00) 00000-0000"
                        onChange={(e) =>
                          field.onChange(aplicarMascaraTelefone(e.target.value))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail *</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" placeholder="contato@loja.com" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Dados Opcionais */}
        <Collapsible
          open={dadosOpcionaisAberto}
          onOpenChange={setDadosOpcionaisAberto}
        >
          <Card>
            <CardHeader>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-6">
                  <CardTitle>Dados Opcionais</CardTitle>
                  <span className="text-sm text-muted-foreground">
                    {dadosOpcionaisAberto ? "Ocultar" : "Mostrar"}
                  </span>
                </Button>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="inscricao_estadual"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Inscrição Estadual</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="000.000.000.000" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="inscricao_municipal"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Inscrição Municipal</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="000000" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="site"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Site</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://www.loja.com" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="horario_funcionamento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Horário de Funcionamento</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Seg a Sex: 9h às 18h&#10;Sábado: 9h às 13h"
                          rows={3}
                        />
                      </FormControl>
                      <FormDescription>
                        Informe o horário de atendimento da loja
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="instagram"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Instagram</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="@suaLoja" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="facebook"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Facebook</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="/suaLoja" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        <div className="flex justify-end">
          <Button type="submit" size="lg">
            Salvar Configurações
          </Button>
        </div>
      </form>
    </Form>
  );
}
