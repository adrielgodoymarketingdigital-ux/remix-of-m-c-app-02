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
import { Card, CardContent } from "@/components/ui/card";
import { ConfiguracaoLoja } from "@/types/configuracao-loja";
import { useToast } from "@/hooks/use-toast";
import { useState, type ReactNode } from "react";
import {
  aplicarMascaraCNPJ,
  aplicarMascaraCEP,
  aplicarMascaraTelefone,
  removerMascara,
} from "@/lib/mascaras";
import { buscarCEP } from "@/lib/buscarCEP";
import {
  AtSign,
  Building2,
  ChevronDown,
  Contact,
  Facebook,
  FileText,
  Globe,
  Hash,
  Home,
  IdCard,
  Instagram,
  Landmark,
  ListPlus,
  Loader2,
  Mail,
  Map as MapIcon,
  MapPin,
  MapPinned,
  MessageCircle,
  Phone,
  Save,
  Search,
  Signpost,
  Store,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
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

// ── Só visual (layout-configuracoes). Locais desta tela: Input/Card do shadcn intocados ──
const CARTAO = "rounded-2xl shadow-sm";
const CAMPO = "h-11 rounded-lg pl-10 focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-0 focus-visible:border-primary";

/** Cabeçalho de cartão: ícone azul em quadrado arredondado, título e subtítulo. */
function CabecalhoCartao({ icone: Icone, titulo, subtitulo, children }: { icone: LucideIcon; titulo: string; subtitulo: string; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-3.5 px-5 pt-5 sm:px-6 sm:pt-6">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
        <Icone className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 text-left">
        <h3 className="text-base font-bold leading-tight sm:text-[17px]">{titulo}</h3>
        <p className="mt-1 text-xs font-normal text-muted-foreground">{subtitulo}</p>
      </div>
      {children}
    </div>
  );
}

/** Ícone à esquerda do campo. O FormControl continua envolvendo o Input (id/aria do form). */
function ComIcone({ icone: Icone, children }: { icone: LucideIcon; children: ReactNode }) {
  return (
    <div className="relative">
      <Icone className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      {children}
    </div>
  );
}

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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        {/* Dados Básicos */}
        <Card className={CARTAO}>
          <CabecalhoCartao icone={Contact} titulo="Dados Básicos" subtitulo="Informações principais da sua loja." />
          <CardContent className="px-5 pb-6 pt-5 sm:px-6">
            <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2 2xl:grid-cols-3">
              <FormField
                control={form.control}
                name="nome_loja"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome da Loja *</FormLabel>
                    <ComIcone icone={Store}>
                      <FormControl>
                        <Input {...field} placeholder="Nome fantasia" className={CAMPO} />
                      </FormControl>
                    </ComIcone>
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
                    <ComIcone icone={Building2}>
                      <FormControl>
                        <Input {...field} placeholder="Razão social da empresa" className={CAMPO} />
                      </FormControl>
                    </ComIcone>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cnpj"
                render={({ field }) => (
                  <FormItem className="md:col-span-2 2xl:col-span-1">
                    <FormLabel>CNPJ *</FormLabel>
                    <ComIcone icone={IdCard}>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="00.000.000/0000-00"
                          className={CAMPO}
                          onChange={(e) =>
                            field.onChange(aplicarMascaraCNPJ(e.target.value))
                          }
                        />
                      </FormControl>
                    </ComIcone>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Endereço */}
        <Card className={CARTAO}>
          <CabecalhoCartao icone={MapPin} titulo="Endereço" subtitulo="Informe o endereço da sua loja." />
          <CardContent className="px-5 pb-6 pt-5 sm:px-6">
            <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-6">
              <div className="flex gap-2.5 md:col-span-6 2xl:col-span-2">
                <FormField
                  control={form.control}
                  name="cep"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>CEP *</FormLabel>
                      <ComIcone icone={MapPinned}>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="00000-000"
                            className={CAMPO}
                            onChange={(e) =>
                              field.onChange(aplicarMascaraCEP(e.target.value))
                            }
                          />
                        </FormControl>
                      </ComIcone>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-lg px-4"
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

              <FormField
                control={form.control}
                name="logradouro"
                render={({ field }) => (
                  <FormItem className="md:col-span-4 2xl:col-span-3">
                    <FormLabel>Logradouro *</FormLabel>
                    <ComIcone icone={Signpost}>
                      <FormControl>
                        <Input {...field} placeholder="Rua, Avenida..." className={CAMPO} />
                      </FormControl>
                    </ComIcone>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="numero"
                render={({ field }) => (
                  <FormItem className="md:col-span-2 2xl:col-span-1">
                    <FormLabel>Número *</FormLabel>
                    <ComIcone icone={Hash}>
                      <FormControl>
                        <Input {...field} placeholder="123" className={CAMPO} />
                      </FormControl>
                    </ComIcone>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="complemento"
                render={({ field }) => (
                  <FormItem className="md:col-span-4 2xl:col-span-2">
                    <FormLabel>Complemento</FormLabel>
                    <ComIcone icone={Home}>
                      <FormControl>
                        <Input {...field} placeholder="Sala, Bloco, Andar..." className={CAMPO} />
                      </FormControl>
                    </ComIcone>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bairro"
                render={({ field }) => (
                  <FormItem className="md:col-span-2 2xl:col-span-2">
                    <FormLabel>Bairro *</FormLabel>
                    <ComIcone icone={MapPin}>
                      <FormControl>
                        <Input {...field} placeholder="Centro" className={CAMPO} />
                      </FormControl>
                    </ComIcone>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cidade"
                render={({ field }) => (
                  <FormItem className="md:col-span-4 2xl:col-span-1">
                    <FormLabel>Cidade *</FormLabel>
                    <ComIcone icone={Landmark}>
                      <FormControl>
                        <Input {...field} placeholder="São Paulo" className={CAMPO} />
                      </FormControl>
                    </ComIcone>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="estado"
                render={({ field }) => (
                  <FormItem className="md:col-span-2 2xl:col-span-1">
                    <FormLabel>Estado *</FormLabel>
                    <ComIcone icone={MapIcon}>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="SP"
                          maxLength={2}
                          className={CAMPO}
                          onChange={(e) =>
                            field.onChange(e.target.value.toUpperCase())
                          }
                        />
                      </FormControl>
                    </ComIcone>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Contatos */}
        <Card className={CARTAO}>
          <CabecalhoCartao icone={Phone} titulo="Contatos" subtitulo="Como seus clientes falam com a loja." />
          <CardContent className="px-5 pb-6 pt-5 sm:px-6">
            <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2 2xl:grid-cols-3">
              <FormField
                control={form.control}
                name="telefone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone *</FormLabel>
                    <ComIcone icone={Phone}>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="(00) 0000-0000"
                          className={CAMPO}
                          onChange={(e) =>
                            field.onChange(aplicarMascaraTelefone(e.target.value))
                          }
                        />
                      </FormControl>
                    </ComIcone>
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
                    <ComIcone icone={MessageCircle}>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="(00) 00000-0000"
                          className={CAMPO}
                          onChange={(e) =>
                            field.onChange(aplicarMascaraTelefone(e.target.value))
                          }
                        />
                      </FormControl>
                    </ComIcone>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="md:col-span-2 2xl:col-span-1">
                    <FormLabel>E-mail *</FormLabel>
                    <ComIcone icone={Mail}>
                      <FormControl>
                        <Input {...field} type="email" placeholder="contato@loja.com" className={CAMPO} />
                      </FormControl>
                    </ComIcone>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Dados Opcionais */}
        <Collapsible
          open={dadosOpcionaisAberto}
          onOpenChange={setDadosOpcionaisAberto}
        >
          <Card className={CARTAO}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="w-full rounded-2xl pb-5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:pb-6"
              >
                <CabecalhoCartao
                  icone={ListPlus}
                  titulo="Dados Opcionais"
                  subtitulo="Inscrições, site, horário de funcionamento e redes sociais."
                >
                  <span className="flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground">
                    {dadosOpcionaisAberto ? "Ocultar" : "Mostrar"}
                    <ChevronDown
                      className={cn("h-4 w-4 transition-transform", dadosOpcionaisAberto && "rotate-180")}
                      aria-hidden="true"
                    />
                  </span>
                </CabecalhoCartao>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="px-5 pb-6 pt-0 sm:px-6">
                <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2 2xl:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="inscricao_estadual"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Inscrição Estadual</FormLabel>
                        <ComIcone icone={FileText}>
                          <FormControl>
                            <Input {...field} placeholder="000.000.000.000" className={CAMPO} />
                          </FormControl>
                        </ComIcone>
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
                        <ComIcone icone={FileText}>
                          <FormControl>
                            <Input {...field} placeholder="000000" className={CAMPO} />
                          </FormControl>
                        </ComIcone>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="site"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2 2xl:col-span-1">
                        <FormLabel>Site</FormLabel>
                        <ComIcone icone={Globe}>
                          <FormControl>
                            <Input {...field} placeholder="https://www.loja.com" className={CAMPO} />
                          </FormControl>
                        </ComIcone>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="horario_funcionamento"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2 2xl:col-span-3">
                        <FormLabel>Horário de Funcionamento</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Seg a Sex: 9h às 18h&#10;Sábado: 9h às 13h"
                            rows={3}
                            className="rounded-lg focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-0 focus-visible:border-primary"
                          />
                        </FormControl>
                        <FormDescription>
                          Informe o horário de atendimento da loja
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="instagram"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Instagram</FormLabel>
                        <ComIcone icone={Instagram}>
                          <FormControl>
                            <Input {...field} placeholder="@suaLoja" className={CAMPO} />
                          </FormControl>
                        </ComIcone>
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
                        <ComIcone icone={Facebook}>
                          <FormControl>
                            <Input {...field} placeholder="/suaLoja" className={CAMPO} />
                          </FormControl>
                        </ComIcone>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        <div className="flex justify-end pt-1">
          <Button
            type="submit"
            size="lg"
            className="h-11 gap-2 rounded-lg bg-[linear-gradient(110deg,#246BFF,#079FD0)] px-6 text-white shadow-[0_5px_15px_rgba(36,107,255,0.18)] hover:brightness-105"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            Salvar alterações
          </Button>
        </div>
      </form>
    </Form>
  );
}
