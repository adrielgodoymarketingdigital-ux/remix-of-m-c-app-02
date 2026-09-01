// ============================================================================
// Serviços (OS entregues) no fechamento de caixa
// ----------------------------------------------------------------------------
// Não existe vínculo estrutural OS <-> caixa. A associação é por DATA: a
// "Data no caixa" escolhida na confirmação de entrega (ordens_servico.data_caixa)
// é a referência canônica do recebimento do saldo; a entrada (sinal), quando
// existe, é um evento à parte com sua própria forma de pagamento e data
// (a data de abertura da OS — não há campo dedicado para a data do sinal).
//
// Cada OS entregue vira 1–2 "eventos de recebimento". O valor faturável total
// vem de getValorFaturavelOS (NÃO reimplementar essa regra aqui) e é dividido
// entre entrada e saldo, cada parte com a sua forma de pagamento.
// ============================================================================

import { getValorFaturavelOS, type OrdemFaturavelLike } from "@/lib/vendasFinanceiras";

export type ColunaFormaCaixa =
  | "total_dinheiro"
  | "total_pix"
  | "total_cartao"
  | "total_a_receber";

const FORMAS_CARTAO = ["debito", "credito", "credito_parcelado"];

/** Mapeia uma forma de pagamento para a coluna de total do caixa. */
export function colunaPorFormaCaixa(forma: string | null | undefined): ColunaFormaCaixa | null {
  if (forma === "dinheiro") return "total_dinheiro";
  if (forma === "pix") return "total_pix";
  if (forma && FORMAS_CARTAO.includes(forma)) return "total_cartao";
  if (forma === "a_receber" || forma === "a_prazo") return "total_a_receber";
  return null;
}

export interface OrdemParaCaixa extends OrdemFaturavelLike {
  numero_os?: string | null;
  status?: string | null;
  created_at?: string | null;
  data_caixa?: string | null;
  data_saida?: string | null;
  clientes?: { nome?: string | null } | null;
  cliente?: { nome?: string | null } | null;
}

export interface EventoRecebimentoOS {
  numeroOs: string;
  clienteNome: string;
  parte: "entrada" | "saldo" | "total";
  valor: number;
  forma: string;
  /** 'YYYY-MM-DD' (ou null quando indefinível). */
  data: string | null;
}

const soData = (v: string | null | undefined): string | null =>
  v ? v.slice(0, 10) : null;

/**
 * Deriva os eventos de recebimento de uma OS **entregue**. OS em qualquer outro
 * status não produz evento (o fechamento e o preview só olham status='entregue',
 * e isso evita que getValorFaturavelOS "veja" como recebida uma OS ainda em aberto).
 */
export function derivarEventosRecebimentoOS(
  ordem: OrdemParaCaixa,
  statusContaVinculada: string | null | undefined,
): EventoRecebimentoOS[] {
  if (ordem.status !== "entregue") return [];

  const faturavel = getValorFaturavelOS(ordem, statusContaVinculada);
  if (!(faturavel > 0)) return [];

  const dp = (ordem.avarias?.dados_pagamento ?? {}) as {
    entrada?: number | string | null;
    forma?: string | null;
    forma_pagamento_entrada?: string | null;
  };

  const numeroOs = ordem.numero_os ?? "";
  const clienteNome =
    ordem.clientes?.nome ?? ordem.cliente?.nome ?? "Cliente não informado";

  const formaSaldo = dp.forma || ordem.forma_pagamento || "dinheiro";
  const formaEntrada =
    dp.forma_pagamento_entrada || dp.forma || ordem.forma_pagamento || "dinheiro";

  const entradaBruta = Math.max(0, Number(dp.entrada || 0));
  const entradaContada = Math.min(entradaBruta, faturavel);
  const saldoContado = Math.max(0, faturavel - entradaContada);

  const dataSaldo = soData(ordem.data_caixa) ?? soData(ordem.data_saida);
  const dataEntrada = soData(ordem.created_at);

  // Sem entrada: evento único ("total") na Data no caixa.
  if (entradaContada <= 0) {
    return [
      { numeroOs, clienteNome, parte: "total", valor: faturavel, forma: formaSaldo, data: dataSaldo },
    ];
  }

  // Com entrada: dois eventos independentes (forma e data podem diferir).
  const eventos: EventoRecebimentoOS[] = [
    { numeroOs, clienteNome, parte: "entrada", valor: entradaContada, forma: formaEntrada, data: dataEntrada },
  ];
  if (saldoContado > 0) {
    eventos.push({
      numeroOs, clienteNome, parte: "saldo", valor: saldoContado, forma: formaSaldo, data: dataSaldo,
    });
  }
  return eventos;
}

export interface AgregadoServicosCaixa {
  total_dinheiro: number;
  total_pix: number;
  total_cartao: number;
  total_a_receber: number;
  /** Soma de todos os eventos considerados (== soma das 4 colunas acima). */
  total_servicos: number;
  linhas: {
    numeroOs: string;
    clienteNome: string;
    forma: string;
    valor: number;
    parte: EventoRecebimentoOS["parte"];
  }[];
}

/**
 * Soma os eventos cuja data cai em [inicio, fim] (inclusivo, comparação por
 * 'YYYY-MM-DD' — mesma folga de fuso já usada no resto do fechamento de caixa).
 */
export function agregarServicosNoCaixa(
  eventos: EventoRecebimentoOS[],
  janelaInicio: string,
  janelaFim: string,
): AgregadoServicosCaixa {
  const inicio = soData(janelaInicio) ?? "";
  const fim = soData(janelaFim) ?? "9999-12-31";

  const agg: AgregadoServicosCaixa = {
    total_dinheiro: 0,
    total_pix: 0,
    total_cartao: 0,
    total_a_receber: 0,
    total_servicos: 0,
    linhas: [],
  };

  for (const ev of eventos) {
    if (!ev.data || ev.data < inicio || ev.data > fim) continue;
    const col = colunaPorFormaCaixa(ev.forma);
    if (col) agg[col] += ev.valor;
    agg.total_servicos += ev.valor;
    agg.linhas.push({
      numeroOs: ev.numeroOs,
      clienteNome: ev.clienteNome,
      forma: ev.forma,
      valor: ev.valor,
      parte: ev.parte,
    });
  }

  return agg;
}

/** Marca das linhas de `vendas` geradas para produtos/peças consumidos numa OS. */
export const MARCA_VENDA_ITEM_OS = "utilizado na OS";

/** true se a linha de venda é um produto/peça consumido numa OS (já contado via total_servicos). */
export function isVendaDeItemOS(observacoes: string | null | undefined): boolean {
  return String(observacoes ?? "").includes(MARCA_VENDA_ITEM_OS);
}
