import { useState, useRef, useEffect } from "react";
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
import { formatarTermoDispositivo, resolverTextoTermoDispositivo } from "@/lib/termo-garantia-utils";

// Normaliza tempo_garantia (sempre em meses) para exibição legível.
// Valores >= 360 são tratados como dias por engano de cadastro e convertidos para meses.
function formatarGarantia(meses: number): string {
  const m = meses >= 360 ? Math.round(meses / 30) : meses;
  if (m % 12 === 0 && m >= 12) {
    const anos = m / 12;
    return anos === 1 ? "1 ano" : `${anos} anos`;
  }
  return `${m} ${m === 1 ? "mês" : "meses"}`;
}

const TERMOS_GARANTIA_PADRAO = {
  termo_com_garantia: `TERMO DE GARANTIA

Loja: {{loja}}
CNPJ: {{loja_cnpj}}
Endereço: {{loja_endereco}}
Telefone: {{loja_telefone}}

COMPRADOR
Nome: {{cliente}}
CPF: {{cpf}}
Telefone: {{telefone}}

PRODUTO
Aparelho: {{dispositivo}}
IMEI: {{imei}}
Nº Série: {{numero_serie}}
Cor: {{cor}}  |  Capacidade: {{capacidade}}
Condição: {{condicao}}
Data da venda: {{data_venda}}
Valor pago: {{valor}}

1. GARANTIA LEGAL (CDC - Lei 8.078/90)
   • Garantia legal de 90 (noventa) dias, conforme Art. 26, II do CDC.
   • Cobre defeitos de fabricação ou vícios que comprometam o funcionamento.

2. GARANTIA CONTRATUAL ({{garantia_meses}} meses)
   • Garantia adicional de {{garantia_meses}} meses a partir da data desta venda.
   • Complementar à garantia legal, conforme Art. 50 do CDC.
   • Cobre defeitos de fabricação, excluindo mau uso, quedas ou oxidação.

3. DIREITOS DO CONSUMIDOR
   • Vício do produto: substituição, devolução ou abatimento (Art. 18 CDC).
   • Prazo suspenso durante reparo (Art. 26, §2º CDC).
   • Conserve este documento como comprovante.

4. EXCLUSÕES
   • Quedas, impactos, contato com líquidos, uso inadequado.
   • Violação de lacres ou reparo por terceiros não autorizados.
   • Desgaste natural de uso.

Para acionamento da garantia, apresente este termo na loja.`,

  termo_sem_garantia: `DECLARAÇÃO DE VENDA SEM GARANTIA CONTRATUAL

Loja: {{loja}}
CNPJ: {{loja_cnpj}}

COMPRADOR
Nome: {{cliente}}
CPF: {{cpf}}

PRODUTO
Aparelho: {{dispositivo}}
IMEI: {{imei}}
Condição: {{condicao}}
Data da venda: {{data_venda}}
Valor pago: {{valor}}

AVISO: Este produto é vendido sem garantia contratual adicional.
A garantia legal de 90 dias prevista no CDC (Art. 26, II) se aplica conforme a legislação.
O cliente declara estar ciente das condições do equipamento.`,
};

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
  const { config: configLoja, refetch } = useConfiguracaoLoja();
  const { funcionarioId } = useFuncionarioPermissoes();

  useEffect(() => {
    if (open) refetch();
  }, [open]);

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

  const watchedValues = form.watch();
  const valorTotal = watchedValues.quantidade_vendida * watchedValues.valor_unitario;

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

  const dataAtualFormatada = format(new Date(), "dd/MM/yyyy", { locale: ptBR });

  const obterTextoTermo = (formValues: FormValues): string => {
    const termoConfig = configLoja?.termo_garantia_dispositivo_config as any;
    const textoBase = resolverTextoTermoDispositivo(
      termoConfig,
      !!dispositivo?.garantia,
      TERMOS_GARANTIA_PADRAO.termo_com_garantia,
      TERMOS_GARANTIA_PADRAO.termo_sem_garantia
    );

    const condicaoLabels: Record<string, string> = { novo: "Novo", semi_novo: "Semi Novo", usado: "Usado" };

    return formatarTermoDispositivo(textoBase, {
      cliente: formValues.cliente_nome,
      cpf: formValues.cliente_cpf,
      telefone: formValues.cliente_telefone,
      dispositivo: [dispositivo?.marca, dispositivo?.modelo].filter(Boolean).join(' '),
      imei: dispositivo?.imei,
      numero_serie: dispositivo?.numero_serie,
      cor: dispositivo?.cor,
      capacidade: dispositivo?.capacidade_gb ? `${dispositivo.capacidade_gb} GB` : undefined,
      condicao: condicaoLabels[dispositivo?.condicao || ''] || dispositivo?.condicao,
      garantia_meses: dispositivo?.tempo_garantia != null ? formatarGarantia(dispositivo.tempo_garantia) : undefined,
      valor: formatCurrency(formValues.quantidade_vendida * formValues.valor_unitario),
      data_venda: dataAtualFormatada,
      loja: configLoja?.nome_loja,
      loja_telefone: configLoja?.telefone,
      loja_cnpj: configLoja?.cnpj,
      loja_endereco: configLoja?.endereco,
    });
  };

  const imprimirRecibo = () => {
    if (!reciboRef.current) return;

    // O reciboRef fica display:none — imagens não carregam nesse estado.
    // O cabeçalho (logo + dados loja) é injetado diretamente no HTML de impressão.
    const conteudoSemHeader = reciboRef.current.innerHTML;

    const cabecalho = `
      <div class="recibo-header">
        ${showLogo && configLoja?.logo_url
          ? `<div style="text-align:center;margin-bottom:15px"><img src="${configLoja.logo_url}" alt="Logo da Loja" class="logo-loja" /></div>`
          : ''}
        <h1>${configLoja?.nome_loja || ''}</h1>
        ${showDadosLoja ? `
        <div class="dados-loja">
          ${configLoja?.cnpj ? `<p>CNPJ: ${configLoja.cnpj}</p>` : ''}
          ${configLoja?.endereco ? `<p>Endereço: ${configLoja.endereco}</p>` : ''}
          ${configLoja?.telefone ? `<p>Telefone: ${configLoja.telefone}</p>` : ''}
          ${configLoja?.email ? `<p>E-mail: ${configLoja.email}</p>` : ''}
        </div>` : ''}
        <div style="margin-top:15px;padding-top:15px;border-top:2px solid #000">
          <h2>RECIBO DE VENDA</h2>
          <p>Data: ${dataAtual}</p>
        </div>
      </div>
    `;

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
                padding-bottom: 2mm;
                margin-bottom: 2mm;
                font-size: ${is80mm ? '9pt' : '14px'};
              }
              .termos-garantia {
                font-size: ${is80mm ? '7pt' : '11px'};
                line-height: 1.6;
                white-space: pre-line;
              }
              .logo-loja {
                max-width: ${is80mm ? '30mm' : '150px'};
                height: auto;
                margin: 0 auto 3mm;
              }
              .dados-loja {
                font-size: ${is80mm ? '9pt' : '12px'};
                font-weight: ${is80mm ? '600' : '400'};
                margin-top: 2mm;
              }
              .recibo-info {
                display: flex;
                justify-content: space-between;
                margin: 1mm 0;
                font-size: ${is80mm ? '9pt' : 'inherit'};
              }
              .recibo-total {
                font-size: ${is80mm ? '13pt' : '20px'};
                font-weight: bold;
                text-align: right;
                margin-top: ${is80mm ? '3mm' : '20px'};
                padding-top: ${is80mm ? '2mm' : '20px'};
                border-top: ${is80mm ? '1px dashed #000' : '2px solid #000'};
              }
              .recibo-checklist {
                display: grid;
                grid-template-columns: ${is80mm ? '1fr' : '1fr 1fr'};
                gap: ${is80mm ? '1mm' : '8px 16px'};
                margin-top: 2mm;
              }
              .recibo-checklist-item {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: ${is80mm ? '8pt' : '11px'};
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
            ${cabecalho}
            ${conteudoSemHeader}
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
  const textoTermo = obterTextoTermo(watchedValues);

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
            {/* O cabeçalho (logo + dados loja) é injetado diretamente na janela de impressão
                para garantir que a imagem seja carregada corretamente. */}
            <div ref={reciboRef} style={{ display: "none" }}>

              {showDadosCliente && (
                <div className="recibo-section">
                  <h3>Dados do Comprador</h3>
                  <div className="recibo-info">
                    <span>Nome:</span>
                    <span>{watchedValues.cliente_nome}</span>
                  </div>
                  {watchedValues.cliente_cpf && (
                    <div className="recibo-info">
                      <span>CPF:</span>
                      <span>{watchedValues.cliente_cpf}</span>
                    </div>
                  )}
                  {watchedValues.cliente_telefone && (
                    <div className="recibo-info">
                      <span>Telefone:</span>
                      <span>{watchedValues.cliente_telefone}</span>
                    </div>
                  )}
                  {watchedValues.cliente_endereco && (
                    <div className="recibo-info">
                      <span>Endereço:</span>
                      <span>{watchedValues.cliente_endereco}</span>
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
                    <span>{watchedValues.quantidade_vendida}</span>
                  </div>
                  {showValor && (
                    <div className="recibo-info">
                      <span>Valor Unitário:</span>
                      <span>{formatCurrency(watchedValues.valor_unitario)}</span>
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
                    {textoTermo}
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
