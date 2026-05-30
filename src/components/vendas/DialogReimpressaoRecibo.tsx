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
import { formatCurrency, formatDate } from "@/lib/formatters";
import { supabase } from "@/integrations/supabase/client";
import { useConfiguracaoLoja } from "@/hooks/useConfiguracaoLoja";
import { checklistLabels } from "@/lib/checklist-templates";
import { Venda } from "@/types/venda";
import { Dispositivo } from "@/types/dispositivo";
import { useToast } from "@/hooks/use-toast";
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
  const isThermal = formatoPapel !== 'a4';
  // Flags de visibilidade ficam em config_80mm (únicas flags de seção salvas pelo DialogConfiguracaoLayoutVendas)
  const config80mm = vendasConfig?.config_80mm || {};
  const showLogo = config80mm?.mostrar_logo !== false;
  const showDadosLoja = config80mm?.mostrar_dados_loja !== false;
  const showDadosCliente = config80mm?.mostrar_dados_cliente !== false;
  // Fallback: ler também as flags legadas de nível superior
  const showDadosDispositivo = vendasConfig?.mostrar_dados_dispositivo !== false;
  const showChecklist = vendasConfig?.mostrar_checklist !== false;
  const showGarantia = vendasConfig?.mostrar_garantia !== false;
  const showAssinaturas = config80mm?.mostrar_assinaturas !== false;
  const showValor = vendasConfig?.mostrar_valor !== false;

  const imprimirRecibo = () => {
    if (!reciboRef.current) return;

    const conteudo = reciboRef.current.innerHTML;
    const janelaImpressao = window.open("", "_blank");

    if (janelaImpressao) {
      const paper = resolvePaperSize(formatoPapel, vendasConfig?.largura_mm, vendasConfig?.altura_mm);
      // getThermalPrintCSS gera @page + body para térmica; A4 retorna string vazia
      const cssTermico = getThermalPrintCSS(paper);
      const titulo = venda?.tipo === "dispositivo"
        ? `${venda.dispositivos?.marca} ${venda.dispositivos?.modelo}`
        : (venda?.produtos?.nome || "Produto");

      janelaImpressao.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Recibo de Venda - ${titulo}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: A4 portrait; margin: 10mm; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: ${isThermal ? '11px' : '13px'};
      color: #111;
      background: white;
      padding: ${isThermal ? '2mm' : '15px'};
      max-width: ${isThermal ? 'none' : '800px'};
      margin: 0 auto;
      line-height: 1.4;
    }
    .recibo-header {
      text-align: center;
      border-bottom: ${isThermal ? '1px dashed #000' : '2px solid #000'};
      padding-bottom: ${isThermal ? '6px' : '16px'};
      margin-bottom: ${isThermal ? '8px' : '16px'};
    }
    .logo-loja {
      display: block;
      max-width: ${isThermal ? '28mm' : '120px'};
      max-height: ${isThermal ? '14mm' : '70px'};
      height: auto;
      margin: 0 auto ${isThermal ? '4px' : '10px'};
    }
    .recibo-header h1 {
      font-size: ${isThermal ? '12px' : '20px'};
      font-weight: 900;
      margin: ${isThermal ? '2px 0' : '6px 0'};
    }
    .dados-loja {
      font-size: ${isThermal ? '11px' : '11px'};
      font-weight: ${isThermal ? '600' : '400'};
      color: #444;
      margin-top: ${isThermal ? '2px' : '6px'};
      line-height: 1.5;
    }
    .recibo-titulo-bloco {
      margin-top: ${isThermal ? '6px' : '12px'};
      padding-top: ${isThermal ? '6px' : '12px'};
      border-top: ${isThermal ? '1px dashed #000' : '1.5px solid #000'};
    }
    .recibo-header h2 {
      font-size: ${isThermal ? '11px' : '15px'};
      font-weight: 700;
      margin: 2px 0;
    }
    .recibo-header p { font-size: ${isThermal ? '9px' : '11px'}; color: #555; }
    .recibo-section {
      margin-bottom: ${isThermal ? '8px' : '16px'};
      page-break-inside: avoid;
    }
    .recibo-section h3 {
      font-size: ${isThermal ? '10px' : '13px'};
      font-weight: 700;
      border-bottom: ${isThermal ? '1px dashed #ccc' : '1px solid #ccc'};
      padding-bottom: 4px;
      margin-bottom: 6px;
    }
    .termos-garantia {
      font-size: ${isThermal ? '7px' : '10px'};
      line-height: 1.6;
      white-space: pre-line;
      color: #333;
    }
    .recibo-info {
      display: flex;
      justify-content: space-between;
      font-size: ${isThermal ? '9px' : '12px'};
      margin: 4px 0;
    }
    .recibo-total {
      font-size: ${isThermal ? '14px' : '20px'};
      font-weight: bold;
      text-align: right;
      margin-top: ${isThermal ? '10px' : '20px'};
      padding-top: ${isThermal ? '8px' : '16px'};
      border-top: ${isThermal ? '1px dashed #000' : '2px solid #000'};
    }
    .recibo-checklist {
      display: grid;
      grid-template-columns: ${isThermal ? '1fr' : '1fr 1fr'};
      gap: 6px ${isThermal ? '6px' : '14px'};
      margin-top: 8px;
    }
    .recibo-checklist-item {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: ${isThermal ? '8px' : '11px'};
    }
    .recibo-checklist-icon { font-size: 11px; flex-shrink: 0; }
    .recibo-checklist-label { color: #333; }
    @media print {
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      body { margin: 0 !important; }
      .recibo-checklist { page-break-inside: avoid; }
    }
    /* Sobrescreve @page e body para térmica (deve vir por último) */
    ${cssTermico}
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
</html>`);
      janelaImpressao.document.close();
    }
  };

  if (!venda) return null;

  const dataVenda = formatDate(venda.data);

  const descontoManual = Number((venda as any).valor_desconto_manual || 0);
  const descontoCupom = Number((venda as any).valor_desconto_cupom || 0);
  const totalDescontos = descontoManual + descontoCupom;
  const totalLiquido = Number(venda.total) - totalDescontos;
  const valorUnitario = Number(venda.total) / venda.quantidade;

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
                <img
                  src={configLoja.logo_url}
                  alt="Logo da Loja"
                  className="logo-loja"
                  crossOrigin="anonymous"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}

              <h1>{configLoja?.nome_loja || ''}</h1>

              {showDadosLoja && (
                <div className="dados-loja">
                  {configLoja?.cnpj && <p>CNPJ: {configLoja.cnpj}</p>}
                  {configLoja?.endereco && <p>{configLoja.endereco}</p>}
                  {configLoja?.telefone && <p>Tel: {configLoja.telefone}</p>}
                  {configLoja?.whatsapp && <p>WhatsApp: {configLoja.whatsapp}</p>}
                  {configLoja?.email && <p>{configLoja.email}</p>}
                </div>
              )}

              <div className="recibo-titulo-bloco">
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
