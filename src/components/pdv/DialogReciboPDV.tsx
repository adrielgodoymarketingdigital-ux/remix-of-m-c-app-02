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
import { formatarTermoDispositivo, resolverTextoTermoDispositivo } from "@/lib/termo-garantia-utils";
import {
  TermoGarantiaDispositivoConfig,
  ModeloGarantia,
  MODELOS_PADRAO_GARANTIA,
} from "@/components/dispositivos/DialogConfiguracaoTermoGarantiaDispositivo";

// Normaliza tempo_garantia (sempre em meses) para exibição legível.
function formatarGarantia(meses: number): string {
  if (meses % 12 === 0 && meses >= 12) {
    const anos = meses / 12;
    return anos === 1 ? "1 ano" : `${anos} anos`;
  }
  return `${meses} ${meses === 1 ? "mês" : "meses"}`;
}

const TERMOS_GARANTIA_PADRAO = {
  termo_com_garantia: `TERMO DE GARANTIA

Loja: {{loja}}
CNPJ: {{loja_cnpj}}

COMPRADOR
Nome: {{cliente}}

PRODUTO
Aparelho: {{dispositivo}}
IMEI: {{imei}}
Data da venda: {{data_venda}}
Valor pago: {{valor}}

1. GARANTIA LEGAL (CDC - Lei 8.078/90)
   • Garantia legal de 90 (noventa) dias, conforme Art. 26, II do CDC.
   • Cobre defeitos de fabricação ou vícios que comprometam o funcionamento.

2. GARANTIA CONTRATUAL ({{garantia_meses}} meses)
   • Garantia de {{garantia_meses}} meses a partir da data desta venda, já incluindo o prazo mínimo de garantia legal previsto no CDC (Art. 26, II).
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

PRODUTO
Aparelho: {{dispositivo}}
IMEI: {{imei}}
Data da venda: {{data_venda}}
Valor pago: {{valor}}

AVISO: Este produto é vendido sem garantia contratual adicional.
A garantia legal de 90 dias prevista no CDC (Art. 26, II) se aplica conforme a legislação.
O cliente declara estar ciente das condições do equipamento.`,
};

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
  empresaId?: string | null;
  pagamentoDuplo?: {
    valorPrimeira: number;
    segundaForma: string;
    valorSegunda: number;
  };
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
  const { config: configLoja } = useConfiguracaoLoja(dados?.empresaId);
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
  // config80mm contém as preferências de seções visíveis (vale para qualquer formato)
  const config80mm = pdvConfig?.config_80mm || {};
  const formatoPapel = pdvConfig?.formato_papel || 'a4';
  const isThermal = formatoPapel !== 'a4';
  // Flags de visibilidade são sempre lidas de config80mm (únicas flags de seção salvas)
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
      // getThermalPrintCSS gera @page + body com largura correta para térmica;
      // para A4 retorna string vazia e o @page abaixo fica como A4.
      const cssTermico = getThermalPrintCSS(paper);

      janelaImpressao.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Recibo de Venda - PDV</title>
  <style>
    /* --- Reset e base --- */
    * { box-sizing: border-box; margin: 0; padding: 0; }
    /* @page padrão A4 — sobrescrito pelo cssTermico quando for térmica */
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
    /* --- Cabeçalho --- */
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
    /* --- Seções --- */
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
    .recibo-info {
      display: flex;
      justify-content: space-between;
      font-size: ${isThermal ? '9px' : '12px'};
      margin: 4px 0;
    }
    /* --- Itens --- */
    .item-venda {
      padding: ${isThermal ? '4px 0' : '7px 0'};
      border-bottom: 1px dashed #ddd;
    }
    .item-venda:last-child { border-bottom: none; }
    .item-nome { font-weight: 600; font-size: ${isThermal ? '10px' : '13px'}; }
    .item-detalhes {
      display: flex;
      justify-content: space-between;
      color: #555;
      font-size: ${isThermal ? '9px' : '11px'};
      margin-top: 2px;
    }
    /* --- Resumo --- */
    .resumo-section {
      margin-top: ${isThermal ? '8px' : '16px'};
      padding-top: ${isThermal ? '6px' : '12px'};
      border-top: ${isThermal ? '1px dashed #000' : '2px solid #000'};
    }
    .resumo-linha {
      display: flex;
      justify-content: space-between;
      font-size: ${isThermal ? '10px' : '13px'};
      margin: 5px 0;
    }
    .resumo-linha.desconto { color: #c00; }
    .resumo-linha.total {
      font-size: ${isThermal ? '14px' : '20px'};
      font-weight: 900;
      margin-top: ${isThermal ? '8px' : '14px'};
      padding-top: ${isThermal ? '6px' : '10px'};
      border-top: ${isThermal ? '1px dashed #000' : '1.5px solid #000'};
    }
    /* --- Assinaturas --- */
    .assinatura-section {
      margin-top: ${isThermal ? '16px' : '36px'};
      text-align: center;
      font-size: ${isThermal ? '9px' : '12px'};
    }
    /* --- Impressão --- */
    @media print {
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      body { margin: 0 !important; padding: ${isThermal ? '0' : '0'} !important; }
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

  if (!dados) return null;

  const dataFormatada = format(new Date(dados.data), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  const temDesconto = dados.descontoManual > 0 || dados.descontoCupom > 0;

  const termoConfig = configLoja?.termo_garantia_dispositivo_config as TermoGarantiaDispositivoConfig | undefined;
  const modelosSalvos: ModeloGarantia[] = termoConfig?.modelos?.length ? termoConfig.modelos : MODELOS_PADRAO_GARANTIA;
  const itensDispositivo = dados.itens.filter((item) => item.tipo === "dispositivo");

  const gerarTextoTermo = (item: ItemVenda): string => {
    const temGarantia = !!item.tempo_garantia && item.tempo_garantia > 0;
    const modeloEscolhido = item.modelo_termo_garantia_id
      ? modelosSalvos.find((m) => m.id === item.modelo_termo_garantia_id)
      : null;

    let textoBase: string;
    if (modeloEscolhido) {
      const secoes = temGarantia ? modeloEscolhido.secoes_com_garantia : modeloEscolhido.secoes_sem_garantia;
      textoBase = secoes.filter((s) => s.visivel).map((s) => s.conteudo.trim()).join("\n\n");
    } else {
      textoBase = resolverTextoTermoDispositivo(
        termoConfig,
        temGarantia,
        TERMOS_GARANTIA_PADRAO.termo_com_garantia,
        TERMOS_GARANTIA_PADRAO.termo_sem_garantia
      );
    }

    return formatarTermoDispositivo(textoBase, {
      cliente: dados.cliente?.nome,
      cpf: dados.cliente?.cpf,
      telefone: dados.cliente?.telefone,
      dispositivo: item.nome,
      imei: item.imei_dispositivo || (item as any).imei || undefined,
      garantia_meses: temGarantia ? formatarGarantia(item.tempo_garantia!) : undefined,
      valor: formatCurrency(item.preco * item.quantidade),
      data_venda: dataFormatada,
      loja: configLoja?.nome_loja,
      loja_telefone: configLoja?.telefone,
      loja_cnpj: configLoja?.cnpj,
      loja_endereco: configLoja?.endereco,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl sm:max-h-[90vh] overflow-y-auto">
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
                <p>Data: {dataFormatada}</p>
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

              {showFormaPagamento && dados.pagamentoDuplo ? (
                <>
                  <div className="resumo-linha" style={{ display: 'flex', justifyContent: 'space-between', margin: '8px 0' }}>
                    <span>1ª forma:</span>
                    <span>
                      {formatCurrency(dados.pagamentoDuplo.valorPrimeira)}{" "}
                      em {labelFormaPagamento[dados.formaPagamento] || dados.formaPagamento}
                    </span>
                  </div>
                  <div className="resumo-linha" style={{ display: 'flex', justifyContent: 'space-between', margin: '8px 0' }}>
                    <span>2ª forma:</span>
                    <span>
                      {formatCurrency(dados.pagamentoDuplo.valorSegunda)}{" "}
                      em {labelFormaPagamento[dados.pagamentoDuplo.segundaForma] || dados.pagamentoDuplo.segundaForma}
                    </span>
                  </div>
                </>
              ) : showFormaPagamento && (
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

              {showFormaPagamento && !dados.pagamentoDuplo && dados.formaPagamento === "credito_parcelado" && dados.numeroParcelas && (
                <div className="resumo-linha" style={{ display: 'flex', justifyContent: 'space-between', margin: '8px 0' }}>
                  <span>Valor por Parcela:</span>
                  <span>{formatCurrency(dados.total / dados.numeroParcelas)}</span>
                </div>
              )}
            </div>

            {itensDispositivo.map((item) => (
              <div key={item.id} className="recibo-section" style={{ marginTop: '20px', pageBreakInside: 'avoid' }}>
                <h3 style={{ borderBottom: '1px solid #ccc', paddingBottom: '5px', marginBottom: '10px' }}>
                  Termo de Garantia — {item.nome}
                </h3>
                <div style={{ fontSize: isThermal ? '9px' : '11px', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                  {gerarTextoTermo(item)}
                </div>
              </div>
            ))}

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
