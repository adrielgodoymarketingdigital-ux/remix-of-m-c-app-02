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
import {
  FormatoPapel,
  salvarUltimoFormatoPapel,
} from "@/components/recibo/SeletorFormatoPapelDialog";

function formatarGarantia(meses: number): string {
  const m = meses >= 360 ? Math.round(meses / 30) : meses;
  if (m % 12 === 0 && m >= 12) {
    const anos = m / 12;
    return anos === 1 ? "1 ano" : `${anos} anos`;
  }
  return `${m} ${m === 1 ? "mês" : "meses"}`;
}

const TERMOS_GARANTIA_CDC = (tempoGarantia?: number) => {
  const label = tempoGarantia ? formatarGarantia(tempoGarantia) : null;
  return `
TERMOS DE GARANTIA

1. GARANTIA LEGAL (Código de Defesa do Consumidor - Lei 8.078/90)
   • Este produto possui garantia legal de 90 (noventa) dias, conforme Art. 26, II do CDC.
   • A garantia legal é oferecida pelo fabricante e tem início na data da compra.
   • Cobre defeitos de fabricação ou vícios que comprometam o funcionamento do produto.

2. GARANTIA CONTRATUAL${label ? ` (${label})` : ''}
   ${label
     ? `• Este produto possui garantia contratual adicional de ${label} a partir da data desta venda.
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
};

interface DialogReimpressaoReciboProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venda: Venda | null;
  // Quando a venda faz parte de um grupo (múltiplos itens em uma mesma
  // compra, ligados por grupo_venda), passar todos os itens aqui para que
  // o recibo liste todos, não só o primeiro.
  vendasGrupo?: Venda[] | null;
}

interface ItemReciboCompleto {
  venda: Venda;
  dispositivo: Dispositivo | null;
  produto: any;
}

export function DialogReimpressaoRecibo({
  open,
  onOpenChange,
  venda,
  vendasGrupo,
}: DialogReimpressaoReciboProps) {
  const reciboRef = useRef<HTMLDivElement>(null);
  const { config: configLoja } = useConfiguracaoLoja(venda?.empresa_id);
  const { toast } = useToast();
  const [clienteCompleto, setClienteCompleto] = useState<any>(null);
  const [itensCompletos, setItensCompletos] = useState<ItemReciboCompleto[]>([]);
  const [loading, setLoading] = useState(false);

  // Itens da venda (grupo completo, ou só a venda avulsa quando não há grupo)
  const itensVenda = vendasGrupo && vendasGrupo.length > 1 ? vendasGrupo : (venda ? [venda] : []);

  useEffect(() => {
    if (open && venda) {
      carregarDadosCompletos();
    }
  }, [open, venda, vendasGrupo]);

  const carregarDadosCompletos = async () => {
    if (!venda) return;

    try {
      setLoading(true);

      // Buscar dados completos do cliente (mesmo cliente para todo o grupo)
      if (venda.cliente_id) {
        const { data: cliente } = await supabase
          .from("clientes")
          .select("*")
          .eq("id", venda.cliente_id)
          .maybeSingle();

        setClienteCompleto(cliente);
      }

      // Buscar dados completos (produto/peça/dispositivo) de cada item da venda/grupo
      const itens = await Promise.all(itensVenda.map(async (v): Promise<ItemReciboCompleto> => {
        let produto: any = null;
        let dispositivo: Dispositivo | null = null;

        if (v.tipo === "produto") {
          if ((v as any).peca_id) {
            const { data: pecaData } = await supabase
              .from("pecas")
              .select("*")
              .eq("id", (v as any).peca_id)
              .maybeSingle();
            if (pecaData) produto = pecaData;
          } else if (v.produto_id) {
            const { data: produtoData } = await supabase
              .from("produtos")
              .select("*")
              .eq("id", v.produto_id)
              .maybeSingle();
            if (produtoData) {
              produto = produtoData;
            } else {
              // Se não encontrou em produtos, tentar em peças (fallback para vendas legadas)
              const { data: pecaData } = await supabase
                .from("pecas")
                .select("*")
                .eq("id", v.produto_id)
                .maybeSingle();
              if (pecaData) produto = pecaData;
            }
          }
        }

        if (v.tipo === "dispositivo" && v.dispositivo_id) {
          const { data: disp } = await supabase
            .from("dispositivos")
            .select("*")
            .eq("id", v.dispositivo_id)
            .maybeSingle();
          if (disp) dispositivo = disp as Dispositivo;
        }

        return { venda: v, produto, dispositivo };
      }));

      setItensCompletos(itens);
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

  const imprimirRecibo = (formato: FormatoPapel) => {
    if (!reciboRef.current) return;

    salvarUltimoFormatoPapel(formato);

    const conteudo = reciboRef.current.innerHTML;
    const janelaImpressao = window.open("", "_blank");

    if (janelaImpressao) {
      const isThermalImpressao = formato !== 'a4';
      const paper = resolvePaperSize(formato, vendasConfig?.largura_mm, vendasConfig?.altura_mm);
      // getThermalPrintCSS gera @page + body para térmica; A4 retorna string vazia
      const cssTermico = getThermalPrintCSS(paper);
      const titulo = itensVenda.length > 1
        ? `${itensVenda.length} itens`
        : venda?.tipo === "dispositivo"
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
      font-size: ${isThermalImpressao ? '13px' : '13px'};
      font-weight: ${isThermalImpressao ? '600' : '400'};
      color: #000;
      background: white;
      padding: ${isThermalImpressao ? '2mm' : '15px'};
      max-width: ${isThermalImpressao ? 'none' : '800px'};
      margin: 0 auto;
      line-height: 1.4;
    }
    .recibo-header {
      text-align: center;
      border-bottom: ${isThermalImpressao ? '1px dashed #000' : '2px solid #000'};
      padding-bottom: ${isThermalImpressao ? '2mm' : '16px'};
      margin-bottom: ${isThermalImpressao ? '3mm' : '16px'};
    }
    .logo-loja {
      display: block;
      max-width: ${isThermalImpressao ? '30mm' : '120px'};
      max-height: ${isThermalImpressao ? '15mm' : '70px'};
      height: auto;
      margin: 0 auto ${isThermalImpressao ? '2mm' : '10px'};
    }
    .recibo-header h1 {
      font-size: ${isThermalImpressao ? '14px' : '20px'};
      font-weight: 900;
      color: #000;
      letter-spacing: 0;
      margin: ${isThermalImpressao ? '1mm 0' : '6px 0'};
    }
    .dados-loja {
      font-size: ${isThermalImpressao ? '12px' : '11px'};
      font-weight: 900;
      font-style: normal;
      color: #000;
      letter-spacing: 0;
      margin-top: 3px;
      line-height: 1.8;
    }
    .recibo-titulo-bloco {
      margin-top: ${isThermalImpressao ? '2mm' : '12px'};
      padding-top: ${isThermalImpressao ? '2mm' : '12px'};
      border-top: ${isThermalImpressao ? '1px dashed #000' : '1.5px solid #000'};
    }
    .recibo-header h2 {
      font-size: ${isThermalImpressao ? '12px' : '15px'};
      font-weight: 900;
      color: #000;
      letter-spacing: 0;
      margin: 1mm 0;
    }
    .recibo-header p { font-size: ${isThermalImpressao ? '12px' : '11px'}; font-weight: 900; color: #000; letter-spacing: 0; }
    .recibo-section {
      margin-bottom: ${isThermalImpressao ? '3mm' : '16px'};
      page-break-inside: avoid;
    }
    .recibo-section h3 {
      font-size: ${isThermalImpressao ? '11px' : '13px'};
      font-weight: 900;
      border-bottom: ${isThermalImpressao ? '1px dashed #ccc' : '1px solid #ccc'};
      padding-bottom: 2mm;
      margin-bottom: 2mm;
    }
    .termos-garantia {
      font-size: ${isThermalImpressao ? '7pt' : '10px'};
      line-height: 1.6;
      white-space: pre-line;
      color: #333;
    }
    .recibo-info {
      display: flex;
      justify-content: space-between;
      font-size: ${isThermalImpressao ? '9pt' : '12px'};
      margin: 1mm 0;
    }
    .recibo-total {
      font-size: ${isThermalImpressao ? '13pt' : '20px'};
      font-weight: bold;
      text-align: right;
      margin-top: ${isThermalImpressao ? '3mm' : '20px'};
      padding-top: ${isThermalImpressao ? '2mm' : '16px'};
      border-top: ${isThermalImpressao ? '1px dashed #000' : '2px solid #000'};
    }
    .recibo-checklist {
      display: grid;
      grid-template-columns: ${isThermalImpressao ? '1fr' : '1fr 1fr'};
      gap: ${isThermalImpressao ? '1mm' : '6px 14px'};
      margin-top: 2mm;
    }
    .recibo-checklist-item {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: ${isThermalImpressao ? '8pt' : '11px'};
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
    window.onload = function() {
      setTimeout(function() {
        window.focus();
        window.print();
        window.onafterprint = function() {
          window.close();
        };
      }, 500);
    };
  </script>
</body>
</html>`);
      janelaImpressao.document.close();
    }
  };

  if (!venda) return null;

  const dataVenda = formatDate(venda.data);

  // Soma descontos e totais de TODOS os itens da venda/grupo, não só do
  // primeiro — cada item pode ter seu próprio desconto aplicado no PDV.
  const descontoManual = itensVenda.reduce((acc, v) => acc + Number((v as any).valor_desconto_manual || 0), 0);
  const descontoCupom = itensVenda.reduce((acc, v) => acc + Number((v as any).valor_desconto_cupom || 0), 0);
  const totalDescontos = descontoManual + descontoCupom;
  const totalBruto = itensVenda.reduce((acc, v) => acc + Number(v.total || 0), 0);
  const totalLiquido = totalBruto - totalDescontos;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Reimprimir Recibo de Venda{venda.numero_venda ? ` — ${venda.numero_venda}` : ""}
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
                {venda.numero_venda && <p>Nº {venda.numero_venda}</p>}
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

            {showDadosDispositivo && itensCompletos.map((item, idx) => {
              const v = item.venda;
              const valorUnitarioItem = Number(v.total) / (v.quantidade || 1);
              return (
                <div className="recibo-section" key={v.id}>
                  <h3>
                    {itensCompletos.length > 1 ? `Produto Vendido (${idx + 1}/${itensCompletos.length})` : "Produto Vendido"}
                  </h3>
                  <div className="recibo-info">
                    <span>Produto:</span>
                    <span>
                      {v.tipo === "dispositivo"
                        ? `${v.dispositivos?.marca} ${v.dispositivos?.modelo}`
                        : v.pecas?.nome || v.produtos?.nome || item.produto?.nome || "Produto não encontrado"}
                    </span>
                  </div>
                  {v.tipo === "dispositivo" && v.dispositivos && (
                    <>
                      <div className="recibo-info">
                        <span>Tipo:</span>
                        <span>{v.dispositivos.tipo}</span>
                      </div>
                      {item.dispositivo?.imei && (
                        <div className="recibo-info">
                          <span>IMEI:</span>
                          <span>{item.dispositivo.imei}</span>
                        </div>
                      )}
                      {item.dispositivo?.numero_serie && (
                        <div className="recibo-info">
                          <span>Número de Série:</span>
                          <span>{item.dispositivo.numero_serie}</span>
                        </div>
                      )}
                    </>
                  )}
                  {v.tipo === "produto" && (item.produto?.sku || v.produtos?.sku) && (
                    <div className="recibo-info">
                      <span>SKU:</span>
                      <span>{item.produto?.sku || v.produtos?.sku}</span>
                    </div>
                  )}
                  <div className="recibo-info">
                    <span>Quantidade:</span>
                    <span>{v.quantidade}</span>
                  </div>
                  {showValor && (
                    <div className="recibo-info">
                      <span>Valor Unitário:</span>
                      <span>{formatCurrency(valorUnitarioItem)}</span>
                    </div>
                  )}
                </div>
              );
            })}

            {showChecklist && itensCompletos.filter(item => item.venda.tipo === "dispositivo" && item.dispositivo?.checklist).map(item => {
              const checklistData = (item.dispositivo!.checklist as any)?.entrada || item.dispositivo!.checklist;
              const entries = Object.entries(checklistData as Record<string, any>).filter(
                ([, val]) => typeof val === 'boolean'
              );
              if (entries.length === 0) return null;
              return (
                <div className="recibo-section" key={item.venda.id}>
                  <h3>
                    Estado do Aparelho na Venda
                    {itensCompletos.length > 1 && item.venda.dispositivos ? ` — ${item.venda.dispositivos.marca} ${item.venda.dispositivos.modelo}` : ""}
                  </h3>
                  <div className="recibo-checklist">
                    {entries.map(([itemChecklist, funciona]) => (
                      <div key={itemChecklist} className="recibo-checklist-item">
                        <span className="recibo-checklist-icon">
                          {funciona ? '✅' : '❌'}
                        </span>
                        <span className="recibo-checklist-label">
                          {checklistLabels[itemChecklist] || itemChecklist}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {showGarantia && itensCompletos.some(item => item.venda.tipo === "dispositivo") && (
              <div className="recibo-section">
                <h3>Termos de Garantia e Direitos do Consumidor</h3>
                <div className="termos-garantia">
                  {TERMOS_GARANTIA_CDC(
                    itensCompletos.find(item => item.venda.tipo === "dispositivo" && item.dispositivo?.garantia)?.dispositivo?.tempo_garantia
                  )}
                </div>
              </div>
            )}

            {showValor && (
              <div className="recibo-total">
                {totalDescontos > 0 && (
                  <>
                    <div style={{ fontSize: '14px', fontWeight: 'normal', marginBottom: '5px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Subtotal:</span>
                      <span>{formatCurrency(totalBruto)}</span>
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
          <Button variant="outline" onClick={() => imprimirRecibo('a4')} disabled={loading} className="w-full sm:w-auto gap-1.5">
            <Printer className="h-4 w-4" />
            A4
          </Button>
          <Button variant="outline" onClick={() => imprimirRecibo('80mm')} disabled={loading} className="w-full sm:w-auto gap-1.5">
            <Printer className="h-4 w-4" />
            80mm
          </Button>
          <Button onClick={() => imprimirRecibo('58mm')} disabled={loading} className="w-full sm:w-auto gap-1.5">
            <Printer className="h-4 w-4" />
            58mm
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
