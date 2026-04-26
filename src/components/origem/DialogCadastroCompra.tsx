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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FormularioCompraDispositivo } from "@/types/origem";
import { useOrigemPessoas } from "@/hooks/useOrigemPessoas";
import { useFornecedores } from "@/hooks/useFornecedores";
import { useDispositivos } from "@/hooks/useDispositivos";
import { DialogCadastroPessoa } from "./DialogCadastroPessoa";
import { DialogCadastroDispositivo } from "@/components/dispositivos/DialogCadastroDispositivo";
import { UploadFotosCompra } from "./UploadFotosCompra";
import { UploadDocumentosVendedor } from "./UploadDocumentosVendedor";
import { AssinaturaCompra } from "./AssinaturaCompra";
import { Plus, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

const createFormSchema = (modoInline: boolean) => z.object({
  tipo_origem: z.enum(['terceiro', 'fornecedor']),
  pessoa_id: z.string().optional(),
  fornecedor_id: z.string().optional(),
  dispositivo_id: modoInline ? z.string().optional() : z.string().min(1, "Selecione um dispositivo"),
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

interface DialogCadastroCompraProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (dados: FormularioCompraDispositivo, gerarPDF: boolean) => Promise<void>;
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
  const [gerarPDF, setGerarPDF] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Estados para fotos, documentos e assinaturas
  const [fotos, setFotos] = useState<string[]>([]);
  const [documentoFrente, setDocumentoFrente] = useState<string | null>(null);
  const [documentoVerso, setDocumentoVerso] = useState<string | null>(null);
  const [assinaturaVendedor, setAssinaturaVendedor] = useState<string>('');
  const [assinaturaVendedorIP, setAssinaturaVendedorIP] = useState<string>('');
  const [assinaturaCliente, setAssinaturaCliente] = useState<string>('');
  const [assinaturaClienteIP, setAssinaturaClienteIP] = useState<string>('');
  
  const { pessoas, carregarPessoas, criarPessoa } = useOrigemPessoas();
  const { fornecedores } = useFornecedores();
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
    
    setIsSubmitting(true);
    
    try {
      const dadosCompra: FormularioCompraDispositivo = {
        pessoa_id: dados.tipo_origem === 'terceiro' ? dados.pessoa_id : undefined,
        fornecedor_id: dados.tipo_origem === 'fornecedor' ? dados.fornecedor_id : undefined,
        dispositivo_id: dados.dispositivo_id || '',
        data_compra: dados.data_compra,
        valor_pago: dados.valor_pago,
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

      await onSubmit(dadosCompra, gerarPDF);
      form.reset();
      setFotos([]);
      setDocumentoFrente(null);
      setDocumentoVerso(null);
      setAssinaturaVendedor('');
      setAssinaturaVendedorIP('');
      setAssinaturaCliente('');
      setAssinaturaClienteIP('');
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao submeter compra:', error);
      toast.error('Erro ao registrar compra');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNovaPessoa = async (dadosPessoa: any) => {
    const pessoa = await criarPessoa(dadosPessoa);
    if (pessoa) {
      await carregarPessoas();
      form.setValue("pessoa_id", pessoa.id);
      setDialogPessoaAberto(false);
    }
  };

  const handleNovoDispositivo = async (dadosDispositivo: any) => {
    const dispositivo = await criarDispositivo(dadosDispositivo);
    if (dispositivo) {
      await carregarDispositivos();
      form.setValue("dispositivo_id", dispositivo.id);
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
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar Nova Compra</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              {/* Tipo de Origem */}
              <FormField
                control={form.control}
                name="tipo_origem"
                render={({ field }) => (
                  <FormItem className="space-y-3">
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
                      <FormItem>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione uma pessoa" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {pessoas.map(pessoa => (
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
                </div>
              ) : (
                <FormField
                  control={form.control}
                  name="fornecedor_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fornecedor *</FormLabel>
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
                      <FormItem>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value}
                          disabled={!!dispositivoId}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione um dispositivo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {dispositivos.filter(d => !d.vendido).map(dispositivo => (
                              <SelectItem key={dispositivo.id} value={dispositivo.id}>
                                {dispositivo.marca} {dispositivo.modelo} {dispositivo.imei && `- IMEI: ${dispositivo.imei}`}
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
              {modoInline && (
                <div className="p-4 bg-muted rounded-lg border border-border">
                  <p className="text-sm text-muted-foreground">
                    📝 O dispositivo será vinculado automaticamente após o cadastro
                  </p>
                </div>
              )}

              <Tabs defaultValue="compra" className="w-full">
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
                        <FormItem>
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
                        <FormItem>
                          <FormLabel>Valor Pago (R$) *</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" {...field} />
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
                        <FormItem>
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
                        <FormItem>
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
                  />
                </TabsContent>

                <TabsContent value="fotos" className="space-y-4">
                  <UploadFotosCompra
                    fotos={fotos}
                    onFotosChange={setFotos}
                    maxFotos={5}
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
                    />
                    
                    <AssinaturaCompra
                      label="Assinatura do Vendedor/Cliente"
                      textoAceite="Declaro que sou o legítimo proprietário do dispositivo e que não há impedimentos legais para sua venda."
                      onSave={handleSalvarAssinaturaCliente}
                      onClear={() => { setAssinaturaCliente(''); setAssinaturaClienteIP(''); }}
                      assinaturaExistente={assinaturaCliente}
                      ipExistente={assinaturaClienteIP}
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
                <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processando...
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

      <DialogCadastroDispositivo
        open={dialogDispositivoAberto}
        onOpenChange={setDialogDispositivoAberto}
        onSubmit={handleNovoDispositivo}
        dispositivoParaEditar={undefined}
      />
    </>
  );
}
