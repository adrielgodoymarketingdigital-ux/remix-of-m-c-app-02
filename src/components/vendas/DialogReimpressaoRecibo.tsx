import { useRef, useEffect, useState } from "react";
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
import { supabase } from "@/integrations/supabase/client";
import { useConfiguracaoLoja } from "@/hooks/useConfiguracaoLoja";
import { checklistLabels } from "@/lib/checklist-templates";
import { Venda } from "@/types/venda";
import { Dispositivo } from "@/types/dispositivo";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
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

interface DialogReimpressaoReciboProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venda: Venda | null;
}

export function DialogReimpressaoRecibo({
  open,
  onOpenChange,
  venda,
}: DialogReimpressaoReciboProps) {
  const reciboRef = useRef<HTMLDivElement>(null);
  const { config: configLoja } = useConfiguracaoLoja();
  const { toast } = useToast();
  const [dispositivo, setDispositivo] = useState<Dispositivo | null>(null);
  const [clienteCompleto, setClienteCompleto] = useState<any>(null);
  const [produto, setProduto] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && venda) {
      carregarDadosCompletos();
    }
  }, [open, venda]);

  const carregarDadosCompletos = async () => {
    if (!venda) return;

    try {
      setLoading(true);

      // Buscar dados completos do cliente
      if (venda.cliente_id) {
        const { data: cliente } = await supabase
          .from("clientes")
          .select("*")
          .eq("id", venda.cliente_id)
          .maybeSingle();
        
        setClienteCompleto(cliente);
      }

      // Buscar dados completos do produto ou peça se for venda de produto
      if (venda.tipo === "produto") {
        // Se tem peca_id, buscar na tabela de peças
        if ((venda as any).peca_id) {
          const { data: pecaData } = await supabase
            .from("pecas")
            .select("*")
            .eq("id", (venda as any).peca_id)
            .maybeSingle();
          
          if (pecaData) {
            setProduto(pecaData);
          }
        } else if (venda.produto_id) {
          // Primeiro tentar buscar na tabela de produtos
          const { data: produtoData } = await supabase
            .from("produtos")
            .select("*")
            .eq("id", venda.produto_id)
            .maybeSingle();
          
          if (produtoData) {
            setProduto(produtoData);
          } else {
            // Se não encontrou em produtos, tentar em peças (fallback para vendas legadas)
            const { data: pecaData } = await supabase
              .from("pecas")
              .select("*")
              .eq("id", venda.produto_id)
              .maybeSingle();
            
            if (pecaData) {
              setProduto(pecaData);
            }
          }
        }
      }

      // Buscar dados completos do dispositivo se for venda de dispositivo
      if (venda.tipo === "dispositivo" && venda.dispositivo_id) {
        const { data: disp } = await supabase
          .from("dispositivos")
          .select("*")
          .eq("id", venda.dispositivo_id)
          .maybeSingle();
        
        if (disp) {
          setDispositivo(disp as Dispositivo);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast({
        title: "Erro ao carregar dados",
        description: "Alguns dados podem estar incompletos.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

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

  const vendasConfig = configLoja?.layout_vendas_config as any;
  const formatoPapel = vendasConfig?.formato_papel || 'a4';
  const is80mm = formatoPapel !== 'a4';
  const showLogo = vendasConfig?.mostrar_logo !== false;
  const showDadosLoja = vendasConfig?.mostrar_dados_loja !== false;
  const showDadosCliente = vendasConfig?.mostrar_dados_cliente !== false;
  const showDadosDispositivo = vendasConfig?.mostrar_dados_dispositivo !== false;
  const showChecklist = vendasConfig?.mostrar_checklist !== false;
  const showGarantia = vendasConfig?.mostrar_garantia !== false;
  const showAssinaturas = vendasConfig?.mostrar_assinaturas !== false;
  const showValor = vendasConfig?.mostrar_valor !== false;

  const imprimirRecibo = () => {
    if (!reciboRef.current) return;

    const conteudo = reciboRef.current.innerHTML;
    const janelaImpressao = window.open("", "_blank");
    
    if (janelaImpressao) {
      const paper = resolvePaperSize(formatoPapel, vendasConfig?.largura_mm, vendasConfig?.altura_mm);
      const estilos80mm = getThermalPrintCSS(paper);

      janelaImpressao.document.write(`
        <html>
          <head>
            <title>Recibo de Venda - ${venda?.tipo === "dispositivo" ? `${venda.dispositivos?.marca} ${venda.dispositivos?.modelo}` : venda?.produtos?.nome}</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                padding: ${is80mm ? '2mm' : '20px'};
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

  if (!venda) return null;

  const dataVenda = format(parseISO(venda.data), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  const descontoManual = Number((venda as any).valor_desconto_manual || 0);
  const descontoCupom = Number((venda as any).valor_desconto_cupom || 0);
  const totalDescontos = descontoManual + descontoCupom;
  const totalLiquido = venda.total - totalDescontos;
  const valorUnitario = venda.total / venda.quantidade;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Reimprimir Recibo de Venda
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
                <p>Data: {dataVenda}</p>
              </div>
            </div>

            {showDadosCliente && (
              <div className="recibo-section">
                <h3>Dados do Comprador</h3>
                <div className="recibo-info">
                  <span>Nome:</span>
                  <span>{clienteCompleto?.nome || venda.clientes?.nome || "Não informado"}</span>
                </div>
                {clienteCompleto?.cpf && (
                  <div className="recibo-info">
                    <span>CPF:</span>
                    <span>{clienteCompleto.cpf}</span>
                  </div>
                )}
                {(clienteCompleto?.telefone || venda.clientes?.telefone) && (
                  <div className="recibo-info">
                    <span>Telefone:</span>
                    <span>{clienteCompleto?.telefone || venda.clientes?.telefone}</span>
                  </div>
                )}
                {clienteCompleto?.endereco && (
                  <div className="recibo-info">
                    <span>Endereço:</span>
                    <span>{clienteCompleto.endereco}</span>
                  </div>
                )}
              </div>
            )}

            {showDadosDispositivo && (
              <div className="recibo-section">
                <h3>Produto Vendido</h3>
                <div className="recibo-info">
                  <span>Produto:</span>
                  <span>
                    {venda.tipo === "dispositivo" 
                      ? `${venda.dispositivos?.marca} ${venda.dispositivos?.modelo}`
                      : venda.pecas?.nome || venda.produtos?.nome || produto?.nome || "Produto não encontrado"}
                  </span>
                </div>
                {venda.tipo === "dispositivo" && venda.dispositivos && (
                  <>
                    <div className="recibo-info">
                      <span>Tipo:</span>
                      <span>{venda.dispositivos.tipo}</span>
                    </div>
                    {dispositivo?.imei && (
                      <div className="recibo-info">
                        <span>IMEI:</span>
                        <span>{dispositivo.imei}</span>
                      </div>
                    )}
                    {dispositivo?.numero_serie && (
                      <div className="recibo-info">
                        <span>Número de Série:</span>
                        <span>{dispositivo.numero_serie}</span>
                      </div>
                    )}
                  </>
                )}
                {venda.tipo === "produto" && (produto?.sku || venda.produtos?.sku) && (
                  <div className="recibo-info">
                    <span>SKU:</span>
                    <span>{produto?.sku || venda.produtos?.sku}</span>
                  </div>
                )}
                <div className="recibo-info">
                  <span>Quantidade:</span>
                  <span>{venda.quantidade}</span>
                </div>
                {showValor && (
                  <div className="recibo-info">
                    <span>Valor Unitário:</span>
                    <span>{formatCurrency(valorUnitario)}</span>
                  </div>
                )}
              </div>
            )}

            {showChecklist && venda.tipo === "dispositivo" && dispositivo?.checklist && (() => {
              const checklistData = (dispositivo.checklist as any)?.entrada || dispositivo.checklist;
              const entries = Object.entries(checklistData as Record<string, any>).filter(
                ([key, val]) => typeof val === 'boolean'
              );
              if (entries.length === 0) return null;
              return (
                <div className="recibo-section">
                  <h3>Estado do Aparelho na Venda</h3>
                  <div className="recibo-checklist">
                    {entries.map(([item, funciona]) => (
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
              );
            })()}

            {showGarantia && venda.tipo === "dispositivo" && (
              <div className="recibo-section">
                <h3>Termos de Garantia e Direitos do Consumidor</h3>
                <div className="termos-garantia">
                  {TERMOS_GARANTIA_CDC(dispositivo?.garantia ? dispositivo?.tempo_garantia : undefined)}
                </div>
              </div>
            )}

            {showValor && (
              <div className="recibo-total">
                {totalDescontos > 0 && (
                  <>
                    <div style={{ fontSize: '14px', fontWeight: 'normal', marginBottom: '5px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Subtotal:</span>
                      <span>{formatCurrency(venda.total)}</span>
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 'normal', marginBottom: '5px', color: '#e11d48', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Desconto:</span>
                      <span>- {formatCurrency(totalDescontos)}</span>
                    </div>
                  </>
                )}
                <div>VALOR TOTAL: {formatCurrency(totalLiquido)}</div>
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
            disabled={loading}
            className="w-full sm:w-auto"
          >
            <Copy className="h-4 w-4 mr-2" />
            Copiar Texto
          </Button>
          <Button onClick={imprimirRecibo} disabled={loading} className="w-full sm:w-auto">
            <Printer className="h-4 w-4 mr-2" />
            {loading ? "Carregando..." : "Imprimir Recibo"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
