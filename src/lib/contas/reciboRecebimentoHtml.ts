import { formatCurrency, formatDate } from "@/lib/formatters";
import { resolvePaperSize, getThermalPrintCSS } from "@/lib/paper-size-utils";
import type { FormatoPapel } from "@/components/recibo/SeletorFormatoPapelDialog";

interface DadosLojaRecibo {
  nome_loja?: string | null;
  cnpj?: string | null;
  endereco?: string | null;
  telefone?: string | null;
  logo_url?: string | null;
}

export interface DadosReciboRecebimento {
  loja: DadosLojaRecibo;
  clienteNome?: string | null;
  /** conta.nome — descrição do que está sendo recebido */
  referencia: string;
  osNumero?: string | null;
  /** identificação curta do recibo (8 primeiros chars do pagamento.id) */
  numeroRecibo: string;
  valorPagamento: number;
  formaPagamento?: string | null;
  /** ISO date (YYYY-MM-DD) do recebimento */
  dataPagamento: string;
  valorTotalConta: number;
  /** soma de todos os recebimentos não estornados, incluindo este */
  totalPago: number;
  saldoRestante: number;
  formato: FormatoPapel;
}

const esc = (s: unknown): string =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

const FORMAS_LABEL: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  debito: "Débito",
  credito: "Crédito",
  credito_parcelado: "Crédito Parcelado",
};
const formaLabel = (f?: string | null) => (f ? FORMAS_LABEL[f] || f : "—");

/**
 * Recibo de recebimento de conta (parcial ou integral). Mesmo padrão de
 * impressão dos recibos de venda: HTML autossuficiente para window.open + print,
 * com CSS térmico (58/80mm) ou A4 conforme o formato escolhido.
 */
export function gerarReciboRecebimentoHtml(d: DadosReciboRecebimento): string {
  const isThermal = d.formato !== "a4";
  const paper = resolvePaperSize(d.formato);
  const cssTermico = getThermalPrintCSS(paper);
  const quitou = d.saldoRestante <= 0.005;

  const linhaLoja = [d.loja.cnpj ? `CNPJ: ${esc(d.loja.cnpj)}` : "", esc(d.loja.endereco), d.loja.telefone ? `Tel: ${esc(d.loja.telefone)}` : ""]
    .filter(Boolean)
    .join(" · ");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Recibo de Recebimento ${esc(d.numeroRecibo)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: A4 portrait; margin: 12mm; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #000; background: #fff;
      font-size: ${isThermal ? "12px" : "13px"};
      font-weight: ${isThermal ? "600" : "400"};
      line-height: 1.45;
      padding: ${isThermal ? "2mm" : "0"};
      max-width: ${isThermal ? "none" : "620px"};
      margin: 0 auto;
    }
    .cab { text-align: center; border-bottom: 1.5px dashed #000; padding-bottom: 6px; margin-bottom: 8px; }
    .cab img { max-width: ${isThermal ? "34mm" : "42mm"}; max-height: 20mm; margin: 0 auto 4px; display: block; }
    .cab .nome { font-weight: 900; font-size: ${isThermal ? "13px" : "16px"}; }
    .cab .sub { font-size: ${isThermal ? "10px" : "11px"}; }
    .titulo { text-align: center; font-weight: 900; letter-spacing: 0.5px; margin: 8px 0 2px; font-size: ${isThermal ? "13px" : "15px"}; }
    .num { text-align: center; font-size: ${isThermal ? "10px" : "11px"}; color: #333; margin-bottom: 8px; }
    .linha { display: flex; justify-content: space-between; gap: 8px; padding: 2px 0; }
    .linha .lbl { color: #333; }
    .linha .val { font-weight: 700; text-align: right; }
    .bloco { border-top: 1.5px dashed #000; margin-top: 8px; padding-top: 6px; }
    .destaque { font-size: ${isThermal ? "14px" : "17px"}; font-weight: 900; text-align: center; padding: 6px 0; border-top: 2px dashed #000; border-bottom: 2px dashed #000; margin: 8px 0; }
    .status { text-align: center; font-weight: 700; margin-top: 6px; }
    .assinatura { margin-top: ${isThermal ? "14mm" : "22mm"}; text-align: center; }
    .assinatura .rasp { border-top: 1px solid #000; width: 70%; margin: 0 auto 3px; }
    .assinatura .cap { font-size: ${isThermal ? "10px" : "11px"}; }
    ${cssTermico}
  </style>
</head>
<body>
  <div class="cab">
    ${d.loja.logo_url ? `<img src="${esc(d.loja.logo_url)}" alt="logo" crossorigin="anonymous" onerror="this.style.display='none'">` : ""}
    <div class="nome">${esc(d.loja.nome_loja || "")}</div>
    ${linhaLoja ? `<div class="sub">${linhaLoja}</div>` : ""}
  </div>

  <div class="titulo">RECIBO DE RECEBIMENTO</div>
  <div class="num">Nº ${esc(d.numeroRecibo)} &nbsp;·&nbsp; ${formatDate(d.dataPagamento)}</div>

  <div class="linha"><span class="lbl">Recebemos de:</span><span class="val">${esc(d.clienteNome || "—")}</span></div>
  <div class="linha"><span class="lbl">Referente a:</span><span class="val">${esc(d.referencia)}${d.osNumero ? ` (${esc(d.osNumero)})` : ""}</span></div>

  <div class="destaque">Valor recebido: ${formatCurrency(d.valorPagamento)}</div>
  <div class="linha"><span class="lbl">Forma de pagamento:</span><span class="val">${esc(formaLabel(d.formaPagamento))}</span></div>

  <div class="bloco">
    <div class="linha"><span class="lbl">Valor total da conta:</span><span class="val">${formatCurrency(d.valorTotalConta)}</span></div>
    <div class="linha"><span class="lbl">Total já recebido:</span><span class="val">${formatCurrency(d.totalPago)}</span></div>
    <div class="linha"><span class="lbl">Saldo restante:</span><span class="val">${formatCurrency(d.saldoRestante)}</span></div>
  </div>

  <div class="status">${quitou ? "Este recibo quita INTEGRALMENTE a conta acima." : "Este recibo quita PARCIALMENTE a conta acima."}</div>

  <div class="assinatura">
    <div class="rasp"></div>
    <div class="cap">${esc(d.loja.nome_loja || "")} — Recebido por</div>
  </div>

  <script>
    window.onload = function () {
      setTimeout(function () { window.focus(); window.print(); }, 250);
      window.onafterprint = function () { setTimeout(function () { window.close(); }, 200); };
    };
  </script>
</body>
</html>`;
}
