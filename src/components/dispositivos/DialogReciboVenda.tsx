import { useState, useRef } from "react";
import { resolvePaperSize, getThermalPrintCSS } from "@/lib/paper-size-utils";
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
import { Dispositivo } from "@/types/dispositivo";
import { formatCurrency } from "@/lib/formatters";
import { Printer, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useConfiguracaoLoja } from "@/hooks/useConfiguracaoLoja";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import { checklistLabels } from "@/lib/checklist-templates";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const TERMOS_GARANTIA_CDC = (tempoGarantia?: number) => `
TERMOS DE GARANTIA

1. GARANTIA LEGAL (Código de Defesa do Consumidor - Lei 8.078/90)
   • Este produto possui garantia legal de 90 (noventa) dias, conforme Art. 26, II do CDC.
   • A garantia legal é oferecida pelo fabricante e tem início na data da compra.
   • Cobre defeitos de fabricação ou vícios que comprometam o funcionamento do produto.

2. GARANTIA CONTRATUAL${tempoGarantia ? ` (${tempoGarantia} meses)` : ''}
   ${tempoGarantia
     ? `• Este produto possui garantia contratual adicional de ${tempoGarantia} meses a partir da data desta venda.
   • A garantia contratual é complementar à garantia legal, conforme Art. 50 do CDC.
   • Cobre defeitos de fabricação, excluindo danos causados por mau uso, quedas ou oxidação.`
     : '• Este produto não possui garantia contratual adicional.'}

3. DIREITOS DO CONSUMIDOR
   • Em caso de vício do produto, o consumidor pode exigir: substituição, devolução do valor pago ou abatimento proporcional do preço (Art. 18 CDC).
   • O prazo de garantia é suspenso durante o período de reparo (Art. 26, §2º CDC).
   • Conserve este recibo como comprovante de compra.

4. EXCLUSÕES
   • Danos causados por quedas, impactos, contato com líquidos, uso inadequado ou modificações não autorizadas.
   • Violação de lacres ou tentativa de reparo por terceiros não autorizados.
   • Desgaste natural decorrente do uso normal do produto.

5. ATENDIMENTO
   Para exercer seus direitos de garantia, entre em contato através dos dados desta loja.
`;

const formSchema = z.object({
  cliente_nome: z.string().min(3, "Nome deve ter no mínimo 3 caracteres"),
  cliente_cpf: z.string().min(11, "CPF inválido").optional(),
  cliente_telefone: z.string().min(10, "Telefone inválido").optional(),
  cliente_endereco: z.string().optional(),
  quantidade_vendida: z.coerce.number().min(1, "Quantidade mínima: 1"),
  valor_unitario: z.coerce.number().min(0, "Valor deve ser maior que zero"),
});

type FormValues = z.infer<typeof formSchema>;

interface DialogReciboVendaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dispositivo: Dispositivo | null;
  onVendaRealizada: () => void;
}

export function DialogReciboVenda({
  open,
  onOpenChange,
  dispositivo,
  onVendaRealizada,
}: DialogReciboVendaProps) {
  const [gerando, setGerando] = useState(false);
  const reciboRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { config: configLoja } = useConfiguracaoLoja();
  const { funcionarioId } = useFuncionarioPermissoes();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      cliente_nome: "",
      cliente_cpf: "",
      cliente_telefone: "",
      cliente_endereco: "",
      quantidade_vendida: 1,
      valor_unitario: dispositivo?.preco || 0,
    },
  });

  const valorTotal = form.watch("quantidade_vendida") * form.watch("valor_unitario");

  const onSubmit = async (data: FormValues) => {
    if (!dispositivo) return;

    try {
      setGerando(true);

      // Verificar se há quantidade suficiente
      if (data.quantidade_vendida > dispositivo.quantidade) {
        toast({
          title: "Quantidade insuficiente",
          description: `Disponível: ${dispositivo.quantidade} unidade(s)`,
          variant: "destructive",
        });
        return;
      }

      // 1. Criar/buscar cliente
      let clienteId: string;
      
      const { data: clienteExistente } = await supabase
        .from("clientes")
        .select("id")
        .eq("cpf", data.cliente_cpf || "")
        .maybeSingle();

      if (clienteExistente) {
        clienteId = clienteExistente.id;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");

        const { data: novoCliente, error: erroCliente } = await supabase
          .from("clientes")
          .insert({
            nome: data.cliente_nome,
            cpf: data.cliente_cpf || null,
            telefone: data.cliente_telefone || null,
            endereco: data.cliente_endereco || null,
            user_id: user.id,
          })
          .select("id")
          .single();

        if (erroCliente || !novoCliente) throw erroCliente;
        clienteId = novoCliente.id;
      }

      // 2. Registrar venda
      const { error: erroVenda } = await supabase
        .from("vendas")
        .insert({
          tipo: "dispositivo",
          dispositivo_id: dispositivo.id,
          cliente_id: clienteId,
          quantidade: data.quantidade_vendida,
          total: valorTotal,
          forma_pagamento: "dinheiro",
          funcionario_id: funcionarioId || null,
        });

      if (erroVenda) throw erroVenda;

      // 3. Atualizar quantidade do dispositivo
      const novaQuantidade = dispositivo.quantidade - data.quantidade_vendida;
      const vendido = novaQuantidade === 0;

      const { error: erroDispositivo } = await supabase
        .from("dispositivos")
        .update({
          quantidade: novaQuantidade,
          vendido: vendido,
        })
        .eq("id", dispositivo.id);

      if (erroDispositivo) throw erroDispositivo;

      toast({
        title: "Venda registrada",
        description: "O recibo foi gerado com sucesso.",
      });

      // Imprimir recibo
      imprimirRecibo();

      onVendaRealizada();
      onOpenChange(false);
      form.reset();
    } catch (error) {
      console.error("Erro ao gerar recibo:", error);
      toast({
        title: "Erro ao gerar recibo",
        description: "Não foi possível processar a venda.",
        variant: "destructive",
      });
    } finally {
      setGerando(false);
    }
  };

  const dispConfig = configLoja?.layout_dispositivos_config as any;
  const formatoPapel = dispConfig?.formato_papel || 'a4';
  const is80mm = formatoPapel !== 'a4';
  const showLogo = dispConfig?.mostrar_logo !== false;
  const showDadosLoja = dispConfig?.mostrar_dados_loja !== false;
  const showDadosCliente = dispConfig?.mostrar_dados_cliente !== false;
  const showDadosDispositivo = dispConfig?.mostrar_dados_dispositivo !== false;
  const showChecklist = dispConfig?.mostrar_checklist !== false;
  const showGarantia = dispConfig?.mostrar_garantia !== false;
  const showAssinaturas = dispConfig?.mostrar_assinaturas !== false;
  const showValor = dispConfig?.mostrar_valor !== false;
  const showFormaPagamento = dispConfig?.mostrar_forma_pagamento !== false;

  const imprimirRecibo = () => {
    if (!reciboRef.current) return;

    const conteudo = reciboRef.current.innerHTML;
    const janelaImpressao = window.open("", "_blank");
    
    if (janelaImpressao) {
      const paper = resolvePaperSize(formatoPapel, dispConfig?.largura_mm, dispConfig?.altura_mm);
      const estilos80mm = getThermalPrintCSS(paper);

      janelaImpressao.document.write(`
        <html>
          <head>
            <title>Recibo de Venda - ${dispositivo?.marca} ${dispositivo?.modelo}</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                padding: 20px;
                max-width: ${is80mm ? '76mm' : '800px'};
                margin: 0 auto;
              }
              .recibo-header {
                text-align: center;
                border-bottom: ${is80mm ? '1px dashed #000' : '2px solid #000'};
                padding-bottom: ${is80mm ? '10px' : '20px'};
                margin-bottom: ${is80mm ? '10px' : '20px'};
              }
              .recibo-section {
                margin-bottom: ${is80mm ? '10px' : '20px'};
                page-break-inside: avoid;
              }
              .recibo-section h3 {
                border-bottom: ${is80mm ? '1px dashed #ccc' : '1px solid #ccc'};
                padding-bottom: 5px;
                margin-bottom: 10px;
                font-size: ${is80mm ? '11px' : '14px'};
              }
              .termos-garantia {
                font-size: ${is80mm ? '8px' : '11px'};
                line-height: 1.6;
                white-space: pre-line;
              }
              .logo-loja {
                max-width: ${is80mm ? '30mm' : '150px'};
                height: auto;
                margin: 0 auto 15px;
              }
              .dados-loja {
                font-size: ${is80mm ? '9px' : '12px'};
                margin-top: 10px;
              }
              .recibo-info {
                display: flex;
                justify-content: space-between;
                margin: 5px 0;
                font-size: ${is80mm ? '10px' : 'inherit'};
              }
              .recibo-total {
                font-size: ${is80mm ? '14px' : '20px'};
                font-weight: bold;
                text-align: right;
                margin-top: ${is80mm ? '10px' : '20px'};
                padding-top: ${is80mm ? '10px' : '20px'};
                border-top: ${is80mm ? '1px dashed #000' : '2px solid #000'};
              }
              .recibo-checklist {
                display: grid;
                grid-template-columns: ${is80mm ? '1fr' : '1fr 1fr'};
                gap: 8px ${is80mm ? '8px' : '16px'};
                margin-top: 10px;
              }
              .recibo-checklist-item {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: ${is80mm ? '9px' : '11px'};
              }
              .recibo-checklist-icon {
                font-size: 12px;
                flex-shrink: 0;
              }
              .recibo-checklist-label {
                color: #333;
              }
              @media print {
                body { margin: 0; }
                .recibo-checklist {
                  page-break-inside: avoid;
                }
              }
              ${estilos80mm}
            </style>
          </head>
          <body>
            ${conteudo}
            <script>
              (function() {
                var printed = false;
                function doPrint() {
                  if (printed) return;
                  printed = true;
                  window.print();
                  window.onafterprint = function() { window.close(); };
                }
                var images = document.querySelectorAll('img');
                if (images.length === 0) {
                  setTimeout(doPrint, 300);
                } else {
                  var promises = Array.from(images).map(function(img) {
                    if (img.complete) return Promise.resolve();
                    return new Promise(function(resolve) {
                      img.onload = resolve;
                      img.onerror = function() { img.style.display = 'none'; resolve(); };
                    });
                  });
                  Promise.all(promises).then(function() { setTimeout(doPrint, 300); });
                }
                setTimeout(doPrint, 3000);
              })();
            </script>
          </body>
        </html>
      `);
      janelaImpressao.document.close();
    }
  };

  if (!dispositivo) return null;

  const dataAtual = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Gerar Recibo de Venda
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Dados do Cliente */}
            <div className="space-y-4 p-4 border rounded-lg">
              <h3 className="font-semibold">Dados do Comprador</h3>
              
              <FormField
                control={form.control}
                name="cliente_nome"
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="cliente_cpf"
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

                <FormField
                  control={form.control}
                  name="cliente_telefone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone</FormLabel>
                      <FormControl>
                        <Input placeholder="(00) 00000-0000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="cliente_endereco"
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

            {/* Dados da Venda */}
            <div className="space-y-4 p-4 border rounded-lg">
              <h3 className="font-semibold">Dados da Venda</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="quantidade_vendida"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantidade *</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="1" 
                          max={dispositivo.quantidade}
                          {...field} 
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        Disponível: {dispositivo.quantidade}
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="valor_unitario"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor Unitário *</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01" 
                          min="0" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Produto</p>
                <p className="font-semibold">
                  {dispositivo.marca} {dispositivo.modelo}
                </p>
                {dispositivo.tipo && (
                  <p className="text-sm text-muted-foreground">{dispositivo.tipo}</p>
                )}
              </div>

              <div className="text-right">
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{formatCurrency(valorTotal)}</p>
              </div>
            </div>

            {/* Preview do Recibo (oculto, só para impressão) */}
            <div ref={reciboRef} style={{ display: "none" }}>
              <div className="recibo-header">
                {showLogo && configLoja?.logo_url && (
                  <div style={{ textAlign: 'center', marginBottom: '15px' }}>
                    <img 
                      src={configLoja.logo_url} 
                      alt="Logo da Loja" 
                      className="logo-loja"
                    />
                  </div>
                )}
                
                <h1>{configLoja?.nome_loja || 'G360 System'}</h1>
                
                {showDadosLoja && (
                  <div className="dados-loja">
                    {configLoja?.cnpj && <p>CNPJ: {configLoja.cnpj}</p>}
                    {configLoja?.endereco && <p>Endereço: {configLoja.endereco}</p>}
                    {configLoja?.telefone && <p>Telefone: {configLoja.telefone}</p>}
                    {configLoja?.email && <p>E-mail: {configLoja.email}</p>}
                  </div>
                )}
                
                <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '2px solid #000' }}>
                  <h2>RECIBO DE VENDA</h2>
                  <p>Data: {dataAtual}</p>
                </div>
              </div>

              {showDadosCliente && (
                <div className="recibo-section">
                  <h3>Dados do Comprador</h3>
                  <div className="recibo-info">
                    <span>Nome:</span>
                    <span>{form.watch("cliente_nome")}</span>
                  </div>
                  {form.watch("cliente_cpf") && (
                    <div className="recibo-info">
                      <span>CPF:</span>
                      <span>{form.watch("cliente_cpf")}</span>
                    </div>
                  )}
                  {form.watch("cliente_telefone") && (
                    <div className="recibo-info">
                      <span>Telefone:</span>
                      <span>{form.watch("cliente_telefone")}</span>
                    </div>
                  )}
                  {form.watch("cliente_endereco") && (
                    <div className="recibo-info">
                      <span>Endereço:</span>
                      <span>{form.watch("cliente_endereco")}</span>
                    </div>
                  )}
                </div>
              )}

              {showDadosDispositivo && (
                <div className="recibo-section">
                  <h3>Produto Vendido</h3>
                  <div className="recibo-info">
                    <span>Produto:</span>
                    <span>{dispositivo.marca} {dispositivo.modelo}</span>
                  </div>
                  <div className="recibo-info">
                    <span>Tipo:</span>
                    <span>{dispositivo.tipo}</span>
                  </div>
                  {dispositivo.imei && (
                    <div className="recibo-info">
                      <span>IMEI:</span>
                      <span>{dispositivo.imei}</span>
                    </div>
                  )}
                  {dispositivo.numero_serie && (
                    <div className="recibo-info">
                      <span>Número de Série:</span>
                      <span>{dispositivo.numero_serie}</span>
                    </div>
                  )}
                  <div className="recibo-info">
                    <span>Quantidade:</span>
                    <span>{form.watch("quantidade_vendida")}</span>
                  </div>
                  {showValor && (
                    <div className="recibo-info">
                      <span>Valor Unitário:</span>
                      <span>{formatCurrency(form.watch("valor_unitario"))}</span>
                    </div>
                  )}
                  {showFormaPagamento && (
                    <div className="recibo-info">
                      <span>Forma de Pagamento:</span>
                      <span>—</span>
                    </div>
                  )}
                </div>
              )}

              {showChecklist && dispositivo.checklist?.entrada && Object.entries(dispositivo.checklist.entrada).filter(([_, funciona]) => funciona !== undefined).length > 0 && (
                <div className="recibo-section">
                  <h3>Estado do Aparelho na Venda</h3>
                  <div className="recibo-checklist">
                    {Object.entries(dispositivo.checklist.entrada)
                      .filter(([_, funciona]) => funciona !== undefined)
                      .map(([item, funciona]) => (
                        <div key={item} className="recibo-checklist-item">
                          <span className="recibo-checklist-icon">
                            {funciona ? '✅' : '❌'}
                          </span>
                          <span className="recibo-checklist-label">
                            {checklistLabels[item] || item}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {showGarantia && (
                <div className="recibo-section">
                  <h3>Termos de Garantia e Direitos do Consumidor</h3>
                  <div className="termos-garantia">
                    {TERMOS_GARANTIA_CDC(dispositivo.garantia ? dispositivo.tempo_garantia : undefined)}
                  </div>
                </div>
              )}

              {showValor && (
                <div className="recibo-total">
                  <div>VALOR TOTAL: {formatCurrency(valorTotal)}</div>
                </div>
              )}

              {showAssinaturas && (
                <>
                  <div style={{ marginTop: "40px", textAlign: "center" }}>
                    <p>_________________________________________</p>
                    <p>Assinatura do Vendedor</p>
                  </div>
                  <div style={{ marginTop: "40px", textAlign: "center" }}>
                    <p>_________________________________________</p>
                    <p>Assinatura do Comprador</p>
                  </div>
                </>
              )}
            </div>

            {/* Botões */}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={gerando}>
                <Printer className="h-4 w-4 mr-2" />
                {gerando ? "Processando..." : "Gerar e Imprimir Recibo"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
