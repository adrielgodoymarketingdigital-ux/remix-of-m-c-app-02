import { useRef } from "react";
import { resolvePaperSize, getThermalPrintCSS } from "@/lib/paper-size-utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Copy, FileText } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { useConfiguracaoLoja } from "@/hooks/useConfiguracaoLoja";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ItemVenda } from "@/components/pdv/DialogSelecionarItem";
import { Cliente } from "@/types/cliente";
import { Cupom } from "@/types/cupom";

export interface DadosReciboPDV {
  itens: ItemVenda[];
  cliente: Cliente | null;
  subtotal: number;
  descontoManual: number;
  descontoCupom: number;
  cupom?: Cupom;
  total: number;
  formaPagamento: string;
  numeroParcelas?: number;
  data: string;
  grupoVendaId: string;
}

interface DialogReciboPDVProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dados: DadosReciboPDV | null;
}

const labelFormaPagamento: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  debito: "Cartão de Débito",
  credito: "Cartão de Crédito",
  credito_parcelado: "Crédito Parcelado",
  a_receber: "A Receber",
};

export function DialogReciboPDV({
  open,
  onOpenChange,
  dados,
}: DialogReciboPDVProps) {
  const reciboRef = useRef<HTMLDivElement>(null);
  const { config: configLoja } = useConfiguracaoLoja();
  const { toast } = useToast();

  const copiarTextoRecibo = async () => {
    if (!reciboRef.current) return;
    
    const textoRecibo = reciboRef.current.innerText;
    
    try {
      await navigator.clipboard.writeText(textoRecibo);
      toast({
        title: "Texto copiado!",
        description: "O texto do recibo foi copiado para a área de transferência.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao copiar",
        description: "Não foi possível copiar o texto.",
      });
    }
  };

  const pdvConfig = configLoja?.layout_pdv_config as any;
  const config80mm = pdvConfig?.config_80mm || {};
  const formatoPapel = pdvConfig?.formato_papel || 'a4';
  const is80mm = formatoPapel !== 'a4';
  const showLogo = config80mm?.mostrar_logo !== false;
  const showDadosLoja = config80mm?.mostrar_dados_loja !== false;
  const showDadosCliente = config80mm?.mostrar_dados_cliente !== false;
  const showItens = config80mm?.mostrar_itens !== false;
  const showSubtotal = config80mm?.mostrar_subtotal !== false;
  const showDescontos = config80mm?.mostrar_descontos !== false;
  const showTotal = config80mm?.mostrar_total !== false;
  const showFormaPagamento = config80mm?.mostrar_forma_pagamento !== false;
  const showAssinaturas = config80mm?.mostrar_assinaturas !== false;

  const imprimirRecibo = () => {
    if (!reciboRef.current) return;

    const conteudo = reciboRef.current.innerHTML;
    const janelaImpressao = window.open("", "_blank");
    
    if (janelaImpressao) {
      const paper = resolvePaperSize(formatoPapel, pdvConfig?.largura_mm, pdvConfig?.altura_mm);
      const estilos80mm = getThermalPrintCSS(paper);

      janelaImpressao.document.write(`
        <html>
          <head>
            <title>Recibo de Venda - PDV</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                padding: ${is80mm ? '2mm' : '20px'};
                max-width: ${is80mm ? '76mm' : '800px'};
                margin: 0 auto;
                font-size: ${is80mm ? '11px' : '14px'};
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
              }
              .item-venda {
                padding: 8px 0;
                border-bottom: 1px dashed #ddd;
              }
              .item-venda:last-child {
                border-bottom: none;
              }
              .item-nome {
                font-weight: 500;
              }
              .item-detalhes {
                display: flex;
                justify-content: space-between;
                color: #666;
                font-size: ${is80mm ? '10px' : '12px'};
                margin-top: 4px;
              }
              .resumo-section {
                margin-top: ${is80mm ? '10px' : '20px'};
                padding-top: ${is80mm ? '8px' : '15px'};
                border-top: ${is80mm ? '1px dashed #000' : '2px solid #000'};
              }
              .resumo-linha {
                display: flex;
                justify-content: space-between;
                margin: 8px 0;
              }
              .resumo-linha.desconto {
                color: #e11d48;
              }
              .resumo-linha.total {
                font-size: ${is80mm ? '14px' : '20px'};
                font-weight: bold;
                margin-top: 15px;
                padding-top: 10px;
                border-top: 1px solid #000;
              }
              .assinatura-section {
                margin-top: ${is80mm ? '20px' : '40px'};
                text-align: center;
              }
              @media print {
                body { margin: 0; }
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

  if (!dados) return null;

  const dataFormatada = format(new Date(dados.data), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  const temDesconto = dados.descontoManual > 0 || dados.descontoCupom > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Recibo da Venda
          </DialogTitle>
        </DialogHeader>

        {/* Preview do Recibo */}
        <div className="border rounded-lg p-6 bg-background">
          <div ref={reciboRef}>
            <div className="recibo-header">
              {showLogo && configLoja?.logo_url && (
                <div style={{ textAlign: 'center', marginBottom: '15px' }}>
                  <img 
                    src={configLoja.logo_url} 
                    alt="Logo da Loja" 
                    className="logo-loja"
                    style={{ maxWidth: '150px', margin: '0 auto' }}
                  />
                </div>
              )}
              
              <h1 style={{ margin: '10px 0', fontSize: '18px' }}>{configLoja?.nome_loja || 'G360 System'}</h1>
              
              {showDadosLoja && (
                <div className="dados-loja" style={{ fontSize: '12px' }}>
                  {configLoja?.cnpj && <p>CNPJ: {configLoja.cnpj}</p>}
                  {configLoja?.endereco && <p>Endereço: {configLoja.endereco}</p>}
                  {configLoja?.telefone && <p>Telefone: {configLoja.telefone}</p>}
                  {configLoja?.email && <p>E-mail: {configLoja.email}</p>}
                </div>
              )}
              
              <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '2px solid #000' }}>
                <h2 style={{ margin: '5px 0', fontSize: '16px' }}>RECIBO DE VENDA</h2>
                <p style={{ fontSize: '12px' }}>Data: {dataFormatada}</p>
              </div>
            </div>

            {showDadosCliente && dados.cliente && (
              <div className="recibo-section">
                <h3 style={{ borderBottom: '1px solid #ccc', paddingBottom: '5px', marginBottom: '10px' }}>Dados do Cliente</h3>
                <div className="recibo-info" style={{ display: 'flex', justifyContent: 'space-between', margin: '5px 0' }}>
                  <span>Nome:</span>
                  <span>{dados.cliente.nome}</span>
                </div>
                {dados.cliente.cpf && (
                  <div className="recibo-info" style={{ display: 'flex', justifyContent: 'space-between', margin: '5px 0' }}>
                    <span>CPF:</span>
                    <span>{dados.cliente.cpf}</span>
                  </div>
                )}
                {dados.cliente.telefone && (
                  <div className="recibo-info" style={{ display: 'flex', justifyContent: 'space-between', margin: '5px 0' }}>
                    <span>Telefone:</span>
                    <span>{dados.cliente.telefone}</span>
                  </div>
                )}
                {dados.cliente.endereco && (
                  <div className="recibo-info" style={{ display: 'flex', justifyContent: 'space-between', margin: '5px 0' }}>
                    <span>Endereço:</span>
                    <span>{dados.cliente.endereco}</span>
                  </div>
                )}
              </div>
            )}

            {showItens && (
              <div className="recibo-section">
                <h3 style={{ borderBottom: '1px solid #ccc', paddingBottom: '5px', marginBottom: '10px' }}>
                  Itens da Venda ({dados.itens.length} {dados.itens.length === 1 ? 'item' : 'itens'})
                </h3>
                
                {dados.itens.map((item, index) => (
                  <div 
                    key={item.id} 
                    className="item-venda"
                    style={{ padding: '8px 0', borderBottom: index < dados.itens.length - 1 ? '1px dashed #ddd' : 'none' }}
                  >
                    <div className="item-nome" style={{ fontWeight: 500 }}>
                      {index + 1}. {item.nome}
                    </div>
                    <div 
                      className="item-detalhes" 
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        color: '#666', 
                        fontSize: '12px', 
                        marginTop: '4px' 
                      }}
                    >
                      <span>
                        {item.quantidade}x {formatCurrency(item.preco)}
                      </span>
                      <span style={{ fontWeight: 500, color: '#000' }}>
                        {formatCurrency(item.preco * item.quantidade)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="resumo-section" style={{ marginTop: '20px', paddingTop: '15px', borderTop: '2px solid #000' }}>
              {showSubtotal && (
                <div className="resumo-linha" style={{ display: 'flex', justifyContent: 'space-between', margin: '8px 0' }}>
                  <span>Subtotal:</span>
                  <span>{formatCurrency(dados.subtotal)}</span>
                </div>
              )}

              {showDescontos && dados.descontoManual > 0 && (
                <div 
                  className="resumo-linha desconto" 
                  style={{ display: 'flex', justifyContent: 'space-between', margin: '8px 0', color: '#e11d48' }}
                >
                  <span>Desconto:</span>
                  <span>- {formatCurrency(dados.descontoManual)}</span>
                </div>
              )}

              {showDescontos && dados.descontoCupom > 0 && dados.cupom && (
                <div 
                  className="resumo-linha desconto" 
                  style={{ display: 'flex', justifyContent: 'space-between', margin: '8px 0', color: '#e11d48' }}
                >
                  <span>Cupom ({dados.cupom.codigo}):</span>
                  <span>- {formatCurrency(dados.descontoCupom)}</span>
                </div>
              )}

              {showTotal && (
                <div 
                  className="resumo-linha total" 
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    margin: '15px 0 8px', 
                    paddingTop: '10px',
                    borderTop: '1px solid #000',
                    fontSize: '20px', 
                    fontWeight: 'bold' 
                  }}
                >
                  <span>TOTAL:</span>
                  <span>{formatCurrency(dados.total)}</span>
                </div>
              )}

              {showFormaPagamento && (
                <div className="resumo-linha" style={{ display: 'flex', justifyContent: 'space-between', margin: '8px 0' }}>
                  <span>Forma de Pagamento:</span>
                  <span>
                    {labelFormaPagamento[dados.formaPagamento] || dados.formaPagamento}
                    {dados.formaPagamento === "credito_parcelado" && dados.numeroParcelas && (
                      <span> ({dados.numeroParcelas}x)</span>
                    )}
                  </span>
                </div>
              )}

              {showFormaPagamento && dados.formaPagamento === "credito_parcelado" && dados.numeroParcelas && (
                <div className="resumo-linha" style={{ display: 'flex', justifyContent: 'space-between', margin: '8px 0' }}>
                  <span>Valor por Parcela:</span>
                  <span>{formatCurrency(dados.total / dados.numeroParcelas)}</span>
                </div>
              )}
            </div>

            {showAssinaturas && (
              <>
                <div className="assinatura-section" style={{ marginTop: '40px', textAlign: 'center' }}>
                  <p>_________________________________________</p>
                  <p>Assinatura do Vendedor</p>
                </div>

                <div style={{ marginTop: '40px', textAlign: 'center' }}>
                  <p>_________________________________________</p>
                  <p>Assinatura do Comprador</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Botões */}
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Fechar
          </Button>
          <Button 
            variant="outline" 
            onClick={copiarTextoRecibo}
            className="w-full sm:w-auto"
          >
            <Copy className="h-4 w-4 mr-2" />
            Copiar Texto
          </Button>
          <Button onClick={imprimirRecibo} className="w-full sm:w-auto">
            <Printer className="h-4 w-4 mr-2" />
            Imprimir Recibo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
