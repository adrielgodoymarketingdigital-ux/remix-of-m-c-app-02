import jsPDF from "jspdf";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { toBrasilia } from "@/lib/dataBrasilia";
import type { AvariasOS, ServicoRealizado, ProdutoUtilizado } from "@/types/ordem-servico";
import type { RecebimentoOS } from "@/lib/ordemServico/calcularRecebimentoOS";
import { adicionarImagemContida } from "@/lib/assinaturaLoja";

export type FormatoReciboOS = "a4" | "80mm";

export interface DadosReciboOS {
  loja: {
    nome_loja?: string | null;
    cnpj?: string | null;
    telefone?: string | null;
    endereco?: string | null;
  };
  numeroOS: string;
  clienteNome?: string | null;
  dispositivo?: string | null;
  /** Serviços realizados (e produtos/peças, com quantidade) — só descrição, sem valores. */
  itens: string[];
  /** dd/MM/yyyy HH:mm, horário de Brasília */
  emitidoEm: string;
  /** dd/MM/yyyy — só quando a OS está entregue */
  dataConclusao?: string | null;
  recebido: number;
  aReceber: number;
  /** YYYY-MM-DD ou null (sem prazo) */
  vencimentoSaldo: string | null;
  /** Data URI da assinatura da loja — só quando ativada (ver assinaturaLojaAtiva). */
  assinaturaLoja?: string | null;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Data/hora de parede de Brasília (toBrasilia devolve os campos em UTC). */
const formatarBrasilia = (instante: Date, comHora: boolean): string => {
  const b = toBrasilia(instante);
  const data = `${pad(b.getUTCDate())}/${pad(b.getUTCMonth() + 1)}/${b.getUTCFullYear()}`;
  return comHora ? `${data} ${pad(b.getUTCHours())}:${pad(b.getUTCMinutes())}` : data;
};

interface OrdemReciboLike {
  numero_os: string;
  status: string | null;
  data_saida: string | null;
  dispositivo_marca?: string | null;
  dispositivo_modelo?: string | null;
  avarias?: unknown;
  cliente?: { nome: string } | null;
}

export function montarDadosReciboOS(
  ordem: OrdemReciboLike,
  recebimento: RecebimentoOS,
  loja: DadosReciboOS["loja"],
  assinaturaLoja: string | null = null,
): DadosReciboOS {
  const avarias = (ordem.avarias ?? null) as (AvariasOS & { servicos_inline?: { nome: string }[] }) | null;

  // Mesmo fallback da impressão da OS: servicos_realizados (novo) ou servicos_inline (onboarding)
  const servicos: ServicoRealizado[] = avarias?.servicos_realizados ?? [];
  const nomesServicos = servicos.length > 0
    ? servicos.map((s) => s.nome)
    : (avarias?.servicos_inline ?? []).map((s) => s.nome);
  const produtos: ProdutoUtilizado[] = avarias?.produtos_utilizados ?? [];
  const nomesProdutos = produtos.map((p) => (p.quantidade > 1 ? `${p.quantidade}x ${p.nome}` : p.nome));

  return {
    loja,
    numeroOS: ordem.numero_os,
    clienteNome: ordem.cliente?.nome,
    dispositivo: [ordem.dispositivo_marca, ordem.dispositivo_modelo].filter(Boolean).join(" ") || null,
    itens: [...nomesServicos, ...nomesProdutos].filter(Boolean),
    emitidoEm: formatarBrasilia(new Date(), true),
    dataConclusao: ordem.status === "entregue" && ordem.data_saida
      ? formatarBrasilia(new Date(ordem.data_saida), false)
      : null,
    recebido: recebimento.recebido,
    aReceber: recebimento.aReceber,
    vencimentoSaldo: recebimento.vencimentoSaldo,
    assinaturaLoja,
  };
}

const textoVencimento = (d: DadosReciboOS) =>
  d.vencimentoSaldo ? formatDate(d.vencimentoSaldo) : "Sem prazo definido";

const esc = (s: unknown): string =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

// ─────────────────────────── HTML (impressão) ───────────────────────────

/**
 * CSS do recibo. Todo seletor é prefixado com recibo-os- porque o caminho iOS
 * (printViaPrintRoot) injeta esse <style> direto na página viva.
 */
export function montarCssReciboOS(formato: FormatoReciboOS): string {
  const termico = formato === "80mm";
  return `
    @page { size: ${termico ? "80mm auto" : "A4 portrait"}; margin: ${termico ? "2mm" : "12mm"}; }
    .recibo-os { box-sizing: border-box; font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff;
      font-size: ${termico ? "12px" : "13px"}; font-weight: ${termico ? "600" : "400"}; line-height: 1.45;
      width: ${termico ? "76mm" : "auto"}; max-width: ${termico ? "76mm" : "620px"}; margin: 0 auto; padding: ${termico ? "2mm" : "0"}; }
    .recibo-os * { box-sizing: border-box; margin: 0; padding: 0; }
    .recibo-os-cab { text-align: center; border-bottom: 1.5px dashed #000; padding-bottom: 6px; margin-bottom: 8px; }
    .recibo-os-cab img { max-width: ${termico ? "34mm" : "42mm"}; max-height: 20mm; margin: 0 auto 4px; display: block; }
    .recibo-os-nome { font-weight: 900; font-size: ${termico ? "13px" : "16px"}; }
    .recibo-os-sub { font-size: ${termico ? "10px" : "11px"}; }
    .recibo-os-titulo { text-align: center; font-weight: 900; letter-spacing: 0.5px; margin: 8px 0 2px; font-size: ${termico ? "13px" : "15px"}; }
    .recibo-os-num { text-align: center; font-size: ${termico ? "11px" : "12px"}; margin-bottom: 8px; }
    .recibo-os-linha { display: flex; justify-content: space-between; gap: 8px; padding: 2px 0; }
    .recibo-os-lbl { color: #333; }
    .recibo-os-val { font-weight: 700; text-align: right; }
    .recibo-os-bloco { border-top: 1.5px dashed #000; margin-top: 8px; padding-top: 6px; }
    .recibo-os-bloco-titulo { font-weight: 900; margin-bottom: 3px; }
    .recibo-os-itens { padding-left: 14px !important; }
    .recibo-os-itens li { padding: 1px 0; }
    .recibo-os-destaque { font-size: ${termico ? "14px" : "17px"}; font-weight: 900; text-align: center; padding: 6px 0;
      border-top: 2px dashed #000; border-bottom: 2px dashed #000; margin: 8px 0; }
    .recibo-os-assinatura { margin-top: ${termico ? "14mm" : "22mm"}; text-align: center; }
    .recibo-os-assinatura-img { display: block; max-width: ${termico ? "45mm" : "60mm"}; max-height: ${termico ? "16mm" : "20mm"}; margin: 0 auto 1mm !important; }
    .recibo-os-rasp { border-top: 1px solid #000; width: 70%; margin: 0 auto 3px !important; }
    .recibo-os-cap { font-size: ${termico ? "10px" : "11px"}; }
  `;
}

export function montarBodyReciboOS(d: DadosReciboOS, logoSrc: string | null): string {
  const linhaLoja = [
    d.loja.cnpj ? `CNPJ: ${esc(d.loja.cnpj)}` : "",
    esc(d.loja.endereco),
    d.loja.telefone ? `Tel: ${esc(d.loja.telefone)}` : "",
  ].filter(Boolean).join(" · ");

  const itens = d.itens.length > 0
    ? `<ul class="recibo-os-itens">${d.itens.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`
    : `<div>—</div>`;

  const aReceber = d.aReceber > 0 ? `
  <div class="recibo-os-bloco">
    <div class="recibo-os-bloco-titulo">A RECEBER</div>
    <div class="recibo-os-linha"><span class="recibo-os-lbl">Valor:</span><span class="recibo-os-val">${formatCurrency(d.aReceber)}</span></div>
    <div class="recibo-os-linha"><span class="recibo-os-lbl">Vencimento:</span><span class="recibo-os-val">${esc(textoVencimento(d))}</span></div>
  </div>` : "";

  return `
<div class="recibo-os">
  <div class="recibo-os-cab">
    ${logoSrc ? `<img src="${esc(logoSrc)}" alt="logo" onerror="this.style.display='none'">` : ""}
    <div class="recibo-os-nome">${esc(d.loja.nome_loja || "")}</div>
    ${linhaLoja ? `<div class="recibo-os-sub">${linhaLoja}</div>` : ""}
  </div>

  <div class="recibo-os-titulo">RECIBO</div>
  <div class="recibo-os-num">Ordem de Serviço Nº ${esc(d.numeroOS)}</div>

  <div class="recibo-os-linha"><span class="recibo-os-lbl">Cliente:</span><span class="recibo-os-val">${esc(d.clienteNome || "—")}</span></div>
  ${d.dispositivo ? `<div class="recibo-os-linha"><span class="recibo-os-lbl">Aparelho:</span><span class="recibo-os-val">${esc(d.dispositivo)}</span></div>` : ""}
  <div class="recibo-os-linha"><span class="recibo-os-lbl">Emitido em:</span><span class="recibo-os-val">${esc(d.emitidoEm)}</span></div>
  ${d.dataConclusao ? `<div class="recibo-os-linha"><span class="recibo-os-lbl">Serviço concluído em:</span><span class="recibo-os-val">${esc(d.dataConclusao)}</span></div>` : ""}

  <div class="recibo-os-bloco">
    <div class="recibo-os-bloco-titulo">SERVIÇO(S) REALIZADO(S)</div>
    ${itens}
  </div>

  <div class="recibo-os-destaque">Valor recebido: ${formatCurrency(d.recebido)}</div>
  ${aReceber}

  <div class="recibo-os-assinatura"${d.assinaturaLoja ? ' style="margin-top: 6mm"' : ""}>
    ${d.assinaturaLoja ? `<img class="recibo-os-assinatura-img" src="${esc(d.assinaturaLoja)}" alt="Assinatura da Loja">` : ""}
    <div class="recibo-os-rasp"></div>
    <div class="recibo-os-cap">${esc(d.loja.nome_loja || "")}</div>
  </div>
</div>`;
}

/** Documento isolado (desktop via window.open / Android via iframe), com auto-print. */
export function montarDocumentoReciboOS(d: DadosReciboOS, formato: FormatoReciboOS, logoSrc: string | null): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Recibo OS ${esc(d.numeroOS)}</title>
  <style>body { margin: 0; background: #fff; } ${montarCssReciboOS(formato)}</style>
</head>
<body>
${montarBodyReciboOS(d, logoSrc)}
  <script>
    window.onload = function () {
      setTimeout(function () {
        window.focus();
        window.__printed = true;
        try { window.print(); } catch (e) { /* reforço do printViaIframe cobre o Android */ }
        window.onafterprint = function () { window.close(); };
      }, 500);
    };
  </script>
</body>
</html>`;
}

// ─────────────────────────── PDF (WhatsApp) ───────────────────────────

const LARGURA_PDF: Record<FormatoReciboOS, number> = { a4: 210, "80mm": 80 };

/** Desenha o recibo e devolve o Y final — usado também pra medir a altura do térmico. */
function desenharReciboPDF(doc: jsPDF, d: DadosReciboOS, logoBase64: string | null, termico: boolean): number {
  const margin = termico ? 3 : 15;
  const largura = doc.internal.pageSize.getWidth();
  const util = largura - margin * 2;
  const centro = largura / 2;
  const fs = (a4: number, t: number) => (termico ? t : a4);
  const passo = termico ? 4 : 6;
  let y = margin;

  const tracejado = () => {
    doc.setLineDashPattern([1, 1], 0);
    doc.setLineWidth(0.3);
    doc.line(margin, y, largura - margin, y);
    doc.setLineDashPattern([], 0);
    y += passo * 0.8;
  };

  const centralizado = (texto: string, tamanho: number, negrito = false) => {
    doc.setFont("helvetica", negrito ? "bold" : "normal");
    doc.setFontSize(tamanho);
    const linhas = doc.splitTextToSize(texto, util) as string[];
    linhas.forEach((l) => {
      doc.text(l, centro, y, { align: "center" });
      y += tamanho * 0.45;
    });
  };

  const linha = (rotulo: string, valor: string) => {
    doc.setFontSize(fs(10, 8));
    doc.setFont("helvetica", "normal");
    doc.text(rotulo, margin, y);
    doc.setFont("helvetica", "bold");
    const larguraRotulo = doc.getTextWidth(rotulo) + 2;
    const linhasValor = doc.splitTextToSize(valor, util - larguraRotulo) as string[];
    linhasValor.forEach((l, i) => {
      doc.text(l, largura - margin, y + i * passo * 0.8, { align: "right" });
    });
    y += passo + (linhasValor.length - 1) * passo * 0.8;
  };

  // Cabeçalho
  if (logoBase64) {
    try {
      const props = doc.getImageProperties(logoBase64);
      const maxL = termico ? 30 : 40;
      const maxA = termico ? 14 : 20;
      let l = maxL;
      let a = (l * props.height) / props.width;
      if (a > maxA) { a = maxA; l = (a * props.width) / props.height; }
      doc.addImage(logoBase64, centro - l / 2, y, l, a);
      y += a + passo * 0.6;
    } catch {
      /* logo inválido — segue sem */
    }
  }
  y += fs(4, 3);
  centralizado(d.loja.nome_loja || "", fs(14, 11), true);
  const infoLoja = [d.loja.cnpj ? `CNPJ: ${d.loja.cnpj}` : "", d.loja.endereco || "", d.loja.telefone ? `Tel: ${d.loja.telefone}` : ""]
    .filter(Boolean);
  if (infoLoja.length > 0) centralizado(infoLoja.join(" · "), fs(9, 7));
  y += passo * 0.3;
  tracejado();

  y += passo * 0.4;
  centralizado("RECIBO", fs(15, 12), true);
  centralizado(`Ordem de Serviço Nº ${d.numeroOS}`, fs(10, 8));
  y += passo * 0.5;

  linha("Cliente:", d.clienteNome || "—");
  if (d.dispositivo) linha("Aparelho:", d.dispositivo);
  linha("Emitido em:", d.emitidoEm);
  if (d.dataConclusao) linha("Serviço concluído em:", d.dataConclusao);

  // Serviços
  tracejado();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(fs(10, 8));
  doc.text("SERVIÇO(S) REALIZADO(S)", margin, y);
  y += passo;
  doc.setFont("helvetica", "normal");
  const itens = d.itens.length > 0 ? d.itens : ["—"];
  itens.forEach((item) => {
    const linhas = doc.splitTextToSize(`• ${item}`, util) as string[];
    linhas.forEach((l) => {
      doc.text(l, margin, y);
      y += passo * 0.85;
    });
  });
  y += passo * 0.3;

  // Valor recebido
  tracejado();
  y += passo * 0.3;
  centralizado(`Valor recebido: ${formatCurrency(d.recebido)}`, fs(15, 12), true);
  y += passo * 0.2;
  tracejado();

  // A receber
  if (d.aReceber > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(fs(10, 8));
    doc.text("A RECEBER", margin, y);
    y += passo;
    linha("Valor:", formatCurrency(d.aReceber));
    linha("Vencimento:", textoVencimento(d));
  }

  // Assinatura (imagem da loja em cima da linha, quando ativada)
  if (d.assinaturaLoja) {
    const alturaMax = termico ? 16 : 20;
    y += termico ? 4 : 8;
    const larguraBox = util * 0.7;
    const desenhada = adicionarImagemContida(doc, d.assinaturaLoja, centro - larguraBox / 2, y, larguraBox, alturaMax);
    y += (desenhada > 0 ? alturaMax : termico ? 8 : 14) + 1;
  } else {
    y += termico ? 12 : 22;
  }
  doc.setLineWidth(0.3);
  doc.line(centro - util * 0.35, y, centro + util * 0.35, y);
  y += passo * 0.8;
  centralizado(d.loja.nome_loja || "", fs(9, 7));

  return y;
}

/**
 * PDF do recibo. Térmico é bobina contínua: mede a altura num doc descartável
 * e desenha o definitivo com a altura exata (mesma técnica de gerarReciboVendaPDF).
 */
export function gerarReciboOSPDF(d: DadosReciboOS, formato: FormatoReciboOS, logoBase64: string | null): Blob {
  if (formato === "a4") {
    const doc = new jsPDF();
    desenharReciboPDF(doc, d, logoBase64, false);
    return doc.output("blob");
  }
  const largura = LARGURA_PDF[formato];
  const medicao = new jsPDF({ unit: "mm", format: [largura, 1000] });
  const altura = Math.max(desenharReciboPDF(medicao, d, logoBase64, true) + 5, 60);
  const doc = new jsPDF({ unit: "mm", format: [largura, altura] });
  desenharReciboPDF(doc, d, logoBase64, true);
  return doc.output("blob");
}

export const nomeArquivoReciboOS = (numeroOS: string) =>
  `Recibo-OS-${numeroOS.replace(/[^\w-]/g, "")}.pdf`;
