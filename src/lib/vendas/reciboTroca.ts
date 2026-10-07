/**
 * Bloco "TROCA DE APARELHO" dos recibos de venda (PDV, histórico de Vendas,
 * Dispositivos vendidos — impressão A4/80mm/58mm, PDF e texto copiado).
 * Puro, sem imports: testado com Deno em scripts/testes-troca-pdv/.
 *
 * Venda sem troca → montarBlocoTrocaRecibo devolve null e o recibo fica igual.
 * Os aparelhos VENDIDOS já aparecem nos itens do recibo; aqui só entra o
 * aparelho RECEBIDO e a conta da troca.
 */

export interface AparelhoRecebidoRecibo {
  marca?: string | null;
  modelo?: string | null;
  capacidadeGb?: number | null;
  cor?: string | null;
  imei?: string | null;
}

export interface DadosTrocaRecibo {
  /** null = não foi possível ler o aparelho (ex.: excluído de vez, sem permissão): só os valores. */
  aparelho: AparelhoRecebidoRecibo | null;
  valorEntrada: number;
  /** Troca cancelada junto com a venda. */
  cancelada: boolean;
  /** Diferença devolvida ao cliente (entrada maior que a venda, Fase 2). */
  valorDevolvido?: number | null;
  formaDevolucao?: "dinheiro" | "pix" | null;
}

export interface LinhaReciboTroca {
  rotulo: string;
  valor: string;
  /** Valor que abate (mostrado com "−"). */
  negativo?: boolean;
  destaque?: boolean;
}

export interface BlocoTrocaRecibo {
  titulo: string;
  aparelhoTitulo: string;
  /** "Apple iPhone 12 Pro Max 256 GB Azul" (ou "Aparelho" se nada foi lido). */
  aparelhoDescricao: string;
  /** IMEI completo, quando existe. */
  imei: string | null;
  linhas: LinhaReciboTroca[];
  /** Frase final: "Pago integralmente com o aparelho recebido." / troca cancelada. */
  observacao: string | null;
  cancelada: boolean;
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
/** Mesmo texto de formatCurrency (src/lib/formatters.ts). */
export const formatarMoedaRecibo = (valor: number): string => brl.format(Math.round((Number(valor) || 0) * 100) / 100);

const limpo = (v: string | null | undefined) => (v ?? "").trim();

export function descreverAparelhoRecebido(a: AparelhoRecebidoRecibo | null): string {
  if (!a) return "Aparelho";
  const partes = [
    limpo(a.marca),
    limpo(a.modelo),
    a.capacidadeGb ? `${a.capacidadeGb} GB` : "",
    limpo(a.cor),
  ].filter(Boolean);
  return partes.length ? partes.join(" ") : "Aparelho";
}

/**
 * @param totalVenda valor da venda (itens − descontos), antes da troca
 * @param formaPagamentoLabel como o recibo já mostra a forma ("Dinheiro", "Dinheiro + PIX"...)
 */
export function montarBlocoTrocaRecibo(p: {
  troca: DadosTrocaRecibo | null | undefined;
  totalVenda: number;
  formaPagamentoLabel: string;
}): BlocoTrocaRecibo | null {
  const troca = p.troca;
  if (!troca || !(Number(troca.valorEntrada) > 0)) return null;
  const totalC = Math.round((Number(p.totalVenda) || 0) * 100);
  const entradaC = Math.round(Number(troca.valorEntrada) * 100);
  // A troca paga no máximo a venda; o que passa disso foi devolvido ao cliente.
  const trocaC = Math.min(entradaC, totalC);
  const pagoC = Math.max(0, totalC - trocaC);
  const devolvidoC = Number(troca.valorDevolvido) > 0
    ? Math.round(Number(troca.valorDevolvido) * 100)
    : Math.max(0, entradaC - totalC);
  const formaDevolucao = troca.formaDevolucao === "pix" ? "Pix" : troca.formaDevolucao === "dinheiro" ? "Dinheiro" : "";
  const pagoIntegralmente = pagoC === 0;
  const forma = limpo(p.formaPagamentoLabel);

  const linhas: LinhaReciboTroca[] = [
    { rotulo: "Valor do aparelho recebido", valor: formatarMoedaRecibo(entradaC / 100), negativo: true },
    { rotulo: "Total da venda", valor: formatarMoedaRecibo(totalC / 100) },
    { rotulo: "Valor da troca", valor: formatarMoedaRecibo(trocaC / 100), negativo: true },
    {
      rotulo: pagoIntegralmente || !forma ? "Valor pago pelo cliente" : `Valor pago pelo cliente (${forma})`,
      valor: formatarMoedaRecibo(pagoC / 100),
      destaque: true,
    },
    ...(devolvidoC > 0
      ? [{
          rotulo: formaDevolucao ? `Diferença devolvida ao cliente (${formaDevolucao})` : "Diferença devolvida ao cliente",
          valor: formatarMoedaRecibo(devolvidoC / 100),
          destaque: true,
        }]
      : []),
  ];
  return {
    titulo: troca.cancelada ? "TROCA DE APARELHO (CANCELADA)" : "TROCA DE APARELHO",
    aparelhoTitulo: "Aparelho recebido na troca",
    aparelhoDescricao: descreverAparelhoRecebido(troca.aparelho),
    imei: limpo(troca.aparelho?.imei) || null,
    linhas,
    observacao: troca.cancelada
      ? "Troca cancelada junto com a venda."
      : pagoIntegralmente ? "Pago integralmente com o aparelho recebido." : null,
    cancelada: troca.cancelada,
  };
}

/** Texto puro do bloco (copiar texto, PDF e testes). Uma informação por linha. */
export function textoBlocoTrocaRecibo(b: BlocoTrocaRecibo): string[] {
  return [
    b.titulo,
    `${b.aparelhoTitulo}: ${b.aparelhoDescricao}`,
    ...(b.imei ? [`IMEI: ${b.imei}`] : []),
    ...b.linhas.map((l) => `${l.rotulo}: ${l.negativo ? "− " : ""}${l.valor}`),
    ...(b.observacao ? [b.observacao] : []),
  ];
}

const escapar = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/**
 * HTML do bloco para recibos montados em string (impressão do recibo de
 * Dispositivos vendidos). Estilos inline: rótulo quebra linha, valor nunca
 * corta (nowrap) — funciona em A4 e em 58/80mm.
 */
export function htmlBlocoTrocaRecibo(b: BlocoTrocaRecibo): string {
  const linha = (rotulo: string, valor: string, extra = "") =>
    `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin:2px 0;${extra}">` +
    `<span style="flex:1 1 auto;min-width:0;overflow-wrap:anywhere;">${escapar(rotulo)}:</span>` +
    `<span style="flex:0 0 auto;white-space:nowrap;">${escapar(valor)}</span></div>`;
  return [
    `<div class="recibo-troca" style="margin:8px 0;padding:6px 8px;border:1px dashed #555;border-radius:4px;page-break-inside:avoid;break-inside:avoid;">`,
    `<div style="font-weight:700;letter-spacing:.5px;margin-bottom:4px;">${escapar(b.titulo)}</div>`,
    `<div style="margin:2px 0;overflow-wrap:anywhere;"><strong>${escapar(b.aparelhoTitulo)}:</strong> ${escapar(b.aparelhoDescricao)}</div>`,
    b.imei ? `<div style="margin:2px 0;overflow-wrap:anywhere;">IMEI: ${escapar(b.imei)}</div>` : "",
    ...b.linhas.map((l) => linha(l.rotulo, `${l.negativo ? "− " : ""}${l.valor}`, l.destaque ? "font-weight:700;" : "")),
    b.observacao ? `<div style="margin-top:4px;font-style:italic;overflow-wrap:anywhere;">${escapar(b.observacao)}</div>` : "",
    `</div>`,
  ].join("");
}
