import { useRef, useEffect } from "react";
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
import { formatarTermoDispositivo, resolverTextoTermoDispositivo } from "@/lib/termo-garantia-utils";

function formatarGarantia(meses: number): string {
  const m = meses >= 360 ? Math.round(meses / 30) : meses;
  if (m % 12 === 0 && m >= 12) {
    const anos = m / 12;
    return anos === 1 ? "1 ano" : `${anos} anos`;
  }
  return `${m} ${m === 1 ? "mês" : "meses"}`;
}

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
  empresa_id?: string | null;
}

const FORMAS_PAGAMENTO_LABEL: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  debito: "Débito",
  credito: "Crédito",
  credito_parcelado: "Crédito Parcelado",
  a_prazo: "A Prazo",
};

const CONDICAO_LABEL: Record<string, string> = {
  novo: "Novo",
  semi_novo: "Semi Novo",
  usado: "Usado",
};

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
  const { config: configLoja, refetch } = useConfiguracaoLoja(venda?.empresa_id);

  useEffect(() => {
    if (open) refetch();
  }, [open]);

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
  const dataVendaCurta = format(new Date(venda.data), "dd/MM/yyyy", { locale: ptBR });
  const valorUnitario = venda.quantidade > 0 ? venda.total / venda.quantidade : venda.total;

  // Variáveis dinâmicas para substituição no termo
  const varsTermos = {
    cliente: venda.cliente_nome,
    cpf: venda.cliente_cpf,
    telefone: venda.cliente_telefone,
    dispositivo: [venda.dispositivo_marca, venda.dispositivo_modelo].filter(Boolean).join(' '),
    imei: venda.dispositivo_imei,
    numero_serie: venda.dispositivo_numero_serie,
    cor: venda.dispositivo_cor,
    capacidade: venda.dispositivo_capacidade_gb ? `${venda.dispositivo_capacidade_gb} GB` : undefined,
    condicao: CONDICAO_LABEL[venda.dispositivo_condicao || ''] || venda.dispositivo_condicao,
    garantia_meses: venda.dispositivo_tempo_garantia != null ? formatarGarantia(venda.dispositivo_tempo_garantia) : undefined,
    valor: formatCurrency(venda.total),
    data_venda: dataVendaCurta,
    loja: configLoja?.nome_loja,
    loja_telefone: configLoja?.telefone,
    loja_cnpj: configLoja?.cnpj,
    loja_endereco: configLoja?.endereco,
  };

  const obterTextoTermo = (): string => {
    const termoConfig = configLoja?.termo_garantia_dispositivo_config as any;
    const temGarantia = (venda.dispositivo_tempo_garantia != null && venda.dispositivo_tempo_garantia > 0) || !!venda.dispositivo_garantia;
    const textoBase = resolverTextoTermoDispositivo(
      termoConfig,
      temGarantia,
      TERMOS_GARANTIA_PADRAO.termo_com_garantia,
      TERMOS_GARANTIA_PADRAO.termo_sem_garantia
    );
    return formatarTermoDispositivo(textoBase, varsTermos);
  };

  const imprimirRecibo = () => {
    const janelaImpressao = window.open("", "_blank");
    if (!janelaImpressao) return;

    const textoTermoAtual = obterTextoTermo();

    const cabecalho = `
      <div class="recibo-header">
        <div class="recibo-header-left">
          ${configLoja?.logo_url ? `<img src="${configLoja.logo_url}" class="logo-loja" />` : ''}
          <div>
            <h1>${configLoja?.nome_loja || ''}</h1>
            <div class="dados-loja">
              ${configLoja?.cnpj ? `CNPJ: ${configLoja.cnpj}<br>` : ''}
              ${configLoja?.telefone ? `Tel: ${configLoja.telefone}` : ''}
            </div>
          </div>
        </div>
        <div class="recibo-header-right">
          <h2>${modo === 'garantia' ? 'TERMO DE GARANTIA' : 'RECIBO DE VENDA'}</h2>
          <p>Data da venda: ${dataVenda}</p>
        </div>
      </div>`;

    const secaoComprador = `
      <div class="recibo-section">
        <h3>Comprador</h3>
        <div class="grid-2">
          <div class="recibo-info"><span>Nome:</span><span>${venda.cliente_nome || '—'}</span></div>
          ${venda.cliente_cpf ? `<div class="recibo-info"><span>CPF:</span><span>${venda.cliente_cpf}</span></div>` : ''}
          ${venda.cliente_telefone ? `<div class="recibo-info"><span>Telefone:</span><span>${venda.cliente_telefone}</span></div>` : ''}
        </div>
      </div>`;

    const secaoProduto = `
      <div class="recibo-section">
        <h3>Produto</h3>
        <div class="grid-2">
          <div class="recibo-info"><span>Aparelho:</span><span>${venda.dispositivo_marca} ${venda.dispositivo_modelo}</span></div>
          ${venda.dispositivo_imei ? `<div class="recibo-info"><span>IMEI:</span><span>${venda.dispositivo_imei}</span></div>` : ''}
          ${venda.dispositivo_numero_serie ? `<div class="recibo-info"><span>Nº Série:</span><span>${venda.dispositivo_numero_serie}</span></div>` : ''}
          ${venda.dispositivo_cor ? `<div class="recibo-info"><span>Cor:</span><span>${venda.dispositivo_cor}</span></div>` : ''}
          ${venda.dispositivo_capacidade_gb ? `<div class="recibo-info"><span>Capacidade:</span><span>${venda.dispositivo_capacidade_gb} GB</span></div>` : ''}
          ${venda.dispositivo_condicao ? `<div class="recibo-info"><span>Condição:</span><span>${CONDICAO_LABEL[venda.dispositivo_condicao] || venda.dispositivo_condicao}</span></div>` : ''}
          <div class="recibo-info"><span>Valor:</span><span>${formatCurrency(venda.total)}</span></div>
          ${venda.dispositivo_tempo_garantia ? `<div class="recibo-info"><span>Garantia:</span><span>${formatarGarantia(venda.dispositivo_tempo_garantia)}</span></div>` : ''}
        </div>
      </div>`;

    const secaoTermo = `
      <div class="recibo-section">
        <h3>Termo de Garantia</h3>
        <div class="termos-garantia">${textoTermoAtual.replace(/\n/g, '<br>')}</div>
      </div>`;

    const secaoAssinaturas = `
      <div class="assinaturas-container">
        <div class="assinatura-bloco">
          <div class="assinatura-linha"></div>
          <p class="assinatura-label">Assinatura do Vendedor</p>
        </div>
        <div class="assinatura-bloco">
          <div class="assinatura-linha"></div>
          <p class="assinatura-label">Assinatura do Comprador — ${venda.cliente_nome || ''}</p>
        </div>
      </div>`;

    const conteudo = modo === 'garantia'
      ? `${cabecalho}${secaoComprador}${secaoProduto}${secaoTermo}${secaoAssinaturas}`
      : `${cabecalho}${secaoComprador}${secaoProduto}${secaoTermo}<div class="recibo-total">VALOR TOTAL: ${formatCurrency(venda.total)}</div>${secaoAssinaturas}`;

    janelaImpressao.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${modo === 'garantia' ? 'Termo de Garantia' : 'Recibo de Venda'} - ${venda.dispositivo_marca} ${venda.dispositivo_modelo}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: A4 portrait; margin: 8mm 10mm; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #111; background: white; line-height: 1.4; }
    .recibo-header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #111; padding-bottom: 6px; margin-bottom: 8px; }
    .recibo-header-left { display: flex; align-items: center; gap: 8px; }
    .logo-loja { max-width: 48px; max-height: 48px; object-fit: contain; }
    .recibo-header h1 { font-size: 13px; font-weight: 900; margin: 0; }
    .dados-loja { font-size: 8px; color: #444; margin-top: 2px; line-height: 1.4; }
    .recibo-header-right { text-align: right; }
    .recibo-header h2 { font-size: 11px; font-weight: 800; margin: 0; }
    .recibo-header p { font-size: 8px; color: #555; margin-top: 1px; }
    .recibo-section { margin-bottom: 6px; }
    .recibo-section h3 { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #555; border-bottom: 1px solid #ddd; padding-bottom: 2px; margin-bottom: 4px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 16px; }
    .recibo-info { display: flex; gap: 4px; font-size: 9px; margin: 1px 0; }
    .recibo-info span:first-child { color: #666; min-width: 80px; }
    .recibo-info span:last-child { font-weight: 600; }
    .termos-garantia { font-size: 8px; line-height: 1.55; color: #222; }
    .recibo-total { font-size: 13px; font-weight: 900; text-align: right; margin-top: 6px; padding-top: 6px; border-top: 2px solid #111; }
    .assinaturas-container { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 12px; page-break-inside: avoid; }
    .assinatura-bloco { text-align: center; }
    .assinatura-linha { border-bottom: 1px solid #333; height: 24px; margin-bottom: 3px; }
    .assinatura-label { font-size: 8px; color: #555; }
    @media print { body { margin: 0 !important; } .assinaturas-container { page-break-inside: avoid; break-inside: avoid; } }
  </style>
</head>
<body>
  ${conteudo}
  <script>
    (function() {
      var printed = false;
      function doPrint() { if (printed) return; printed = true; window.print(); window.onafterprint = function() { window.close(); }; }
      var images = document.querySelectorAll('img');
      if (images.length === 0) { setTimeout(doPrint, 300); }
      else {
        Promise.all(Array.from(images).map(function(img) {
          if (img.complete) return Promise.resolve();
          return new Promise(function(r) { img.onload = r; img.onerror = function() { img.style.display='none'; r(); }; });
        })).then(function() { setTimeout(doPrint, 300); });
      }
      setTimeout(doPrint, 3000);
    })();
  </script>
</body>
</html>`);
    janelaImpressao.document.close();
  };

  const textoTermo = obterTextoTermo();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl sm:max-h-[90vh] overflow-y-auto">
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
              <span className="text-muted-foreground">Garantia:</span>
              <p className="font-medium">
                {venda.dispositivo_garantia
                  ? (venda.dispositivo_tempo_garantia != null ? formatarGarantia(venda.dispositivo_tempo_garantia) : '—')
                  : 'Sem garantia contratual'}
              </p>
            </div>
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
