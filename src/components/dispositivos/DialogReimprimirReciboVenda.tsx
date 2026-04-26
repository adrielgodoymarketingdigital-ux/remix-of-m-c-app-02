import { useRef } from "react";
import { resolvePaperSize, getThermalPrintCSS } from "@/lib/paper-size-utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, FileText } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { useConfiguracaoLoja } from "@/hooks/useConfiguracaoLoja";
import { checklistLabels } from "@/lib/checklist-templates";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface VendaDispositivo {
  id: string;
  quantidade: number;
  total: number;
  forma_pagamento: string;
  data: string;
  cliente_nome?: string;
  cliente_telefone?: string;
  cliente_cpf?: string;
  cliente_endereco?: string;
  dispositivo_marca?: string;
  dispositivo_modelo?: string;
  dispositivo_tipo?: string;
  dispositivo_imei?: string;
  dispositivo_numero_serie?: string;
  dispositivo_cor?: string;
  dispositivo_capacidade_gb?: number;
  dispositivo_condicao?: string;
  dispositivo_garantia?: boolean;
  dispositivo_tempo_garantia?: number;
  dispositivo_checklist?: any;
}

const FORMAS_PAGAMENTO_LABEL: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  debito: "Débito",
  credito: "Crédito",
  credito_parcelado: "Crédito Parcelado",
  a_prazo: "A Prazo",
};

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

interface DialogReimprimirReciboVendaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venda: VendaDispositivo | null;
  modo?: "recibo" | "garantia";
}

export function DialogReimprimirReciboVenda({
  open,
  onOpenChange,
  venda,
  modo = "recibo",
}: DialogReimprimirReciboVendaProps) {
  const reciboRef = useRef<HTMLDivElement>(null);
  const garantiaRef = useRef<HTMLDivElement>(null);
  const { config: configLoja } = useConfiguracaoLoja();

  if (!venda) return null;

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
  const dataVenda = format(new Date(venda.data), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  const valorUnitario = venda.quantidade > 0 ? venda.total / venda.quantidade : venda.total;

  const imprimirRecibo = () => {
    const ref = modo === "garantia" ? garantiaRef : reciboRef;
    if (!ref.current) return;

    const conteudo = ref.current.innerHTML;
    const janelaImpressao = window.open("", "_blank");

    if (janelaImpressao) {
      const paper = resolvePaperSize(formatoPapel, dispConfig?.largura_mm, dispConfig?.altura_mm);
      const estilos80mm = getThermalPrintCSS(paper);

      janelaImpressao.document.write(`
        <html>
          <head>
            <title>${modo === "garantia" ? "Termo de Garantia" : "Recibo de Venda"} - ${venda.dispositivo_marca} ${venda.dispositivo_modelo}</title>
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
              .recibo-checklist-icon { font-size: 12px; flex-shrink: 0; }
              .recibo-checklist-label { color: #333; }
              .recibo-reimpressao {
                text-align: center;
                font-size: ${is80mm ? '8px' : '10px'};
                color: #999;
                margin-top: 15px;
                font-style: italic;
              }
              @media print {
                body { margin: 0; }
                .recibo-checklist { page-break-inside: avoid; }
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {modo === "garantia" ? "Imprimir Termo de Garantia" : "Reimprimir Recibo de Venda"}
          </DialogTitle>
        </DialogHeader>

        {/* Preview resumido */}
        <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-bold text-lg">
                {venda.dispositivo_marca} {venda.dispositivo_modelo}
              </h3>
              <p className="text-sm text-muted-foreground">{venda.dispositivo_tipo}</p>
            </div>
            <p className="text-lg font-bold">{formatCurrency(venda.total)}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Cliente:</span>
              <p className="font-medium">{venda.cliente_nome || "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Data da venda:</span>
              <p className="font-medium">{dataVenda}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Pagamento:</span>
              <p className="font-medium">{FORMAS_PAGAMENTO_LABEL[venda.forma_pagamento] || venda.forma_pagamento}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Quantidade:</span>
              <p className="font-medium">{venda.quantidade}</p>
            </div>
          </div>
        </div>

        {/* Recibo oculto para impressão */}
        <div ref={reciboRef} style={{ display: "none" }}>
          <div className="recibo-header">
            {showLogo && configLoja?.logo_url && (
              <div style={{ textAlign: 'center', marginBottom: '15px' }}>
                <img src={configLoja.logo_url} alt="Logo da Loja" className="logo-loja" />
              </div>
            )}
            <h1>{configLoja?.nome_loja || 'Loja'}</h1>
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
              <p>Data da venda: {dataVenda}</p>
            </div>
          </div>

          {showDadosCliente && (
            <div className="recibo-section">
              <h3>Dados do Comprador</h3>
              <div className="recibo-info"><span>Nome:</span><span>{venda.cliente_nome || "—"}</span></div>
              {venda.cliente_cpf && <div className="recibo-info"><span>CPF:</span><span>{venda.cliente_cpf}</span></div>}
              {venda.cliente_telefone && <div className="recibo-info"><span>Telefone:</span><span>{venda.cliente_telefone}</span></div>}
              {venda.cliente_endereco && <div className="recibo-info"><span>Endereço:</span><span>{venda.cliente_endereco}</span></div>}
            </div>
          )}

          {showDadosDispositivo && (
            <div className="recibo-section">
              <h3>Produto Vendido</h3>
              <div className="recibo-info"><span>Produto:</span><span>{venda.dispositivo_marca} {venda.dispositivo_modelo}</span></div>
              <div className="recibo-info"><span>Tipo:</span><span>{venda.dispositivo_tipo}</span></div>
              {venda.dispositivo_cor && <div className="recibo-info"><span>Cor:</span><span>{venda.dispositivo_cor}</span></div>}
              {venda.dispositivo_capacidade_gb && <div className="recibo-info"><span>Capacidade:</span><span>{venda.dispositivo_capacidade_gb} GB</span></div>}
              {venda.dispositivo_imei && <div className="recibo-info"><span>IMEI:</span><span>{venda.dispositivo_imei}</span></div>}
              {venda.dispositivo_numero_serie && <div className="recibo-info"><span>Nº Série:</span><span>{venda.dispositivo_numero_serie}</span></div>}
              <div className="recibo-info"><span>Condição:</span><span>{venda.dispositivo_condicao === 'novo' ? 'Novo' : venda.dispositivo_condicao === 'semi_novo' ? 'Semi Novo' : 'Usado'}</span></div>
              <div className="recibo-info"><span>Quantidade:</span><span>{venda.quantidade}</span></div>
              {showValor && <div className="recibo-info"><span>Valor Unitário:</span><span>{formatCurrency(valorUnitario)}</span></div>}
              {showFormaPagamento && <div className="recibo-info"><span>Forma de Pagamento:</span><span>{FORMAS_PAGAMENTO_LABEL[venda.forma_pagamento] || venda.forma_pagamento}</span></div>}
            </div>
          )}

          {showChecklist && venda.dispositivo_checklist?.entrada && Object.entries(venda.dispositivo_checklist.entrada).filter(([_, funciona]) => funciona !== undefined).length > 0 && (
            <div className="recibo-section">
              <h3>Estado do Aparelho na Venda</h3>
              <div className="recibo-checklist">
                {Object.entries(venda.dispositivo_checklist.entrada)
                  .filter(([_, funciona]) => funciona !== undefined)
                  .map(([item, funciona]) => (
                    <div key={item} className="recibo-checklist-item">
                      <span className="recibo-checklist-icon">{funciona ? '✅' : '❌'}</span>
                      <span className="recibo-checklist-label">{checklistLabels[item] || item}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {showGarantia && (
            <div className="recibo-section">
              <h3>Termos de Garantia e Direitos do Consumidor</h3>
              <div className="termos-garantia">
                {TERMOS_GARANTIA_CDC(venda.dispositivo_garantia ? venda.dispositivo_tempo_garantia : undefined)}
              </div>
            </div>
          )}

          {showValor && (
            <div className="recibo-total">
              <div>VALOR TOTAL: {formatCurrency(venda.total)}</div>
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

          <div className="recibo-reimpressao">
            2ª via - Reimpressão em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </div>
        </div>

        {/* Garantia oculta para impressão */}
        <div ref={garantiaRef} style={{ display: "none" }}>
          <div className="recibo-header">
            {configLoja?.logo_url && (
              <div style={{ textAlign: 'center', marginBottom: '15px' }}>
                <img src={configLoja.logo_url} alt="Logo da Loja" className="logo-loja" />
              </div>
            )}
            <h1>{configLoja?.nome_loja || 'Loja'}</h1>
            <div className="dados-loja">
              {configLoja?.cnpj && <p>CNPJ: {configLoja.cnpj}</p>}
              {configLoja?.endereco && <p>Endereço: {configLoja.endereco}</p>}
              {configLoja?.telefone && <p>Telefone: {configLoja.telefone}</p>}
              {configLoja?.email && <p>E-mail: {configLoja.email}</p>}
            </div>
            <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '2px solid #000' }}>
              <h2>TERMO DE GARANTIA</h2>
              <p>Data da venda: {dataVenda}</p>
            </div>
          </div>

          <div className="recibo-section">
            <h3>Dados do Comprador</h3>
            <div className="recibo-info"><span>Nome:</span><span>{venda.cliente_nome || "—"}</span></div>
            {venda.cliente_cpf && <div className="recibo-info"><span>CPF:</span><span>{venda.cliente_cpf}</span></div>}
            {venda.cliente_telefone && <div className="recibo-info"><span>Telefone:</span><span>{venda.cliente_telefone}</span></div>}
          </div>

          <div className="recibo-section">
            <h3>Produto</h3>
            <div className="recibo-info"><span>Produto:</span><span>{venda.dispositivo_marca} {venda.dispositivo_modelo}</span></div>
            {venda.dispositivo_imei && <div className="recibo-info"><span>IMEI:</span><span>{venda.dispositivo_imei}</span></div>}
            {venda.dispositivo_numero_serie && <div className="recibo-info"><span>Nº Série:</span><span>{venda.dispositivo_numero_serie}</span></div>}
            <div className="recibo-info"><span>Condição:</span><span>{venda.dispositivo_condicao === 'novo' ? 'Novo' : venda.dispositivo_condicao === 'semi_novo' ? 'Semi Novo' : 'Usado'}</span></div>
            {venda.dispositivo_garantia && venda.dispositivo_tempo_garantia && (
              <div className="recibo-info"><span>Garantia:</span><span>{venda.dispositivo_tempo_garantia} meses</span></div>
            )}
          </div>

          <div className="recibo-section">
            <h3>Termos de Garantia e Direitos do Consumidor</h3>
            <div className="termos-garantia">
              {(() => {
                const termoConfig = configLoja?.termo_garantia_dispositivo_config as any;
                if (termoConfig) {
                  return venda.dispositivo_garantia
                    ? termoConfig.termo_com_garantia
                    : termoConfig.termo_sem_garantia;
                }
                return TERMOS_GARANTIA_CDC(venda.dispositivo_garantia ? venda.dispositivo_tempo_garantia : undefined);
              })()}
            </div>
          </div>

          <div style={{ marginTop: "40px", textAlign: "center" }}>
            <p>_________________________________________</p>
            <p>Assinatura do Vendedor</p>
          </div>
          <div style={{ marginTop: "40px", textAlign: "center" }}>
            <p>_________________________________________</p>
            <p>Assinatura do Comprador</p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button onClick={imprimirRecibo}>
            <Printer className="h-4 w-4 mr-2" />
            {modo === "garantia" ? "Imprimir Garantia" : "Imprimir Recibo"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
