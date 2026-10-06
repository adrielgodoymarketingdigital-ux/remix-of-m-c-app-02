import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm, type FieldErrors } from "react-hook-form";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FormularioCompraDispositivo, OrigemPessoa } from "@/types/origem";
import type { Dispositivo } from "@/types/dispositivo";
import { ComboboxBusca, type ItemComboboxBusca } from "@/components/busca/ComboboxBusca";
import {
  dispositivosDisponiveisParaCompra,
  filtrarDispositivos,
  filtrarPessoas,
  garantirNaLista,
} from "@/lib/busca/normalizarBusca";
import { parseValorMonetarioBR, formatarNumeroParaInputBR } from "@/lib/formatters";
import { dataBrasiliaISO } from "@/lib/dataBrasilia";
import { supabase } from "@/integrations/supabase/client";
import { useOrigemPessoas } from "@/hooks/useOrigemPessoas";
import { useFornecedores } from "@/hooks/useFornecedores";
import { useDispositivos } from "@/hooks/useDispositivos";
import { DialogCadastroPessoa } from "./DialogCadastroPessoa";
import { DialogCadastroDispositivo } from "@/components/dispositivos/DialogCadastroDispositivo";
import { DialogCadastroFornecedor } from "@/components/fornecedores/DialogCadastroFornecedor";
import { UploadFotosCompra } from "./UploadFotosCompra";
import { UploadDocumentosVendedor } from "./UploadDocumentosVendedor";
import { AssinaturaCompra } from "./AssinaturaCompra";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Plus, Save, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  CriadosNaSessao,
  ResultadoCompra,
  TravaEnvio,
  compraFalhou,
  criadosSemCompra,
  deveFecharDialogo,
  finalizarEnvio,
  idsParaTentativa,
  iniciarEnvio,
  montarMensagemErroCompra,
} from "@/lib/origem/fluxoCompra";

const pessoaParaItem = (p: OrigemPessoa): ItemComboboxBusca => ({
  id: p.id,
  rotulo: p.nome,
  sublinha: [p.cpf_cnpj, p.telefone].filter(Boolean).join(" · ") || null,
});

const dispositivoParaItem = (d: Dispositivo): ItemComboboxBusca => ({
  id: d.id,
  rotulo: `${d.marca ?? ""} ${d.modelo ?? ""}`.trim() || "Dispositivo",
  sublinha: [d.imei && `IMEI ${d.imei}`, d.numero_serie && `Série ${d.numero_serie}`].filter(Boolean).join(" · ") || null,
});

// Campos obrigatórios na ordem da tela: rótulo do aviso e aba onde ficam.
const CAMPOS_OBRIGATORIOS: { campo: string; rotulo: string; aba?: string }[] = [
  { campo: "tipo_origem", rotulo: "Origem" },
  { campo: "pessoa_id", rotulo: "Pessoa" },
  { campo: "fornecedor_id", rotulo: "Fornecedor" },
  { campo: "dispositivo_id", rotulo: "Dispositivo" },
  { campo: "data_compra", rotulo: "Data da compra", aba: "compra" },
  { campo: "valor_pago", rotulo: "Valor pago", aba: "compra" },
  { campo: "forma_pagamento", rotulo: "Forma de pagamento", aba: "compra" },
  { campo: "condicao_aparelho", rotulo: "Condição do aparelho", aba: "compra" },
];

const createFormSchema = (modoInline: boolean) => z.object({
  tipo_origem: z.enum(['terceiro', 'fornecedor']),
  pessoa_id: z.string().optional(),
  fornecedor_id: z.string().optional(),
  dispositivo_id: modoInline ? z.string().optional() : z.string().min(1, "Selecione um dispositivo"),
  data_compra: z.string().min(1, "Data é obrigatória"),
  // Texto livre (permite colar valores formatados como "1.500,00" ou "R$ 1.500,00"
  // sem que o navegador zere o campo, como acontecia com type="number" — ver
  // parseValorMonetarioBR). O parse para number acontece em handleSubmit.
  valor_pago: z.string(),
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

interface DialogCadastroCompraProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Só fecha o diálogo quando devolve { ok: true }; se falhar, os dados ficam no formulário. */
  onSubmit: (dados: FormularioCompraDispositivo, gerarPDF: boolean) => Promise<ResultadoCompra<unknown>>;
  dispositivoId?: string;
  modoInline?: boolean;
}

export function DialogCadastroCompra({
  open,
  onOpenChange,
  onSubmit,
  dispositivoId,
  modoInline = false,
}: DialogCadastroCompraProps) {
  const [dialogPessoaAberto, setDialogPessoaAberto] = useState(false);
  const [dialogDispositivoAberto, setDialogDispositivoAberto] = useState(false);
  const [dialogFornecedorAberto, setDialogFornecedorAberto] = useState(false);
  const [gerarPDF, setGerarPDF] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<{ mensagem: string; detalhe: string | null } | null>(null);
  const [abaAtiva, setAbaAtiva] = useState("compra");
  const [enviandoFotos, setEnviandoFotos] = useState(false);
  const [enviandoDocumentos, setEnviandoDocumentos] = useState(false);
  const [processandoAssinaturaVendedor, setProcessandoAssinaturaVendedor] = useState(false);
  const [processandoAssinaturaCliente, setProcessandoAssinaturaCliente] = useState(false);
  const enviandoArquivos = enviandoFotos || enviandoDocumentos || processandoAssinaturaVendedor || processandoAssinaturaCliente;
  // Ignora cliques repetidos enquanto uma tentativa roda (o estado do React só atualiza no próximo render).
  const travaEnvio = useRef<TravaEnvio>({ emAndamento: false });
  // Pessoa/dispositivo criados pelos "+ Novo" nesta sessão do diálogo: reaproveitados na nova tentativa.
  const criadosNaSessao = useRef<CriadosNaSessao>({});
  // Recém-criados pelos "+ Novo": entram na lista do seletor na hora (antes do refetch).
  const [pessoaRecemCriada, setPessoaRecemCriada] = useState<OrigemPessoa | null>(null);
  const [dispositivoRecemCriado, setDispositivoRecemCriado] = useState<Dispositivo | null>(null);
  
  // Estados para fotos, documentos e assinaturas
  const [fotos, setFotos] = useState<string[]>([]);
  const [documentoFrente, setDocumentoFrente] = useState<string | null>(null);
  const [documentoVerso, setDocumentoVerso] = useState<string | null>(null);
  const [assinaturaVendedor, setAssinaturaVendedor] = useState<string>('');
  const [assinaturaVendedorIP, setAssinaturaVendedorIP] = useState<string>('');
  const [assinaturaCliente, setAssinaturaCliente] = useState<string>('');
  const [assinaturaClienteIP, setAssinaturaClienteIP] = useState<string>('');
  
  const { pessoas, carregarPessoas, criarPessoa } = useOrigemPessoas();
  const { fornecedores, criarFornecedor } = useFornecedores();
  const { dispositivos, criarDispositivo, carregarDispositivos } = useDispositivos();

  const formSchema = createFormSchema(modoInline);
  type FormValues = z.infer<typeof formSchema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tipo_origem: 'terceiro',
      pessoa_id: "",
      fornecedor_id: "",
      dispositivo_id: dispositivoId || "",
      data_compra: dataBrasiliaISO(),
      valor_pago: "",
      forma_pagamento: 'pix',
      funcionario_responsavel: "",
      unidade: "",
      condicao_aparelho: "usado",
      situacao_conta: "",
      observacoes: "",
    },
  });

  const tipoOrigemWatch = form.watch("tipo_origem");
  const dispositivoSelecionado = form.watch("dispositivo_id");

  const opcoesPessoas = useMemo(() => garantirNaLista(pessoas, pessoaRecemCriada), [pessoas, pessoaRecemCriada]);
  // Só aparelhos sem compra, não vendidos e não excluídos; o pré-selecionado
  // (?dispositivo=, recém-criado ou já escolhido) entra sempre.
  const opcoesDispositivos = useMemo(
    () => dispositivosDisponiveisParaCompra(
      garantirNaLista(dispositivos, dispositivoRecemCriado),
      dispositivoId || dispositivoSelecionado || dispositivoRecemCriado?.id,
    ),
    [dispositivos, dispositivoRecemCriado, dispositivoId, dispositivoSelecionado],
  );

  useEffect(() => {
    if (dispositivoId) {
      form.setValue("dispositivo_id", dispositivoId);
    }
  }, [dispositivoId, form]);

  // Reset quando dialog fecha
  useEffect(() => {
    if (!open) {
      setFotos([]);
      setDocumentoFrente(null);
      setDocumentoVerso(null);
      setAssinaturaVendedor('');
      setAssinaturaVendedorIP('');
      setAssinaturaCliente('');
      setAssinaturaClienteIP('');
      setErroEnvio(null);
      setAbaAtiva("compra");
      criadosNaSessao.current = {};
      setPessoaRecemCriada(null);
      setDispositivoRecemCriado(null);
    }
  }, [open]);

  const handleSubmit = async (dados: FormValues) => {
    // Validação de origem
    const tipoOrigem = dados.tipo_origem;
    
    if (tipoOrigem === 'terceiro' && !dados.pessoa_id) {
      toast.error('Selecione uma pessoa ou cadastre uma nova');
      return;
    }
    
    if (tipoOrigem === 'fornecedor' && !dados.fornecedor_id) {
      toast.error('Selecione um fornecedor');
      return;
    }

    if (enviandoArquivos) {
      toast.info('Aguarde terminar o envio das fotos, documentos ou assinaturas.');
      return;
    }

    if (!iniciarEnvio(travaEnvio.current)) return;
    setErroEnvio(null);
    setIsSubmitting(true);

    try {
      const { pessoaId, dispositivoId } = idsParaTentativa(dados, criadosNaSessao.current);
      const dadosCompra: FormularioCompraDispositivo = {
        pessoa_id: pessoaId ?? undefined,
        fornecedor_id: dados.tipo_origem === 'fornecedor' ? dados.fornecedor_id : undefined,
        dispositivo_id: dispositivoId ?? '',
        data_compra: dados.data_compra,
        valor_pago: parseValorMonetarioBR(dados.valor_pago),
        forma_pagamento: dados.forma_pagamento,
        funcionario_responsavel: dados.funcionario_responsavel,
        unidade: dados.unidade,
        condicao_aparelho: dados.condicao_aparelho,
        situacao_conta: dados.situacao_conta,
        observacoes: dados.observacoes,
        fotos: fotos.length > 0 ? fotos : undefined,
        documento_vendedor_frente: documentoFrente || undefined,
        documento_vendedor_verso: documentoVerso || undefined,
        assinatura_vendedor: assinaturaVendedor || undefined,
        assinatura_vendedor_ip: assinaturaVendedorIP || undefined,
        assinatura_cliente: assinaturaCliente || undefined,
        assinatura_cliente_ip: assinaturaClienteIP || undefined,
      };

      const resultado = await onSubmit(dadosCompra, gerarPDF);
      if (!deveFecharDialogo(resultado)) {
        // Falhou: nada é limpo; o alerta fica perto do botão e a próxima tentativa
        // reaproveita a pessoa/dispositivo já criados.
        if (compraFalhou(resultado)) setErroEnvio({ mensagem: resultado.mensagem, detalhe: resultado.detalhe });
        const pendentes = criadosSemCompra(criadosNaSessao.current, false);
        if (pendentes.length) console.error("[compra] criados nesta sessão aguardando a compra (serão reaproveitados)", pendentes);
        return;
      }
      form.reset();
      setFotos([]);
      setDocumentoFrente(null);
      setDocumentoVerso(null);
      setAssinaturaVendedor('');
      setAssinaturaVendedorIP('');
      setAssinaturaCliente('');
      setAssinaturaClienteIP('');
      criadosNaSessao.current = {};
      onOpenChange(false);
    } catch (error) {
      console.error('[compra] etapa=enviar formulário', error);
      setErroEnvio(montarMensagemErroCompra(error));
    } finally {
      setIsSubmitting(false);
      finalizarEnvio(travaEnvio.current);
    }
  };

  // Validação barrou o envio: avisa quais campos faltam e rola até o primeiro (o
  // ref do Select do Radix não está ligado ao campo, então o foco automático não rola).
  const handleInvalido = useCallback((erros: FieldErrors<FormValues>) => {
    const tipo = form.getValues("tipo_origem");
    const comErro = new Set(Object.keys(erros));
    // O refine de origem marca pessoa_id mesmo quando a origem é fornecedor.
    if (tipo === "fornecedor" && comErro.delete("pessoa_id")) comErro.add("fornecedor_id");
    const faltando = CAMPOS_OBRIGATORIOS.filter((c) => comErro.has(c.campo));
    if (faltando.length === 0) return;
    toast.error(`Preencha os campos obrigatórios: ${faltando.map((c) => c.rotulo).join(", ")}`, { id: "compra-campos-obrigatorios" });
    const primeiro = faltando[0];
    if (primeiro.aba) setAbaAtiva(primeiro.aba);
    requestAnimationFrame(() => {
      document.querySelector(`[data-campo-compra="${primeiro.campo}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [form]);

  const handleNovaPessoa = async (dadosPessoa: any) => {
    const pessoa = await criarPessoa(dadosPessoa);
    if (!pessoa) console.error("[compra] etapa=criar pessoa: não criada (ver erro acima)");
    if (pessoa) {
      criadosNaSessao.current.pessoaId = pessoa.id;
      setPessoaRecemCriada(pessoa);
      form.setValue("pessoa_id", pessoa.id, { shouldValidate: true });
      await carregarPessoas();
      setDialogPessoaAberto(false);
    }
  };

  const handleNovoFornecedor = async (dadosFornecedor: any): Promise<boolean> => {
    const ok = await criarFornecedor(dadosFornecedor);
    if (ok) {
      // Buscar o id do fornecedor recém-criado diretamente do DB
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data } = await supabase
          .from("fornecedores")
          .select("id")
          .eq("user_id", session.user.id)
          .eq("nome", dadosFornecedor.nome)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data?.id) form.setValue("fornecedor_id", data.id);
      }
      setDialogFornecedorAberto(false);
      return true;
    }
    return false;
  };

  const handleNovoDispositivo = async (dadosDispositivo: any) => {
    // Sem o redirecionamento do onboarding para /os: desmontaria este formulário.
    const dispositivo = await criarDispositivo(dadosDispositivo, { redirecionarOnboarding: false });
    if (!dispositivo) console.error("[compra] etapa=criar dispositivo: não criado (ver erro acima)");
    if (dispositivo) {
      criadosNaSessao.current.dispositivoId = dispositivo.id;
      setDispositivoRecemCriado(dispositivo);
      form.setValue("dispositivo_id", dispositivo.id, { shouldValidate: true });
      await carregarDispositivos();
      setDialogDispositivoAberto(false);
    }
  };

  const handleSalvarAssinaturaVendedor = (assinatura: string, ip: string) => {
    setAssinaturaVendedor(assinatura);
    setAssinaturaVendedorIP(ip);
  };

  const handleSalvarAssinaturaCliente = (assinatura: string, ip: string) => {
    setAssinaturaCliente(assinatura);
    setAssinaturaClienteIP(ip);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl sm:max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar Nova Compra</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit, handleInvalido)} className="space-y-6">
              {/* Tipo de Origem */}
              <FormField
                control={form.control}
                name="tipo_origem"
                render={({ field }) => (
                  <FormItem className="space-y-3" data-campo-compra="tipo_origem">
                    <FormLabel>Origem do Dispositivo *</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="terceiro" id="terceiro" />
                          <Label htmlFor="terceiro" className="font-normal cursor-pointer">
                            Terceiro (Pessoa Física/Jurídica)
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="fornecedor" id="fornecedor" />
                          <Label htmlFor="fornecedor" className="font-normal cursor-pointer">
                            Fornecedor Cadastrado
                          </Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Selecionador de Pessoa/Fornecedor */}
              {tipoOrigemWatch === 'terceiro' ? (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label>Pessoa *</Label>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={() => setDialogPessoaAberto(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Nova Pessoa
                    </Button>
                  </div>
                  <FormField
                    control={form.control}
                    name="pessoa_id"
                    render={({ field }) => (
                      <FormItem data-campo-compra="pessoa_id">
                        <ComboboxBusca
                          id="compra-pessoa"
                          opcoes={opcoesPessoas}
                          filtrar={filtrarPessoas}
                          paraItem={pessoaParaItem}
                          valor={field.value ?? ""}
                          onChange={field.onChange}
                          placeholder="Selecione uma pessoa"
                          placeholderBusca="Buscar por nome, CPF ou telefone..."
                          permitirLimpar
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label>Fornecedor *</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDialogFornecedorAberto(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Novo Fornecedor
                    </Button>
                  </div>
                  <FormField
                    control={form.control}
                    name="fornecedor_id"
                    render={({ field }) => (
                      <FormItem data-campo-compra="fornecedor_id">
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione um fornecedor" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {fornecedores.map(fornecedor => (
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
                </div>
              )}

              {/* Dispositivo */}
              {!modoInline && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label>Dispositivo *</Label>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={() => setDialogDispositivoAberto(true)}
                      disabled={!!dispositivoId}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Novo Dispositivo
                    </Button>
                  </div>
                  <FormField
                    control={form.control}
                    name="dispositivo_id"
                    render={({ field }) => (
                      <FormItem data-campo-compra="dispositivo_id">
                        <ComboboxBusca
                          id="compra-dispositivo"
                          opcoes={opcoesDispositivos}
                          filtrar={filtrarDispositivos}
                          paraItem={dispositivoParaItem}
                          valor={field.value ?? ""}
                          onChange={field.onChange}
                          placeholder="Selecione um dispositivo"
                          placeholderBusca="Buscar por modelo, IMEI ou série..."
                          disabled={!!dispositivoId}
                          permitirLimpar
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
              {modoInline && (
                <div className="p-4 bg-muted rounded-lg border border-border">
                  <p className="text-sm text-muted-foreground">
                    📝 O dispositivo será vinculado automaticamente após o cadastro
                  </p>
                </div>
              )}

              <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="w-full">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="compra">Dados</TabsTrigger>
                  <TabsTrigger value="documentos">Doc.</TabsTrigger>
                  <TabsTrigger value="fotos">Fotos</TabsTrigger>
                  <TabsTrigger value="assinaturas">Assin.</TabsTrigger>
                  <TabsTrigger value="observacoes">Obs.</TabsTrigger>
                </TabsList>

                <TabsContent value="compra" className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="data_compra"
                      render={({ field }) => (
                        <FormItem data-campo-compra="data_compra">
                          <FormLabel>Data da Compra *</FormLabel>
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
                        <FormItem data-campo-compra="valor_pago">
                          <FormLabel>Valor Pago (R$) *</FormLabel>
                          <FormControl>
                            <Input
                              type="text"
                              inputMode="decimal"
                              placeholder="0,00"
                              {...field}
                              onChange={(e) => {
                                // Permite dígitos, vírgula e ponto livremente (digitando ou
                                // colando) — o parse de verdade acontece no schema (submit)
                                // e no blur abaixo. Não usamos type="number" porque ele zera
                                // silenciosamente ao colar "1.500,00" ou "R$ 1.500,00".
                                field.onChange(e.target.value.replace(/[^0-9,.]/g, ""));
                              }}
                              onBlur={(e) => {
                                field.onBlur();
                                if (e.target.value.trim() === "") return;
                                const numero = parseValorMonetarioBR(e.target.value);
                                field.onChange(formatarNumeroParaInputBR(numero));
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="forma_pagamento"
                      render={({ field }) => (
                        <FormItem data-campo-compra="forma_pagamento">
                          <FormLabel>Forma de Pagamento *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
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

                    <FormField
                      control={form.control}
                      name="condicao_aparelho"
                      render={({ field }) => (
                        <FormItem data-campo-compra="condicao_aparelho">
                          <FormLabel>Condição do Aparelho *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Ex: Perfeito estado, Pequenos riscos..." />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="funcionario_responsavel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Funcionário Responsável</FormLabel>
                          <FormControl>
                            <Input {...field} />
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
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="situacao_conta"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Situação de Conta iCloud/Google</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ex: iCloud liberado, Conta Google vinculada..." />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>

                <TabsContent value="documentos" className="space-y-4">
                  <UploadDocumentosVendedor
                    documentoFrente={documentoFrente}
                    documentoVerso={documentoVerso}
                    onDocumentoFrenteChange={setDocumentoFrente}
                    onDocumentoVersoChange={setDocumentoVerso}
                    onEnviandoChange={setEnviandoDocumentos}
                  />
                </TabsContent>

                <TabsContent value="fotos" className="space-y-4">
                  <UploadFotosCompra
                    fotos={fotos}
                    onFotosChange={setFotos}
                    maxFotos={5}
                    onEnviandoChange={setEnviandoFotos}
                  />
                </TabsContent>

                <TabsContent value="assinaturas" className="space-y-4">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <AssinaturaCompra
                      label="Assinatura do Funcionário"
                      textoAceite="Declaro que realizei a conferência do dispositivo e que todas as informações registradas estão corretas."
                      onSave={handleSalvarAssinaturaVendedor}
                      onClear={() => { setAssinaturaVendedor(''); setAssinaturaVendedorIP(''); }}
                      assinaturaExistente={assinaturaVendedor}
                      ipExistente={assinaturaVendedorIP}
                      onProcessandoChange={setProcessandoAssinaturaVendedor}
                    />
                    
                    <AssinaturaCompra
                      label="Assinatura do Vendedor/Cliente"
                      textoAceite="Declaro que sou o legítimo proprietário do dispositivo e que não há impedimentos legais para sua venda."
                      onSave={handleSalvarAssinaturaCliente}
                      onClear={() => { setAssinaturaCliente(''); setAssinaturaClienteIP(''); }}
                      assinaturaExistente={assinaturaCliente}
                      ipExistente={assinaturaClienteIP}
                      onProcessandoChange={setProcessandoAssinaturaCliente}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="observacoes" className="space-y-4">
                  <FormField
                    control={form.control}
                    name="observacoes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Observações</FormLabel>
                        <FormControl>
                          <Textarea {...field} rows={5} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>
              </Tabs>

              {tipoOrigemWatch === 'terceiro' && (
                <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
                  <input
                    type="checkbox"
                    id="gerar-pdf"
                    checked={gerarPDF}
                    onChange={(e) => setGerarPDF(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="gerar-pdf" className="cursor-pointer">
                    Gerar Termo de Compra em PDF
                  </Label>
                </div>
              )}

              {erroEnvio && (
                <Alert variant="destructive" data-testid="erro-envio-compra">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>{erroEnvio.mensagem}</AlertTitle>
                  {erroEnvio.detalhe && <AlertDescription>Motivo: {erroEnvio.detalhe}</AlertDescription>}
                </Alert>
              )}

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                  className="w-full sm:w-auto"
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting || enviandoArquivos} className="w-full sm:w-auto">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processando...
                    </>
                  ) : enviandoArquivos ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Aguarde o envio da foto...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      {gerarPDF && tipoOrigemWatch === 'terceiro' ? 'Registrar e Gerar Termo PDF' : 'Registrar Compra'}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <DialogCadastroPessoa
        open={dialogPessoaAberto}
        onOpenChange={setDialogPessoaAberto}
        onSubmit={handleNovaPessoa}
      />

      <DialogCadastroFornecedor
        open={dialogFornecedorAberto}
        onOpenChange={setDialogFornecedorAberto}
        onSubmit={handleNovoFornecedor}
      />

      <DialogCadastroDispositivo
        open={dialogDispositivoAberto}
        onOpenChange={setDialogDispositivoAberto}
        onSubmit={handleNovoDispositivo}
        dispositivoParaEditar={undefined}
      />
    </>
  );
}
